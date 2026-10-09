import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  Settings, Building2, Sliders, Database, Download, Upload, 
  Check, Save, RefreshCw, Layers, Tag, ShieldCheck, AlertCircle 
} from 'lucide-react';
import CrudTableModal from './CrudTableModal';
import DeleteConfirmModal from './DeleteConfirmModal';

const PRESETS_SECTOR = {
  "Farmacéutico": {
    label_formato: "Forma farmacéutica / Formato",
    label_atributo: "Molécula / Atributo principal",
    label_clasificacion: "Clase ATC / Clasificación",
    label_core: "CORE (Estratégico)",
    moneda: "Bs."
  },
  "Alimentos y Bebidas": {
    label_formato: "Envase / Presentación (Tetra, Botella, Lata)",
    label_atributo: "Sabor / Ingrediente principal",
    label_clasificacion: "Categoría de Alimento / Línea",
    label_core: "Producto Estrella (Top)",
    moneda: "$"
  },
  "Consumo Masivo / Retail": {
    label_formato: "Formato / Tamaño (Pack, Unidad, Display)",
    label_atributo: "Variedad / Marca secundaria",
    label_clasificacion: "Categoría Góndola / Segmento",
    label_core: "SKU Clave (Driver de Venta)",
    moneda: "$"
  },
  "Tecnología y Electrónica": {
    label_formato: "Factor de forma / Tipo de dispositivo",
    label_atributo: "Especificación / Procesador / Modelo",
    label_clasificacion: "Familia tecnológica / Gama",
    label_core: "Flagship / Estratégico",
    moneda: "USD"
  },
  "Logística e Industrial": {
    label_formato: "Unidad de embalaje / Pallet / Tambor",
    label_atributo: "Material / Grado industrial / Composición",
    label_clasificacion: "Partida arancelaria / Clasificación",
    label_core: "Artículo Crítico",
    moneda: "$"
  },
  "Personalizado": {
    label_formato: "Formato / Tipo de presentación",
    label_atributo: "Atributo o componente principal",
    label_clasificacion: "Clasificación o familia",
    label_core: "Estratégico / Prioritario",
    moneda: "$"
  }
};

