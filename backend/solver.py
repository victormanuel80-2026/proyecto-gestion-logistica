import numpy as np
from scipy.optimize import minimize
from typing import Dict, Any, List
from forecasting import calculate_metrics, model_ses, model_holt_linear, model_holt_winters

def optimize_parameters_solver(series: List[float], model_type: str = "holt_linear", target_metric: str = "mape") -> Dict[str, Any]:
    """
    Optimizador Inteligente tipo Excel Solver.
    Busca los valores óptimos de Alpha, Beta y Phi/Gamma que minimizan el error (MAPE o RMSE).
    Restricciones: 0.01 <= param <= 0.99
    """
    arr = np.array(series, dtype=float)
    if len(arr) < 4:
        return {
            "success": False,
            "message": "Se requieren al menos 4 periodos históricos para optimizar con Solver.",
            "alpha": 0.3,
            "beta": 0.1,
            "phi": 0.1,
            "initial_metric": 0.0,
            "optimized_metric": 0.0,
            "improvement_pct": 0.0
        }

    # Initial metric with default parameters
    if model_type == "ses":
        initial_params = [0.30]
        bounds = [(0.01, 0.99)]
        
        def objective(params):
            alpha = params[0]
            fitted, _ = model_ses(arr, alpha=alpha)
            metrics = calculate_metrics(arr, fitted)
            return metrics[target_metric]
            
    elif model_type == "holt_linear":
        initial_params = [0.30, 0.10]
        bounds = [(0.01, 0.99), (0.01, 0.99)]
        
        def objective(params):
            alpha, beta = params
            fitted, _ = model_holt_linear(arr, alpha=alpha, beta=beta)
            metrics = calculate_metrics(arr, fitted)
            return metrics[target_metric]
            
    else:  # holt_winters
        initial_params = [0.30, 0.10, 0.20]
        bounds = [(0.01, 0.99), (0.01, 0.99), (0.01, 0.99)]
        
        def objective(params):
            alpha, beta, gamma = params
            fitted, _ = model_holt_winters(arr, alpha=alpha, beta=beta, gamma=gamma)
            metrics = calculate_metrics(arr, fitted)
            return metrics[target_metric]

    initial_error = objective(initial_params)
    
    # Run optimization (L-BFGS-B or Nelder-Mead with bounds)
    res = minimize(
        objective, 
        initial_params, 
        method='L-BFGS-B', 
        bounds=bounds,
        options={'maxiter': 200, 'ftol': 1e-5}
    )
    
    opt_alpha = round(float(res.x[0]), 4)
    opt_beta = round(float(res.x[1]), 4) if len(res.x) > 1 else None
    opt_phi = round(float(res.x[2]), 4) if len(res.x) > 2 else None
    
    optimized_error = round(float(res.fun), 2)
    improvement = round(max(0.0, initial_error - optimized_error), 2)
    improvement_pct = round((improvement / (initial_error + 1e-6)) * 100.0, 1)

    # Calculate fitted & future series with optimized parameters
    if model_type == "ses":
        fitted, future = model_ses(arr, alpha=opt_alpha, forecast_horizon=12)
    elif model_type == "holt_linear":
        fitted, future = model_holt_linear(arr, alpha=opt_alpha, beta=opt_beta, forecast_horizon=12)
    else:
        fitted, future = model_holt_winters(arr, alpha=opt_alpha, beta=opt_beta, gamma=opt_phi, forecast_horizon=12)

    final_metrics = calculate_metrics(arr, fitted)

    return {
        "success": bool(res.success),
        "iterations": int(res.nit),
        "target_metric": target_metric.upper(),
        "model_type": model_type,
        "alpha": opt_alpha,
        "beta": opt_beta,
        "phi": opt_phi,
        "initial_error": round(float(initial_error), 2),
        "optimized_error": optimized_error,
        "improvement_pct": improvement_pct,
        "fitted": [round(float(x), 2) for x in fitted],
        "forecast_12m": [round(float(x), 2) for x in future],
        "metrics": final_metrics
    }
