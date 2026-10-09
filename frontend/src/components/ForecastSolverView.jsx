import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Cpu, Zap, Activity, CheckCircle, Sliders, Play, RefreshCw, BarChart2, TrendingUp } from 'lucide-react';

export default function ForecastSolverView({ regionalId }) {
  const [productos, setProductos] = useState([]);
  const [selectedProdId, setSelectedProdId] = useState(1);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Solver State
  const [solverModelType, setSolverModelType] = useState('holt_linear');
  const [solverTargetMetric, setSolverTargetMetric] = useState('mape');
  const [solverLoading, setSolverLoading] = useState(false);
  const [solverResult, setSolverResult] = useState(null);

  useEffect(() => {
    api.getProductos().then(res => {
      setProductos(res);
      if (res.length > 0 && !selectedProdId) {
        setSelectedProdId(res[0].id);
      }
    });
  }, []);

  const loadForecast = (prodId) => {
    setLoading(true);
    setSolverResult(null);
    api.getProductForecast(prodId, regionalId || null)
      .then(res => {
        setForecastData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedProdId) {
      loadForecast(selectedProdId);
    }
  }, [selectedProdId, regionalId]);

  const handleRunSolver = async () => {
    setSolverLoading(true);
    try {
      const res = await api.runSolver({
        product_id: selectedProdId,
        regional_id: regionalId || null,
        model_type: solverModelType,
        target_metric: solverTargetMetric
      });
      setSolverResult(res);
    } catch (err) {
      alert("Error al ejecutar Solver IA: " + err.message);
    } finally {
      setSolverLoading(false);
    }
  };

  if (loading && !forecastData) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        ⏳ Ejecutando motor de pronósticos y AutoML...
      </div>
    );
  }

  const bestModel = forecastData?.modelos?.find(m => m.is_best) || forecastData?.modelos?.[0];

  // Dynamic SVG Chart preparation
  const histVals = forecastData?.historico?.valores || [];
  const futureVals = solverResult ? solverResult.forecast_12m : (bestModel?.forecast || []);
  const allChartVals = [...histVals, ...futureVals];
  const maxChartVal = Math.max(...allChartVals, 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Product Selector Header Card */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              Seleccionar Producto para Forecast:
            </span>
            <select 
              className="custom-select" 
              style={{ minWidth: '320px', fontWeight: 600 }}
              value={selectedProdId}
              onChange={e => setSelectedProdId(parseInt(e.target.value))}
            >
              {productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.codigo} - {p.nombre} ({p.linea})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge-tag core" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              ✓ Mejor Modelo AutoML: <strong>{forecastData?.best_model_name}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* SVG Time Series Chart: Historical + Forecast */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Activity size={18} color="var(--accent-cyan)" />
              Serie Histórica (24 Meses) vs. Proyección Forecast (12 Meses Gestión 2026-2027)
            </div>
            <div className="card-subtitle">
              Visualización continua de unidades mensuales: Histórico real (azul oscuro) y Proyección IA (cian brillante)
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, background: '#0284c7', borderRadius: '50%' }}></span> Histórico Real
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, background: '#38bdf8', borderRadius: '50%' }}></span> Proyección IA
            </span>
          </div>
        </div>

        <div className="card-body">
          <div style={{ width: '100%', height: '220px', display: 'flex', alignItems: 'flex-end', gap: '6px', paddingBottom: '30px' }}>
            {/* Historical points */}
            {histVals.map((val, idx) => {
              const h = Math.round((val / maxChartVal) * 180);
              const label = forecastData?.historico?.labels[idx];
              return (
                <div key={`h-${idx}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div 
                    title={`Histórico ${label}: ${val.toLocaleString()} unid`}
                    style={{ 
                      width: '80%', 
                      height: `${h}px`, 
                      background: 'rgba(2, 132, 199, 0.45)', 
                      borderRadius: '3px 3px 0 0',
                      borderTop: '2px solid #38bdf8',
                      transition: 'height 0.3s ease'
                    }} 
                  />
                  {idx % 3 === 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.66rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {label}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Separator Line */}
            <div style={{ width: '2px', height: '100%', background: 'var(--accent-purple)', opacity: 0.6, margin: '0 4px' }} title="Corte Fiscal" />

            {/* Future points */}
            {futureVals.map((val, idx) => {
              const h = Math.round((val / maxChartVal) * 180);
              const label = forecastData?.forecast_labels[idx];
              return (
                <div key={`f-${idx}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div 
                    title={`Forecast IA ${label}: ${val.toLocaleString()} unid`}
                    style={{ 
                      width: '80%', 
                      height: `${h}px`, 
                      background: 'linear-gradient(180deg, #06b6d4, #0284c7)', 
                      borderRadius: '3px 3px 0 0',
                      boxShadow: '0 0 10px rgba(6, 182, 212, 0.3)',
                      transition: 'height 0.3s ease'
                    }} 
                  />
                  {idx % 2 === 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.66rem', color: 'var(--accent-cyan)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Model Benchmark Table + Solver Engine */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Model Evaluation Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cpu size={18} color="var(--accent-cyan)" />
              Comparativa de Modelos de Series Temporales (AutoML)
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Evaluación estadística de precisión
            </span>
          </div>

          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Parámetros</th>
                  <th style={{ textAlign: 'right' }}>MAD</th>
                  <th style={{ textAlign: 'right' }}>RMSE</th>
                  <th style={{ textAlign: 'right' }}>MAPE</th>
                  <th style={{ textAlign: 'right' }}>Precisión</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {forecastData?.modelos?.map((m, idx) => {
                  const paramStr = Object.entries(m.params || {})
                    .filter(([_, v]) => v !== null)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ') || 'N/A';

                  return (
                    <tr key={idx} style={{ background: m.is_best ? 'rgba(6, 182, 212, 0.08)' : 'transparent' }}>
                      <td style={{ fontWeight: m.is_best ? 700 : 500 }}>
                        {m.name}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {paramStr}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.mad.toFixed(1)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.rmse.toFixed(1)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{m.mape}%</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                        {m.precision}%
                      </td>
                      <td>
                        {m.is_best ? (
                          <span className="badge-tag success">★ ÓPTIMO</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Alternativa</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Solver Replacement Engine */}
        <div className="card" style={{ border: '1px solid rgba(139, 92, 246, 0.35)' }}>
          <div className="card-header" style={{ background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15), transparent)' }}>
            <div>
              <div className="card-title" style={{ color: '#c084fc' }}>
                <Zap size={18} />
                Optimizador Inteligente (Reemplazo Solver Excel)
              </div>
              <div className="card-subtitle">
                Calibración matemática autónoma de Alpha (Nivel), Beta (Tendencia) y Phi (Amortiguación)
              </div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Modelo a Optimizar:</label>
                <select 
                  className="custom-select" style={{ width: '100%', marginTop: '4px' }}
                  value={solverModelType} onChange={e => setSolverModelType(e.target.value)}
                >
                  <option value="holt_linear">Holt Lineal (Nivel + Tendencia)</option>
                  <option value="ses">Suavización Exponencial Simple (SES)</option>
                  <option value="holt_winters">Holt-Winters Estacional (12M)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Métrica Objetivo a Minimizar:</label>
                <select 
                  className="custom-select" style={{ width: '100%', marginTop: '4px' }}
                  value={solverTargetMetric} onChange={e => setSolverTargetMetric(e.target.value)}
                >
                  <option value="mape">Minimizar MAPE (%)</option>
                  <option value="rmse">Minimizar RMSE</option>
                  <option value="mad">Minimizar MAD</option>
                </select>
              </div>
            </div>

            <button 
              className="btn btn-solver" 
              onClick={handleRunSolver}
              disabled={solverLoading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {solverLoading ? (
                <>⏳ Iterando convergencia L-BFGS-B...</>
              ) : (
                <><Play size={16} /> Ejecutar Solver IA y Calibrar Parámetros</>
              )}
            </button>

            {/* Solver Optimization Results Display */}
            {solverResult && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#c084fc', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Convergencia Exitosa ({solverResult.iterations} iteraciones)
                  </span>
                  <span className="trend-badge positive">
                    +{solverResult.improvement_pct}% de Mejora en Error
                  </span>
                </div>

                {/* Optimal Parameters Card */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Alpha (Nivel)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {solverResult.alpha}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Beta (Tendencia)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                      {solverResult.beta !== null ? solverResult.beta : 'N/A'}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Phi / Gamma</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                      {solverResult.phi !== null ? solverResult.phi : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Before vs After Error Comparison */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                  <span>Error Inicial ({solverResult.target_metric}): <strong>{solverResult.initial_error}%</strong></span>
                  <span style={{ color: 'var(--accent-emerald)' }}>Error Optimizado: <strong>{solverResult.optimized_error}%</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
