import React, { useState } from 'react';
import { api } from '../api';
import { Bot, Send, Sparkles, X, AlertTriangle, TrendingUp, DollarSign, Lightbulb } from 'lucide-react';

export default function CopilotModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'copilot',
      title: '¡Hola! Soy tu Copilot Comercial IA',
      summary: 'Estoy conectado a la base de datos para responder consultas analíticas, auditar desvíos presupuestarios, analizar el mercado CUP y generar propuestas de metas para la Gestión 2026-2027.',
      recommendation: 'Haz clic en una de las preguntas frecuentes o escribe cualquier consulta comercial.'
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    const userMsg = { sender: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.askCopilot(q);
      setMessages(prev => [...prev, { sender: 'copilot', ...res }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'copilot',
        title: 'Error de Consulta',
        summary: 'No se pudo procesar la consulta: ' + err.message
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "¿Cuáles productos tienen problemas o desvíos negativos frente a la meta?",
    "Generar propuesta de presupuesto 2026-2027 con crecimiento ponderado",
    "Analizar oportunidades de mercado Retail y CUP",
    "Resumen ejecutivo de facturación y productos CORE"
  ];

  return (
    <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0 }}>
      <div className="modal-content" style={{
        maxWidth: '560px',
        height: '100vh',
        maxHeight: '100vh',
        borderRadius: '24px 0 0 24px',
        animation: 'slideInRight 0.3s ease-out'
      }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(90deg, #0f172a, #1e1b4b)' }}>
          <div className="card-title" style={{ color: '#fff' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0284c7, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Bot size={18} color="#fff" />
            </div>
            Asistente IA Copilot Comercial
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Message Thread */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', gap: '16px' }}>
          {/* Quick Prompts Chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
              Sugerencias Rápidas:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '14px', background: 'rgba(56, 189, 248, 0.08)' }}
                >
                  <Sparkles size={12} color="var(--accent-cyan)" /> {p}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {messages.map((m, idx) => {
            if (m.sender === 'user') {
              return (
                <div key={idx} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', padding: '10px 14px', borderRadius: '14px 14px 2px 14px', fontSize: '0.84rem' }}>
                  {m.text}
                </div>
              );
            }

            return (
              <div key={idx} style={{
                alignSelf: 'flex-start',
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                padding: '16px',
                borderRadius: '14px 14px 14px 2px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {m.title && (
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bot size={16} /> {m.title}
                  </div>
                )}

                <div style={{ fontSize: '0.84rem', lineHeight: '1.5', color: '#e2e8f0' }}>
                  {m.summary}
                </div>

                {/* Optional Data Table */}
                {m.data && Array.isArray(m.data) && m.data.length > 0 && (
                  <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px' }}>
                    <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
                      <tbody>
                        {m.data.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {Object.entries(row).map(([k, v], cIdx) => (
                              <td key={cIdx} style={{ padding: '4px 6px', color: cIdx === 0 ? 'var(--accent-cyan)' : 'inherit' }}>
                                {typeof v === 'number' ? v.toLocaleString() : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {m.recommendation && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderLeft: '3px solid var(--accent-emerald)',
                    padding: '8px 12px',
                    borderRadius: '0 6px 6px 0',
                    fontSize: '0.78rem',
                    color: '#a7f3d0'
                  }}>
                    <strong style={{ color: 'var(--accent-emerald)' }}>Recomendación:</strong> {m.recommendation}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="animate-spin" /> Analizando base de datos comercial y calculando indicadores...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.95)' }}>
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Pregunta sobre desvíos, presupuestos, precios..."
              style={{ flex: 1 }}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
