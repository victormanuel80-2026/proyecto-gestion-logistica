"""
Motor CRUD genérico: listar, crear, editar, borrar (con cascada), duplicar,
configuración de empresa, respaldo y restauración de base de datos.
Todas las columnas/tablas se validan contra crud_config (lista blanca) para evitar inyección SQL.
"""
import os
import sqlite3
import tempfile
from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException, Request, Body, UploadFile, File
from fastapi.responses import FileResponse

from database import get_db, log_audit, DB_PATH
from crud_config import ENTITIES, CONFIG_DEFAULTS

router = APIRouter(prefix="/api")

NUMERIC = ("number", "money", "percent")


# ----------------------------------------------------------------- helpers
def _ent(name: str) -> dict:
    e = ENTITIES.get(name)
    if not e:
        raise HTTPException(404, f"La entidad '{name}' no existe.")
    return e


def _user(request: Request) -> str:
    return request.headers.get("X-User", "Admin")


def _chunks(lst, n=800):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def get_config_dict(conn) -> dict:
    cfg = dict(CONFIG_DEFAULTS)
    for r in conn.execute("SELECT clave, valor FROM configuracion").fetchall():
        cfg[r["clave"]] = r["valor"]
    return cfg


def _fk_label_expr(field: dict) -> str:
    ref = ENTITIES[field["ref"]]
    disp = ref["display_sql"].format(a="r")
    return f"(SELECT {disp} FROM {ref['table']} r WHERE r.id = t.{field['name']})"


def _coerce(e: dict, data: dict, partial: bool = False) -> dict:
    out = {}
    for f in e["fields"]:
        n, t = f["name"], f["type"]
        if f.get("computed") or f.get("readonly"):
            continue
        if n not in data:
            if partial:
                continue
            v = f.get("default")
        else:
            v = data[n]
        if isinstance(v, str):
            v = v.strip()
        if v == "":
            v = None

        if v is None:
            if f.get("required"):
                raise HTTPException(422, {"message": f"El campo '{f['label']}' es obligatorio.", "field": n})
            if t == "bool":
                v = f.get("default", 0)
            elif t in ("text", "textarea", "catalog"):
                v = ""
            out[n] = v
            continue

        try:
            if t in NUMERIC:
                v = float(v)
            elif t in ("int", "fk"):
                v = int(float(v))
            elif t == "bool":
                v = 1 if v in (True, 1, "1", "true", "True", "on", "si", "Sí") else 0
            elif t == "select" and f.get("int"):
                v = int(v)
            else:
                v = str(v)
        except (ValueError, TypeError):
            raise HTTPException(422, {"message": f"Valor inválido en '{f['label']}'.", "field": n})

        if isinstance(v, (int, float)) and t != "bool":
            if "min" in f and v < f["min"]:
                raise HTTPException(422, {"message": f"'{f['label']}' debe ser ≥ {f['min']}.", "field": n})
            if "max" in f and v > f["max"]:
                raise HTTPException(422, {"message": f"'{f['label']}' debe ser ≤ {f['max']}.", "field": n})
        out[n] = v
    return out


def _apply_computed(e: dict, merged: dict) -> dict:
    res = {}
    for f in e["fields"]:
        if f.get("computed"):
            a, b = f["computed"]
            res[f["name"]] = round(float(merged.get(a) or 0) * float(merged.get(b) or 0), 2)
    return res


def _check_unique(conn, e, vals, exclude_id=None):
    for f in e["fields"]:
        v = vals.get(f["name"])
        if f.get("unique") and v not in (None, ""):
            q = f"SELECT id FROM {e['table']} WHERE {f['name']} = ?"
            p = [v]
            if exclude_id:
                q += " AND id <> ?"
                p.append(exclude_id)
            if conn.execute(q, p).fetchone():
                raise HTTPException(409, {"message": f"Ya existe un registro con {f['label']} = '{v}'.",
                                          "field": f["name"]})


def _sync_catalogs(conn, e, vals):
    for f in e["fields"]:
        if f["type"] == "catalog" and vals.get(f["name"]):
            conn.execute("INSERT OR IGNORE INTO catalogos (tipo, valor) VALUES (?, ?)",
                         (f["catalog"], vals[f["name"]]))


def _recalc_orden_item(conn, gestion_id, cliente_id, producto_id):
    rows = conn.execute("""SELECT id, cantidad FROM planificacion_orden_item
                           WHERE gestion_id=? AND cliente_id=? AND producto_id=?""",
                        (gestion_id, cliente_id, producto_id)).fetchall()
    total = sum(r["cantidad"] or 0 for r in rows)
    for r in rows:
        pct = round((r["cantidad"] or 0) * 100.0 / total, 2) if total else 0
        conn.execute("UPDATE planificacion_orden_item SET porcentaje_distribucion=? WHERE id=?", (pct, r["id"]))


