import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Plus, Search, Filter, Pill, ShieldCheck, Tag, Edit2, Trash2, Copy } from 'lucide-react';
import CrudTableModal from './CrudTableModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function ProductosView() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLinea, setSelectedLinea] = useState('');
  const [coreOnly, setCoreOnly] = useState(false);
  const [config, setConfig] = useState({});

  // Modals
  const [editModal, setEditModal] = useState({ open: false, rowId: null, data: null, isDuplicate: false });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, label: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProductos(selectedLinea || null, coreOnly ? 1 : null, search || null),
      api.getConfig()
    ]).then(([prods, cfg]) => {
      setProductos(prods);
      setConfig(cfg || {});
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedLinea, coreOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const moneda = config.moneda || 'Bs.';
  const labelFormato = config.label_formato || 'Forma & Presentación';
  const labelAtributo = config.label_atributo || 'Molécula / Atributo';
  const labelCore = config.label_core || 'CORE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Action Toolbar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '320px', flex: 1 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                className="input-control" 
                placeholder="Buscar por código SKU, nombre comercial o atributo..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 11 }} />
            </div>
            <button type="submit" className="btn btn-secondary">Buscar</button>
          </form>

          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select 
              className="custom-select" 
              value={selectedLinea} 
              onChange={e => setSelectedLinea(e.target.value)}
            >
              <option value="">Todas las Líneas</option>
              <option value="Línea Ética">Línea Ética</option>
              <option value="Línea Cardiometabólica">Línea Cardiometabólica</option>
              <option value="Línea Respiratoria">Línea Respiratoria</option>
              <option value="Línea Gastrointestinal">Línea Gastrointestinal</option>
              <option value="Línea Hospitalaria">Línea Hospitalaria</option>
              <option value="Línea Pediátrica">Línea Pediátrica</option>
              <option value="Línea OTC">Línea OTC</option>
            </select>

            <button 
              className={`btn ${coreOnly ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCoreOnly(!coreOnly)}
            >
              <ShieldCheck size={16} /> {labelCore} ({coreOnly ? 'Activado' : 'Todos'})
            </button>

            <button
              className="btn btn-primary"
              onClick={() => setEditModal({ open: true, rowId: null, data: null, isDuplicate: false })}
            >
              <Plus size={16} /> Nuevo Producto / Artículo
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Pill size={18} color="var(--accent-cyan)" />
            Catálogo Maestro de Productos y Artículos ({productos.length} registros activos)
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Estructura con edición, duplicación, eliminación en cascada y márgenes
          </span>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Línea & Categoría</th>
                <th>{labelAtributo}</th>
                <th>{labelFormato}</th>
                <th>{labelCore}</th>
                <th style={{ textAlign: 'right' }}>Precio Base</th>
                <th style={{ textAlign: 'right' }}>Costo Base</th>
                <th style={{ textAlign: 'right' }}>Margen Bruto</th>
                <th style={{ textAlign: 'right', minWidth: '110px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Cargando catálogo...
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No se encontraron productos. Haz clic en "Nuevo Producto" para agregar uno.
                  </td>
                </tr>
              ) : (
                productos.map(p => {
                  const margin = p.precio_base > 0 ? (((p.precio_base - p.costo_base) / p.precio_base) * 100).toFixed(1) : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {p.codigo}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{p.linea}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{p.categoria}</div>
                      </td>
                      <td>
                        <span style={{ fontStyle: 'italic', color: '#e2e8f0' }}>{p.molecula}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem' }}>{p.forma_farmaceutica}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.presentacion}</div>
                      </td>
                      <td>
                        {p.core ? (
                          <span className="badge-tag core">★ {labelCore}</span>
                        ) : (
                          <span className="badge-tag secondary">Estándar</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {moneda} {p.precio_base?.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        {moneda} {p.costo_base?.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: margin > 50 ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontWeight: 700 }}>
                          {margin}%
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px' }}
                            title="Editar producto"
                            onClick={() => setEditModal({ open: true, rowId: p.id, data: p, isDuplicate: false })}
                          >
                            <Edit2 size={13} color="var(--accent-cyan)" />
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px' }}
                            title="Duplicar producto"
                            onClick={() => setEditModal({ open: true, rowId: null, data: p, isDuplicate: true })}
                          >
                            <Copy size={13} color="var(--accent-purple)" />
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px' }}
                            title="Eliminar producto"
                            onClick={() => setDeleteModal({ open: true, id: p.id, label: `${p.codigo} - ${p.nombre}` })}
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

      {/* Edit / Create / Duplicate Modal */}
      {editModal.open && (
        <CrudTableModal
          entity="productos"
          rowId={editModal.rowId}
          initialData={editModal.data}
          isDuplicate={editModal.isDuplicate}
          onClose={() => setEditModal({ open: false, rowId: null, data: null, isDuplicate: false })}
          onSaved={loadData}
        />
      )}

      {/* Delete Confirmation Modal with Cascade preview */}
      {deleteModal.open && (
        <DeleteConfirmModal
          entity="productos"
          ids={[deleteModal.id]}
          itemLabel={deleteModal.label}
          onClose={() => setDeleteModal({ open: false, id: null, label: '' })}
          onDeleted={loadData}
        />
      )}
    </div>
  );
}
