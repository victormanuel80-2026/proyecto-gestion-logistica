import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  Calendar, Layers, DollarSign, Package, TrendingUp, Save, Check, 
  Copy, Sliders, Trash2, Plus, AlertCircle 
} from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function PresupuestoView({ regionalId, linea }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [escenarioId, setEscenarioId] = useState(null);
  const [escenarioTipo, setEscenarioTipo] = useState('OFICIAL');
  const [viewMetric, setViewMetric] = useState('qty'); // 'qty', 'val', 'price'
  const [editingCell, setEditingCell] = useState(null); // { prodId, mesFiscal }
  const [editValue, setEditValue] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [config, setConfig] = useState({});

  // Advanced budget tools
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyForm, setCopyForm] = useState({ nombre: '', tipo_escenario: 'MODIFICADO', factor_pct: 5, descripcion: '' });
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ pct: 5, campo: 'cantidad' });
  const [deleteRowModal, setDeleteRowModal] = useState({ open: false, prodId: null, label: '' });

  const loadPresupuesto = (targetEscId = null, targetEscTipo = null) => {
    setLoading(true);
    const escParam = targetEscTipo || escenarioTipo;
    Promise.all([
      api.getPresupuestoMatriz(1, escParam, regionalId, linea),
      api.getConfig()
    ]).then(([res, cfg]) => {
      setData(res);
      setConfig(cfg || {});
      if (res.escenario_actual) {
        setEscenarioId(res.escenario_actual.id);
        setEscenarioTipo(res.escenario_actual.tipo_escenario);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadPresupuesto();
  }, [regionalId, linea]);

  const handleSelectEscenario = (esc) => {
    setEscenarioId(esc.id);
    setEscenarioTipo(esc.tipo_escenario);
    loadPresupuesto(esc.id, esc.tipo_escenario);
  };

  const handleCellClick = (prodId, mesFiscal, currentValue) => {
    if (escenarioTipo === 'HISTORICO') return; // Read only
    setEditingCell({ prodId, mesFiscal });
    setEditValue(currentValue);
  };

  const handleCellBlurOrEnter = async (prod, mes) => {
    if (!editingCell) return;
    const newVal = parseFloat(editValue);
    if (isNaN(newVal) || newVal < 0) {
      setEditingCell(null);
      return;
    }

    try {
      const isQty = viewMetric === 'qty';
      const isPrice = viewMetric === 'price';
      
      const payload = {
        escenario_id: data.escenario_actual.id,
        producto_id: prod.producto_id,
        regional_id: regionalId || null,
        mes_fiscal: mes.mes_fiscal,
        cantidad: isQty ? newVal : null,
        precio: isPrice ? newVal : null
      };

      await api.updatePresupuestoCelda(payload);
      setSaveStatus("Guardado ✓");
      setTimeout(() => setSaveStatus(null), 2500);

      // Local optimistic update
      setData(prev => {
        const nextMatriz = prev.matriz.map(item => {
          if (item.producto_id !== prod.producto_id) return item;
          const updatedMeses = item.meses.map(m => {
            if (m.mes_fiscal !== mes.mes_fiscal) return m;
            const updatedQty = isQty ? newVal : m.cantidad;
            const updatedPrice = isPrice ? newVal : m.precio;
            return {
              ...m,
              cantidad: updatedQty,
              precio: updatedPrice,
              valorizacion: Math.round(updatedQty * updatedPrice)
            };
          });

          const newTotalQty = updatedMeses.reduce((acc, cur) => acc + cur.cantidad, 0);
          const newTotalVal = updatedMeses.reduce((acc, cur) => acc + cur.valorizacion, 0);

          return {
            ...item,
            meses: updatedMeses,
            total_anual_qty: newTotalQty,
            total_anual_val: newTotalVal
          };
        });

        return { ...prev, matriz: nextMatriz };
      });

    } catch (err) {
      console.error(err);
      alert("Error al actualizar celda: " + err.message);
    } finally {
      setEditingCell(null);
    }
  };

  const handleDeleteRow = async () => {
    if (!deleteRowModal.prodId || !data.escenario_actual) return;
    try {
      await api.deletePresupuestoFila(data.escenario_actual.id, deleteRowModal.prodId, regionalId || null);
      setDeleteRowModal({ open: false, prodId: null, label: '' });
      loadPresupuesto();
    } catch (err) {
      alert("Error al eliminar fila: " + err.message);
    }
  };

  const handleCopySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.copyEscenario({
        origen_id: data.escenario_actual.id,
        nombre: copyForm.nombre,
        tipo_escenario: copyForm.tipo_escenario,
        factor_pct: parseFloat(copyForm.factor_pct) || 0,
        descripcion: copyForm.descripcion
      });
      setCopyModalOpen(false);
      alert(`✓ Escenario creado con éxito (${res.items} ítems presupuestados copiados)`);
      loadPresupuesto(res.id, copyForm.tipo_escenario);
    } catch (err) {
      alert("Error al copiar escenario: " + err.message);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.bulkAdjustBudget({
        escenario_id: data.escenario_actual.id,
        pct: parseFloat(bulkForm.pct) || 0,
        campo: bulkForm.campo,
        regional_id: regionalId || null,
        linea: linea || null
      });
      setBulkModalOpen(false);
      alert("✓ Ajuste masivo aplicado exitosamente a las filas seleccionadas");
      loadPresupuesto();
    } catch (err) {
      alert("Error al aplicar ajuste: " + err.message);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        ⏳ Cargando matriz presupuestaria fiscal (Abril - Marzo)...
      </div>
    );
  }

  if (!data) return <div>Error al cargar presupuesto comercial.</div>;

  const mesesHeaders = [
    { num: 1, name: "Abril" },
    { num: 2, name: "Mayo" },
    { num: 3, name: "Junio" },
    { num: 4, name: "Julio" },
    { num: 5, name: "Agosto" },
    { num: 6, name: "Septiembre" },
    { num: 7, name: "Octubre" },
    { num: 8, name: "Noviembre" },
    { num: 9, name: "Diciembre" },
    { num: 10, name: "Enero" },
    { num: 11, name: "Febrero" },
    { num: 12, name: "Marzo" },
  ];

  const moneda = config.moneda || 'Bs.';

  // Column Totals
  const colTotals = mesesHeaders.map(mh => {
    return data.matriz.reduce((sum, row) => {
      const mesData = row.meses.find(m => m.mes_fiscal === mh.num);
      if (!mesData) return sum;
      return sum + (viewMetric === 'qty' ? mesData.cantidad : mesData.valorizacion);
    }, 0);
  });

  const grandTotal = data.matriz.reduce((sum, row) => {
    return sum + (viewMetric === 'qty' ? row.total_anual_qty : row.total_anual_val);
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Scenario & Tool Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Dynamic Scenario Switcher Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, marginRight: '4px' }}>
              Escenario:
            </span>
            {data.escenarios_disponibles.map(sc => {
              const isCurrent = data.escenario_actual?.id === sc.id;
              return (
                <button
                  key={sc.id}
                  className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  onClick={() => handleSelectEscenario(sc)}
                >
                  {sc.nombre}
                </button>
              );
            })}
          </div>

          {/* Action buttons + Metric Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {saveStatus && (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={16} /> {saveStatus}
              </span>
            )}

            {/* Bulk & Copy Tools */}
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.76rem', padding: '6px 12px' }}
              onClick={() => {
                setCopyForm({
                  nombre: `${data.escenario_actual?.nombre} - Modif Q`,
                  tipo_escenario: 'MODIFICADO',
                  factor_pct: 5,
                  descripcion: ''
                });
                setCopyModalOpen(true);
              }}
            >
              <Copy size={14} /> Copiar Escenario
            </button>

            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.76rem', padding: '6px 12px' }}
              onClick={() => setBulkModalOpen(true)}
            >
              <Sliders size={14} /> Ajuste Masivo %
            </button>

            {/* Metric Mode Toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
              <button
                onClick={() => setViewMetric('qty')}
                className="btn"
                style={{
                  padding: '5px 12px', fontSize: '0.76rem',
                  background: viewMetric === 'qty' ? 'var(--primary)' : 'transparent',
                  color: viewMetric === 'qty' ? '#fff' : 'var(--text-muted)'
                }}
              >
                <Package size={14} /> Cantidades
              </button>
              <button
                onClick={() => setViewMetric('val')}
                className="btn"
                style={{
                  padding: '5px 12px', fontSize: '0.76rem',
                  background: viewMetric === 'val' ? 'var(--primary)' : 'transparent',
                  color: viewMetric === 'val' ? '#fff' : 'var(--text-muted)'
                }}
              >
                <DollarSign size={14} /> Valorización ({moneda})
              </button>
              <button
                onClick={() => setViewMetric('price')}
                className="btn"
                style={{
                  padding: '5px 12px', fontSize: '0.76rem',
                  background: viewMetric === 'price' ? 'var(--primary)' : 'transparent',
                  color: viewMetric === 'price' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Precio
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Budget Grid */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Calendar size={18} color="var(--accent-cyan)" />
              Matriz Presupuestaria Gestión 2026-2027 (Abril a Marzo)
            </div>
            <div className="card-subtitle">
              Escenario: <strong>{data.escenario_actual?.nombre}</strong> | Clic en celda para editar en vivo | Ícono 🗑️ para eliminar fila
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
            {data.matriz.length} Productos Planificados
          </span>
        </div>

        <div className="table-responsive">
          <table className="modern-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#111827' }}>Código / SKU</th>
                <th style={{ position: 'sticky', left: '90px', zIndex: 10, background: '#111827' }}>Producto / Artículo</th>
                {mesesHeaders.map(mh => (
                  <th key={mh.num} style={{ textAlign: 'right', minWidth: '85px' }}>
                    {mh.name}
                  </th>
                ))}
                <th style={{ textAlign: 'right', minWidth: '110px', background: '#172554', color: '#93c5fd' }}>
                  Total Anual ({viewMetric === 'qty' ? 'Unid' : moneda})
                </th>
                <th style={{ width: '40px', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {data.matriz.map(prod => {
                return (
                  <tr key={prod.producto_id}>
                    {/* Fixed Product Info */}
                    <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-card)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {prod.codigo}
                      </span>
                    </td>
                    <td style={{ position: 'sticky', left: '90px', zIndex: 5, background: 'var(--bg-card)' }}>
                      <div style={{ fontWeight: 600, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prod.nombre}>
                        {prod.nombre}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{prod.linea}</div>
                    </td>

                    {/* 12 Months Cells */}
                    {prod.meses.map(m => {
                      const isEditing = editingCell?.prodId === prod.producto_id && editingCell?.mesFiscal === m.mes_fiscal;
                      const displayVal = viewMetric === 'qty' ? m.cantidad : (viewMetric === 'val' ? m.valorizacion : m.precio);

                      return (
                        <td 
                          key={m.mes_fiscal} 
                          style={{ 
                            textAlign: 'right', 
                            cursor: escenarioTipo !== 'HISTORICO' ? 'pointer' : 'default',
                            background: isEditing ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            fontFamily: 'var(--font-mono)'
                          }}
                          onClick={() => handleCellClick(prod.producto_id, m.mes_fiscal, displayVal)}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              autoFocus
                              className="editable-cell-input"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => handleCellBlurOrEnter(prod, m)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCellBlurOrEnter(prod, m);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          ) : (
                            <span title="Doble clic o clic para editar">
                              {viewMetric === 'val' 
                                ? `${moneda} ${Math.round(displayVal).toLocaleString()}` 
                                : displayVal.toLocaleString()}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Anual Row */}
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(2, 132, 199, 0.12)', color: '#38bdf8' }}>
                      {viewMetric === 'qty' 
                        ? prod.total_anual_qty.toLocaleString() 
                        : `${moneda} ${Math.round(prod.total_anual_val).toLocaleString('es-BO')}`}
                    </td>

                    {/* Delete row button */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 6px', color: 'var(--accent-rose)' }}
                        title="Eliminar este producto del presupuesto"
                        onClick={() => setDeleteRowModal({ open: true, prodId: prod.producto_id, label: prod.nombre })}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals Footer Row */}
            <tfoot>
              <tr style={{ background: '#111827', fontWeight: 800, borderTop: '2px solid rgba(56,189,248,0.4)' }}>
                <td colSpan={2} style={{ padding: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd' }}>
                  Total Consolidado ({viewMetric === 'qty' ? 'Unidades' : moneda})
                </td>
                {colTotals.map((tot, idx) => (
                  <td key={idx} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#f8fafc', padding: '14px 10px' }}>
                    {viewMetric === 'val' ? `${moneda} ${Math.round(tot).toLocaleString()}` : Math.round(tot).toLocaleString()}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', padding: '14px 10px', fontSize: '0.9rem' }}>
                  {viewMetric === 'val' ? `${moneda} ${Math.round(grandTotal).toLocaleString('es-BO')}` : Math.round(grandTotal).toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Copy Scenario Modal */}
      {copyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="card-title">
                <Copy size={18} color="var(--accent-cyan)" /> Copiar Escenario Presupuestario
              </div>
              <button onClick={() => setCopyModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleCopySubmit}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Nombre del Nuevo Escenario *</label>
                  <input
                    type="text"
                    required
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={copyForm.nombre}
                    onChange={e => setCopyForm({ ...copyForm, nombre: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Tipo de Escenario *</label>
                    <select
                      className="custom-select"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={copyForm.tipo_escenario}
                      onChange={e => setCopyForm({ ...copyForm, tipo_escenario: e.target.value })}
                    >
                      <option value="MODIFICADO">MODIFICADO</option>
                      <option value="PROYECTADO">PROYECTADO</option>
                      <option value="OFICIAL">OFICIAL</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Factor % Variación (+/-)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="input-control"
                      style={{ width: '100%', marginTop: '4px' }}
                      placeholder="Ej: 5 para +5%, -3 para -3%"
                      value={copyForm.factor_pct}
                      onChange={e => setCopyForm({ ...copyForm, factor_pct: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Descripción / Justificación</label>
                  <textarea
                    rows={2}
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={copyForm.descripcion}
                    onChange={e => setCopyForm({ ...copyForm, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCopyModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Escenario Copiado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Adjust Modal */}
      {bulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="card-title">
                <Sliders size={18} color="var(--accent-purple)" /> Ajuste Masivo Porcentual
              </div>
              <button onClick={() => setBulkModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleBulkSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Aplica una variación porcentual masiva a todas las celdas del escenario actual (<strong>{data.escenario_actual?.nombre}</strong>).
                </p>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Campo a Ajustar:</label>
                  <select
                    className="custom-select"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={bulkForm.campo}
                    onChange={e => setBulkForm({ ...bulkForm, campo: e.target.value })}
                  >
                    <option value="cantidad">Cantidades (+/- % volumen)</option>
                    <option value="precio">Precios (+/- % precio unitario)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Porcentaje de Ajuste (%):</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="Ej: 8 para +8%, -5 para -5%"
                    value={bulkForm.pct}
                    onChange={e => setBulkForm({ ...bulkForm, pct: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBulkModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Aplicar Ajuste Masivo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Row Confirmation Modal */}
      {deleteRowModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="card-title" style={{ color: 'var(--accent-rose)' }}>
                <Trash2 size={18} /> Eliminar Fila del Presupuesto
              </div>
              <button onClick={() => setDeleteRowModal({ open: false, prodId: null, label: '' })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem' }}>
                ¿Deseas quitar <strong>{deleteRowModal.label}</strong> del escenario <strong>{data.escenario_actual?.nombre}</strong>?
                Se eliminarán los 12 meses presupuestados para este producto.
              </p>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteRowModal({ open: false, prodId: null, label: '' })}>Cancelar</button>
              <button
                className="btn"
                style={{ background: 'var(--accent-rose)', color: '#fff' }}
                onClick={handleDeleteRow}
              >
                Eliminar Fila
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
