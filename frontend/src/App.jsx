import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Pill, FileSpreadsheet, Calendar, Network, 
  Cpu, Globe, DollarSign, ShieldCheck, Bot, Sparkles, User, Filter,
  Database, Settings
} from 'lucide-react';

import { api } from './api';
import DashboardView from './components/DashboardView';
import ProductosView from './components/ProductosView';
import PresupuestoView from './components/PresupuestoView';
import HistoricoVentasView from './components/HistoricoVentasView';
import ForecastSolverView from './components/ForecastSolverView';
import OrdenItemView from './components/OrdenItemView';
import MercadoCupView from './components/MercadoCupView';
import PreciosView from './components/PreciosView';
import DataMasterView from './components/DataMasterView';
import ConfiguracionView from './components/ConfiguracionView';
import AuditoriaView from './components/AuditoriaView';
import CopilotModal from './components/CopilotModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({
    empresa_nombre: 'Mi Empresa S.A.',
    empresa_slogan: 'Commercial Intelligence & IA',
    sector: 'Farmacéutico',
    moneda: 'Bs.'
  });
  
  // Global Filters
  const [selectedRegional, setSelectedRegional] = useState('');
  const [selectedLinea, setSelectedLinea] = useState('');
  const [lineasDisponibles, setLineasDisponibles] = useState([]);
  const [copilotOpen, setCopilotOpen] = useState(false);

  useEffect(() => {
    api.getConfig().then(cfg => {
      if (cfg) setConfig(cfg);
    });
    // Load catalog options for business lines dynamically
    api.listRows('catalogos', { f_tipo: 'linea', limit: 50 }).then(res => {
      if (res.rows?.length) {
        setLineasDisponibles(res.rows.map(r => r.valor));
      }
    });
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Gerencial', icon: BarChart3, badge: 'En Vivo' },
    { id: 'productos', label: 'Catálogo de Artículos', icon: Pill },
    { id: 'historico', label: 'Histórico Ventas & Excel', icon: FileSpreadsheet },
    { id: 'presupuesto', label: 'Presupuesto Fiscal (Abr-Mar)', icon: Calendar, badge: '5 Escenarios' },
    { id: 'orden_item', label: 'Planificación Orden × Ítem', icon: Network },
    { id: 'forecast', label: 'Forecast IA & Solver', icon: Cpu, badge: 'AutoML' },
    { id: 'mercado', label: 'Inteligencia de Mercado', icon: Globe },
    { id: 'precios', label: 'Gestión Precios & Impacto', icon: DollarSign },
    { id: 'data_master', label: 'Gestor Tablas & CRUD', icon: Database, badge: '12 Tablas' },
    { id: 'configuracion', label: 'Configuración Empresa & Sector', icon: Settings, badge: 'Multi-sector' },
    { id: 'auditoria', label: 'Seguridad & Auditoría', icon: ShieldCheck },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-logo-icon">
            {config.empresa_nombre ? config.empresa_nombre.charAt(0).toUpperCase() : 'E'}
          </div>
          <div className="brand-info">
            <h2 title={config.empresa_nombre}>{config.empresa_nombre}</h2>
            <p>{config.sector || 'ERP Comercial'}</p>
          </div>
        </div>

        <nav className="nav-menu">
          <div className="nav-section-title">Módulos del Sistema</div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div 
                key={item.id} 
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge && <span className="nav-item-badge">{item.badge}</span>}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">AD</div>
            <div className="user-details">
              <h4>Administrador General</h4>
              <span>● Moneda: {config.moneda || 'Bs.'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-wrapper">
        {/* Sticky Top Header with Global Filters */}
        <header className="top-header">
          <div className="header-title-zone">
            <h1>{config.empresa_nombre} · Planificación Comercial & Forecasting IA</h1>
            <p>
              Sector: <strong>{config.sector || 'Comercial'}</strong> | Ciclo Presupuestario: Gestión 2026-2027 (Abril – Marzo)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Global Filters Bar */}
            <div className="global-filters">
              <div className="filter-group">
                <label>Regional:</label>
                <select 
                  className="custom-select"
                  value={selectedRegional}
                  onChange={e => setSelectedRegional(e.target.value)}
                >
                  <option value="">Nacional (Todas)</option>
                  <option value="1">Santa Cruz</option>
                  <option value="2">La Paz - El Alto</option>
                  <option value="3">Cochabamba</option>
                  <option value="4">Chuquisaca</option>
                  <option value="5">Tarija</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Línea:</label>
                <select 
                  className="custom-select"
                  value={selectedLinea}
                  onChange={e => setSelectedLinea(e.target.value)}
                >
                  <option value="">Todas las Líneas</option>
                  {lineasDisponibles.map((l, i) => (
                    <option key={i} value={l}>{l}</option>
                  ))}
                  {!lineasDisponibles.length && (
                    <>
                      <option value="Línea Ética">Línea Ética</option>
                      <option value="Línea Cardiometabólica">Línea Cardiometabólica</option>
                      <option value="Línea Respiratoria">Línea Respiratoria</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* AI Copilot Trigger Button */}
            <button className="copilot-trigger-btn" onClick={() => setCopilotOpen(true)}>
              <Sparkles size={16} />
              <span>Copilot IA</span>
            </button>
          </div>
        </header>

        {/* View Routing */}
        <section className="content-body">
          {activeTab === 'dashboard' && (
            <DashboardView 
              regionalId={selectedRegional ? parseInt(selectedRegional) : null} 
              linea={selectedLinea || null} 
            />
          )}

          {activeTab === 'productos' && (
            <ProductosView />
          )}

          {activeTab === 'historico' && (
            <HistoricoVentasView 
              regionalId={selectedRegional ? parseInt(selectedRegional) : null} 
            />
          )}

          {activeTab === 'presupuesto' && (
            <PresupuestoView 
              regionalId={selectedRegional ? parseInt(selectedRegional) : null} 
              linea={selectedLinea || null} 
            />
          )}

          {activeTab === 'orden_item' && (
            <OrdenItemView />
          )}

          {activeTab === 'forecast' && (
            <ForecastSolverView 
              regionalId={selectedRegional ? parseInt(selectedRegional) : null} 
            />
          )}

          {activeTab === 'mercado' && (
            <MercadoCupView />
          )}

          {activeTab === 'precios' && (
            <PreciosView />
          )}

          {activeTab === 'data_master' && (
            <DataMasterView />
          )}

          {activeTab === 'configuracion' && (
            <ConfiguracionView onConfigSaved={(newCfg) => setConfig(newCfg)} />
          )}

          {activeTab === 'auditoria' && (
            <AuditoriaView />
          )}
        </section>
      </main>

      {/* AI Copilot Modal Drawer */}
      <CopilotModal isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
