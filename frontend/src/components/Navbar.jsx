import React from 'react';
import { 
  DollarSign, 
  Users, 
  Wine, 
  QrCode, 
  ShieldCheck, 
  Calendar, 
  ChevronDown, 
  Sparkles 
} from 'lucide-react';

export default function Navbar({ 
  eventData, 
  activeTab, 
  setActiveTab, 
  onOpenEventSelector 
}) {
  const hasBar = Boolean(eventData?.has_bar);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Selector de Evento */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-sm">
                EP
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 block leading-tight">
                  {eventData?.producer_name || 'Productora'}
                </span>
                <span className="text-xs text-slate-400 font-medium">Control Producciones</span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            {/* Event Switcher Pill */}
            <button
              onClick={onOpenEventSelector}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 transition"
              title="Cambiar o crear evento"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold max-w-[150px] sm:max-w-[200px] truncate">
                {eventData?.name || 'Seleccionar Evento'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Navegación por Módulos */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('finances')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'finances'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden md:inline">Finanzas y Margen</span>
            </button>

            <button
              onClick={() => setActiveTab('attendees')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'attendees'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300'
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