export default function ConfiguracionView({ onConfigSaved }) {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Catalogs Management
  const [catalogType, setCatalogType] = useState('linea');
  const [catalogs, setCatalogs] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [editCatModal, setEditCatModal] = useState({ open: false, rowId: null, data: null });
  const [delCatModal, setDelCatModal] = useState({ open: false, id: null, label: '' });

  // Restore State
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState(null);

  useEffect(() => {
    loadConfig();
    loadCatalogItems('linea');
  }, []);

  const loadConfig = () => {
    setLoading(true);
    api.getConfig().then(cfg => {
      setConfig(cfg);
      setLoading(false);
    });
  };

  const loadCatalogItems = (tipo) => {
    setCatLoading(true);
    api.listRows('catalogos', { f_tipo: tipo, limit: 100 })
      .then(res => {
        setCatalogs(res.rows || []);
        setCatLoading(false);
      });
  };

  const handleApplyPreset = (presetName) => {
    const preset = PRESETS_SECTOR[presetName];
    if (!preset) return;
    setConfig(prev => ({
      ...prev,
      sector: presetName,
      label_formato: preset.label_formato,
      label_atributo: preset.label_atributo,
      label_clasificacion: preset.label_clasificacion,
      label_core: preset.label_core,
      moneda: prev.moneda || preset.moneda
    }));
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);
    try {
      const updated = await api.saveConfig(config);
      setConfig(updated);
      setSaveStatus("✓ Configuración guardada correctamente");
      setTimeout(() => setSaveStatus(null), 3000);
      onConfigSaved?.(updated);
    } catch (err) {
      alert("Error al guardar configuración: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!restoreFile) return;
    if (!window.confirm("¿Estás seguro de restaurar la base de datos? Se creará un respaldo automático previo del estado actual.")) {
      return;
    }
    setRestoring(true);
    setRestoreMsg(null);
    try {
      const res = await api.restoreBackup(restoreFile);
      setRestoreMsg({ success: true, message: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setRestoreMsg({ success: false, message: err.message });
      setRestoring(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Cargando configuración del sistema...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sector Preset Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Sliders size={18} color="var(--accent-cyan)" />
              Adaptación del Sistema a Cualquier Industria o Sector Comercial
            </div>
            <div className="card-subtitle">
              Configura el sistema para que funcione con farmacéuticos, alimentos, retail, tecnología, logística o cualquier negocio.
            </div>
          </div>
          {saveStatus && (
            <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem' }}>
              {saveStatus}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConfig}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Quick Industry Presets */}
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                Plantillas de Sector (1 Clic para adaptar etiquetas):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.keys(PRESETS_SECTOR).map(name => {
                  const isCurrent = config.sector === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                      onClick={() => handleApplyPreset(name)}
                    >
                      {isCurrent ? '✓ ' : ''}{name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* General Company Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Nombre de la Empresa / Organización:</label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={config.empresa_nombre || ''}
                  onChange={e => setConfig({ ...config, empresa_nombre: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Slogan / Subtítulo Comercial:</label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={config.empresa_slogan || ''}
                  onChange={e => setConfig({ ...config, empresa_slogan: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Símbolo Monetario (Moneda):</label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="Ej: Bs., $, USD, EUR, S/."
                  value={config.moneda || ''}
                  onChange={e => setConfig({ ...config, moneda: e.target.value })}
                />
              </div>
            </div>

            {/* Dynamic Labels for any industry */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                Personalización de Nombres de Columnas en Catálogo de Productos / Artículos:
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Etiqueta de Formato / Presentación:</label>
                  <input
                    type="text"
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={config.label_formato || ''}
                    onChange={e => setConfig({ ...config, label_formato: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Etiqueta de Atributo Principal / Molécula:</label>
                  <input
                    type="text"
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={config.label_atributo || ''}
                    onChange={e => setConfig({ ...config, label_atributo: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Etiqueta de Clasificación / Código ATC:</label>
                  <input
                    type="text"
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={config.label_clasificacion || ''}
                    onChange={e => setConfig({ ...config, label_clasificacion: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Etiqueta de Producto Estratégico (CORE):</label>
                  <input
                    type="text"
                    className="input-control"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={config.label_core || ''}
                    onChange={e => setConfig({ ...config, label_core: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={15} /> {saving ? 'Guardando...' : 'Guardar y Aplicar Cambios Generales'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Two Column Layout: Catalogs Manager + Database Backup & Restore */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Dropdown Catalogs Manager */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Tag size={18} color="var(--accent-purple)" />
                Gestión de Listas Desplegables y Catálogos
              </div>
              <div className="card-subtitle">
                Agrega, edita o elimina las opciones de líneas, categorías, canales y tipos de cliente
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.76rem' }}
              onClick={() => setEditCatModal({
                open: true,
                rowId: null,
                data: { tipo: catalogType, valor: '', descripcion: '', orden: 0, activo: 1 }
              })}
            >
              Nuevo Valor
            </button>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Catalog Type Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'linea', label: 'Líneas' },
                { id: 'categoria', label: 'Categorías' },
                { id: 'formato', label: 'Formatos' },
                { id: 'canal', label: 'Canales' },
                { id: 'tipo_cliente', label: 'Tipos Cliente' },
                { id: 'mercado', label: 'Mercados' }
              ].map(cat => (
                <button
                  key={cat.id}
                  className={`btn ${catalogType === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                  onClick={() => {
                    setCatalogType(cat.id);
                    loadCatalogItems(cat.id);
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Catalog Items Table */}
            <div className="table-responsive" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Valor</th>
                    <th>Descripción</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catLoading ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>Cargando lista...</td></tr>
                  ) : catalogs.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)' }}>No hay valores registrados.</td></tr>
                  ) : (
                    catalogs.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.valor}</strong></td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.descripcion || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              onClick={() => setEditCatModal({ open: true, rowId: item.id, data: item })}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.72rem', color: 'var(--accent-rose)' }}
                              onClick={() => setDelCatModal({ open: true, id: item.id, label: item.valor })}
                            >
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Database Backup & Restore */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Database size={18} color="var(--accent-emerald)" />
                Respaldo y Restauración de Base de Datos
              </div>
              <div className="card-subtitle">
                Descarga una copia completa o restaura información anterior
              </div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Download Backup */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                Descargar Respaldo Completo (.db)
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Exporta toda la base de datos relacional con productos, ventas, presupuestos y auditoría.
              </p>
              <a
                href={api.downloadBackupUrl}
                className="btn btn-primary"
                download="respaldo_erp_comercial.db"
                style={{ textDecoration: 'none' }}
              >
                <Download size={15} /> Descargar Archivo de Respaldo
              </a>
            </div>

            {/* Restore from Backup */}
            <form onSubmit={handleRestoreSubmit} style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '4px' }}>
                Restaurar Base de Datos desde Respaldo
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Sube un archivo <code>.db</code> previamente descargado. Se generará un respaldo de seguridad automático antes de aplicar la restauración.
              </p>
              <input
                type="file"
                accept=".db,.sqlite"
                required
                onChange={e => setRestoreFile(e.target.files[0])}
                style={{ fontSize: '0.78rem', marginBottom: '10px', display: 'block' }}
              />

              {restoreMsg && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  marginBottom: '10px',
                  background: restoreMsg.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: restoreMsg.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  {restoreMsg.message}
                </div>
              )}

              <button
                type="submit"
                className="btn"
                disabled={restoring || !restoreFile}
                style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}
              >
                <Upload size={15} /> {restoring ? 'Restaurando...' : 'Restaurar Base de Datos'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Catalog Modal */}
      {editCatModal.open && (
        <CrudTableModal
          entity="catalogos"
          rowId={editCatModal.rowId}
          initialData={editCatModal.data}
          onClose={() => setEditCatModal({ open: false, rowId: null, data: null })}
          onSaved={() => loadCatalogItems(catalogType)}
        />
      )}

      {/* Delete Catalog Modal */}
      {delCatModal.open && (
        <DeleteConfirmModal
          entity="catalogos"
          ids={[delCatModal.id]}
          itemLabel={delCatModal.label}
          onClose={() => setDelCatModal({ open: false, id: null, label: '' })}
          onDeleted={() => loadCatalogItems(catalogType)}
        />
      )}
    </div>
  );
}
