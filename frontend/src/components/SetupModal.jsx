import React, { useState, useRef } from 'react';
import { 
  Wine, 
  Building2, 
  Mail, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { API_URL } from '../utils/api.js';
import { compressImage } from '../utils/image.js';

export default function SetupModal({ eventId, onComplete, defaultEventName = '' }) {
  const [producerName, setProducerName] = useState('');
  const [producerEmail, setProducerEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [eventName, setEventName] = useState(defaultEventName || '');
  const [hasBar, setHasBar] = useState(null); // null obliga a elegir obligatoriamente
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressing(true);
      setError('');
      const compressed = await compressImage(file, 400, 400, 0.9);
      setLogoUrl(compressed);
    } catch (err) {
      setError(err.message || 'Error al procesar el logo');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
      const res = await fetch(`${API_URL}/api/events/${eventId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerName: producerName.trim(),
          producerEmail: producerEmail.trim(),
          producerLogo: logoUrl || null,
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
        {/* Glow decorativo de fondo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Configuración Inicial Requerida
            </span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            Antes de ingresar al panel
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Esta configuración se realiza <strong>una sola vez</strong>. Define el remitente oficial de los correos QR, tu logo oficial y activa los módulos necesarios.
          </p>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            
            {/* CARGA OPCIONAL DE LOGO */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Logo de la Productora <span className="text-slate-500 font-normal lowercase">(opcional, editable luego)</span>
              </label>

              {logoUrl ? (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 p-1.5 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <span className="text-xs text-slate-300 font-medium">Logo cargado correctamente</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/50 hover:bg-slate-950 rounded-2xl p-3.5 flex items-center justify-center gap-3 cursor-pointer transition text-xs text-slate-400 hover:text-slate-200"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>{compressing ? 'Optimizando...' : 'Cargar logo de la productora (PNG/JPG)'}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Nombre de la Productora */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Nombre de la Productora <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ej: Psicosis Producciones"
                  value={producerName}
                  onChange={(e) => setProducerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            {/* Correo de Contacto */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Correo de contacto / Soporte <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="entradas@tudominio.cl"
                  value={producerEmail}
                  onChange={(e) => setProducerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            {/* Nombre del Evento */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Nombre del Evento
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Ej: Festival Electrónico Sunset 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 outline-none text-sm font-medium transition"
                />
              </div>
            </div>

            {/* Switch de Barra */}
            <div className="pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                ¿Este evento contará con Barra de Tragos? <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHasBar(true)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    hasBar === true
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wine className={`w-4 h-4 ${hasBar === true ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="font-bold text-xs">SÍ, tiene barra</span>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight block">
                    Habilita control de stock, ventas POS y arqueo de caja.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHasBar(false)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    hasBar === false
                      ? 'bg-blue-500/10 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xs">NO tiene barra</span>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight block">
                    Oculta el módulo de barra para mantener la interfaz limpia.
                  </span>
                </button>
              </div>
            </div>

            {/* Botón de Enviar */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading || compressing}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Guardando configuración...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar al Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