def _after_write(conn, entity, row_id, before, merged, user):
    """Reglas de negocio automáticas al guardar."""
    if entity == "productos" and before is not None:
        old_p, new_p = before.get("precio_base"), merged.get("precio_base")
        if old_p is not None and new_p is not None and abs(float(old_p) - float(new_p)) > 1e-9:
            conn.execute("""INSERT INTO historico_cambios_precios
                            (producto_id, precio_anterior, precio_nuevo, justificacion, usuario)
                            VALUES (?, ?, ?, ?, ?)""",
                         (row_id, old_p, new_p, "Edición directa en catálogo", user))
    if entity == "planificacion_orden_item":
        _recalc_orden_item(conn, merged["gestion_id"], merged["cliente_id"], merged["producto_id"])


def _collect(conn, entity, ids, acc, nulls):
    """Recolecta recursivamente todos los registros dependientes a borrar."""
    acc.setdefault(entity, set()).update(ids)
    for dep in ENTITIES[entity].get("dependents", []):
        de, col = dep[0], dep[1]
        action = dep[2] if len(dep) > 2 else "cascade"
        table = ENTITIES[de]["table"]
        child = set()
        for ch in _chunks(list(ids)):
            q = f"SELECT id FROM {table} WHERE {col} IN ({','.join('?' * len(ch))})"
            child.update(r[0] for r in conn.execute(q, ch).fetchall())
        if action == "set_null":
            if child:
                nulls.append({"entity": de, "column": col, "parent_ids": list(ids), "count": len(child)})
            continue
        child -= acc.get(de, set())
        if child:
            _collect(conn, de, child, acc, nulls)


def _deps_summary(conn, entity, ids):
    acc, nulls = {}, []
    _collect(conn, entity, set(ids), acc, nulls)
    related = [{"entity": k, "label": ENTITIES[k]["label"], "count": len(v)}
               for k, v in acc.items() if k != entity and v]
    set_null = [{"entity": n["entity"], "label": ENTITIES[n["entity"]]["label"], "count": n["count"]} for n in nulls]
    return acc, nulls, related, set_null


def _perform_delete(conn, acc, nulls):
    for n in nulls:
        table = ENTITIES[n["entity"]]["table"]
        for ch in _chunks(n["parent_ids"]):
            conn.execute(f"UPDATE {table} SET {n['column']} = NULL WHERE {n['column']} IN ({','.join('?' * len(ch))})", ch)
    total = 0
    for ent, ids in acc.items():
        table = ENTITIES[ent]["table"]
        for ch in _chunks(list(ids)):
            conn.execute(f"DELETE FROM {table} WHERE id IN ({','.join('?' * len(ch))})", ch)
        total += len(ids)
    return total


# --------------------------------------------------------------- endpoints
@router.get("/crud/entities")
def list_entities():
    conn = get_db()
    out = []
    for k, e in ENTITIES.items():
        cnt = conn.execute(f"SELECT COUNT(*) FROM {e['table']}").fetchone()[0]
        out.append({"key": k, "label": e["label"], "group": e["group"],
                    "description": e.get("description", ""), "count": cnt})
    conn.close()
    return out


@router.get("/crud/{entity}/schema")
def get_schema(entity: str):
    e = _ent(entity)
    conn = get_db()
    cfg = get_config_dict(conn)
    fields = []
    for f in e["fields"]:
        f2 = dict(f)
        if f.get("label_key") and cfg.get(f["label_key"]):
            f2["label"] = cfg[f["label_key"]]
        if f["type"] == "fk":
            ref = ENTITIES[f["ref"]]
            disp = ref["display_sql"].format(a="r")
            f2["options"] = [{"value": r[0], "label": r[1]} for r in
                             conn.execute(f"SELECT r.id, {disp} FROM {ref['table']} r ORDER BY 2").fetchall()]
        elif f["type"] == "catalog":
            f2["options"] = [r[0] for r in conn.execute(
                "SELECT valor FROM catalogos WHERE tipo=? AND activo=1 ORDER BY orden, valor", (f["catalog"],)).fetchall()]
        fields.append(f2)
    conn.close()
    virtual = [{k: v for k, v in x.items() if k != "sql"} for x in e.get("virtual", [])]
    return {"key": entity, "label": e["label"], "description": e.get("description", ""),
            "fields": fields, "virtual": virtual}


