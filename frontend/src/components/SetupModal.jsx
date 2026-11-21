import React, { useState } from 'react';
import { Wine, Building2, Mail, Calendar, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function SetupModal({ eventId, onComplete, defaultEventName = '' }) {
  const [producerName, setProducerName] = useState('');
  const [producerEmail, setProducerEmail] = useState('');
  const [eventName, setEventName] = useState(defaultEventName || '');
  const [hasBar, setHasBar] = useState(null); // null obliga a elegir obligatoriamente
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!producerName.trim()) {
      setError('Debes ingresar el nombre de la productora.');
      return;
    }
    if (!producerEmail.trim()) {
      setError('Debes ingresar el correo de contacto de la productora.');
      return;
    }
    if (hasBar === null) {
      setError('Debes indicar si el evento contará con barra de tragos o no.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`http://localhost:4000/api/events/${eventId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerName: producerName.trim(),
          producerEmail: producerEmail.trim(),
          eventName: eventName.trim(),
          hasBar: Boolean(hasBar)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar configuración inicial');
      }

      const updatedEvent = await res.json();
      onComplete(updatedEvent);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
        {/* Glow decorativo de fondo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Configuración Inicial Requerida
            </span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            Antes de ingresar al panel
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Esta configuración se realiza <strong>una sola vez</strong>. Define el remitente oficial de los correos QR y activa los módulos necesarios.
          </p>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Nombre de la Productora */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Nombre de la Productora <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-5 h-5 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Ej: Renton Producciones, Psicosis Events"
                  value={producerName}
                  onChange={(e) => setProducerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Aparecerá como remitente oficial en los correos con entradas QR.
              </span>
            </div>

            {/* Correo de Contacto */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Correo de contacto / Soporte <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="entradas@tudominio.cl"
                  value={producerEmail}
                  onChange={(e) => setProducerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                />
              </div>
            </div>

            {/* Nombre del Evento */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Nombre del Evento
              </label>
              <div className="relative">
                <Calendar className="w-5 h-5 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Ej: Festival Electrónico Sunset 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                />
              </div>
            </div>

            {/* Switch de Barra */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                ¿Este evento contará con Barra de Tragos? <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHasBar(true)}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    hasBar === true
                      ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wine className={`w-5 h-5 ${hasBar === true ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="font-bold text-sm">SÍ, tiene barra</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Abre el panel de stock inicial, ventas POS y arqueo de caja.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setHasBar(false)}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    hasBar === false
                      ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/30 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">NO tiene barra</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Oculta el módulo de barra para mantener la interfaz limpia.
                  </p>
                </button>
              </div>
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <span>Guardando configuración...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Cifrado y firma criptográfica HMAC-SHA256 activa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
