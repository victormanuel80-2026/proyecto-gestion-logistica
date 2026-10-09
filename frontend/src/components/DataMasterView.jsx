import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  Database, Plus, Search, Edit2, Trash2, Copy, RefreshCw, 
  Filter, ChevronLeft, ChevronRight, CheckSquare, Square, Download 
} from 'lucide-react';
import CrudTableModal from './CrudTableModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function DataMasterView({ initialEntity = 'productos' }) {
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(initialEntity);
  const [schema, setSchema] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [editModal, setEditModal] = useState({ open: false, rowId: null, data: null, isDuplicate: false });
  const [deleteModal, setDeleteModal] = useState({ open: false, ids: [], label: '' });

  // Load available entities list
  useEffect(() => {
    api.getEntities().then(res => {
      setEntities(res);
    });
  }, []);

  // When entity changes, reset filters
  useEffect(() => {
    setPage(0);
    setSearch('');
    setSelectedIds([]);
    setSortField('');
    loadSchemaAndData(selectedEntity);
  }, [selectedEntity]);

  const loadSchemaAndData = async (ent) => {
    setLoading(true);
    try {
      const sch = await api.getSchema(ent);
      setSchema(sch);
      loadRows(ent, 0, pageSize, search, sortField, sortDir);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const loadRows = (ent, p, size, s, sort, dir) => {
    setLoading(true);
    const params = {
      limit: size,
      offset: p * size,
      search: s || undefined,
      sort: sort || undefined,
      dir: dir || undefined,
    };
    api.listRows(ent, params)
      .then(res => {
        setRows(res.rows || []);
        setTotal(res.total || 0);
        setSelectedIds([]);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    loadRows(selectedEntity, 0, pageSize, search, sortField, sortDir);
  };

  const handleSort = (fieldName) => {
    const nextDir = sortField === fieldName && sortDir === 'asc' ? 'desc' : 'asc';
    setSortField(fieldName);
    setSortDir(nextDir);
    setPage(0);
    loadRows(selectedEntity, 0, pageSize, search, fieldName, nextDir);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map(r => r.id));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const currentEntMeta = entities.find(e => e.key === selectedEntity) || { label: schema?.label || selectedEntity };

  // Columns to show in table
  const tableColumns = schema ? [
    ...schema.fields.filter(f => f.list !== false).slice(0, 7),
    ...(schema.virtual || [])
  ] : [];

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Selector Card */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              Seleccionar Tabla / Entidad para Administrar:
            </span>
            <select
              className="custom-select"
              style={{ minWidth: '300px', fontWeight: 600 }}
              value={selectedEntity}
              onChange={e => setSelectedEntity(e.target.value)}
            >
              {entities.map(e => (
                <option key={e.key} value={e.key}>
                  [{e.group}] {e.label} ({e.count} registros)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedIds.length > 0 && (
              <button
                className="btn"
                style={{ background: 'rgba(244, 63, 94, 0.2)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)' }}
                onClick={() => setDeleteModal({ open: true, ids: selectedIds, label: `${selectedIds.length} seleccionados` })}
              >
                <Trash2 size={16} /> Eliminar Seleccionados ({selectedIds.length})
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={() => setEditModal({ open: true, rowId: null, data: null, isDuplicate: false })}
            >
              <Plus size={16} /> Nuevo Registro
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Database size={18} color="var(--accent-cyan)" />
              {currentEntMeta.label} ({total.toLocaleString()} registros totales)
            </div>
            <div className="card-subtitle">
              {schema?.description || 'Gestión integral: crear, editar en línea, duplicar y eliminar con control de dependencias'}
            </div>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-control"
                placeholder="Buscar en esta tabla..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '240px', paddingLeft: '32px' }}
              />
              <Search size={14} color="var(--text-dim)" style={{ position: 'absolute', left: 10, top: 11 }} />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px' }}>
              Filtrar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              title="Refrescar datos"
              style={{ padding: '6px 10px' }}
              onClick={() => loadRows(selectedEntity, page, pageSize, search, sortField, sortDir)}
            >
              <RefreshCw size={14} />
            </button>
          </form>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <button
                    onClick={toggleSelectAll}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {selectedIds.length > 0 && selectedIds.length === rows.length ? (
                      <CheckSquare size={16} color="var(--accent-cyan)" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>
                  ID {sortField === 'id' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                {tableColumns.map(col => (
                  <th
                    key={col.name}
                    style={{ cursor: 'pointer', textAlign: col.type === 'money' || col.type === 'number' || col.type === 'percent' ? 'right' : 'left' }}
                    onClick={() => handleSort(col.name)}
                  >
                    {col.label} {sortField === col.name && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                ))}
                <th style={{ textAlign: 'right', minWidth: '120px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColumns.length + 3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    ⏳ Cargando registros de {currentEntMeta.label}...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length + 3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No se encontraron registros. Haz clic en <strong>Nuevo Registro</strong> para agregar uno.
                  </td>
                </tr>
              ) : (
                rows.map(row => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr key={row.id} style={{ background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggleSelectRow(row.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          {isSelected ? <CheckSquare size={16} color="var(--accent-cyan)" /> : <Square size={16} />}
                        </button>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                          #{row.id}
                        </span>
                      </td>

                      {tableColumns.map(col => {
                        const rawVal = row[col.name];
                        const labelVal = row[`${col.name}__label`];
                        const display = labelVal || rawVal;

                        const isNum = col.type === 'money' || col.type === 'number' || col.type === 'percent' || col.format === 'percent';

                        return (
                          <td key={col.name} style={{ textAlign: isNum ? 'right' : 'left' }}>
                            {col.type === 'bool' ? (
                              rawVal ? (
                                <span className="badge-tag success" style={{ fontSize: '0.68rem' }}>Sí</span>
                              ) : (
                                <span className="badge-tag secondary" style={{ fontSize: '0.68rem' }}>No</span>
                              )
                            ) : col.type === 'money' ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {rawVal !== null && rawVal !== undefined ? Number(rawVal).toLocaleString('es-BO', { minimumFractionDigits: 2 }) : '-'}
                              </span>
                            ) : col.type === 'percent' || col.format === 'percent' ? (
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                                {rawVal !== null && rawVal !== undefined ? `${rawVal}%` : '-'}
                              </span>
                            ) : col.format === 'code' ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                                {display}
                              </span>
                            ) : (
                              <span style={{ maxWidth: '240px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(display ?? '')}>
                                {display !== null && display !== undefined ? String(display) : '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Action buttons */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            title="Editar este registro"
                            onClick={() => setEditModal({ open: true, rowId: row.id, data: row, isDuplicate: false })}
                          >
                            <Edit2 size={13} color="var(--accent-cyan)" />
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            title="Duplicar como nuevo registro"
                            onClick={() => setEditModal({ open: true, rowId: null, data: row, isDuplicate: true })}
                          >
                            <Copy size={13} color="var(--accent-purple)" />
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            title="Eliminar registro"
                            onClick={() => setDeleteModal({ open: true, ids: [row.id], label: row.nombre || row.codigo || `#${row.id}` })}
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

        {/* Pagination Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Mostrando {rows.length} de {total.toLocaleString()} registros</span>
            <select
              className="custom-select"
              style={{ padding: '3px 8px', fontSize: '0.76rem' }}
              value={pageSize}
              onChange={e => {
                const sz = parseInt(e.target.value);
                setPageSize(sz);
                setPage(0);
                loadRows(selectedEntity, 0, sz, search, sortField, sortDir);
              }}
            >
              <option value="15">15 por página</option>
              <option value="25">25 por página</option>
              <option value="50">50 por página</option>
              <option value="100">100 por página</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Página {page + 1} de {totalPages}</span>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px' }}
              disabled={page === 0}
              onClick={() => {
                const prev = Math.max(0, page - 1);
                setPage(prev);
                loadRows(selectedEntity, prev, pageSize, search, sortField, sortDir);
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px' }}
              disabled={page >= totalPages - 1}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                loadRows(selectedEntity, next, pageSize, search, sortField, sortDir);
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {editModal.open && (
        <CrudTableModal
          entity={selectedEntity}
          rowId={editModal.rowId}
          initialData={editModal.data}
          isDuplicate={editModal.isDuplicate}
          onClose={() => setEditModal({ open: false, rowId: null, data: null, isDuplicate: false })}
          onSaved={() => loadRows(selectedEntity, page, pageSize, search, sortField, sortDir)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <DeleteConfirmModal
          entity={selectedEntity}
          ids={deleteModal.ids}
          itemLabel={deleteModal.label}
          onClose={() => setDeleteModal({ open: false, ids: [], label: '' })}
          onDeleted={() => {
            loadRows(selectedEntity, page, pageSize, search, sortField, sortDir);
            // Refresh entities count
            api.getEntities().then(setEntities);
          }}
        />
      )}
    </div>
  );
}