@router.get("/crud/{entity}")
def list_rows(entity: str, request: Request):
    e = _ent(entity)
    qp = request.query_params
    limit = max(1, min(int(qp.get("limit", 25)), 20000))
    offset = max(0, int(qp.get("offset", 0)))
    names = {f["name"] for f in e["fields"]} | {"id"}

    selects, label_exprs = ["t.*"], {}
    for f in e["fields"]:
        if f["type"] == "fk":
            ex = _fk_label_expr(f)
            label_exprs[f["name"]] = ex
            selects.append(f"{ex} AS {f['name']}__label")
    vnames = set()
    for v in e.get("virtual", []):
        selects.append(f"{v['sql']} AS {v['name']}")
        vnames.add(v["name"])

    where, params = ["1=1"], []
    for k, v in qp.items():
        if k.startswith("f_") and k[2:] in names and v not in ("", "null", "undefined"):
            where.append(f"t.{k[2:]} = ?")
            params.append(v)

    s = qp.get("search", "").strip()
    if s:
        cols = [f"t.{c}" for c in e.get("search", [])] + list(label_exprs.values())
        if cols:
            where.append("(" + " OR ".join(f"CAST({c} AS TEXT) LIKE ?" for c in cols) + ")")
            params += [f"%{s}%"] * len(cols)

    sort = qp.get("sort")
    d = "ASC" if qp.get("dir", "desc").lower() == "asc" else "DESC"
    if sort in names:
        order = f"t.{sort} {d}"
    elif sort and sort.endswith("__label") and sort[:-7] in label_exprs:
        order = f"{sort} {d}"
    elif sort in vnames:
        order = f"{sort} {d}"
    else:
        order = e.get("order", "t.id DESC")

    wsql = " AND ".join(where)
    conn = get_db()
    total = conn.execute(f"SELECT COUNT(*) FROM {e['table']} t WHERE {wsql}", params).fetchone()[0]
    rows = [dict(r) for r in conn.execute(
        f"SELECT {', '.join(selects)} FROM {e['table']} t WHERE {wsql} ORDER BY {order} LIMIT ? OFFSET ?",
        params + [limit, offset]).fetchall()]
    conn.close()
    return {"total": total, "rows": rows}


