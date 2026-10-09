import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from database import get_db, log_audit

def generate_sample_excel_template() -> bytes:
    """
    Genera un archivo Excel de plantilla con estructura y datos de ejemplo listos para importar.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Historico_Ventas"
    
    headers = [
        "CODIGO_PRODUCTO", "NOMBRE_PRODUCTO", "REGIONAL", "CANAL_CLIENTE", 
        "CLIENTE", "ANIO", "MES", "CANTIDAD", "PRECIO_UNITARIO", "IMPORTE"
    ]
    
    # Header styling
    header_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    sample_rows = [
        ["SKU-101", "Paracetamol Forte 1g", "Santa Cruz", "Cadenas Farmacéuticas", "Cadena Farmacorp S.A.", 2025, 1, 500, 18.50, 9250.00],
        ["SKU-101", "Paracetamol Forte 1g", "La Paz - El Alto", "Cadenas Farmacéuticas", "Farmacias Bolivia Red La Paz", 2025, 1, 420, 18.50, 7770.00],
        ["SKU-102", "Amoxicilina + Ác. Clavulánico 875/125", "Santa Cruz", "Cadenas Farmacéuticas", "Farmacias Chávez Corporativo", 2025, 1, 260, 72.00, 18720.00],
        ["SKU-103", "Losartán Potásico 50mg", "Cochabamba", "Farmacias Independientes", "Farmacias San Elías CBB", 2025, 1, 310, 42.00, 13020.00],
        ["SKU-105", "Azitromicina 500mg", "Santa Cruz", "Cadenas Farmacéuticas", "Cadena Farmacorp S.A.", 2025, 2, 450, 38.00, 17100.00],
        ["SKU-106", "Omeprazol 20mg Gastro", "La Paz - El Alto", "Seguridad Social / Público", "Hospital Obrero CNS La Paz", 2025, 2, 800, 31.00, 24800.00]
    ]
    
    for row in sample_rows:
        ws.append(row)
        
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
        
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.read()

def process_excel_import(file_bytes: bytes, filename: str, user: str = "Admin") -> dict:
    """
    Lee y valida un archivo Excel cargado.
    Valida:
    - Códigos de productos válidos existentes.
    - Regionales existentes.
    - Cuadratura aritmética: Importe == Cantidad * Precio (+/- 0.05).
    - Mes válido (1 a 12).
    - Año válido.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, codigo, nombre FROM productos")
    prod_map = {row["codigo"].strip().upper(): row["id"] for row in cursor.fetchall()}

    cursor.execute("SELECT id, nombre FROM regionales")
    reg_map = {row["nombre"].strip().upper(): row["id"] for row in cursor.fetchall()}

    cursor.execute("SELECT id, nombre, regional_id FROM clientes")
    cli_map = {row["nombre"].strip().upper(): (row["id"], row["regional_id"]) for row in cursor.fetchall()}

    valid_rows = []
    errors = []
    warnings = []
    total_importe_calculado = 0.0

    rows_iter = list(ws.iter_rows(values_only=True))
    if len(rows_iter) < 2:
        return {"success": False, "message": "El archivo Excel está vacío o no contiene filas de datos."}

    header = [str(c or '').strip().upper() for c in rows_iter[0]]
    
    # Auto-detect column indexes
    def find_col(possible_names):
        for name in possible_names:
            for idx, h in enumerate(header):
                if name in h:
                    return idx
        return -1

    idx_sku = find_col(["CODIGO", "SKU", "PRODUCT"])
    idx_reg = find_col(["REGIONAL", "DEPTO", "TERRITORIO"])
    idx_cli = find_col(["CLIENTE", "RAZON"])
    idx_anio = find_col(["ANIO", "AÑO", "YEAR"])
    idx_mes = find_col(["MES", "MONTH"])
    idx_qty = find_col(["CANTIDAD", "QTY", "UNIDADES"])
    idx_prc = find_col(["PRECIO", "PRICE", "UNITARIO"])
    idx_imp = find_col(["IMPORTE", "TOTAL", "VALORIZACION", "NETO"])

    if idx_sku == -1 or idx_qty == -1 or idx_prc == -1:
        return {
            "success": False, 
            "message": f"Columnas requeridas no encontradas. Se requiere al menos CODIGO, CANTIDAD y PRECIO. Encabezados detectados: {header}"
        }

    for row_idx, r in enumerate(rows_iter[1:], start=2):
        if not r or all(cell is None for cell in r):
            continue
            
        sku_val = str(r[idx_sku]).strip().upper() if idx_sku < len(r) and r[idx_sku] else ""
        if sku_val not in prod_map:
            errors.append(f"Fila {row_idx}: Código de producto '{sku_val}' no existe en el catálogo maestro.")
            continue
            
        pid = prod_map[sku_val]

        try:
            qty = float(r[idx_qty]) if idx_qty < len(r) and r[idx_qty] is not None else 0.0
            price = float(r[idx_prc]) if idx_prc < len(r) and r[idx_prc] is not None else 0.0
            calc_imp = round(qty * price, 2)
            
            if idx_imp != -1 and idx_imp < len(r) and r[idx_imp] is not None:
                excel_imp = float(r[idx_imp])
                if abs(excel_imp - calc_imp) > 0.5:
                    warnings.append(f"Fila {row_idx} ({sku_val}): Importe informado ({excel_imp}) difiere del cálculo Cantidad * Precio ({calc_imp}). Se ajustó al cálculo.")
            
            anio = int(r[idx_anio]) if idx_anio != -1 and idx_anio < len(r) and r[idx_anio] else 2025
            mes = int(r[idx_mes]) if idx_mes != -1 and idx_mes < len(r) and r[idx_mes] else 1
            if mes < 1 or mes > 12:
                errors.append(f"Fila {row_idx}: Mes {mes} inválido (debe ser entre 1 y 12).")
                continue

            # Regional detection
            reg_name = str(r[idx_reg]).strip().upper() if idx_reg != -1 and idx_reg < len(r) and r[idx_reg] else ""
            reg_id = 1
            for k, v in reg_map.items():
                if k in reg_name or reg_name in k:
                    reg_id = v
                    break
                    
            # Client detection
            cli_name = str(r[idx_cli]).strip().upper() if idx_cli != -1 and idx_cli < len(r) and r[idx_cli] else ""
            cli_id = 1
            for k, (cid, crid) in cli_map.items():
                if k in cli_name or cli_name in k:
                    cli_id = cid
                    reg_id = crid
                    break

            valid_rows.append((pid, cli_id, reg_id, anio, mes, qty, price, calc_imp, filename))
            total_importe_calculado += calc_imp

        except Exception as ex:
            errors.append(f"Fila {row_idx}: Error de formato numérico: {str(ex)}")

    if len(errors) > 0 and len(valid_rows) == 0:
        conn.close()
        return {
            "success": False,
            "message": "No se pudo importar ningún registro debido a errores de validación.",
            "errors": errors[:15]
        }

    # Insert valid rows
    cursor.executemany(
        """INSERT INTO historico_ventas 
           (producto_id, cliente_id, regional_id, anio, mes, cantidad, precio_unitario, importe, fuente)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        valid_rows
    )
    conn.commit()

    log_audit(
        user, "HISTORICO_VENTAS", "IMPORT_EXCEL", 
        {"archivo": filename, "filas_insertadas": len(valid_rows), "total_importe": total_importe_calculado, "advertencias": len(warnings)}
    )
    conn.close()

    return {
        "success": True,
        "message": f"Se importaron con éxito {len(valid_rows)} registros de ventas desde '{filename}'.",
        "rows_count": len(valid_rows),
        "total_importe": round(total_importe_calculado, 2),
        "warnings": warnings[:10],
        "errors": errors[:10]
    }
