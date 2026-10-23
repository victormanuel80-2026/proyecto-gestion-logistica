from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json

from database import get_db, init_db, log_audit, bootstrap_db
from forecasting import run_all_models_and_select_best
from solver import optimize_parameters_solver
from ai_assistant import ask_copilot
from excel_processor import generate_sample_excel_template, process_excel_import
from crud import router as crud_router

app = FastAPI(
    title="Commercial Planning & AI Forecasting API",
    description="Plataforma Empresarial de Planificación Comercial, Presupuesto, Mercado y Forecasting IA (multi-sector)",
    version="2.1.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(crud_router)

@app.on_event("startup")
def on_startup():
    bootstrap_db()
    init_db()
    # Si la BD queda vacía (sin snapshot), cargar datos de demostración.
    from seed_data import seed_all
    seed_all()

def _escenario_id(cursor, gestion_id: int, tipo: str) -> int:
    """Devuelve el ID del primer escenario del tipo indicado (o -1 si no existe)."""
    r = cursor.execute(
        "SELECT id FROM presupuesto_escenarios WHERE gestion_id = ? AND tipo_escenario = ? ORDER BY aprobado DESC, id ASC LIMIT 1",
        (gestion_id, tipo)).fetchone()
    return r[0] if r else -1

# --- Pydantic Request Models ---
class CopilotQuery(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class SolverRequest(BaseModel):
    product_id: int
    regional_id: Optional[int] = None
    model_type: str = "holt_linear"
    target_metric: str = "mape"

class PriceSimulationRequest(BaseModel):
    product_id: int
    new_price: float
    elasticidad: float = -0.50
    elasticity: Optional[float] = None
    justificacion: str = "Ajuste de precio comercial"
    justification: Optional[str] = None
    user: str = "Gerente Comercial"

    def get_elasticidad(self) -> float:
        return self.elasticity if self.elasticity is not None else self.elasticidad

    def get_justificacion(self) -> str:
        return self.justification if self.justification is not None else self.justificacion

class BudgetUpdateItem(BaseModel):
    item_id: Optional[int] = None
    escenario_id: int
    producto_id: int
    regional_id: Optional[int] = None   # None = vista consolidada -> se distribuye proporcionalmente
    mes_fiscal: int
    cantidad: Optional[float] = None
    precio: Optional[float] = None

class CopyScenarioRequest(BaseModel):
    origen_id: int
    nombre: str
    tipo_escenario: str = "MODIFICADO"
    factor_pct: float = 0.0
    descripcion: Optional[str] = ""

class BulkAdjustRequest(BaseModel):
    escenario_id: int
    pct: float
    campo: str = "cantidad"   # cantidad | precio
    regional_id: Optional[int] = None
    linea: Optional[str] = None
    producto_id: Optional[int] = None

class OrderItemDistributeRequest(BaseModel):
    cliente_id: int
    producto_id: int
    anual_target: float
    distribution_curve: Optional[List[float]] = None # 12 months weights
    modo: str = "estacional"  # estacional | uniforme | historico

# ==========================================
# 1. DASHBOARD GERENCIAL
# ==========================================
@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    gestion_id: int = Query(1),
    regional_id: Optional[int] = Query(None),
    linea: Optional[str] = Query(None)
):
    conn = get_db()
    cursor = conn.cursor()

    # Budget vs Real filters
    where_reg_pi = f"AND pi.regional_id = {regional_id}" if regional_id else ""
    linea_sql = linea.replace("'", "''") if linea else None
    where_linea_pi = f"AND p.linea = '{linea_sql}'" if linea else ""
    E_OF = _escenario_id(cursor, gestion_id, "OFICIAL")
    E_PR = _escenario_id(cursor, gestion_id, "PROYECTADO")
    E_RE = _escenario_id(cursor, gestion_id, "REAL")

    # Total Presupuesto Oficial Anual (Gestión 2026-2027)
    q_oficial = f"""
        SELECT COALESCE(SUM(pi.valorizacion), 0) as total_presupuesto,
               COALESCE(SUM(pi.cantidad), 0) as total_unidades_presupuesto
        FROM presupuesto_items pi
        JOIN productos p ON pi.producto_id = p.id
        WHERE pi.escenario_id = {E_OF} {where_reg_pi} {where_linea_pi}
    """
    cursor.execute(q_oficial)
    row_oficial = cursor.fetchone()
    total_presupuesto = row_oficial["total_presupuesto"]
    total_unidades_presupuesto = row_oficial["total_unidades_presupuesto"]

    # Real ejecutado (M1 a M6)
    q_real = f"""
        SELECT COALESCE(SUM(pi.valorizacion), 0) as total_real,
               COALESCE(SUM(pi.cantidad), 0) as total_unidades_real
        FROM presupuesto_items pi
        JOIN productos p ON pi.producto_id = p.id
        WHERE pi.escenario_id = {E_RE} AND pi.mes_fiscal <= 6 {where_reg_pi} {where_linea_pi}
    """
    cursor.execute(q_real)
    row_real = cursor.fetchone()
    total_real = row_real["total_real"]

    # Presupuesto para el mismo periodo real (M1 a M6) para calcular % de cumplimiento real
    q_oficial_m6 = f"""
        SELECT COALESCE(SUM(pi.valorizacion), 0) as total_oficial_m6
        FROM presupuesto_items pi
        JOIN productos p ON pi.producto_id = p.id
        WHERE pi.escenario_id = {E_OF} AND pi.mes_fiscal <= 6 {where_reg_pi} {where_linea_pi}
    """
    cursor.execute(q_oficial_m6)
    presupuesto_m6 = cursor.fetchone()["total_oficial_m6"] or 1.0

    cumplimiento_pct = round((total_real / presupuesto_m6) * 100.0, 1)

    # Forecast Proyectado Anual (Escenario 2)
    q_forecast = f"""
        SELECT COALESCE(SUM(pi.valorizacion), 0) as total_forecast
        FROM presupuesto_items pi
        JOIN productos p ON pi.producto_id = p.id
        WHERE pi.escenario_id = {E_PR} {where_reg_pi} {where_linea_pi}
    """
    cursor.execute(q_forecast)
    total_forecast = cursor.fetchone()["total_forecast"]

    # Histórico del año anterior (2025)
    where_reg_hv = f"AND hv.regional_id = {regional_id}" if regional_id else ""
    where_linea_hv = f"AND p.linea = '{linea_sql}'" if linea else ""
    q_hist = f"""
        SELECT COALESCE(SUM(hv.importe), 0) as total_hist
        FROM historico_ventas hv
        JOIN productos p ON hv.producto_id = p.id
        WHERE hv.anio = 2025 {where_reg_hv} {where_linea_hv}
    """
    cursor.execute(q_hist)
    total_hist = cursor.fetchone()["total_hist"] or 1.0
    crecimiento_anual_pct = round(((total_presupuesto - total_hist) / total_hist) * 100.0, 1)

    # Evolución Mensual 12 Meses Fiscales (Abril M1 a Marzo M12)
    meses_nombres = ["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar"]
    cursor.execute(f"""
        SELECT pi.mes_fiscal,
               SUM(CASE WHEN pi.escenario_id = {E_OF} THEN pi.valorizacion ELSE 0 END) as oficial,
               SUM(CASE WHEN pi.escenario_id = {E_PR} THEN pi.valorizacion ELSE 0 END) as forecast,
               SUM(CASE WHEN pi.escenario_id = {E_RE} THEN pi.valorizacion ELSE 0 END) as real
        FROM presupuesto_items pi
        JOIN productos p ON pi.producto_id = p.id
        WHERE 1=1 {where_reg_pi} {where_linea_pi}
        GROUP BY pi.mes_fiscal
        ORDER BY pi.mes_fiscal
    """)
    mensual_rows = cursor.fetchall()
    serie_mensual = []
    for r in mensual_rows:
        mf = r["mes_fiscal"]
        mes_label = meses_nombres[mf - 1] if 1 <= mf <= 12 else f"M{mf}"
        serie_mensual.append({
            "mes_fiscal": mf,
            "mes_nombre": mes_label,
            "oficial": round(r["oficial"], 2),
            "forecast": round(r["forecast"], 2),
            "real": round(r["real"], 2) if r["real"] > 0 else None
        })

    # Desempeño por Regional
    cursor.execute(f"""
        SELECT r.id, r.nombre,
               COALESCE(SUM(CASE WHEN pi.escenario_id = {E_OF} AND pi.mes_fiscal <= 6 THEN pi.valorizacion ELSE 0 END), 0) as meta_m6,
               COALESCE(SUM(CASE WHEN pi.escenario_id = {E_RE} AND pi.mes_fiscal <= 6 THEN pi.valorizacion ELSE 0 END), 0) as real_m6
        FROM regionales r
        LEFT JOIN presupuesto_items pi ON r.id = pi.regional_id
        GROUP BY r.id
    """)
    reg_rows = cursor.fetchall()
    desempeno_regionales = []
    for r in reg_rows:
        m = r["meta_m6"] or 1.0
        re = r["real_m6"]
        desempeno_regionales.append({
            "regional_id": r["id"],
            "regional": r["nombre"],
            "meta_semestral": round(m, 2),
            "real_semestral": round(re, 2),
            "cumplimiento_pct": round((re / m) * 100.0, 1)
        })

    # Top 5 Productos en Presupuesto
    cursor.execute(f"""
        SELECT p.id, p.codigo, p.nombre, p.linea, p.core,
               SUM(pi.valorizacion) as valorizacion,
               SUM(pi.cantidad) as unidades
        FROM productos p
        JOIN presupuesto_items pi ON p.id = pi.producto_id AND pi.escenario_id = {E_OF}
        WHERE 1=1 {where_reg_pi} {where_linea_pi}
        GROUP BY p.id
        ORDER BY valorizacion DESC
        LIMIT 6
    """)
    top_prods = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "kpis": {
            "total_presupuesto_oficial": round(total_presupuesto, 2),
            "total_unidades_presupuesto": round(total_unidades_presupuesto, 0),
            "total_real_ejecutado": round(total_real, 2),
            "cumplimiento_pct": cumplimiento_pct,
            "total_forecast": round(total_forecast, 2),
            "crecimiento_anual_pct": crecimiento_anual_pct,
            "periodo_fiscal": "Abril 2026 - Marzo 2027",
            "mes_corte_real": "Septiembre 2026 (M06)"
        },
        "serie_mensual_fiscal": serie_mensual,
        "desempeno_regionales": desempeno_regionales,
        "top_productos": top_prods
    }

