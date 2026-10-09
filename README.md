# Sistema ERP Comercial Pharma & Forecasting IA 🚀

Plataforma Empresarial de Planificación Comercial, Presupuesto, Inteligencia de Mercado y Pronósticos con Inteligencia Artificial.

## 📋 Características Principales

- **Gestión Presupuestaria Abr-Mar**: Ciclo fiscal farmacéutico y análisis matricial mensual.
- **Motor de Pronósticos IA & Solver**: Algoritmos estadísticos (Naive, SMA, WMA, Holt-Winters) y optimización de parámetros.
- **Asistente Copilot IA**: Asesor comercial conversacional para análisis de ventas y proyecciones.
- **Analítica Retail / CUP & Regional**: Tableros interactivos por regional (SCZ, LPZ, CBB, CHQ, TJA).
- **Importador / Validador Excel**: Conciliación y procesamiento rápido de datos.

## 🛠️ Stack Tecnológico

- **Frontend**: React + Vite + Vanilla CSS moderno (Glassmorphism & High-Performance UI)
- **Backend**: Python + FastAPI + NumPy / SciPy
- **Base de Datos**: SQLite (desarrollo ágil) / PostgreSQL

## 🚀 Puesta en Marcha

### Backend (Python FastAPI)
```bash
cd backend
python -m venv venv
# Activar entorno virtual:
# En Windows: .\venv\Scripts\activate
# En Linux/Mac: source venv/bin/activate
pip install fastapi uvicorn numpy scipy
python seed_data.py
uvicorn main:app --reload --port 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Acceso web: `http://localhost:5173`
API Docs: `http://localhost:8000/docs`
