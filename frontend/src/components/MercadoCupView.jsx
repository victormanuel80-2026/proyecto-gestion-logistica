import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Globe, TrendingUp, PieChart, Award, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import CrudTableModal from './CrudTableModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function MercadoCupView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMercado, setSelectedMercado] = useState('');
  const [config, setConfig] = useState({});

  // Modals
  const [editModal, setEditModal] = useState({ open: false, rowId: null, data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, label: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getMercadoCup(selectedMercado || null),
      api.getConfig()
    ]).then(([res, cfg]) => {
      setData(res);
      setConfig(cfg || {});
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedMercado]);

  const moneda = config.moneda || 'Bs.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Filter Card */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Filtrar Segmento de Mercado:
            </span>
            <select 
              className="custom-select" 
              value={selectedMercado} 
              onChange={e => setSelectedMercado(e.target.value)}
            >
              <option value="">Todos los Mercados Auditados</option>
              <option value="Mercado Analgésicos">Mercado Analgésicos (N02B)</option>
              <option value="Mercado Antibióticos">Mercado Antibióticos (J01CR)</option>
              <option value="Mercado Cardiovascular">Mercado Cardiovascular (C09CA)</option>
              <option value="Mercado Gastrointestinal">Mercado Gastrointestinal (A02BC)</option>
              <option value="Mercado Respiratorio">Mercado Respiratorio (R03AC)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setEditModal({ open: true, rowId: null, data: null })}
            >
              <Plus size={16} /> Nuevo Registro de Mercado
            </button>
          </div>
        </div>
      </div>

      {/* Market Share Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <PieChart size={18} color="var(--accent-cyan)" />
            Auditoría de Mercado Retail & CUP (Participación de Mercado y Evolución)
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Índice de Evolución (IE &gt; 100 indica crecimiento superior al mercado) | Edita o elimina cualquier fila
          </span>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Mercado & Clase</th>
                <th>Componente / Molécula</th>
                <th>Marca / Producto</th>
                <th>Laboratorio / Fabricante</th>
                <th style={{ textAlign: 'right' }}>Unidades</th>
                <th style={{ textAlign: 'right' }}>Valores ({moneda})</th>
                <th style={{ textAlign: 'right' }}>Share Unid (%)</th>
                <th style={{ textAlign: 'right' }}>Share Val (%)</th>
                <th style={{ textAlign: 'right' }}>Índice Evolución (IE)</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Cargando auditoría de mercado...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    No hay registros de mercado disponibles. Haz clic en "Nuevo Registro de Mercado".
                  </td>
                </tr>
              ) : (
                data.map(r => {
                  const isOurBrand = r.laboratorio === 'Laboratorio Propio';
                  const isGrowing = r.indice_evolucion >= 100;
                  return (
                    <tr key={r.id} style={{ background: isOurBrand ? 'rgba(6, 182, 212, 0.06)' : 'transparent' }}>
                      <td><span style={{ fontFamily: 'var(--font-mono)' }}>{r.periodo}</span></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.mercado}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{r.clase_terapeutica}</div>
                      </td>
                      <td><span style={{ fontStyle: 'italic', color: '#e2e8f0' }}>{r.molecula}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, color: isOurBrand ? 'var(--accent-cyan)' : 'inherit' }}>
                          {r.marca} {isOurBrand && '★'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge-tag ${isOurBrand ? 'core' : 'secondary'}`}>
                          {r.laboratorio}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.unidades_mercado?.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{moneda} {r.valores_mercado?.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.market_share_unidades}%</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isOurBrand ? 'var(--accent-cyan)' : 'inherit' }}>
                        {r.market_share_valores}%
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                        <span style={{ color: isGrowing ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                          {r.indice_evolucion}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 7px' }}
                            title="Editar registro de mercado"
                            onClick={() => setEditModal({ open: true, rowId: r.id, data: r })}
                          >
                            <Edit2 size={13} color="var(--accent-cyan)" />
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 7px' }}
                            title="Eliminar registro"
                            onClick={() => setDeleteModal({ open: true, id: r.id, label: `${r.marca} (${r.mercado} - ${r.periodo})` })}
                          >
                            <Trash2 size={13} color="var(--accent-rose)" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.open && (
        <CrudTableModal
          entity="auditoria_mercado_cup"
          rowId={editModal.rowId}
          initialData={editModal.data}
          onClose={() => setEditModal({ open: false, rowId: null, data: null })}
          onSaved={loadData}
        />
      )}

      {/* Delete Modal */}
      {deleteModal.open && (
        <DeleteConfirmModal
          entity="auditoria_mercado_cup"
          ids={[deleteModal.id]}
          itemLabel={deleteModal.label}
          onClose={() => setDeleteModal({ open: false, id: null, label: '' })}
          onDeleted={loadData}
        />
      )}
    </div>
  );
}
