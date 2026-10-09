import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Network, Users, Package, Sliders, CheckCircle, ArrowRight } from 'lucide-react';

export default function OrdenItemView() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(1);
  const [selectedProducto, setSelectedProducto] = useState(1);
  const [planItems, setPlanItems] = useState([]);
  const [anualTarget, setAnualTarget] = useState(2500);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    Promise.all([api.getClientes(), api.getProductos()]).then(([cls, prods]) => {
      setClientes(cls);
      setProductos(prods);
      if (cls.length > 0) setSelectedCliente(cls[0].id);
      if (prods.length > 0) setSelectedProducto(prods[0].id);
    });
  }, []);

  const loadPlan = () => {
    if (!selectedCliente || !selectedProducto) return;
    setLoading(true);
    api.getPlanOrdenItem(selectedCliente, selectedProducto)
      .then(res => {
        setPlanItems(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPlan();
  }, [selectedCliente, selectedProducto]);

  const handleAutoDistribute = async () => {
    setLoading(true);
    try {
      await api.distributeOrdenItem({
        cliente_id: selectedCliente,
        producto_id: selectedProducto,
        anual_target: anualTarget
      });
      setSuccessMsg("Distribución estacional aplicada con éxito ✓");
      setTimeout(() => setSuccessMsg(''), 3000);
      loadPlan();
    } catch (err) {
      alert("Error al distribuir: " + err.message);
      setLoading(false);
    }
  };

  const mesesNombres = ["Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"];

  const totalUnidades = planItems.reduce((acc, cur) => acc + cur.cantidad, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Control Configuration Card */}
      <div className="card" style={{ padding: '20px' }}>
        <div className="card-header" style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
          <div>
            <div className="card-title">
              <Network size={18} color="var(--accent-cyan)" />
              Planificación Comercial por Cliente y Producto (Orden × Item)
            </div>
            <div className="card-subtitle">
              Distribución mensual automatizada según estacionalidad farmacéutica y ponderaciones históricas
            </div>
          </div>
          {successMsg && (
            <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem' }}>
              {successMsg}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>1. Seleccionar Cliente:</label>
            <select 
              className="custom-select" style={{ width: '100%', marginTop: '4px' }}
              value={selectedCliente} onChange={e => setSelectedCliente(parseInt(e.target.value))}
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.canal})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>2. Seleccionar Producto:</label>
            <select 
              className="custom-select" style={{ width: '100%', marginTop: '4px' }}
              value={selectedProducto} onChange={e => setSelectedProducto(parseInt(e.target.value))}
            >
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>3. Cuota Anual Meta (Unidades):</label>
            <input 
              type="number" className="input-control" style={{ width: '100%', marginTop: '4px' }}
              value={anualTarget} onChange={e => setAnualTarget(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <button 
              className="btn btn-primary" 
              onClick={handleAutoDistribute}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Sliders size={16} /> Distribuir por Estacionalidad
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Distribution Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Package size={18} color="var(--accent-cyan)" />
            Desglose Mensual Ciclo Fiscal (Gestión Abril - Marzo)
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            Total Asignado: {totalUnidades.toLocaleString()} / {anualTarget.toLocaleString()} unidades
          </span>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mes Fiscal</th>
                <th>Periodo</th>
                <th style={{ textAlign: 'right' }}>% Ponderación Estacional</th>
                <th style={{ textAlign: 'right' }}>Cantidad Planificada</th>
                <th>Curva de Distribución</th>
              </tr>
            </thead>
            <tbody>
              {planItems.map(item => {
                const mesLabel = mesesNombres[item.mes_fiscal - 1];
                const pct = item.porcentaje_distribucion || 0;
                return (
                  <tr key={item.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-purple)' }}>
                        M{String(item.mes_fiscal).padStart(2, '0')}
                      </span>
                    </td>
                    <td><strong>{mesLabel}</strong></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {pct}%
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {item.cantidad.toLocaleString()} unid
                    </td>
                    <td style={{ width: '40%' }}>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct * 7}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
