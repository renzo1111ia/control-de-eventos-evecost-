import React, { useState, useRef } from 'react';
import { 
  Building2, 
  Mail, 
  Upload, 
  Trash2, 
  X, 
  Check, 
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { API_URL } from '../utils/api.js';
import { compressImage } from '../utils/image.js';

export default function ProducerSettingsModal({ eventId, eventData, onClose, onUpdated }) {
  const [producerName, setProducerName] = useState(eventData?.producer_name || '');
  const [producerEmail, setProducerEmail] = useState(eventData?.producer_email || '');
  const [logoUrl, setLogoUrl] = useState(eventData?.producer_logo || '');
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
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
      setError(err.message || 'Error al procesar la imagen del logo.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    try {
      setCompressing(true);
      setError('');
      const compressed = await compressImage(file, 400, 400, 0.9);
      setLogoUrl(compressed);
    } catch (err) {
      setError(err.message || 'Error al procesar la imagen del logo.');
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!producerName.trim()) {
      setError('El nombre de la productora es obligatorio.');
      return;
    }
    if (!producerEmail.trim()) {
      setError('El correo de contacto es obligatorio.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_URL}/api/events/${eventId}/producer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerName: producerName.trim(),
          producerEmail: producerEmail.trim(),
          producerLogo: logoUrl || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar productora');
      }

      const updated = await res.json();
      setSavedSuccess(true);
      setTimeout(() => {
        onUpdated(updated);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
        
        {/* Glow sutil de fondo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Identidad y Marca
                </span>
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Ajustes de Productora
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Personaliza el logo y los datos oficiales que verán tus asistentes.
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* CARGA DE LOGO OFICIAL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Logo de la Productora
              </label>

              {logoUrl ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700/80 p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      <img
                        src={logoUrl}
                        alt="Logo Productora"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Logo activo</span>
                      <span className="text-[11px] text-slate-400">
                        Se incluirá centrado en la cabecera de los correos QR.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-200 transition"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition"
                      title="Eliminar logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-6 text-center cursor-pointer transition group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition">
                    {compressing ? (
                      <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-white">
                    {compressing ? 'Optimizando imagen...' : 'Selecciona o arrastra el logo de tu productora'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Formatos PNG, JPG, WebP o SVG (se optimiza automáticamente)
                  </div>
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

            {/* NOMBRE DE LA PRODUCTORA */}
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 outline-none text-sm font-medium transition focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* CORREO DE SOPORTE */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Correo de Contacto / Soporte <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="contacto@productora.cl"
                  value={producerEmail}
                  onChange={(e) => setProducerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 outline-none text-sm font-medium transition focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Los asistentes podrán responder al correo recibido a esta dirección.
              </span>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading || compressing}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>¡Guardado!</span>
                  </>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
