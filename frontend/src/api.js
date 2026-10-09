const BASE_URL = "http://127.0.0.1:8000/api";

export async function fetchApi(endpoint, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || err.detail || "Error en la petición");
    }
    return await res.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Dashboard
  getDashboardSummary: (gestionId = 1, regionalId = null, linea = null) => {
    let url = `/dashboard/summary?gestion_id=${gestionId}`;
    if (regionalId) url += `&regional_id=${regionalId}`;
    if (linea) url += `&linea=${encodeURIComponent(linea)}`;
    return fetchApi(url);
  },

  // Productos
  getProductos: (linea = null, core = null, search = null) => {
    let url = `/productos?`;
    if (linea) url += `&linea=${encodeURIComponent(linea)}`;
    if (core !== null) url += `&core=${core}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return fetchApi(url);
  },

  createProducto: (data) => fetchApi("/productos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),

  // Regionales & Clientes
  getRegionales: () => fetchApi("/regionales"),
  getClientes: (regId = null) => fetchApi(`/clientes${regId ? `?regional_id=${regId}` : ""}`),

  // Historico Ventas
  getHistoricoVentas: (prodId = null, regId = null, anio = null, limit = 50, offset = 0) => {
    let url = `/historico-ventas?limit=${limit}&offset=${offset}`;
    if (prodId) url += `&producto_id=${prodId}`;
    if (regId) url += `&regional_id=${regId}`;
    if (anio) url += `&anio=${anio}`;
    return fetchApi(url);
  },

  uploadExcelVentas: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/excel/import`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail?.message || err.message || "Error al importar Excel");
    }
    return await res.json();
  },

  downloadExcelTemplateUrl: `${BASE_URL}/excel/template`,

  // Presupuesto
  getPresupuestoMatriz: (gestionId = 1, escenario = "OFICIAL", regId = null, linea = null) => {
    let url = `/presupuesto/matriz?gestion_id=${gestionId}&escenario_tipo=${escenario}`;
    if (regId) url += `&regional_id=${regId}`;
    if (linea) url += `&linea=${encodeURIComponent(linea)}`;
    return fetchApi(url);
  },

  updatePresupuestoCelda: (data) => fetchApi("/presupuesto/actualizar-celda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),

  // Orden x Item
  getPlanOrdenItem: (clienteId, productoId) => 
    fetchApi(`/planificacion-orden-item?cliente_id=${clienteId}&producto_id=${productoId}`),
  distributeOrdenItem: (data) => fetchApi("/planificacion-orden-item/distribuir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),

  // Forecast & Solver
  getProductForecast: (productId, regId = null) => {
    let url = `/forecast/product/${productId}`;
    if (regId) url += `?regional_id=${regId}`;
    return fetchApi(url);
  },

  runSolver: (data) => fetchApi("/forecast/solver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),

  // Mercado CUP
  getMercadoCup: (mercado = null) => {
    let url = `/mercado-cup`;
    if (mercado) url += `?mercado=${encodeURIComponent(mercado)}`;
    return fetchApi(url);
  },

  // Precios
  getHistorialPrecios: (prodId) => fetchApi(`/precios/historial/${prodId}`),
  simularPrecio: (data) => fetchApi("/precios/simular-y-guardar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),

  // Copilot IA
  askCopilot: (query, context = null) => fetchApi("/copilot/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, context })
  }),

  // Auditoria & Usuarios
  getAuditoriaLogs: () => fetchApi("/auditoria?limit=50"),
  getUsuarios: () => fetchApi("/usuarios"),

  // ==========================================
  // MOTOR CRUD GENÉRICO & CONFIGURACIÓN
  // ==========================================
  getEntities: () => fetchApi("/crud/entities"),
  getSchema: (entity) => fetchApi(`/crud/${entity}/schema`),
  listRows: (entity, params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, v);
    });
    return fetchApi(`/crud/${entity}?${qs.toString()}`);
  },
  getRow: (entity, id) => fetchApi(`/crud/${entity}/${id}`),
  createRow: (entity, data) => fetchApi(`/crud/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),
  updateRow: (entity, id, data) => fetchApi(`/crud/${entity}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),
  deleteRow: (entity, id, cascade = false) => fetchApi(`/crud/${entity}/${id}?cascade=${cascade}`, {
    method: "DELETE"
  }),
  bulkDelete: (entity, ids, cascade = false) => fetchApi(`/crud/${entity}/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, cascade })
  }),
  previewDependencies: (entity, ids) => fetchApi(`/crud/${entity}/dependencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  }),

  // Presupuesto avanzado
  deletePresupuestoFila: (escenarioId, productoId, regionalId = null) => {
    let url = `/presupuesto/fila?escenario_id=${escenarioId}&producto_id=${productoId}`;
    if (regionalId) url += `&regional_id=${regionalId}`;
    return fetchApi(url, { method: "DELETE" });
  },
  copyEscenario: (data) => fetchApi("/presupuesto/escenarios/copiar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),
  bulkAdjustBudget: (data) => fetchApi("/presupuesto/ajuste-masivo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),

  // Configuración de Empresa & Sector
  getConfig: () => fetchApi("/config"),
  saveConfig: (data) => fetchApi("/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }),
  downloadBackupUrl: `${BASE_URL}/backup`,
  restoreBackup: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/restore`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.detail?.message || err.detail || err.message || "Error al restaurar");
    }
    return await res.json();
  }
};