# ==========================================
# 2. CATÁLOGO DE PRODUCTOS & MAESTROS
# ==========================================
@app.get("/api/productos")
def list_productos(linea: Optional[str] = None, core: Optional[int] = None, search: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM productos WHERE 1=1"
    params = []
    if linea:
        query += " AND linea = ?"
        params.append(linea)
    if core is not None:
        query += " AND core = ?"
        params.append(core)
    if search:
        query += " AND (nombre LIKE ? OR codigo LIKE ? OR molecula LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s])
    query += " ORDER BY core DESC, id ASC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/productos")
def create_producto(prod: dict):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO productos 
        (codigo, nombre, linea, categoria, forma_farmaceutica, core, molecula, presentacion, clase_terapeutica_atc, precio_base, costo_base)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        prod["codigo"], prod["nombre"], prod["linea"], prod["categoria"],
        prod["forma_farmaceutica"], 1 if prod.get("core") else 0,
        prod["molecula"], prod["presentacion"], prod.get("clase_terapeutica_atc", ""),
        float(prod["precio_base"]), float(prod["costo_base"])
    ))
    new_id = cursor.lastrowid
    conn.commit()
    log_audit("Admin", "PRODUCTOS", "CREATE", {"producto_id": new_id, "codigo": prod["codigo"]})
    conn.close()
    return {"id": new_id, "message": "Producto creado con éxito."}

