import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "pharma_commercial.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Productos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        linea TEXT NOT NULL,
        categoria TEXT NOT NULL,
        forma_farmaceutica TEXT NOT NULL,
        core INTEGER NOT NULL DEFAULT 1,
        molecula TEXT NOT NULL,
        presentacion TEXT NOT NULL,
        clase_terapeutica_atc TEXT,
        precio_base REAL NOT NULL,
        costo_base REAL NOT NULL,
        activo INTEGER DEFAULT 1
    );
    """)

    # 2. Regionales
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS regionales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        responsable TEXT NOT NULL,
        cuota_anual_base REAL DEFAULT 0
    );
    """)

    # 3. Clientes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        canal TEXT NOT NULL,
        regional_id INTEGER NOT NULL,
        tipo_cliente TEXT NOT NULL,
        FOREIGN KEY (regional_id) REFERENCES regionales(id)
    );
    """)

    # 4. Histórico de Ventas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS historico_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        cliente_id INTEGER NOT NULL,
        regional_id INTEGER NOT NULL,
        anio INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio_unitario REAL NOT NULL,
        importe REAL NOT NULL,
        fuente TEXT DEFAULT 'SISTEMA_BASE',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES productos(id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (regional_id) REFERENCES regionales(id)
    );
    """)

    # 5. Gestiones Fiscales y Presupuesto
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gestiones_fiscales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT NOT NULL,
        activa INTEGER DEFAULT 1
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS presupuesto_escenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gestion_id INTEGER NOT NULL,
        tipo_escenario TEXT NOT NULL, -- HISTORICO, REAL, PROYECTADO, OFICIAL, MODIFICADO
        nombre TEXT NOT NULL,
        descripcion TEXT,
        aprobado INTEGER DEFAULT 0,
        FOREIGN KEY (gestion_id) REFERENCES gestiones_fiscales(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS presupuesto_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        escenario_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        regional_id INTEGER NOT NULL,
        mes_fiscal INTEGER NOT NULL, -- 1=Abril ... 12=Marzo
        cantidad REAL NOT NULL,
        precio REAL NOT NULL,
        valorizacion REAL NOT NULL,
        crecimiento_pct REAL DEFAULT 0.0,
        FOREIGN KEY (escenario_id) REFERENCES presupuesto_escenarios(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id),
        FOREIGN KEY (regional_id) REFERENCES regionales(id)
    );
    """)

    # 6. Planificación Orden x Item
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS planificacion_orden_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gestion_id INTEGER NOT NULL,
        cliente_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        mes_fiscal INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        porcentaje_distribucion REAL DEFAULT 0,
        FOREIGN KEY (gestion_id) REFERENCES gestiones_fiscales(id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
    """)

    # 7. Auditoría de Mercado Retail y CUP
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auditoria_mercado_cup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periodo TEXT NOT NULL, -- Ej: '2026-03'
        mercado TEXT NOT NULL,
        clase_terapeutica TEXT NOT NULL,
        molecula TEXT NOT NULL,
        marca TEXT NOT NULL,
        laboratorio TEXT NOT NULL,
        unidades_mercado REAL NOT NULL,
        valores_mercado REAL NOT NULL,
        market_share_unidades REAL NOT NULL,
        market_share_valores REAL NOT NULL,
        indice_evolucion REAL NOT NULL
    );
    """)

    # 8. Gestión de Precios & Impacto
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS historico_cambios_precios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        precio_anterior REAL NOT NULL,
        precio_nuevo REAL NOT NULL,
        fecha_cambio TEXT DEFAULT CURRENT_TIMESTAMP,
        elasticidad REAL DEFAULT -0.5,
        impacto_volumen_pct REAL DEFAULT 0,
        impacto_facturacion REAL DEFAULT 0,
        justificacion TEXT,
        usuario TEXT DEFAULT 'Gerente Comercial',
        FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
    """)

    # 9. Auditoría y Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auditoria_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL,
        modulo TEXT NOT NULL,
        accion TEXT NOT NULL,
        detalles TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 10. Usuarios & Roles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        rol TEXT NOT NULL,
        regional_id INTEGER,
        activo INTEGER DEFAULT 1
    );
    """)

    # 11. Catálogos editables (listas desplegables genéricas)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS catalogos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        valor TEXT NOT NULL,
        descripcion TEXT DEFAULT '',
        orden INTEGER DEFAULT 0,
        activo INTEGER DEFAULT 1,
        UNIQUE(tipo, valor)
    );
    """)

    # 12. Configuración de empresa / sector / etiquetas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
    );
    """)

    # Poblar catálogos la primera vez a partir de los datos existentes
    from crud_config import CATALOG_SOURCES
    if cursor.execute("SELECT COUNT(*) FROM catalogos").fetchone()[0] == 0:
        for tipo, table, col in CATALOG_SOURCES:
            cursor.execute(
                f"INSERT OR IGNORE INTO catalogos (tipo, valor) "
                f"SELECT DISTINCT ?, {col} FROM {table} WHERE {col} IS NOT NULL AND {col} <> ''",
                (tipo,)
            )

    conn.commit()
    conn.close()

def log_audit(usuario: str, modulo: str, accion: str, detalles: dict):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO auditoria_logs (usuario, modulo, accion, detalles) VALUES (?, ?, ?, ?)",
            (usuario, modulo, accion, json.dumps(detalles, ensure_ascii=False))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging audit: {e}")
