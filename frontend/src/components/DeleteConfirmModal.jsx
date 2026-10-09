import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';

export default function DeleteConfirmModal({ entity, ids = [], itemLabel = '', onClose, onDeleted }) {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [info, setInfo] = useState(null);
  const [cascade, setCascade] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!entity || !ids.length) return;
    setLoading(true);
    setError(null);
    api.previewDependencies(entity, ids)
      .then(res => {
        setInfo(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setInfo({ related: [], set_null: [], total_related: 0 });
        setLoading(false);
      });
  }, [entity, ids]);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      if (ids.length === 1) {
        await api.deleteRow(entity, ids[0], cascade);
      } else {
        await api.bulkDelete(entity, ids, cascade);
      }
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al eliminar');
      setDeleting(false);
    }
  };

  const hasRelated = info && info.total_related > 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(244, 63, 94, 0.3)' }}>
          <div className="card-title" style={{ color: 'var(--accent-rose)' }}>
            <Trash2 size={18} />
            Confirmar Eliminación {ids.length > 1 ? `(${ids.length} registros)` : ''}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>
            ¿Estás seguro de que deseas eliminar {ids.length === 1 ? (
              <strong>{itemLabel || `el registro #${ids[0]}`}</strong>
            ) : (
              <strong>{ids.length} registros seleccionados</strong>
            )}?
          </p>

          {loading ? (
            <div style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verificando dependencias en la base de datos...
            </div>
          ) : hasRelated ? (
            <div style={{
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.85rem' }}>
                <AlertTriangle size={18} />
                Atención: Existen {info.total_related} registros relacionados dependientes:
              </div>
              <ul style={{ paddingLeft: '22px', fontSize: '0.78rem', color: '#fecdd3' }}>
                {info.related.map((r, i) => (
                  <li key={i}>
                    <strong>{r.count}</strong> en <em>{r.label}</em>
                  </li>
                ))}
              </ul>
              {info.set_null && info.set_null.length > 0 && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Se desvincularán (quedarán en blanco) referencias en: {info.set_null.map(s => `${s.label} (${s.count})`).join(', ')}.
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px', fontSize: '0.82rem', color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={cascade}
                  onChange={e => setCascade(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Confirmar borrado en CASCADA de los datos relacionados</span>
              </label>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Este registro no tiene datos dependientes bloqueantes. Se eliminará de forma segura y quedará registrado en la auditoría.
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}
            onClick={handleConfirm}
            disabled={deleting || (hasRelated && !cascade)}
          >
            <Trash2 size={15} />
            {deleting ? 'Eliminando...' : (hasRelated ? 'Eliminar con Cascada' : 'Eliminar')}
          </button>
        </div>
      </div>
    </div>
  );
}
