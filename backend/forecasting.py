import numpy as np
from typing import List, Dict, Any, Tuple

def calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
    """
    Calcula MAD, RMSE, MAPE y Precisión (%) entre series de valores reales y predichos.
    """
    mask = actual > 0
    if not np.any(mask):
        return {"mad": 0.0, "rmse": 0.0, "mape": 0.0, "precision": 100.0}
    
    act = actual[mask]
    pred = predicted[mask]
    
    errors = act - pred
    abs_errors = np.abs(errors)
    
    mad = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    
    pct_errors = np.abs(errors / act) * 100.0
    mape = float(np.mean(pct_errors))
    # Cap MAPE to reasonable bounds for display
    mape = min(mape, 100.0)
    precision = max(0.0, round(100.0 - mape, 2))
    
    return {
        "mad": round(mad, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "precision": precision
    }

def model_naive(series: np.ndarray, forecast_horizon: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """Modelo Naive: último valor observado proyectado."""
    n = len(series)
    fitted = np.zeros(n)
    fitted[0] = series[0]
    fitted[1:] = series[:-1]
    
    future = np.full(forecast_horizon, series[-1])
    return fitted, future

def model_sma(series: np.ndarray, window: int = 3, forecast_horizon: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """Promedio Móvil Simple (SMA)."""
    n = len(series)
    fitted = np.zeros(n)
    for t in range(n):
        if t < window:
            fitted[t] = np.mean(series[:t+1])
        else:
            fitted[t] = np.mean(series[t-window:t])
            
    last_window_val = np.mean(series[-window:])
    future = np.full(forecast_horizon, last_window_val)
    return fitted, future

def model_wma(series: np.ndarray, window: int = 3, forecast_horizon: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """Promedio Móvil Ponderado (WMA)."""
    n = len(series)
    weights = np.arange(1, window + 1)
    w_sum = weights.sum()
    fitted = np.zeros(n)
    
    for t in range(n):
        if t < window:
            fitted[t] = series[t]
        else:
            chunk = series[t-window:t]
            fitted[t] = np.sum(chunk * weights) / w_sum
            
    chunk_last = series[-window:]
    last_wma = np.sum(chunk_last * weights) / w_sum
    future = np.full(forecast_horizon, last_wma)
    return fitted, future

def model_ses(series: np.ndarray, alpha: float = 0.3, forecast_horizon: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """Suavización Exponencial Simple (SES)."""
    n = len(series)
    fitted = np.zeros(n)
    level = series[0]
    fitted[0] = level
    
    for t in range(1, n):
        fitted[t] = level
        level = alpha * series[t] + (1 - alpha) * level
        
    future = np.full(forecast_horizon, level)
    return fitted, future

def model_holt_linear(series: np.ndarray, alpha: float = 0.3, beta: float = 0.1, forecast_horizon: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """Modelo Holt Lineal (Nivel + Tendencia)."""
    n = len(series)
    fitted = np.zeros(n)
    
    level = series[0]
    trend = series[1] - series[0] if n > 1 else 0.0
    fitted[0] = level
    
    for t in range(1, n):
        fitted[t] = level + trend
        prev_level = level
        level = alpha * series[t] + (1 - alpha) * (prev_level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
        
    future = np.zeros(forecast_horizon)
    for m in range(1, forecast_horizon + 1):
        future[m - 1] = max(0.0, level + m * trend)
        
    return fitted, future

def model_holt_winters(series: np.ndarray, alpha: float = 0.3, beta: float = 0.1, gamma: float = 0.2, 
                       seasonal_periods: int = 12, mode: str = "additive", forecast_horizon: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """
    Modelo Holt-Winters (Nivel + Tendencia + Estacionalidad de 12 meses).
    """
    n = len(series)
    if n < seasonal_periods * 2:
        # Si no hay 2 años completos, usar Holt lineal con factor estacional empírico
        return model_holt_linear(series, alpha, beta, forecast_horizon)
        
    fitted = np.zeros(n)
    seasonals = np.ones(seasonal_periods)
    
    # Inicialización estacional
    if mode == "multiplicative":
        for i in range(seasonal_periods):
            vals = [series[i + j * seasonal_periods] for j in range(n // seasonal_periods)]
            seasonals[i] = np.mean(vals) / (np.mean(series) + 1e-6)
    else:
        for i in range(seasonal_periods):
            vals = [series[i + j * seasonal_periods] for j in range(n // seasonal_periods)]
            seasonals[i] = np.mean(vals) - np.mean(series)

    level = np.mean(series[:seasonal_periods])
    trend = (np.mean(series[seasonal_periods:2*seasonal_periods]) - np.mean(series[:seasonal_periods])) / seasonal_periods
    
    for t in range(n):
        s_idx = t % seasonal_periods
        if mode == "multiplicative":
            fitted[t] = (level + trend) * seasonals[s_idx]
            prev_level = level
            level = alpha * (series[t] / (seasonals[s_idx] + 1e-6)) + (1 - alpha) * (prev_level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
            seasonals[s_idx] = gamma * (series[t] / (level + 1e-6)) + (1 - gamma) * seasonals[s_idx]
        else:
            fitted[t] = level + trend + seasonals[s_idx]
            prev_level = level
            level = alpha * (series[t] - seasonals[s_idx]) + (1 - alpha) * (prev_level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
            seasonals[s_idx] = gamma * (series[t] - level) + (1 - gamma) * seasonals[s_idx]

    future = np.zeros(forecast_horizon)
    for m in range(1, forecast_horizon + 1):
        s_idx = (n + m - 1) % seasonal_periods
        if mode == "multiplicative":
            val = (level + m * trend) * seasonals[s_idx]
        else:
            val = level + m * trend + seasonals[s_idx]
        future[m - 1] = max(0.0, round(val, 2))
        
    return fitted, future

def run_all_models_and_select_best(series: List[float], forecast_horizon: int = 12) -> Dict[str, Any]:
    """
    Ejecuta todos los modelos de pronóstico, calcula MAD, RMSE, MAPE y selecciona automáticamente
    el modelo con menor MAPE (AutoML Time Series).
    """
    arr = np.array(series, dtype=float)
    if len(arr) == 0:
        return {"models": [], "best_model": None}
        
    models_definitions = [
        ("Naive (Último Valor)", lambda: model_naive(arr, forecast_horizon), {"alpha": None, "beta": None, "phi": None}),
        ("Promedio Móvil 3M (SMA 3)", lambda: model_sma(arr, 3, forecast_horizon), {"alpha": None, "beta": None, "phi": None}),
        ("Promedio Móvil 6M (SMA 6)", lambda: model_sma(arr, 6, forecast_horizon), {"alpha": None, "beta": None, "phi": None}),
        ("Promedio Ponderado (WMA)", lambda: model_wma(arr, 3, forecast_horizon), {"alpha": None, "beta": None, "phi": None}),
        ("Suavización Exponencial Simple (SES)", lambda: model_ses(arr, 0.35, forecast_horizon), {"alpha": 0.35, "beta": None, "phi": None}),
        ("Holt Lineal (Tendencia)", lambda: model_holt_linear(arr, 0.38, 0.15, forecast_horizon), {"alpha": 0.38, "beta": 0.15, "phi": None}),
        ("Holt-Winters Aditivo", lambda: model_holt_winters(arr, 0.30, 0.10, 0.20, 12, "additive", forecast_horizon), {"alpha": 0.30, "beta": 0.10, "phi": 0.20}),
        ("Holt-Winters Multiplicativo", lambda: model_holt_winters(arr, 0.32, 0.12, 0.18, 12, "multiplicative", forecast_horizon), {"alpha": 0.32, "beta": 0.12, "phi": 0.18}),
    ]
    
    evaluated_models = []
    best_model = None
    min_mape = float("inf")
    
    for name, run_fn, params in models_definitions:
        fitted, future = run_fn()
        metrics = calculate_metrics(arr, fitted)
        
        is_best = False
        if metrics["mape"] < min_mape and metrics["mape"] > 0:
            min_mape = metrics["mape"]
            best_model = name
            
        evaluated_models.append({
            "name": name,
            "params": params,
            "fitted": [round(float(x), 2) for x in fitted],
            "forecast": [round(float(x), 2) for x in future],
            "mad": metrics["mad"],
            "rmse": metrics["rmse"],
            "mape": metrics["mape"],
            "precision": metrics["precision"],
            "is_best": False
        })
        
    # Mark the best model
    for m in evaluated_models:
        if m["name"] == best_model:
            m["is_best"] = True
            
    if best_model is None and len(evaluated_models) > 0:
        evaluated_models[0]["is_best"] = True
        best_model = evaluated_models[0]["name"]
        
    return {
        "best_model_name": best_model,
        "models": evaluated_models
    }
