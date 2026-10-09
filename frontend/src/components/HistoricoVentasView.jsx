import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { UploadCloud, Download, CheckCircle, AlertTriangle, FileSpreadsheet, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import CrudTableModal from './CrudTableModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function HistoricoVentasView({ regionalId }) {
  const [data, setData] = useState({ records: [], total_records: 0, total_importe_acumulado: 0, total_unidades_acumuladas: 0 });
  const [loading, setLoading] = useState(true);
  const [anioFilter, setAnioFilter] = useState('');
  const [config, setConfig] = useState({});

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, rowId: null, data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, label: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getHistoricoVentas(null, regionalId || null, anioFilter ? parseInt(anioFilter) : null, 100, 0),
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
  }, [regionalId, anioFilter]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setImportResult(null);

    try {
      const res = await api.uploadExcelVentas(uploadFile);
      setImportResult({ success: true, ...res });
      loadData();
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setUploading(false);
    }
  };

  const moneda = config.moneda || 'Bs.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Stats Bar */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Transacciones Registradas</span>
            <div className="kpi-icon-wrap"><FileSpreadsheet size={18} /></div>
          </div>
          <div className="kpi-value">{data.total_records.toLocaleString()}</div>
          <div className="kpi-subtext">Ventas históricas consolidadas</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-header">
            <span className="kpi-label">Volumen Acumulado de Unidades</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-emerald)' }}><CheckCircle size={18} /></div>
          </div>
          <div className="kpi-value">{Math.round(data.total_unidades_acumuladas).toLocaleString()}</div>
          <div className="kpi-subtext">Unidades comercializadas</div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-header">
            <span className="kpi-label">Importe Total Facturado</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-purple)' }}><FileSpreadsheet size={18} /></div>
          </div>
          <div className="kpi-value">{moneda} {data.total_importe_acumulado.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtext">Valor neto acumulado</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filtrar Año:</span>
            <select className="custom-select" value={anioFilter} onChange={e => setAnioFilter(e.target.value)}>
              <option value="">Todos los Años (2024 - 2026)</option>
              <option value="2026">Gestión 2026</option>
              <option value="2025">Gestión 2025</option>
              <option value="2024">Gestión 2024</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => setEditModal({ open: true, rowId: null, data: null })}
            >
              <Plus size={16} /> Nuevo Registro
            </button>

            <a 
              href={api.downloadExcelTemplateUrl} 
              className="btn btn-secondary"
              download="Plantilla_Ventas_Historicas.xlsx"
            >
              <Download size={16} /> Plantilla Excel
            </a>

            <button className="btn btn-secondary" onClick={() => { setShowImportModal(true); setImportResult(null); }}>
              <UploadCloud size={16} /> Importar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Sales History Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileSpreadsheet size={18} color="var(--accent-cyan)" />
            Registros de Ventas Históricas
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando {data.records.length} registros más recientes | Edita o borra cualquier venta
          </span>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Código</th>
                <th>Producto / Artículo</th>
                <th>Regional</th>
                <th>Cliente / Canal</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                <th style={{ textAlign: 'right' }}>Importe Neto</th>
                <th>Fuente</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Cargando histórico de ventas...
                  </td>
                </tr>
              ) : (
                data.records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {r.anio}-{String(r.mes).padStart(2, '0')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {r.producto_codigo}
                      </span>
                    </td>
                    <td><div style={{ fontWeight: 600 }}>{r.producto_nombre}</div></td>
                    <td><span className="badge-tag secondary">{r.regional_nombre}</span></td>
                    <td><div style={{ fontSize: '0.82rem' }}>{r.cliente_nombre}</div></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.cantidad?.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{moneda} {r.precio_unitario?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {moneda} {r.importe?.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {r.fuente}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 7px' }}
                          title="Editar registro de venta"
                          onClick={() => setEditModal({ open: true, rowId: r.id, data: r })}
                        >
                          <Edit2 size={13} color="var(--accent-cyan)" />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 7px' }}
                          title="Eliminar registro"
                          onClick={() => setDeleteModal({ open: true, id: r.id, label: `Venta #${r.id} (${r.producto_codigo} - ${r.anio}/${r.mes})` })}
                        >
                          <Trash2 size={13} color="var(--accent-rose)" />
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

      {/* Edit / Create Modal */}
      {editModal.open && (
        <CrudTableModal
          entity="historico_ventas"
          rowId={editModal.rowId}
          initialData={editModal.data}
          onClose={() => setEditModal({ open: false, rowId: null, data: null })}
          onSaved={loadData}
        />
      )}

      {/* Delete Modal */}
      {deleteModal.open && (
        <DeleteConfirmModal
          entity="historico_ventas"
          ids={[deleteModal.id]}
          itemLabel={deleteModal.label}
          onClose={() => setDeleteModal({ open: false, id: null, label: '' })}
          onDeleted={loadData}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="card-title">
                <UploadCloud size={18} color="var(--accent-cyan)" />
                Importar Planilla Excel de Ventas Históricas
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >✕</button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Sube el archivo Excel (<code>.xlsx</code>) con las columnas requeridas: Código de Producto, Cantidad, Precio Unitario, Año, Mes y Regional.
                  El sistema verificará celda por celda la integridad de los datos y la cuadratura matemática: <code>Importe = Cantidad × Precio</code>.
                </p>

                <div style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '30px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    required
                    onChange={e => setUploadFile(e.target.files[0])}
                    style={{ display: 'block', margin: '0 auto', fontSize: '0.84rem' }}
                  />
                  {uploadFile && (
                    <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      Archivo seleccionado: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                {/* Import Status Feedback */}
                {importResult && (
                  <div style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: importResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                    border: `1px solid ${importResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: importResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {importResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                      {importResult.message}
                    </div>

                    {importResult.success && (
                      <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        ✓ Filas importadas: <strong>{importResult.rows_count}</strong><br />
                        ✓ Total valorizado conciliado: <strong>{moneda} {importResult.total_importe?.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}

                    {importResult.warnings && importResult.warnings.length > 0 && (
                      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--accent-amber)' }}>
                        <strong>Advertencias de cuadratura resueltas:</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                          {importResult.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cerrar</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Validando e Importando...' : 'Iniciar Importación & Validación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
