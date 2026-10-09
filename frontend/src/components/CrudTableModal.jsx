import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Save, X, Edit, Plus, AlertCircle, Copy } from 'lucide-react';

export default function CrudTableModal({ entity, rowId = null, initialData = null, isDuplicate = false, onClose, onSaved }) {
  const [schema, setSchema] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEdit = Boolean(rowId && !isDuplicate);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getSchema(entity)
      .then(sch => {
        setSchema(sch);
        if (initialData) {
          const init = { ...initialData };
          if (isDuplicate) {
            delete init.id;
            if (init.codigo) init.codigo = `${init.codigo}_COPIA`;
            if (init.nombre) init.nombre = `${init.nombre} (Copia)`;
          }
          setFormData(init);
          setLoading(false);
        } else if (isEdit) {
          api.getRow(entity, rowId)
            .then(row => {
              setFormData(row);
              setLoading(false);
            })
            .catch(err => {
              setError(err.message);
              setLoading(false);
            });
        } else {
          // Initialize defaults
          const defaults = {};
          sch.fields.forEach(f => {
            if (f.default !== undefined) defaults[f.name] = f.default;
            else if (f.type === 'bool') defaults[f.name] = 0;
            else if (f.type === 'select' && f.options?.length) defaults[f.name] = f.options[0].value;
            else defaults[f.name] = '';
          });
          setFormData(defaults);
          setLoading(false);
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [entity, rowId, isDuplicate]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateRow(entity, rowId, formData);
      } else {
        await api.createRow(entity, formData);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar registro');
      setSaving(false);
    }
  };

  if (loading || !schema) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '640px', padding: '30px', textAlign: 'center' }}>
          ⏳ Cargando formulario dinámico...
        </div>
      </div>
    );
  }

  // Filter out computed or readonly fields for the form
  const editableFields = schema.fields.filter(f => !f.computed && !f.readonly);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div className="card-title">
            {isEdit ? <Edit size={18} color="var(--accent-cyan)" /> : (
              isDuplicate ? <Copy size={18} color="var(--accent-purple)" /> : <Plus size={18} color="var(--accent-emerald)" />
            )}
            {isEdit ? `Editar ${schema.label} (#${rowId})` : (
              isDuplicate ? `Duplicar ${schema.label}` : `Nuevo Registro en ${schema.label}`
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {editableFields.map(f => {
                const val = formData[f.name] ?? '';
                const isRequired = Boolean(f.required);

                return (
                  <div key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {f.label} {isRequired && <span style={{ color: 'var(--accent-rose)' }}>*</span>}
                    </label>

                    {f.type === 'bool' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', cursor: 'pointer', fontSize: '0.84rem' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={e => handleChange(f.name, e.target.checked ? 1 : 0)}
                        />
                        <span style={{ color: val ? 'var(--accent-emerald)' : 'var(--text-dim)', fontWeight: 600 }}>
                          {val ? 'Sí / Activo' : 'No / Inactivo'}
                        </span>
                      </label>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        className="input-control"
                        rows={3}
                        required={isRequired}
                        value={val}
                        onChange={e => handleChange(f.name, e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    ) : f.type === 'select' ? (
                      <select
                        className="custom-select"
                        required={isRequired}
                        value={val}
                        onChange={e => handleChange(f.name, f.int ? parseInt(e.target.value) : e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {f.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'fk' ? (
                      <select
                        className="custom-select"
                        required={isRequired}
                        value={val || ''}
                        onChange={e => handleChange(f.name, e.target.value ? parseInt(e.target.value) : null)}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Seleccionar {f.label} --</option>
                        {f.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'catalog' ? (
                      <>
                        <input
                          type="text"
                          list={`list_${f.name}`}
                          className="input-control"
                          required={isRequired}
                          value={val}
                          onChange={e => handleChange(f.name, e.target.value)}
                          placeholder={`Selecciona o escribe nuevo...`}
                          style={{ width: '100%' }}
                        />
                        <datalist id={`list_${f.name}`}>
                          {f.options?.map((opt, i) => (
                            <option key={i} value={opt} />
                          ))}
                        </datalist>
                      </>
                    ) : f.type === 'date' ? (
                      <input
                        type="date"
                        className="input-control"
                        required={isRequired}
                        value={val}
                        onChange={e => handleChange(f.name, e.target.value)}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <input
                        type={f.type === 'int' || f.type === 'number' || f.type === 'money' || f.type === 'percent' ? 'number' : 'text'}
                        step={f.type === 'int' ? '1' : '0.01'}
                        min={f.min !== undefined ? f.min : undefined}
                        max={f.max !== undefined ? f.max : undefined}
                        className="input-control"
                        required={isRequired}
                        value={val}
                        onChange={e => handleChange(f.name, e.target.value)}
                        style={{ width: '100%' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(15, 23, 42, 0.95)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={15} />
              {saving ? 'Guardando...' : (isEdit ? 'Actualizar Cambios' : 'Crear Registro')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
