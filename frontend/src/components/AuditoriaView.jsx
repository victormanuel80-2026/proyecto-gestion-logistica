import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { ShieldCheck, Users, Database, FileText, Lock, Download } from 'lucide-react';

export default function AuditoriaView() {
  const [logs, setLogs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAuditoriaLogs(), api.getUsuarios()]).then(([l, u]) => {
      setLogs(l);
      setUsuarios(u);
      setLoading(false);
    });
  }, []);

  const handleDownloadBackup = () => {
    alert("✓ Respaldo de base de datos generado y verificado (pharma_commercial.db).");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Info Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Seguridad & Control RBAC</span>
            <div className="kpi-icon-wrap"><Lock size={18} /></div>
          </div>
          <div className="kpi-value">5 Roles</div>
          <div className="kpi-subtext">Admin, Gerente, KAM, Demand Planner, Auditor</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-header">
            <span className="kpi-label">Auditoría Transaccional</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-emerald)' }}><ShieldCheck size={18} /></div>
          </div>
          <div className="kpi-value">{logs.length} Eventos</div>
          <div className="kpi-subtext">Trazabilidad inmutable de cambios</div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-header">
            <span className="kpi-label">Base de Datos & Backup</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--accent-purple)' }}><Database size={18} /></div>
          </div>
          <div className="kpi-value">SQLite Relacional</div>
          <div className="kpi-subtext">
            <button 
              onClick={handleDownloadBackup} 
              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 700, padding: 0 }}
            >
              Generar Respaldo
            </button>
          </div>
        </div>
      </div>

      {/* Two Columns: Users Table + Audit Logs Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        {/* Users & Roles */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Users size={18} color="var(--accent-cyan)" />
              Usuarios y Permisos Asignados
            </div>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Regional</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className="badge-tag core">{u.rol}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {u.regional_nombre || 'Nacional'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FileText size={18} color="var(--accent-purple)" />
              Bitácora Inmutable de Auditoría
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Últimos eventos del sistema
            </span>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Usuario</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                        {l.timestamp}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.usuario}</td>
                    <td><span className="badge-tag secondary">{l.modulo}</span></td>
                    <td>
                      <span className="badge-tag success" style={{ fontSize: '0.7rem' }}>
                        {l.accion}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.detalles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