@router.get("/crud/{entity}/{row_id}")
def get_row(entity: str, row_id: int):
    e = _ent(entity)
    conn = get_db()
    r = conn.execute(f"SELECT * FROM {e['table']} WHERE id=?", (row_id,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(404, "Registro no encontrado.")
    return dict(r)


@router.post("/crud/{entity}")
def create_row(entity: str, request: Request, data: dict = Body(...)):
    e = _ent(entity)
    user = _user(request)
    vals = _coerce(e, data)
    vals.update(_apply_computed(e, vals))
    conn = get_db()
    try:
        _check_unique(conn, e, vals)
        cols = list(vals.keys())
        cur = conn.execute(f"INSERT INTO {e['table']} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                           [vals[c] for c in cols])
        new_id = cur.lastrowid
        _sync_catalogs(conn, e, vals)
        _after_write(conn, entity, new_id, None, vals, user)
        conn.commit()
    except sqlite3.IntegrityError as ex:
        conn.rollback()
        raise HTTPException(409, {"message": f"Restricción de integridad: {ex}"})
    finally:
        conn.close()
    log_audit(user, entity.upper(), "CREATE", {"id": new_id, "datos": vals})
    return {"success": True, "id": new_id, "message": "Registro creado correctamente."}


@router.put("/crud/{entity}/{row_id}")
def update_row(entity: str, row_id: int, request: Request, data: dict = Body(...)):
    e = _ent(entity)
    user = _user(request)
    conn = get_db()
    try:
        r = conn.execute(f"SELECT * FROM {e['table']} WHERE id=?", (row_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Registro no encontrado.")
        before = dict(r)
        vals = _coerce(e, data, partial=True)
        merged = {**before, **vals}
        vals.update(_apply_computed(e, merged))
        merged.update(vals)
        _check_unique(conn, e, merged, exclude_id=row_id)
        if vals:
            sets = ", ".join(f"{c} = ?" for c in vals)
            conn.execute(f"UPDATE {e['table']} SET {sets} WHERE id = ?", list(vals.values()) + [row_id])
        _sync_catalogs(conn, e, merged)
        _after_write(conn, entity, row_id, before, merged, user)
        conn.commit()
    except sqlite3.IntegrityError as ex:
        conn.rollback()
        raise HTTPException(409, {"message": f"Restricción de integridad: {ex}"})
    finally:
        conn.close()
    changes = {k: {"antes": before.get(k), "despues": v} for k, v in vals.items() if before.get(k) != v}
    log_audit(user, entity.upper(), "UPDATE", {"id": row_id, "cambios": changes})
    return {"success": True, "id": row_id, "message": "Registro actualizado correctamente.", "cambios": len(changes)}


@router.post("/crud/{entity}/dependencies")
def preview_dependencies(entity: str, payload: dict = Body(...)):
    _ent(entity)
    ids = [int(i) for i in payload.get("ids", [])]
    conn = get_db()
    _, _, related, set_null = _deps_summary(conn, entity, ids)
    conn.close()
    return {"ids": ids, "related": related, "set_null": set_null,
            "total_related": sum(x["count"] for x in related)}


def _delete_ids(entity, ids, cascade, user):
    conn = get_db()
    try:
        acc, nulls, related, _ = _deps_summary(conn, entity, ids)
        if related and not cascade:
            raise HTTPException(409, {"message": "El registro tiene datos relacionados. Confirme el borrado en cascada.",
                                      "dependents": related})
        e = ENTITIES[entity]
        snapshot = [dict(r) for r in conn.execute(
            f"SELECT * FROM {e['table']} WHERE id IN ({','.join('?' * len(ids[:20]))})", ids[:20]).fetchall()] if ids else []
        total = _perform_delete(conn, acc, nulls)
        conn.commit()
    finally:
        conn.close()
    log_audit(user, entity.upper(), "DELETE", {"ids": ids, "total_borrados": total,
                                                "relacionados": related, "muestra": snapshot})
    return {"success": True, "deleted": len(ids), "deleted_total": total,
            "message": f"Se eliminaron {len(ids)} registro(s) ({total} en total incluyendo relacionados)."}


@router.delete("/crud/{entity}/{row_id}")
def delete_row(entity: str, row_id: int, request: Request, cascade: bool = False):
    _ent(entity)
    return _delete_ids(entity, [row_id], cascade, _user(request))


@router.post("/crud/{entity}/bulk-delete")
def bulk_delete(entity: str, request: Request, payload: dict = Body(...)):
    _ent(entity)
    ids = [int(i) for i in payload.get("ids", [])]
    if not ids:
        raise HTTPException(400, "No se enviaron registros para eliminar.")
    return _delete_ids(entity, ids, bool(payload.get("cascade")), _user(request))


# ------------------------------------------------------------ configuración
@router.get("/config")
def read_config():
    conn = get_db()
    cfg = get_config_dict(conn)
    conn.close()
    return cfg


@router.put("/config")
def save_config(request: Request, data: dict = Body(...)):
    conn = get_db()
    for k, v in data.items():
        if k in CONFIG_DEFAULTS or k.startswith("label_"):
            conn.execute("INSERT INTO configuracion (clave, valor) VALUES (?, ?) "
                         "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor", (k, str(v)))
    conn.commit()
    cfg = get_config_dict(conn)
    conn.close()
    log_audit(_user(request), "CONFIGURACION", "UPDATE", data)
    return cfg


# ------------------------------------------------------- respaldo / restauración
@router.get("/backup")
def download_backup():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(tempfile.gettempdir(), f"respaldo_erp_{ts}.db")
    src = get_db()
    dst = sqlite3.connect(path)
    src.backup(dst)
    dst.close()
    src.close()
    log_audit("Admin", "RESPALDO", "BACKUP", {"archivo": os.path.basename(path)})
    return FileResponse(path, filename=os.path.basename(path), media_type="application/octet-stream")


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...)):
    content = await file.read()
    tmp = os.path.join(tempfile.gettempdir(), f"restore_{datetime.now().strftime('%H%M%S')}.db")
    with open(tmp, "wb") as fh:
        fh.write(content)
    try:
        src = sqlite3.connect(tmp)
        tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "productos" not in tables or "historico_ventas" not in tables:
            src.close()
            raise HTTPException(400, "El archivo no es un respaldo válido del sistema.")
        # Respaldo automático de seguridad antes de restaurar
        safety = DB_PATH + f".antes_restaurar_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        cur = sqlite3.connect(DB_PATH)
        bk = sqlite3.connect(safety)
        cur.backup(bk)
        bk.close()
        src.backup(cur)
        cur.close()
        src.close()
    except sqlite3.DatabaseError:
        raise HTTPException(400, "El archivo no es una base de datos SQLite válida.")
    log_audit("Admin", "RESPALDO", "RESTORE", {"archivo": file.filename, "copia_seguridad": os.path.basename(safety)})
    return {"success": True, "message": f"Base de datos restaurada desde '{file.filename}'."}
