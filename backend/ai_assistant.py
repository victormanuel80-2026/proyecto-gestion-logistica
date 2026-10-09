import json
from database import get_db

def ask_copilot(query: str, filters: dict = None) -> dict:
    """
    Motor Copilot Asistente Comercial IA.
    Interpreta consultas en lenguaje natural, analiza indicadores en la base de datos
    y devuelve diagnósticos, alertas, oportunidades y propuestas de presupuesto.
    """
    q = query.lower()
    conn = get_db()
    cursor = conn.cursor()

    # Intención 1: Productos con problemas o desvíos negativos
    if any(k in q for k in ["problema", "desvío", "bajo", "alerta", "riesgo", "caída", "menos"]):
        cursor.execute("""
            SELECT p.codigo, p.nombre, p.linea, p.core,
                   SUM(pi_oficial.valorizacion) as val_oficial,
                   SUM(pi_real.valorizacion) as val_real,
                   ROUND((SUM(pi_real.valorizacion) / (SUM(pi_oficial.valorizacion) + 1e-6)) * 100, 1) as cumplimiento_pct
            FROM productos p
            JOIN presupuesto_items pi_oficial ON p.id = pi_oficial.producto_id AND pi_oficial.escenario_id = 1
            LEFT JOIN presupuesto_items pi_real ON p.id = pi_real.producto_id AND pi_real.escenario_id = 4 AND pi_real.mes_fiscal <= 6
            WHERE pi_oficial.mes_fiscal <= 6
            GROUP BY p.id
            HAVING cumplimiento_pct < 98.0
            ORDER BY cumplimiento_pct ASC
        """)
        rows = cursor.fetchall()
        items = []
        for r in rows:
            items.append({
                "codigo": r["codigo"],
                "nombre": r["nombre"],
                "linea": r["linea"],
                "es_core": bool(r["core"]),
                "presupuesto_semestral": round(r["val_oficial"], 2),
                "real_semestral": round(r["val_real"], 2) if r["val_real"] else 0,
                "cumplimiento_pct": r["cumplimiento_pct"]
            })

        if len(items) > 0:
            summary = (
                f"He detectado {len(items)} productos con ejecución por debajo de la meta en el primer semestre fiscal. "
                f"El caso más representativo es '{items[0]['nombre']}' ({items[0]['codigo']}) con un cumplimiento de {items[0]['cumplimiento_pct']}%. "
                f"{'Atención: Es un producto estratégico CORE.' if items[0]['es_core'] else ''}"
            )
            recommendation = "Se recomienda coordinar con los KAMs de Santa Cruz y La Paz una campaña de incentivo comercial o revisión de quiebres de inventario."
        else:
            summary = "Excelente noticia: Todos los productos farmacéuticos se encuentran cumpliendo o superando el 98% de la cuota semestral presupuestada para la Gestión activa."
            recommendation = "Mantener el ritmo de abastecimiento para evitar quiebres de stock en el segundo semestre."

        conn.close()
        return {
            "type": "diagnostic",
            "title": "Diagnóstico de Cumplimiento Presupuestario",
            "summary": summary,
            "data": items,
            "recommendation": recommendation
        }

    # Intención 2: Propuesta o Generación de Presupuesto
    elif any(k in q for k in ["propuesta", "generar presupuesto", "meta", "crecimiento", "forecast"]):
        cursor.execute("""
            SELECT p.linea, COUNT(p.id) as total_skus,
                   SUM(hv.importe) as total_historico
            FROM productos p
            JOIN historico_ventas hv ON p.id = hv.producto_id AND hv.anio = 2025
            GROUP BY p.linea
        """)
        lineas = cursor.fetchall()
        propuesta = []
        total_hist = 0
        total_prop = 0
        
        for l in lineas:
            hist_val = l["total_historico"]
            # Apply recommended target growth: 9.5% for ethical/cardio, 7% for others
            growth_rate = 0.095 if "Ética" in l["linea"] or "Cardio" in l["linea"] else 0.075
            prop_val = round(hist_val * (1.0 + growth_rate), 2)
            total_hist += hist_val
            total_prop += prop_val
            
            propuesta.append({
                "linea": l["linea"],
                "skus": l["total_skus"],
                "venta_2025": round(hist_val, 2),
                "crecimiento_sugerido_pct": round(growth_rate * 100, 1),
                "presupuesto_propuesto_2026_2027": prop_val
            })

        summary = (
            f"Propuesta generada para la Gestión 2026-2027 (Abril - Marzo): "
            f"Presupuesto consolidado de Bs. {total_prop:,.2f}, lo cual representa un crecimiento ponderado de "
            f"{round(((total_prop / total_hist) - 1) * 100, 2)}% sobre el histórico 2025. "
            f"Se prioriza la Línea Cardiometabólica y Línea Ética por su alto margen y estabilidad."
        )
        conn.close()
        return {
            "type": "proposal",
            "title": "Propuesta Inteligente de Presupuesto Gestión 2026-2027",
            "summary": summary,
            "data": propuesta,
            "recommendation": "Puedes aplicar esta distribución directamente en el módulo 'Presupuesto Gestión Fiscal' como Escenario Modificado o Nuevo Oficial."
        }

    # Intención 3: Oportunidades de Mercado y Retail CUP
    elif any(k in q for k in ["mercado", "cup", "retail", "share", "oportunidad", "competencia"]):
        cursor.execute("""
            SELECT mercado, clase_terapeutica, molecula, marca, laboratorio,
                   market_share_valores, indice_evolucion
            FROM auditoria_mercado_cup
            ORDER BY indice_evolucion DESC
        """)
        rows = cursor.fetchall()
        items = [dict(r) for r in rows]
        top = items[0]
        summary = (
            f"En la auditoría de mercado Retail/CUP, tu producto con mayor dinamismo es '{top['marca']}' "
            f"con un Índice de Evolución (IE) de {top['indice_evolucion']} y {top['market_share_valores']}% de Market Share. "
            f"Un IE superior a 100 indica que la marca está ganando terreno frente a la competencia del segmento."
        )
        conn.close()
        return {
            "type": "market_insight",
            "title": "Oportunidades de Crecimiento en Mercado Farmacéutico",
            "summary": summary,
            "data": items,
            "recommendation": "Capitalizar el liderazgo en el segmento de antibióticos y analgésicos mediante acuerdos de visibilidad en cadenas farmacéuticas."
        }

    # Intención 4: Resumen Ejecutivo General
    else:
        cursor.execute("SELECT SUM(importe) FROM historico_ventas WHERE anio = 2025")
        venta_anual = cursor.fetchone()[0] or 0
        cursor.execute("SELECT COUNT(*) FROM productos WHERE core = 1")
        core_count = cursor.fetchone()[0] or 0
        cursor.execute("SELECT COUNT(*) FROM clientes")
        cli_count = cursor.fetchone()[0] or 0

        summary = (
            f"El sistema cuenta actualmente con 12 productos activos ({core_count} estratégicos CORE), "
            f"{cli_count} clientes corporativos en 5 regionales y una facturación base anual de Bs. {venta_anual:,.2f}. "
            f"La gestión activa es 2026-2027 con ciclo fiscal Abril a Marzo. "
            f"¿Deseas analizar desvíos presupuestarios, optimizar parámetros de pronóstico con Solver o simular precios?"
        )
        conn.close()
        return {
            "type": "overview",
            "title": "Resumen Comercial Ejecutivo",
            "summary": summary,
            "data": [
                {"indicador": "Facturación Anual Histórica", "valor": f"Bs. {venta_anual:,.2f}"},
                {"indicador": "Productos CORE Estratégicos", "valor": f"{core_count} SKUs"},
                {"indicador": "Ciclo Presupuestario", "valor": "Abril 2026 - Marzo 2027"},
                {"indicador": "Regionales Operativas", "valor": "5 Departamentos"}
            ],
            "recommendation": "Selecciona una de las preguntas sugeridas o escribe tu consulta sobre cualquier producto o regional."
        }
