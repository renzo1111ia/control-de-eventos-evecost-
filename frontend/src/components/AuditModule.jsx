import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Clock, RefreshCw, Key, Database } from 'lucide-react';
import { API_URL } from '../utils/api.js';

export default function AuditModule({ eventId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/audit`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [eventId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Registro Inmutable de Auditoría & Ciberseguridad
          </h2>
          <p className="text-xs text-slate-400">
            Trazabilidad completa de operaciones financieras y accesos en puerta.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Logs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Cifrado de Entradas</span>
          <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-2">
            <Key className="w-4 h-4" />
            HMAC-SHA256 Activo
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Anti-falsificación y protección contra réplicas</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Rate Limiting</span>
          <div className="text-base font-bold text-emerald-400 mt-1">
            Activo (120 scans/min)
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Mitiga ataques de fuerza bruta en puerta</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Integridad Contable</span>
          <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Transacciones ACID
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Consistencia en inventario de barra e ingresos</span>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Últimos Eventos de Seguridad Registrados
          </h3>
        </div>

        <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No hay eventos de auditoría registrados aún.
            </div>
          ) : (
            logs.map((log) => {
              const isAlert = log.action.includes('ALERT') || log.action.includes('FAKE');
              return (
                <div key={log.id} className="p-4 flex items-start justify-between text-xs hover:bg-slate-800/40 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isAlert ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {log.action}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">{log.ip_address}</span>
                    </div>
                    <div className="text-white font-medium break-all max-w-xl">
                      {log.details}
                    </div>
                  </div>
                  <div className="text-slate-500 text-[11px] whitespace-nowrap ml-4">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
