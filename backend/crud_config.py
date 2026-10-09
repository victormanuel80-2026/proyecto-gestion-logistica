"""
Configuración declarativa de entidades para el motor CRUD genérico.
Cada entidad define: tabla, campos (tipo, validación, formato), relaciones (fk),
dependencias (para borrado en cascada) y columnas virtuales calculadas.

Tipos de campo soportados:
  text, textarea, int, number, money, percent, bool, date,
  select (opciones fijas), fk (relación a otra entidad), catalog (lista editable + texto libre)
"""


def F(name, label, type="text", **kw):
    d = {"name": name, "label": label, "type": type}
    d.update(kw)
    return d


MESES = [{"value": i + 1, "label": n} for i, n in enumerate(
    ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
     "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"])]

MESES_FISCALES = [{"value": i + 1, "label": f"M{i + 1:02d} · {n}"} for i, n in enumerate(
    ["Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre",
     "Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"])]

TIPOS_ESCENARIO = [{"value": v, "label": v.capitalize()} for v in
                   ["OFICIAL", "PROYECTADO", "MODIFICADO", "REAL", "HISTORICO"]]

ROLES = [{"value": v, "label": l} for v, l in [
    ("ADMIN", "Administrador"), ("GERENTE_COMERCIAL", "Gerente Comercial"),
    ("PLANIFICADOR_DEMANDA", "Planificador de Demanda"), ("KAM_REGIONAL", "KAM Regional"),
    ("AUDITOR", "Auditor"), ("CONSULTA", "Solo consulta")]]

CATALOG_TYPES = [{"value": v, "label": l} for v, l in [
    ("linea", "Líneas de negocio"), ("categoria", "Categorías"), ("formato", "Formatos / Tipos"),
    ("canal", "Canales de venta"), ("tipo_cliente", "Tipos de cliente"), ("mercado", "Mercados / Segmentos")]]

# Fuentes para poblar los catálogos la primera vez a partir de los datos existentes
CATALOG_SOURCES = [
    ("linea", "productos", "linea"),
    ("categoria", "productos", "categoria"),
    ("formato", "productos", "forma_farmaceutica"),
    ("canal", "clientes", "canal"),
    ("tipo_cliente", "clientes", "tipo_cliente"),
    ("mercado", "auditoria_mercado_cup", "mercado"),
]

CONFIG_DEFAULTS = {
    "empresa_nombre": "Mi Empresa S.A.",
    "empresa_slogan": "Commercial Intelligence & IA",
    "sector": "Farmacéutico",
    "moneda": "Bs.",
    "label_formato": "Forma farmacéutica / Formato",
    "label_atributo": "Molécula / Atributo principal",
    "label_clasificacion": "Clase ATC / Clasificación",
    "label_core": "CORE (Estratégico)",
}

