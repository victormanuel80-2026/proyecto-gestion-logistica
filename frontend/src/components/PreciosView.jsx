import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { DollarSign, TrendingUp, Sliders, History, AlertCircle, CheckCircle, Calculator } from 'lucide-react';

export default function PreciosView() {
  const [productos, setProductos] = useState([]);
  const [selectedProdId, setSelectedProdId] = useState(1);
  const [selectedProd, setSelectedProd] = useState(null);
  const [newPrice, setNewPrice] = useState(0);
  const [elasticity, setElasticity] = useState(-0.5);
  const [justification, setJustification] = useState('Ajuste anual por inflación y costos');
  const [historial, setHistorial] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProductos().then(prods => {
      setProductos(prods);
      if (prods.length > 0) {
        setSelectedProdId(prods[0].id);
        setSelectedProd(prods[0]);
        setNewPrice(prods[0].precio_base);
      }
    });
  }, []);

  const loadHistorial = (prodId) => {
    api.getHistorialPrecios(prodId).then(setHistorial);
  };

  useEffect(() => {
    if (selectedProdId) {
      const p = productos.find(x => x.id === selectedProdId);
      if (p) {
        setSelectedProd(p);
        setNewPrice(p.precio_base);
        loadHistorial(selectedProdId);
      }
    }
  }, [selectedProdId, productos]);

  // Dynamic simulation calculations
  const precioActual = selectedProd ? selectedProd.precio_base : 1;
  const pctCambioPrecio = precioActual > 0 ? ((newPrice - precioActual) / precioActual) * 100 : 0;
  const deltaVolumenPct = elasticity * pctCambioPrecio;
  
  // Base volume estimated from catalog
  const baseVolumen = 12000;
  const nuevoVolumen = Math.round(baseVolumen * (1 + deltaVolumenPct / 100));
  const facturacionActual = baseVolumen * precioActual;
  const facturacionNueva = nuevoVolumen * newPrice;
  const impactoFacturacion = facturacionNueva - facturacionActual;

  const handleApplyPriceChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.simularPrecio({
        product_id: selectedProdId,
        new_price: parseFloat(newPrice),
        elasticity: parseFloat(elasticity),
        justification: justification,
        user: "Gerente Comercial"
      });
      setSimulationResult(res);
      // Reload products & history
      api.getProductos().then(setProductos);
      loadHistorial(selectedProdId);
      alert("✓ Cambio de precio y análisis de impacto económico registrados exitosamente.");
    } catch (err) {
      alert("Error al aplicar cambio de precio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Product Selector */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Seleccionar Producto Farmacéutico:
          </span>
          <select 
            className="custom-select" 
            style={{ minWidth: '320px', fontWeight: 600 }}
            value={selectedProdId}
            onChange={e => setSelectedProdId(parseInt(e.target.value))}
          >
            {productos.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo} - {p.nombre} (Precio Actual: Bs. {p.precio_base.toFixed(2)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Two Column Layout: Interactive Simulator + Historical Changes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Dynamic Simulator Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Calculator size={18} color="var(--accent-cyan)" />
                Simulador Dinámico de Precios y Elasticidad Económica
              </div>
              <div className="card-subtitle">
                Evalúa el impacto en volumen y facturación anual antes de aplicar el nuevo precio
              </div>
            </div>
          </div>

          <form onSubmit={handleApplyPriceChange}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Precio Actual Base:</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                    Bs. {precioActual.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    Costo Base: Bs. {selectedProd?.costo_base.toFixed(2)}
                  </div>
                </div>

                <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>Nuevo Precio Propuesto:</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Bs. {parseFloat(newPrice || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: pctCambioPrecio >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    Variación: {pctCambioPrecio > 0 ? `+${pctCambioPrecio.toFixed(1)}%` : `${pctCambioPrecio.toFixed(1)}%`}
                  </div>
                </div>
              </div>

              {/* Slider for Interactive Adjustment */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Ajustar Nuevo Precio con Slider:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    Bs. {parseFloat(newPrice || 0).toFixed(2)}
                  </span>
                </label>
                <input 
                  type="range" 
                  min={Math.max(1, precioActual * 0.6)} 
                  max={precioActual * 1.5} 
                  step="0.5" 
                  value={newPrice}
                  onChange={e => setNewPrice(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              {/* Elasticity Setting */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Elasticidad Precio-Demanda:</label>
                  <input 
                    type="number" step="0.05" className="input-control" style={{ width: '100%', marginTop: '4px' }}
                    value={elasticity} onChange={e => setElasticity(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Justificación del Cambio:</label>
                  <input 
                    type="text" required className="input-control" style={{ width: '100%', marginTop: '4px' }}
                    value={justification} onChange={e => setJustification(e.target.value)}
                  />
                </div>
              </div>

              {/* Economic Impact Summary Box */}
              <div style={{
                background: 'rgba(18, 26, 45, 0.9)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Impacto Económico Estimado (Anualizado)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Impacto en Volumen:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: deltaVolumenPct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                      {deltaVolumenPct > 0 ? `+${deltaVolumenPct.toFixed(1)}%` : `${deltaVolumenPct.toFixed(1)}%`}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Volumen Proyectado:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                      {nuevoVolumen.toLocaleString()} unid
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Impacto Facturación:</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: impactoFacturacion >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                      {impactoFacturacion >= 0 ? `+Bs. ${impactoFacturacion.toLocaleString('es-BO', { maximumFractionDigits: 0 })}` : `-Bs. ${Math.abs(impactoFacturacion).toLocaleString('es-BO', { maximumFractionDigits: 0 })}`}
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
                {saving ? 'Guardando...' : 'Aplicar Nuevo Precio & Registrar Auditoría'}
              </button>
            </div>
          </form>
        </div>

        {/* Price Change Audit History */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <History size={18} color="var(--accent-purple)" />
              Histórico de Cambios de Precio
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {historial.length} Modificaciones
            </span>
          </div>

          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Precio Ant.</th>
                  <th>Precio Nuevo</th>
                  <th style={{ textAlign: 'right' }}>Impacto Est.</th>
                  <th>Justificación & Usuario</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                      No hay cambios de precio registrados para este producto.
                    </td>
                  </tr>
                ) : (
                  historial.map(h => (
                    <tr key={h.id}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>{h.fecha_cambio.substring(0, 10)}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>Bs. {h.precio_anterior.toFixed(2)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>Bs. {h.precio_nuevo.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: h.impacto_facturacion >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        Bs. {h.impacto_facturacion.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem' }}>{h.justificacion}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Por: {h.usuario}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
