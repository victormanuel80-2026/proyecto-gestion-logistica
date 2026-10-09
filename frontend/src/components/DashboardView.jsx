import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { DollarSign, TrendingUp, CheckCircle, Target, Award, ArrowUpRight, BarChart2 } from 'lucide-react';

export default function DashboardView({ regionalId, linea }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDashboardSummary(1, regionalId, linea)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [regionalId, linea]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>⏳ Cargando indicadores ejecutivos y series fiscales...</div>
      </div>
    );
  }

  if (!data) return <div>Error al cargar datos del Dashboard.</div>;

  const { kpis, serie_mensual_fiscal, desempeno_regionales, top_productos } = data;

  // Chart max value for scaling SVG bars
  const maxVal = Math.max(
    ...serie_mensual_fiscal.map(d => Math.max(d.oficial, d.forecast, d.real || 0)),
    1000
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Presupuesto Oficial (Abr-Mar)</span>
            <div className="kpi-icon-wrap"><DollarSign size={20} /></div>
          </div>
          <div className="kpi-value">Bs. {kpis.total_presupuesto_oficial?.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtext">
            <span>Meta anual: {kpis.total_unidades_presupuesto?.toLocaleString()} unidades</span>
          </div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-header">
            <span className="kpi-label">Venta Real Ejecutada (M01-M06)</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-emerald)' }}><CheckCircle size={20} /></div>
          </div>
          <div className="kpi-value">Bs. {kpis.total_real_ejecutado?.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtext">
            <span className="trend-badge positive">
              <ArrowUpRight size={14} /> {kpis.cumplimiento_pct}% Cumplimiento
            </span>
            <span>Corte Septiembre 2026</span>
          </div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-header">
            <span className="kpi-label">Forecast Proyectado IA</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-purple)' }}><Target size={20} /></div>
          </div>
          <div className="kpi-value">Bs. {kpis.total_forecast?.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtext">
            <span>Modelo Holt-Winters optimizado</span>
          </div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-header">
            <span className="kpi-label">Crecimiento Proyectado YoY</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-amber)' }}><TrendingUp size={20} /></div>
          </div>
          <div className="kpi-value">+{kpis.crecimiento_anual_pct}%</div>
          <div className="kpi-subtext">
            <span>Vs. Facturación Gestión 2025</span>
          </div>
        </div>
      </div>

      {/* Main Fiscal Chart: 12 Months Comparison */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <BarChart2 size={18} color="var(--accent-cyan)" />
              Comparativa Gestión Fiscal (Abril - Marzo): Presupuesto vs. Real vs. Forecast
            </div>
            <div className="card-subtitle">
              Ciclo presupuestario farmacéutico de 12 periodos con seguimiento mensual de valorización en Bs.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 12, height: 12, background: '#0284c7', borderRadius: 2 }}></span> Presupuesto Oficial
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }}></span> Real Ejecutado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 12, height: 12, background: '#8b5cf6', borderRadius: 2 }}></span> Forecast IA
            </span>
          </div>
        </div>

        <div className="card-body">
          {/* Dynamic SVG Visualizer */}
          <div style={{ width: '100%', height: '240px', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingBottom: '30px', position: 'relative' }}>
            {serie_mensual_fiscal.map((m, idx) => {
              const hOficial = Math.round((m.oficial / maxVal) * 190);
              const hForecast = Math.round((m.forecast / maxVal) * 190);
              const hReal = m.real ? Math.round((m.real / maxVal) * 190) : 0;

              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  {/* Bars group */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center' }}>
                    {/* Oficial */}
                    <div 
                      title={`Presupuesto Oficial ${m.mes_nombre}: Bs. ${m.oficial.toLocaleString()}`}
                      style={{ 
                        width: '28%', 
                        height: `${hOficial}px`, 
                        background: 'linear-gradient(180deg, #38bdf8, #0284c7)', 
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.4s ease'
                      }} 
                    />
                    {/* Real */}
                    {m.real !== null ? (
                      <div 
                        title={`Real Ejecutado ${m.mes_nombre}: Bs. ${m.real.toLocaleString()}`}
                        style={{ 
                          width: '28%', 
                          height: `${hReal}px`, 
                          background: 'linear-gradient(180deg, #34d399, #059669)', 
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.4s ease'
                        }} 
                      />
                    ) : (
                      <div style={{ width: '28%', height: '4px', background: 'rgba(255,255,255,0.05)' }} title="Periodo futuro sin cierre real" />
                    )}
                    {/* Forecast */}
                    <div 
                      title={`Forecast IA ${m.mes_nombre}: Bs. ${m.forecast.toLocaleString()}`}
                      style={{ 
                        width: '28%', 
                        height: `${hForecast}px`, 
                        background: 'linear-gradient(180deg, #a78bfa, #7c3aed)', 
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.4s ease'
                      }} 
                    />
                  </div>
                  {/* Label */}
                  <div style={{ marginTop: '10px', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {m.mes_nombre}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two Columns: Regional Performance + Top Products */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px' }}>
        {/* Regional Execution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Award size={18} color="var(--accent-emerald)" />
              Cumplimiento por Regional (Corte M01 a M06)
            </div>
            <div className="card-subtitle">Desempeño territorial frente a cuota semestral</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {desempeno_regionales.map(reg => {
              const pct = reg.cumplimiento_pct;
              const isOver = pct >= 100;
              return (
                <div key={reg.regional_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span>{reg.regional}</span>
                    <span style={{ color: isOver ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {pct}% ({`Bs. ${reg.real_semestral.toLocaleString()} / Bs. ${reg.meta_semestral.toLocaleString()}`})
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`,
                      height: '100%',
                      background: isOver ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top CORE Products */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Target size={18} color="var(--accent-purple)" />
              Top Productos Estratégicos en Presupuesto
            </div>
            <div className="card-subtitle">SKUs con mayor valorización en la gestión activa</div>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Línea</th>
                  <th style={{ textAlign: 'right' }}>Unidades</th>
                  <th style={{ textAlign: 'right' }}>Valorización</th>
                </tr>
              </thead>
              <tbody>
                {top_productos.map(p => (
                  <tr key={p.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.codigo}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                    </td>
                    <td><span className="badge-tag secondary">{p.linea}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p.unidades.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Bs. {p.valorizacion.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