ENTITIES = {
    # ---------------------------------------------------------------- MAESTROS
    "productos": {
        "table": "productos", "label": "Productos / Artículos", "group": "Maestros",
        "description": "Catálogo de productos, servicios o artículos comercializados.",
        "display_sql": "{a}.codigo || ' - ' || {a}.nombre",
        "search": ["codigo", "nombre", "molecula", "categoria", "linea", "presentacion"],
        "order": "t.core DESC, t.codigo ASC",
        "fields": [
            F("codigo", "Código / SKU", required=True, unique=True, format="code"),
            F("nombre", "Nombre", required=True),
            F("linea", "Línea de negocio", "catalog", catalog="linea", required=True),
            F("categoria", "Categoría", "catalog", catalog="categoria", required=True),
            F("forma_farmaceutica", "Formato", "catalog", catalog="formato", label_key="label_formato"),
            F("molecula", "Atributo principal", label_key="label_atributo"),
            F("presentacion", "Presentación / Unidad"),
            F("clase_terapeutica_atc", "Clasificación", label_key="label_clasificacion", list=False),
            F("core", "Estratégico", "bool", label_key="label_core", default=0),
            F("precio_base", "Precio base", "money", required=True, min=0),
            F("costo_base", "Costo base", "money", required=True, min=0),
            F("activo", "Activo", "bool", default=1),
        ],
        "virtual": [{"name": "margen_pct", "label": "Margen %", "format": "percent",
                     "sql": "ROUND((t.precio_base - t.costo_base) * 100.0 / NULLIF(t.precio_base, 0), 1)"}],
        "dependents": [("historico_ventas", "producto_id"), ("presupuesto_items", "producto_id"),
                       ("planificacion_orden_item", "producto_id"), ("historico_cambios_precios", "producto_id")],
    },
    "regionales": {
        "table": "regionales", "label": "Regionales / Territorios", "group": "Maestros",
        "description": "Zonas geográficas o territorios comerciales.",
        "display_sql": "{a}.nombre", "search": ["codigo", "nombre", "responsable"],
        "order": "t.id ASC",
        "fields": [
            F("codigo", "Código", required=True, unique=True, format="code"),
            F("nombre", "Nombre", required=True),
            F("responsable", "Responsable", required=True),
            F("cuota_anual_base", "Cuota anual", "money", default=0, min=0),
        ],
        "dependents": [("clientes", "regional_id"), ("historico_ventas", "regional_id"),
                       ("presupuesto_items", "regional_id"), ("usuarios", "regional_id", "set_null")],
    },
    "clientes": {
        "table": "clientes", "label": "Clientes", "group": "Maestros",
        "description": "Cartera de clientes con canal, tipo y territorio asignado.",
        "display_sql": "{a}.nombre", "search": ["codigo", "nombre", "canal", "tipo_cliente"],
        "order": "t.id ASC",
        "fields": [
            F("codigo", "Código", required=True, unique=True, format="code"),
            F("nombre", "Nombre / Razón social", required=True),
            F("canal", "Canal", "catalog", catalog="canal", required=True),
            F("regional_id", "Regional", "fk", ref="regionales", required=True),
            F("tipo_cliente", "Tipo de cliente", "catalog", catalog="tipo_cliente", required=True),
        ],
        "dependents": [("historico_ventas", "cliente_id"), ("planificacion_orden_item", "cliente_id")],
    },
    "catalogos": {
        "table": "catalogos", "label": "Listas / Catálogos", "group": "Maestros",
        "description": "Valores de listas desplegables (líneas, categorías, canales…).",
        "display_sql": "{a}.valor", "search": ["tipo", "valor", "descripcion"],
        "order": "t.tipo ASC, t.orden ASC, t.valor ASC",
        "fields": [
            F("tipo", "Tipo de lista", "select", options=CATALOG_TYPES, required=True),
            F("valor", "Valor", required=True),
            F("descripcion", "Descripción"),
            F("orden", "Orden", "int", default=0),
            F("activo", "Activo", "bool", default=1),
        ],
    },
    # ---------------------------------------------------------- TRANSACCIONES
    "historico_ventas": {
        "table": "historico_ventas", "label": "Histórico de Ventas", "group": "Transacciones",
        "description": "Ventas reales por producto, cliente, regional y periodo.",
        "display_sql": "'#' || {a}.id", "search": ["fuente", "anio"],
        "order": "t.anio DESC, t.mes DESC, t.id DESC",
        "fields": [
            F("anio", "Año", "int", required=True, min=1990, max=2100),
            F("mes", "Mes", "select", options=MESES, int=True, required=True),
            F("producto_id", "Producto", "fk", ref="productos", required=True),
            F("cliente_id", "Cliente", "fk", ref="clientes", required=True),
            F("regional_id", "Regional", "fk", ref="regionales", required=True),
            F("cantidad", "Cantidad", "number", required=True),
            F("precio_unitario", "Precio unitario", "money", required=True, min=0),
            F("importe", "Importe", "money", computed=["cantidad", "precio_unitario"]),
            F("fuente", "Fuente", default="MANUAL"),
        ],
    },
    "presupuesto_items": {
        "table": "presupuesto_items", "label": "Ítems de Presupuesto", "group": "Planificación",
        "description": "Detalle mensual del presupuesto por escenario, producto y regional.",
        "display_sql": "'#' || {a}.id", "search": [],
        "order": "t.escenario_id ASC, t.mes_fiscal ASC, t.id ASC",
        "fields": [
            F("escenario_id", "Escenario", "fk", ref="presupuesto_escenarios", required=True),
            F("producto_id", "Producto", "fk", ref="productos", required=True),
            F("regional_id", "Regional", "fk", ref="regionales", required=True),
            F("mes_fiscal", "Mes fiscal", "select", options=MESES_FISCALES, int=True, required=True),
            F("cantidad", "Cantidad", "number", required=True),
            F("precio", "Precio", "money", required=True, min=0),
            F("valorizacion", "Valorización", "money", computed=["cantidad", "precio"]),
            F("crecimiento_pct", "Crecimiento %", "percent", default=0),
        ],
    },
    "planificacion_orden_item": {
        "table": "planificacion_orden_item", "label": "Planificación Orden × Ítem", "group": "Planificación",
        "description": "Cuotas mensuales por cliente y producto.",
        "display_sql": "'#' || {a}.id", "search": [],
        "order": "t.cliente_id ASC, t.producto_id ASC, t.mes_fiscal ASC",
        "fields": [
            F("gestion_id", "Gestión", "fk", ref="gestiones_fiscales", required=True),
            F("cliente_id", "Cliente", "fk", ref="clientes", required=True),
            F("producto_id", "Producto", "fk", ref="productos", required=True),
            F("mes_fiscal", "Mes fiscal", "select", options=MESES_FISCALES, int=True, required=True),
            F("cantidad", "Cantidad", "number", required=True),
            F("porcentaje_distribucion", "% Distribución", "percent", readonly=True),
        ],
    },
    "gestiones_fiscales": {
        "table": "gestiones_fiscales", "label": "Gestiones / Periodos Fiscales", "group": "Planificación",
        "description": "Ciclos presupuestarios (por defecto Abril – Marzo).",
        "display_sql": "{a}.nombre", "search": ["nombre"], "order": "t.id DESC",
        "fields": [
            F("nombre", "Nombre", required=True),
            F("fecha_inicio", "Fecha inicio", "date", required=True),
            F("fecha_fin", "Fecha fin", "date", required=True),
            F("activa", "Activa", "bool", default=1),
        ],
        "dependents": [("presupuesto_escenarios", "gestion_id"), ("planificacion_orden_item", "gestion_id")],
    },
    "presupuesto_escenarios": {
        "table": "presupuesto_escenarios", "label": "Escenarios de Presupuesto", "group": "Planificación",
        "description": "Versiones del presupuesto: oficial, proyectado, modificado, real, histórico.",
        "display_sql": "{a}.nombre || ' (' || {a}.tipo_escenario || ')'",
        "search": ["nombre", "tipo_escenario", "descripcion"], "order": "t.id ASC",
        "fields": [
            F("gestion_id", "Gestión", "fk", ref="gestiones_fiscales", required=True),
            F("tipo_escenario", "Tipo", "select", options=TIPOS_ESCENARIO, required=True),
            F("nombre", "Nombre", required=True),
            F("descripcion", "Descripción", "textarea"),
            F("aprobado", "Aprobado", "bool", default=0),
        ],
        "dependents": [("presupuesto_items", "escenario_id")],
    },
    "historico_cambios_precios": {
        "table": "historico_cambios_precios", "label": "Histórico de Precios", "group": "Transacciones",
        "description": "Bitácora de cambios de precio e impacto estimado.",
        "display_sql": "'#' || {a}.id", "search": ["justificacion", "usuario"], "order": "t.id DESC",
        "fields": [
            F("producto_id", "Producto", "fk", ref="productos", required=True),
            F("precio_anterior", "Precio anterior", "money", required=True),
            F("precio_nuevo", "Precio nuevo", "money", required=True),
            F("fecha_cambio", "Fecha", "date"),
            F("elasticidad", "Elasticidad", "number", default=-0.5),
            F("impacto_volumen_pct", "Impacto volumen %", "percent", default=0),
            F("impacto_facturacion", "Impacto facturación", "money", default=0),
            F("justificacion", "Justificación", "textarea"),
            F("usuario", "Usuario", default="Admin"),
        ],
    },
    # ---------------------------------------------------------------- MERCADO
    "auditoria_mercado_cup": {
        "table": "auditoria_mercado_cup", "label": "Inteligencia de Mercado", "group": "Mercado",
        "description": "Auditoría de mercado: participación, competidores e índice de evolución.",
        "display_sql": "{a}.marca", "search": ["periodo", "mercado", "clase_terapeutica", "molecula", "marca", "laboratorio"],
        "order": "t.market_share_valores DESC",
        "fields": [
            F("periodo", "Periodo (AAAA-MM)", required=True),
            F("mercado", "Mercado", "catalog", catalog="mercado", required=True),
            F("clase_terapeutica", "Clase / Segmento", required=True),
            F("molecula", "Componente / Atributo", required=True),
            F("marca", "Marca / Producto", required=True),
            F("laboratorio", "Fabricante / Competidor", required=True),
            F("unidades_mercado", "Unidades", "number", required=True),
            F("valores_mercado", "Valores", "money", required=True),
            F("market_share_unidades", "Share unid. %", "percent", required=True),
            F("market_share_valores", "Share valores %", "percent", required=True),
            F("indice_evolucion", "Índice evolución", "number", format="index", required=True),
        ],
    },
    # -------------------------------------------------------------- SEGURIDAD
    "usuarios": {
        "table": "usuarios", "label": "Usuarios", "group": "Seguridad",
        "description": "Usuarios del sistema, roles y regional asignada.",
        "display_sql": "{a}.nombre", "search": ["nombre", "email", "rol"], "order": "t.id ASC",
        "fields": [
            F("nombre", "Nombre", required=True),
            F("email", "Email", required=True, unique=True),
            F("rol", "Rol", "select", options=ROLES, required=True),
            F("regional_id", "Regional", "fk", ref="regionales"),
            F("activo", "Activo", "bool", default=1),
        ],
    },
}
