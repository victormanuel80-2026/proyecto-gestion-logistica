import random
import math
from database import get_db, init_db

def seed_all():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Check if already seeded
    cursor.execute("SELECT COUNT(*) FROM productos")
    if cursor.fetchone()[0] > 0:
        conn.close()
        print("Base de datos ya contenía datos. Omitiendo seed repetido.")
        return

    print("Iniciando carga de datos maestros y transaccionales farmacéuticos...")

    # 1. Regionales
    regionales_data = [
        ("SCZ", "Santa Cruz", "Lic. Carlos Montero", 4500000.0),
        ("LPZ", "La Paz - El Alto", "Dra. Patricia Mendoza", 3800000.0),
        ("CBB", "Cochabamba", "Ing. Roberto Siles", 2600000.0),
        ("CHQ", "Chuquisaca / Sucre", "Lic. Elena Vaca", 1200000.0),
        ("TJA", "Tarija", "Lic. Marcelo Ortiz", 950000.0),
    ]
    cursor.executemany(
        "INSERT INTO regionales (codigo, nombre, responsable, cuota_anual_base) VALUES (?, ?, ?, ?)",
        regionales_data
    )

    # 2. Productos Farmacéuticos
    productos_data = [
        # codigo, nombre, linea, categoria, forma, core, molecula, presentacion, atc, precio_base, costo_base
        ("SKU-101", "Paracetamol Forte 1g", "Línea Ética", "Analgésicos y Antipiréticos", "Comprimidos", 1, "Paracetamol", "Caja x 20 comprimidos", "N02BE01", 18.50, 7.20),
        ("SKU-102", "Amoxicilina + Ác. Clavulánico 875/125", "Línea Ética", "Antibióticos Sistémicos", "Comprimidos Recubiertos", 1, "Amoxicilina + Clavulanato", "Caja x 14 comprimidos", "J01CR02", 72.00, 28.50),
        ("SKU-103", "Losartán Potásico 50mg", "Línea Cardiometabólica", "Antihipertensivos", "Comprimidos", 1, "Losartán", "Caja x 30 comprimidos", "C09CA01", 42.00, 14.80),
        ("SKU-104", "Ibuprofeno Suspensión 100mg/5ml", "Línea Pediátrica", "Antiinflamatorios AINEs", "Suspensión Oral", 0, "Ibuprofeno", "Frasco x 120 ml", "M01AE01", 24.50, 9.10),
        ("SKU-105", "Azitromicina 500mg", "Línea Ética", "Antibióticos Macrólidos", "Comprimidos", 1, "Azitromicina", "Caja x 3 comprimidos", "J01FA10", 38.00, 13.50),
        ("SKU-106", "Omeprazol 20mg Gastro", "Línea Gastrointestinal", "Inhibidores Bomba Protones", "Cápsulas", 1, "Omeprazol", "Caja x 28 cápsulas", "A02BC01", 31.00, 10.20),
        ("SKU-107", "Atorvastatina 20mg", "Línea Cardiometabólica", "Hipolipemiantes", "Comprimidos Recubiertos", 1, "Atorvastatina", "Caja x 30 comprimidos", "C10AA05", 55.00, 19.40),
        ("SKU-108", "Metformina Clorhidrato 850mg", "Línea Cardiometabólica", "Antidiabéticos Orales", "Comprimidos", 1, "Metformina", "Caja x 60 comprimidos", "A10BA02", 34.00, 11.80),
        ("SKU-109", "Ceftriaxona 1g IM/IV", "Línea Hospitalaria", "Cefalosporinas", "Polvo Inyectable + Diluyente", 0, "Ceftriaxona Sódica", "Vial x 1 frasco ampolla", "J01DD04", 45.00, 18.00),
        ("SKU-110", "Salbutamol Aerosol 100mcg", "Línea Respiratoria", "Broncodilatadores", "Inhalador Presurizado", 1, "Salbutamol", "Inhalador x 200 dosis", "R03AC02", 39.50, 14.30),
        ("SKU-111", "Complejo B Neuro Forte", "Línea OTC", "Vitaminas y Minerales", "Cápsulas Blandas", 0, "Vitaminas B1, B6, B12", "Caja x 30 cápsulas blandas", "A11DB01", 28.00, 8.50),
        ("SKU-112", "Loratadina 10mg Antialérgico", "Línea Respiratoria", "Antihistamínicos", "Comprimidos", 0, "Loratadina", "Caja x 20 comprimidos", "R06AX13", 16.00, 5.20)
    ]
    cursor.executemany(
        """INSERT INTO productos 
           (codigo, nombre, linea, categoria, forma_farmaceutica, core, molecula, presentacion, clase_terapeutica_atc, precio_base, costo_base)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        productos_data
    )

    # 3. Clientes
    clientes_data = [
        ("CLI-001", "Cadena Farmacorp S.A.", "Cadenas Farmacéuticas", 1, "Cliente A (Estratégico)"),
        ("CLI-002", "Farmacias Chávez Corporativo", "Cadenas Farmacéuticas", 1, "Cliente A (Estratégico)"),
        ("CLI-003", "Clínica Foianini", "Instituciones Privadas", 1, "Cliente B (Institucional)"),
        ("CLI-004", "Farmacias Bolivia Red La Paz", "Cadenas Farmacéuticas", 2, "Cliente A (Estratégico)"),
        ("CLI-005", "Hospital Obrero CNS La Paz", "Seguridad Social / Público", 2, "Cliente A (Licitaciones)"),
        ("CLI-006", "Droguería Inti Mayorista", "Distribuidores Mayoristas", 2, "Cliente B (Distribuidor)"),
        ("CLI-007", "Farmacias San Elías CBB", "Farmacias Independientes", 3, "Cliente B (Independiente)"),
        ("CLI-008", "Clínica Los Olivos", "Instituciones Privadas", 3, "Cliente C (Clínica)"),
        ("CLI-009", "Farmacia San Agustín Sucre", "Farmacias Independientes", 4, "Cliente C (Independiente)"),
        ("CLI-010", "Distribuidora del Sur Tarija", "Distribuidores Mayoristas", 5, "Cliente C (Distribuidor)"),
    ]
    cursor.executemany(
        "INSERT INTO clientes (codigo, nombre, canal, regional_id, tipo_cliente) VALUES (?, ?, ?, ?, ?)",
        clientes_data
    )

    # 4. Histórico de Ventas (24 meses: 2024 y 2025)
    # Generar serie con estacionalidad farmacéutica creíble (picos invernales para respiratorios/antibióticos en jun-ago)
    print("Generando serie histórica de ventas de 24 meses...")
    ventas_historicas = []
    
    # Precios base mapa
    cursor.execute("SELECT id, precio_base, linea, core FROM productos")
    prod_rows = cursor.fetchall()

    for p in prod_rows:
        pid = p[0]
        base_price = p[1]
        linea = p[2]
        is_core = p[3]
        
        # Base volume per month
        base_vol = 1400 if is_core else 650
        if "Respiratoria" in linea or "Antibióticos" in linea:
            season_factor = lambda m: 1.0 + 0.45 * math.sin((m - 3) * math.pi / 6) # Peak in month 6 (June)
        else:
            season_factor = lambda m: 1.0 + 0.15 * math.sin((m - 1) * math.pi / 6)

        for anio in [2024, 2025]:
            trend = 1.08 if anio == 2025 else 1.0
            for mes in range(1, 13):
                # Distribuir entre regionales
                for reg_id in range(1, 6):
                    reg_weight = {1: 0.38, 2: 0.32, 3: 0.18, 4: 0.07, 5: 0.05}[reg_id]
                    client_id = reg_id * 2 - 1 # Primary client
                    
                    random_noise = random.uniform(0.92, 1.08)
                    qty = round(base_vol * season_factor(mes) * trend * reg_weight * random_noise)
                    # Small price variations over time
                    price_var = round(base_price * (1.0 + (anio - 2024) * 0.04 + random.uniform(-0.02, 0.02)), 2)
                    importe = round(qty * price_var, 2)
                    
                    ventas_historicas.append((pid, client_id, reg_id, anio, mes, qty, price_var, importe, "EXCEL_AUDIT_HIST"))

    cursor.executemany(
        """INSERT INTO historico_ventas 
           (producto_id, cliente_id, regional_id, anio, mes, cantidad, precio_unitario, importe, fuente)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ventas_historicas
    )

    # 5. Gestión Fiscal y Escenarios de Presupuesto (Abril 2026 - Marzo 2027)
    cursor.execute("""
        INSERT INTO gestiones_fiscales (nombre, fecha_inicio, fecha_fin, activa)
        VALUES ('Gestión 2026-2027 (Abril - Marzo)', '2026-04-01', '2027-03-31', 1)
    """)
    gestion_id = cursor.lastrowid

    escenarios_data = [
        (gestion_id, "OFICIAL", "Presupuesto Comercial Oficial Aprobado 2026-2027", "Aprobado por Directorio", 1),
        (gestion_id, "PROYECTADO", "Forecast Proyectado IA (Holt-Winters)", "Generado automáticamente por Motor IA", 0),
        (gestion_id, "MODIFICADO", "Presupuesto Modificado Q2", "Ajuste por licitaciones institucionales", 0),
        (gestion_id, "REAL", "Ejecución Real Acumulada 2026", "Ventas consolidadas M01 a M06", 0),
        (gestion_id, "HISTORICO", "Línea Base Histórica Gestión Anterior", "Comparativa de referencia", 0)
    ]
    cursor.executemany(
        "INSERT INTO presupuesto_escenarios (gestion_id, tipo_escenario, nombre, descripcion, aprobado) VALUES (?, ?, ?, ?, ?)",
        escenarios_data
    )
    
    cursor.execute("SELECT id, tipo_escenario FROM presupuesto_escenarios WHERE gestion_id = ?", (gestion_id,))
    esc_map = {row[1]: row[0] for row in cursor.fetchall()}

    # Items de Presupuesto para Escenario OFICIAL y PROYECTADO
    presupuesto_items = []
    for p in prod_rows:
        pid = p[0]
        base_price = p[1]
        is_core = p[2]
        
        # Monthly budget Abr (M1) to Mar (M12)
        for mes_fiscal in range(1, 13):
            for reg_id in range(1, 6):
                reg_weight = {1: 0.38, 2: 0.32, 3: 0.18, 4: 0.07, 5: 0.05}[reg_id]
                qty_oficial = round(320 * reg_weight * (1.10 + 0.1 * math.sin(mes_fiscal * 0.5)))
                val_oficial = round(qty_oficial * base_price, 2)
                growth = 8.5 # 8.5% meta anual

                # Oficial
                presupuesto_items.append((esc_map["OFICIAL"], pid, reg_id, mes_fiscal, qty_oficial, base_price, val_oficial, growth))
                
                # Proyectado IA (con leve variación)
                qty_proy = round(qty_oficial * random.uniform(0.95, 1.05))
                val_proy = round(qty_proy * base_price, 2)
                presupuesto_items.append((esc_map["PROYECTADO"], pid, reg_id, mes_fiscal, qty_proy, base_price, val_proy, growth - 0.8))

                # Real (primeros meses con ejecución)
                if mes_fiscal <= 6:
                    qty_real = round(qty_oficial * random.uniform(0.92, 1.08))
                    val_real = round(qty_real * base_price, 2)
                    presupuesto_items.append((esc_map["REAL"], pid, reg_id, mes_fiscal, qty_real, base_price, val_real, 7.2))

    cursor.executemany(
        """INSERT INTO presupuesto_items 
           (escenario_id, producto_id, regional_id, mes_fiscal, cantidad, precio, valorizacion, crecimiento_pct)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        presupuesto_items
    )

    # 6. Planificación Orden x Item (distribución por cliente y producto)
    plan_orden_item = []
    # Seasonal weights for pharmaceutical year (April=0.08 ... June/July=0.11 ... Dec=0.09 ... March=0.08)
    seasonal_weights = [0.075, 0.082, 0.105, 0.110, 0.095, 0.085, 0.080, 0.078, 0.092, 0.088, 0.075, 0.085]

    for cli_id in [1, 2, 4]: # Top chains
        for pid in [1, 2, 3, 5, 7]: # Top core products
            anual_target = 2400 if cli_id == 1 else 1600
            for mf in range(1, 13):
                weight = seasonal_weights[mf - 1]
                qty = round(anual_target * weight)
                plan_orden_item.append((gestion_id, cli_id, pid, mf, qty, round(weight * 100, 2)))

    cursor.executemany(
        """INSERT INTO planificacion_orden_item 
           (gestion_id, cliente_id, producto_id, mes_fiscal, cantidad, porcentaje_distribucion)
           VALUES (?, ?, ?, ?, ?, ?)""",
        plan_orden_item
    )

    # 7. Auditoría de Mercado Retail y CUP (Clase ATC, Marcas, Market Share, IE)
    mercado_cup_data = [
        # periodo, mercado, clase, molecula, marca, lab, unidades, valores, ms_u, ms_v, ie
        ("2026-03", "Mercado Analgésicos", "N02B Analgésicos No Opioides", "Paracetamol", "Paracetamol Forte (Nuestra Marca)", "Laboratorio Propio", 45000, 832500, 31.5, 34.2, 108.5),
        ("2026-03", "Mercado Analgésicos", "N02B Analgésicos No Opioides", "Paracetamol", "Kitadol", "Laboratorio Competidor A", 38000, 722000, 26.6, 29.6, 97.4),
        ("2026-03", "Mercado Analgésicos", "N02B Analgésicos No Opioides", "Paracetamol", "Tylenol", "Multinacional B", 22000, 484000, 15.4, 19.9, 94.1),
        ("2026-03", "Mercado Antibióticos", "J01CR Combinaciones Penicilinas", "Amoxicilina + Clavulanato", "Amox Clav Forte (Nuestra Marca)", "Laboratorio Propio", 18500, 1332000, 28.0, 31.8, 112.0),
        ("2026-03", "Mercado Antibióticos", "J01CR Combinaciones Penicilinas", "Amoxicilina + Clavulanato", "Clavinex", "Laboratorio Competidor C", 21000, 1617000, 31.8, 38.6, 102.3),
        ("2026-03", "Mercado Cardiovascular", "C09CA Antagonistas Angiotensina II", "Losartán", "Losartán 50mg (Nuestra Marca)", "Laboratorio Propio", 34000, 1428000, 36.2, 33.5, 105.4),
        ("2026-03", "Mercado Cardiovascular", "C09CA Antagonistas Angiotensina II", "Losartán", "Cozaar", "Laboratorio Innovador D", 14000, 1120000, 14.9, 26.3, 89.2),
        ("2026-03", "Mercado Gastrointestinal", "A02BC Inhibidores Bomba Protones", "Omeprazol", "Omeprazol 20mg (Nuestra Marca)", "Laboratorio Propio", 52000, 1612000, 41.0, 39.5, 106.8),
        ("2026-03", "Mercado Gastrointestinal", "A02BC Inhibidores Bomba Protones", "Omeprazol", "Losec", "Multinacional E", 11000, 682000, 8.7, 16.7, 84.5),
        ("2026-03", "Mercado Respiratorio", "R03AC Agonistas Beta-2", "Salbutamol", "Salbutamol Inhalador (Nuestra Marca)", "Laboratorio Propio", 26000, 1027000, 33.3, 30.1, 104.2),
    ]
    cursor.executemany(
        """INSERT INTO auditoria_mercado_cup 
           (periodo, mercado, clase_terapeutica, molecula, marca, laboratorio, unidades_mercado, valores_mercado, market_share_unidades, market_share_valores, indice_evolucion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        mercado_cup_data
    )

    # 8. Histórico de Cambios de Precios
    precios_hist_data = [
        (1, 17.50, 18.50, -0.45, -2.5, 34200.0, "Ajuste anual por inflación en costos de principio activo", "Dra. Laura Gómez (Pricing Manager)"),
        (2, 68.00, 72.00, -0.38, -2.1, 62400.0, "Incremento regulatorio y mejora de presentación con empaque foil", "Dra. Laura Gómez (Pricing Manager)"),
        (3, 39.50, 42.00, -0.52, -3.2, 48000.0, "Alineamiento con precio de referencia en mercado retail", "Lic. Carlos Montero (Gerente Comercial)"),
    ]
    cursor.executemany(
        """INSERT INTO historico_cambios_precios 
           (producto_id, precio_anterior, precio_nuevo, elasticidad, impacto_volumen_pct, impacto_facturacion, justificacion, usuario)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        precios_hist_data
    )

    # 9. Usuarios del Sistema
    usuarios_data = [
        ("Administrador General", "admin@pharmaerp.com", "ADMIN", None),
        ("Carlos Montero (Gerente Comercial)", "carlos.montero@pharmaerp.com", "GERENTE_COMERCIAL", 1),
        ("Patricia Mendoza (KAM Regional La Paz)", "patricia.mendoza@pharmaerp.com", "KAM_REGIONAL", 2),
        ("Ing. David Terrazas (Planificador de Demanda)", "david.terrazas@pharmaerp.com", "PLANIFICADOR_DEMANDA", None),
        ("Lic. Mariana Soto (Auditora de Control)", "mariana.soto@pharmaerp.com", "AUDITOR", None),
    ]
    cursor.executemany(
        "INSERT INTO usuarios (nombre, email, rol, regional_id) VALUES (?, ?, ?, ?)",
        usuarios_data
    )

    # 10. Auditoría Inicial
    cursor.execute("""
        INSERT INTO auditoria_logs (usuario, modulo, accion, detalles)
        VALUES ('Sistema', 'INICIALIZACION', 'SEED_DATA', 'Inicialización completa de base de datos comercial farmacéutica con 12 productos, 5 regionales, 10 clientes y 24 meses históricos.')
    """)

    conn.commit()
    conn.close()
    print("Base de datos inicializada y cargada con éxito.")

if __name__ == "__main__":
    seed_all()
