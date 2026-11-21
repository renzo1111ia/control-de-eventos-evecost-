import React, { useState } from 'react';
import { Calendar, Plus, X, Check, Building2, Search, Sparkles, Trash2 } from 'lucide-react';

export default function EventSelectorModal({ 
  events = [], 
  currentEventId, 
  onSelectEvent, 
  onCreateEvent, 
  onDeleteEvent,
  onClose 
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    setLoading(true);
    await onCreateEvent(newEventName.trim(), newEventDate);
    setLoading(false);
    setShowCreateForm(false);
    setNewEventName('');
    setNewEventDate('');
  };

  const filteredEvents = events.filter(ev => 
    ev.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ev.producer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Selector Multi-Evento
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Crea y cambia entre distintas fiestas o producciones
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showCreateForm ? (
          <div className="mt-4 space-y-4">
            {/* Buscador de eventos */}
            {events.length > 3 && (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar fiesta o productora..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                />
              </div>
            )}

            {/* Lista de Fiestas / Eventos */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredEvents.map((ev) => {
                const isSelected = ev.id === currentEventId;
                const dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString('es-CL', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Fecha por definir';

                return (
                  <div
                    key={ev.id}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60 ring-2 ring-emerald-500/20 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectEvent(ev.id)}
                      className="flex-1 text-left space-y-1 min-w-0"
                    >
                      <div className="font-bold text-sm flex items-center gap-2 truncate">
                        <span className="truncate">{ev.name}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black shrink-0">
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-300">{ev.producer_name || 'Sin productora'}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                        <span>•</span>
                        <span>{ev.has_bar ? '🍸 Con Barra' : '🚫 Sin Barra'}</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && <Check className="w-5 h-5 text-emerald-400 mr-1" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Estás seguro de eliminar permanentemente la fiesta "${ev.name}" y todos sus datos?`)) {
                            onDeleteEvent && onDeleteEvent(ev.id, ev.name);
                          }
                        }}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                        title="Eliminar evento creado por error"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 text-xs transition shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ Crear Nueva Fiesta / Evento</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              Nueva Fiesta
            </span>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nombre de la Fiesta / Evento</label>
              <input
                type="text"
                required
                placeholder="Ej: Open Air Techno Festival Vol. 2"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Fecha Programada</label>
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl disabled:opacity-50 transition"
              >
                {loading ? 'Creando...' : 'Crear y Abrir'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
