import React from 'react';
import { 
  DollarSign, 
  Users, 
  Wine, 
  QrCode, 
  ShieldCheck, 
  Calendar, 
  ChevronDown, 
  Settings,
  Sparkles,
  Building2
} from 'lucide-react';

export default function Navbar({ 
  eventData, 
  activeTab, 
  setActiveTab, 
  onOpenEventSelector,
  onOpenProducerSettings
}) {
  const hasBar = Boolean(eventData?.has_bar);
  const producerLogo = eventData?.producer_logo;
  const producerName = eventData?.producer_name || 'Productora';

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo de la Productora y Selector de Evento */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Botón interactivo para abrir ajustes de Productora */}
            <button
              onClick={onOpenProducerSettings}
              className="flex items-center gap-2.5 p-1.5 -ml-1.5 rounded-2xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
              title="Ajustes de Productora y Logo"
            >
              {producerLogo ? (
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm group-hover:border-emerald-500/50 transition">
                  <img
                    src={producerLogo}
                    alt={producerName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-black text-slate-950 text-xs tracking-wider shadow-sm shrink-0 group-hover:scale-105 transition">
                  {producerName.substring(0, 2).toUpperCase()}
                </div>
              )}

              <div className="hidden xs:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 block leading-tight max-w-[120px] sm:max-w-[150px] truncate">
                    {producerName}
                  </span>
                  <Settings className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition" />
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Panel de Producción</span>
              </div>
            </button>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            {/* Event Switcher */}
            <button
              onClick={onOpenEventSelector}
              className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 transition shadow-sm"
              title="Cambiar o crear evento"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-bold max-w-[130px] sm:max-w-[180px] truncate">
                {eventData?.name || 'Seleccionar Evento'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Navegación por Módulos */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('finances')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'finances'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden md:inline">Finanzas y Margen</span>
            </button>

            <button
              onClick={() => setActiveTab('attendees')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'attendees'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Asistentes & QR</span>
            </button>

            {hasBar && (
              <button
                onClick={() => setActiveTab('bar')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'bar'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                }`}
              >
                <Wine className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">Control Barra</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'scanner'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Escáner Puerta</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'audit'
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
              }`}
              title="Auditoría y Ciberseguridad"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