# ==========================================
# 3. REGIONALES & CLIENTES
# ==========================================
@app.get("/api/regionales")
def list_regionales():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM regionales ORDER BY id ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.get("/api/clientes")
def list_clientes(regional_id: Optional[int] = None):
    conn = get_db()
    cursor = conn.cursor()
    q = "SELECT c.*, r.nombre as regional_nombre FROM clientes c JOIN regionales r ON c.regional_id = r.id WHERE 1=1"
    params = []
    if regional_id:
        q += " AND c.regional_id = ?"
        params.append(regional_id)
    q += " ORDER BY c.id ASC"
    cursor.execute(q, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

# ==========================================
# 4. HISTÓRICO DE VENTAS & EXCEL ETL
# ==========================================
@app.get("/api/historico-ventas")
def get_historico_ventas(
    producto_id: Optional[int] = None,
    regional_id: Optional[int] = None,
    anio: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT hv.*, p.codigo as producto_codigo, p.nombre as producto_nombre,
               c.nombre as cliente_nombre, r.nombre as regional_nombre
        FROM historico_ventas hv
        JOIN productos p ON hv.producto_id = p.id
        JOIN clientes c ON hv.cliente_id = c.id
        JOIN regionales r ON hv.regional_id = r.id
        WHERE 1=1
    """
    params = []
    if producto_id:
        query += " AND hv.producto_id = ?"
        params.append(producto_id)
    if regional_id:
        query += " AND hv.regional_id = ?"
        params.append(regional_id)
    if anio:
        query += " AND hv.anio = ?"
        params.append(anio)
        
    query += " ORDER BY hv.anio DESC, hv.mes DESC, hv.id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]

    # Stats
    cursor.execute("SELECT COUNT(*), SUM(importe), SUM(cantidad) FROM historico_ventas")
    stats = cursor.fetchone()
    conn.close()

    return {
        "total_records": stats[0],
        "total_importe_acumulado": round(stats[1] or 0, 2),
        "total_unidades_acumuladas": round(stats[2] or 0, 0),
        "records": rows
    }

@app.get("/api/excel/template")
def download_excel_template():
    excel_bytes = generate_sample_excel_template()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Plantilla_Ventas_Historicas_Pharma.xlsx"}
    )

@app.post("/api/excel/import")
async def import_excel_ventas(file: UploadFile = File(...)):
    contents = await file.read()
    result = process_excel_import(contents, file.filename)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result)
    return result

# ==========================================
# 5. PRESUPUESTO GESTIÓN FISCAL (ABR - MAR)
# ==========================================
@app.get("/api/presupuesto/matriz")
def get_presupuesto_matriz(
    gestion_id: int = Query(1),
    escenario_tipo: str = Query("OFICIAL"),
    escenario_id: Optional[int] = Query(None),
    regional_id: Optional[int] = Query(None),
    linea: Optional[str] = Query(None)
):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, tipo_escenario, nombre, aprobado FROM presupuesto_escenarios WHERE gestion_id = ? ORDER BY id", (gestion_id,))
    escenarios_list = [dict(r) for r in cursor.fetchall()]

    esc = None
    if escenario_id:
        esc = next((e for e in escenarios_list if e["id"] == escenario_id), None)
    if not esc:
        esc = next((e for e in escenarios_list if e["tipo_escenario"] == escenario_tipo), None)
    if not esc and escenarios_list:
        esc = escenarios_list[0]
    if not esc:
        conn.close()
        return {"escenario_actual": None, "escenarios_disponibles": [], "matriz": []}

    escenario_id = esc["id"]
    
    # Filter products
    prod_query = "SELECT id, codigo, nombre, linea, forma_farmaceutica, core, precio_base FROM productos WHERE 1=1"
    params = []
    if linea:
        prod_query += " AND linea = ?"
        params.append(linea)
    prod_query += " ORDER BY core DESC, id ASC"
    cursor.execute(prod_query, params)
    prods = [dict(r) for r in cursor.fetchall()]

    where_reg = f"AND regional_id = {regional_id}" if regional_id else ""

    result_matrix = []
    meses_nombres = ["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar"]

    for p in prods:
        pid = p["id"]
        cursor.execute(f"""
            SELECT mes_fiscal, SUM(cantidad) as total_qty, AVG(precio) as avg_price, SUM(valorizacion) as total_val
            FROM presupuesto_items
            WHERE escenario_id = ? AND producto_id = ? {where_reg}
            GROUP BY mes_fiscal
            ORDER BY mes_fiscal
        """, (escenario_id, pid))
        
        items_by_month = {row["mes_fiscal"]: row for row in cursor.fetchall()}
        
        meses_data = []
        suma_anual_qty = 0
        suma_anual_val = 0
        
        for mf in range(1, 13):
            item = items_by_month.get(mf)
            qty = round(item["total_qty"], 0) if item else 0
            val = round(item["total_val"], 2) if item else 0
            prc = round(item["avg_price"], 2) if item else p["precio_base"]
            
            suma_anual_qty += qty
            suma_anual_val += val
            meses_data.append({
                "mes_fiscal": mf,
                "mes_nombre": meses_nombres[mf - 1],
                "cantidad": qty,
                "precio": prc,
                "valorizacion": val
            })
            
        result_matrix.append({
            "producto_id": pid,
            "codigo": p["codigo"],
            "nombre": p["nombre"],
            "linea": p["linea"],
            "core": bool(p["core"]),
            "precio_base": p["precio_base"],
            "meses": meses_data,
            "total_anual_qty": suma_anual_qty,
            "total_anual_val": round(suma_anual_val, 2)
        })

    # Available scenarios
    cursor.execute("SELECT id, tipo_escenario, nombre, aprobado FROM presupuesto_escenarios WHERE gestion_id = ?", (gestion_id,))
    escenarios_list = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "gestion": "Gestión 2026-2027 (Abril - Marzo)",
        "escenario_actual": esc,
        "escenarios_disponibles": escenarios_list,
        "matriz": result_matrix
    }

@app.post("/api/presupuesto/actualizar-celda")
def update_presupuesto_celda(data: BudgetUpdateItem):
    """
    Edita una celda (producto x mes). Si regional_id es None (vista consolidada),
    la nueva cantidad se reparte proporcionalmente entre las regionales existentes
    y el nuevo precio se aplica a todas.
    """
    conn = get_db()
    cursor = conn.cursor()
    q = "SELECT id, cantidad, precio FROM presupuesto_items WHERE escenario_id = ? AND producto_id = ? AND mes_fiscal = ?"
    p = [data.escenario_id, data.producto_id, data.mes_fiscal]
    if data.regional_id:
        q += " AND regional_id = ?"
        p.append(data.regional_id)
    rows = cursor.execute(q, p).fetchall()

    if not rows:
        reg = data.regional_id or (cursor.execute("SELECT MIN(id) FROM regionales").fetchone()[0] or 1)
        prod = cursor.execute("SELECT precio_base FROM productos WHERE id = ?", (data.producto_id,)).fetchone()
        qty = data.cantidad or 0
        prc = data.precio if data.precio is not None else (prod["precio_base"] if prod else 0)
        cursor.execute("""
            INSERT INTO presupuesto_items (escenario_id, producto_id, regional_id, mes_fiscal, cantidad, precio, valorizacion)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (data.escenario_id, data.producto_id, reg, data.mes_fiscal, qty, prc, round(qty * prc, 2)))
    else:
        total_q = sum(r["cantidad"] or 0 for r in rows)
        for r in rows:
            qty, prc = r["cantidad"] or 0, r["precio"] or 0
            if data.cantidad is not None:
                qty = data.cantidad * (qty / total_q) if total_q > 0 else data.cantidad / len(rows)
            if data.precio is not None:
                prc = data.precio
            cursor.execute("UPDATE presupuesto_items SET cantidad = ?, precio = ?, valorizacion = ? WHERE id = ?",
                           (round(qty, 2), prc, round(qty * prc, 2), r["id"]))
    conn.commit()
    conn.close()
    log_audit("Admin", "PRESUPUESTO", "UPDATE_CELL", data.dict())
    return {"success": True}

@app.delete("/api/presupuesto/fila")
def delete_presupuesto_fila(escenario_id: int, producto_id: int, regional_id: Optional[int] = None):
    conn = get_db()
    q = "DELETE FROM presupuesto_items WHERE escenario_id = ? AND producto_id = ?"
    p = [escenario_id, producto_id]
    if regional_id:
        q += " AND regional_id = ?"
        p.append(regional_id)
    n = conn.execute(q, p).rowcount
    conn.commit()
    conn.close()
    log_audit("Admin", "PRESUPUESTO", "DELETE_ROW", {"escenario_id": escenario_id, "producto_id": producto_id, "regional_id": regional_id, "items": n})
    return {"success": True, "deleted": n}

@app.post("/api/presupuesto/escenarios/copiar")
def copy_escenario(req: CopyScenarioRequest):
    conn = get_db()
    cur = conn.cursor()
    src = cur.execute("SELECT gestion_id FROM presupuesto_escenarios WHERE id = ?", (req.origen_id,)).fetchone()
    if not src:
        conn.close()
        raise HTTPException(404, "Escenario origen no encontrado.")
    cur.execute("INSERT INTO presupuesto_escenarios (gestion_id, tipo_escenario, nombre, descripcion, aprobado) VALUES (?, ?, ?, ?, 0)",
                (src["gestion_id"], req.tipo_escenario, req.nombre, req.descripcion or f"Copia del escenario #{req.origen_id}"))
    new_id = cur.lastrowid
    f = 1 + req.factor_pct / 100.0
    cur.execute("""
        INSERT INTO presupuesto_items (escenario_id, producto_id, regional_id, mes_fiscal, cantidad, precio, valorizacion, crecimiento_pct)
        SELECT ?, producto_id, regional_id, mes_fiscal, ROUND(cantidad * ?, 2), precio, ROUND(cantidad * ? * precio, 2), crecimiento_pct
        FROM presupuesto_items WHERE escenario_id = ?
    """, (new_id, f, f, req.origen_id))
    n = cur.rowcount
    conn.commit()
    conn.close()
    log_audit("Admin", "PRESUPUESTO", "COPY_SCENARIO", {**req.dict(), "nuevo_id": new_id, "items": n})
    return {"success": True, "id": new_id, "items": n}

@app.post("/api/presupuesto/ajuste-masivo")
def bulk_adjust(req: BulkAdjustRequest):
    f = 1 + req.pct / 100.0
    where, p = ["escenario_id = ?"], [req.escenario_id]
    if req.regional_id:
        where.append("regional_id = ?"); p.append(req.regional_id)
    if req.producto_id:
        where.append("producto_id = ?"); p.append(req.producto_id)
    if req.linea:
        where.append("producto_id IN (SELECT id FROM productos WHERE linea = ?)"); p.append(req.linea)
    if req.campo == "precio":
        sets = "precio = ROUND(precio * ?, 2), valorizacion = ROUND(cantidad * precio * ?, 2)"
    else:
        sets = "cantidad = ROUND(cantidad * ?, 2), valorizacion = ROUND(cantidad * ? * precio, 2)"
    conn = get_db()
    n = conn.execute(f"UPDATE presupuesto_items SET {sets} WHERE {' AND '.join(where)}", [f, f] + p).rowcount
    conn.commit()
    conn.close()
    log_audit("Admin", "PRESUPUESTO", "BULK_ADJUST", {**req.dict(), "items": n})
    return {"success": True, "updated": n}

# ==========================================
# 6. PLANIFICACIÓN ORDEN X ITEM (CLIENTE x PRODUCTO)
# ==========================================
@app.get("/api/planificacion-orden-item")
def get_planificacion_orden_item(cliente_id: int, producto_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT poi.*, c.nombre as cliente_nombre, p.nombre as producto_nombre
        FROM planificacion_orden_item poi
        JOIN clientes c ON poi.cliente_id = c.id
        JOIN productos p ON poi.producto_id = p.id
        WHERE poi.cliente_id = ? AND poi.producto_id = ?
        ORDER BY poi.mes_fiscal ASC
    """, (cliente_id, producto_id))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/planificacion-orden-item/distribuir")
def distribute_orden_item(req: OrderItemDistributeRequest):
    conn = get_db()
    cursor = conn.cursor()

    if req.distribution_curve:
        curve = req.distribution_curve
    elif req.modo == "uniforme":
        curve = [1.0] * 12
    elif req.modo == "historico":
        # Mes fiscal 1 = Abril (mes calendario 4) ... 12 = Marzo (3)
        hist = {r[0]: r[1] for r in cursor.execute("""
            SELECT mes, SUM(cantidad) FROM historico_ventas WHERE cliente_id = ? AND producto_id = ? GROUP BY mes
        """, (req.cliente_id, req.producto_id)).fetchall()}
        if not hist:
            hist = {r[0]: r[1] for r in cursor.execute(
                "SELECT mes, SUM(cantidad) FROM historico_ventas WHERE producto_id = ? GROUP BY mes", (req.producto_id,)).fetchall()}
        curve = [float(hist.get(((mf + 2) % 12) + 1, 0) or 0) for mf in range(1, 13)]
        if sum(curve) <= 0:
            curve = [1.0] * 12
    else:
        curve = [0.075, 0.082, 0.105, 0.110, 0.095, 0.085, 0.080, 0.078, 0.092, 0.088, 0.075, 0.085]
    total_weights = sum(curve)

    gestion = cursor.execute("SELECT id FROM gestiones_fiscales ORDER BY activa DESC, id DESC LIMIT 1").fetchone()
    gestion_id = gestion[0] if gestion else 1
    cursor.execute("DELETE FROM planificacion_orden_item WHERE cliente_id = ? AND producto_id = ?", (req.cliente_id, req.producto_id))

    for mf in range(1, 13):
        w = curve[mf - 1] / total_weights
        qty = round(req.anual_target * w)
        cursor.execute("""
            INSERT INTO planificacion_orden_item (gestion_id, cliente_id, producto_id, mes_fiscal, cantidad, porcentaje_distribucion)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (gestion_id, req.cliente_id, req.producto_id, mf, qty, round(w * 100, 2)))

    conn.commit()
    conn.close()
    log_audit("Admin", "ORDEN_ITEM", "DISTRIBUTE", {"cliente_id": req.cliente_id, "producto_id": req.producto_id, "anual_target": req.anual_target, "modo": req.modo})
    return {"success": True, "message": f"Cantidades distribuidas (modo {req.modo})."}

# ==========================================
# 7. FORECASTING IA (AUTO-ML SERIES TEMPORALES)
# ==========================================
@app.get("/api/forecast/product/{product_id}")
def get_product_forecast(product_id: int, regional_id: Optional[int] = None):
    conn = get_db()
    cursor = conn.cursor()

    where_reg = f"AND regional_id = {regional_id}" if regional_id else ""
    cursor.execute(f"""
        SELECT anio, mes, SUM(cantidad) as total_qty
        FROM historico_ventas
        WHERE producto_id = ? {where_reg}
        GROUP BY anio, mes
        ORDER BY anio ASC, mes ASC
    """, (product_id,))
    
    rows = cursor.fetchall()
    if not rows:
        conn.close()
        raise HTTPException(status_code=404, detail="No se encontraron datos históricos para este producto.")
        
    historical_series = [float(r["total_qty"]) for r in rows]
    labels = [f"{r['anio']}-M{r['mes']:02d}" for r in rows]

    # Get product info
    cursor.execute("SELECT id, codigo, nombre, linea, core FROM productos WHERE id = ?", (product_id,))
    prod = dict(cursor.fetchone())

    conn.close()

    # Run all 7 models + Auto-select best model
    forecast_results = run_all_models_and_select_best(historical_series, forecast_horizon=12)

    # Future labels: 12 months (M01 Abr 2026 to M12 Mar 2027)
    future_labels = ["2026-Abr", "2026-May", "2026-Jun", "2026-Jul", "2026-Ago", "2026-Sep", 
                     "2026-Oct", "2026-Nov", "2026-Dic", "2027-Ene", "2027-Feb", "2027-Mar"]

    return {
        "producto": prod,
        "historico": {
            "labels": labels,
            "valores": historical_series
        },
        "forecast_labels": future_labels,
        "best_model_name": forecast_results["best_model_name"],
        "modelos": forecast_results["models"]
    }

# ==========================================
# 8. OPTIMIZADOR INTELIGENTE (SOLVER IA)
# ==========================================
@app.post("/api/forecast/solver")
def run_solver(req: SolverRequest):
    conn = get_db()
    cursor = conn.cursor()

    where_reg = f"AND regional_id = {req.regional_id}" if req.regional_id else ""
    cursor.execute(f"""
        SELECT anio, mes, SUM(cantidad) as total_qty
        FROM historico_ventas
        WHERE producto_id = ? {where_reg}
        GROUP BY anio, mes
        ORDER BY anio ASC, mes ASC
    """, (req.product_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        raise HTTPException(status_code=404, detail="No hay datos históricos para optimizar.")

    series = [float(r["total_qty"]) for r in rows]
    solver_result = optimize_parameters_solver(series, model_type=req.model_type, target_metric=req.target_metric)
    
    log_audit("Admin", "SOLVER_IA", "OPTIMIZE", {
        "producto_id": req.product_id, 
        "modelo": req.model_type, 
        "alpha": solver_result["alpha"], 
        "beta": solver_result.get("beta"),
        "mejora_pct": solver_result["improvement_pct"]
    })
    
    return solver_result

# ==========================================
# 9. INTELIGENCIA DE MERCADO RETAIL & CUP
# ==========================================
@app.get("/api/mercado-cup")
def get_mercado_cup(mercado: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    q = "SELECT * FROM auditoria_mercado_cup WHERE 1=1"
    params = []
    if mercado:
        q += " AND mercado = ?"
        params.append(mercado)
    q += " ORDER BY market_share_valores DESC"
    cursor.execute(q, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

# ==========================================
# 10. GESTIÓN DE PRECIOS & IMPACTO ECONÓMICO
# ==========================================
@app.get("/api/precios/historial/{product_id}")
def get_historial_precios(product_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT hcp.*, p.nombre as producto_nombre, p.codigo as producto_codigo
        FROM historico_cambios_precios hcp
        JOIN productos p ON hcp.producto_id = p.id
        WHERE hcp.producto_id = ?
        ORDER BY hcp.id DESC
    """, (product_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/precios/simular-y-guardar")
def simular_cambio_precio(req: PriceSimulationRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, precio_base, nombre FROM productos WHERE id = ?", (req.product_id,))
    prod = cursor.fetchone()
    if not prod:
        conn.close()
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    precio_actual = prod["precio_base"]
    pct_cambio_precio = (req.new_price - precio_actual) / precio_actual

    # Volumen anual estimado
    cursor.execute("SELECT SUM(cantidad) FROM historico_ventas WHERE producto_id = ? AND anio = 2025", (req.product_id,))
    volumen_base = cursor.fetchone()[0] or 10000

    # Impacto en volumen según elasticidad: delta_Q = Elasticidad * delta_P
    el = req.get_elasticidad()
    just = req.get_justificacion()
    delta_volumen_pct = round(el * pct_cambio_precio * 100, 2)
    nuevo_volumen = volumen_base * (1.0 + (delta_volumen_pct / 100.0))
    
    facturacion_actual = volumen_base * precio_actual
    facturacion_proyectada = nuevo_volumen * req.new_price
    impacto_facturacion = round(facturacion_proyectada - facturacion_actual, 2)

    # Guardar en histórico de precios y actualizar precio base
    cursor.execute("""
        INSERT INTO historico_cambios_precios 
        (producto_id, precio_anterior, precio_nuevo, elasticidad, impacto_volumen_pct, impacto_facturacion, justificacion, usuario)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (req.product_id, precio_actual, req.new_price, el, delta_volumen_pct, impacto_facturacion, just, req.user))

    cursor.execute("UPDATE productos SET precio_base = ? WHERE id = ?", (req.new_price, req.product_id))
    conn.commit()

    log_audit(req.user, "PRECIOS", "UPDATE_PRICE", {
        "producto_id": req.product_id,
        "precio_anterior": precio_actual,
        "precio_nuevo": req.new_price,
        "impacto_facturacion": impacto_facturacion
    })
    conn.close()

    return {
        "success": True,
        "precio_anterior": precio_actual,
        "precio_nuevo": req.new_price,
        "cambio_precio_pct": round(pct_cambio_precio * 100, 2),
        "impacto_volumen_pct": delta_volumen_pct,
        "volumen_proyectado": round(nuevo_volumen, 0),
        "impacto_facturacion": impacto_facturacion,
        "nueva_facturacion_estimada": round(facturacion_proyectada, 2)
    }

# ==========================================
# 11. ASISTENTE IA COPILOT COMERCIAL
# ==========================================
@app.post("/api/copilot/chat")
def chat_copilot(query_data: CopilotQuery):
    response = ask_copilot(query_data.query, query_data.context)
    return response

# ==========================================
# 12. AUDITORÍA, SEGURIDAD & USUARIOS
# ==========================================
@app.get("/api/auditoria")
def get_auditoria_logs(limit: int = 50):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM auditoria_logs ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.get("/api/usuarios")
def get_usuarios():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT u.*, r.nombre as regional_nombre FROM usuarios u LEFT JOIN regionales r ON u.regional_id = r.id")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
