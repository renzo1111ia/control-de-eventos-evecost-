import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import SetupModal from './components/SetupModal.jsx';
import EventSelectorModal from './components/EventSelectorModal.jsx';
import FinanceModule from './components/FinanceModule.jsx';
import AttendeesModule from './components/AttendeesModule.jsx';
import BarStockModule from './components/BarStockModule.jsx';
import ScannerModule from './components/ScannerModule.jsx';
import AuditModule from './components/AuditModule.jsx';

export default function App() {
  const [events, setEvents] = useState([]);
  const [currentEventId, setCurrentEventId] = useState('11111111-1111-1111-1111-111111111111');
  const [eventData, setEventData] = useState(null);
  const [activeTab, setActiveTab] = useState('finances');
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [loading, setLoading] = useState(true);

  // Datos específicos de módulos
  const [financeData, setFinanceData] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [barData, setBarData] = useState({ inventory: [], sales: [], closings: [], courtesyRecipients: [], courtesies: [] });

  // 1. Cargar lista de eventos
  const fetchEvents = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/events');
      const data = await res.json();
      setEvents(data);
      if (data.length > 0 && !currentEventId) {
        setCurrentEventId(data[0].id);
      }
    } catch (err) {
      console.error('Error al cargar eventos:', err);
    }
  };

  // 2. Cargar datos del evento seleccionado
  const fetchEventData = async (eventId) => {
    if (!eventId) return;
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:4000/api/events/${eventId}`);
      if (!res.ok) throw new Error('Evento no encontrado');
      const data = await res.json();
      setEventData(data);

      // Cargar datos financieros
      const finRes = await fetch(`http://localhost:4000/api/events/${eventId}/finances`);
      const finData = await finRes.json();
      setFinanceData(finData);

      // Cargar asistentes
      const attRes = await fetch(`http://localhost:4000/api/events/${eventId}/attendees`);
      const attData = await attRes.json();
      setAttendees(attData);

      // Cargar barra (si aplica)
      if (data.has_bar) {
        const barRes = await fetch(`http://localhost:4000/api/events/${eventId}/bar`);
        const bData = await barRes.json();
        setBarData(bData);
      }
    } catch (err) {
      console.error('Error al cargar datos del evento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (currentEventId) {
      fetchEventData(currentEventId);
    }
  }, [currentEventId]);

  // Manejar finalización del SetupModal bloqueante
  const handleSetupComplete = (updatedEvent) => {
    setEventData(updatedEvent);
    fetchEvents();
    // Si tiene barra, redirigir inmediatamente a cargar stock
    if (updatedEvent.has_bar) {
      setActiveTab('bar');
    } else {
      setActiveTab('finances');
    }
  };

  // Crear nuevo evento
  const handleCreateEvent = async (name, date) => {
    try {
      const res = await fetch('http://localhost:4000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, eventDate: date })
      });
      const newEvent = await res.json();
      await fetchEvents();
      setCurrentEventId(newEvent.id);
      setShowEventSelector(false);
    } catch (err) {
      alert('Error al crear evento: ' + err.message);
    }
  };

  // Eliminar evento
  const handleDeleteEvent = async (eventId, eventName) => {
    try {
      const res = await fetch(`http://localhost:4000/api/events/${eventId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar evento');
      }
      const updatedEvents = events.filter(e => e.id !== eventId);
      setEvents(updatedEvents);
      if (currentEventId === eventId) {
        if (updatedEvents.length > 0) {
          setCurrentEventId(updatedEvents[0].id);
        } else {
          await fetchEvents();
        }
      }
    } catch (err) {
      alert('Error al eliminar evento: ' + err.message);
    }
  };

  const handleRefresh = () => {
    if (currentEventId) {
      fetchEventData(currentEventId);
    }
  };

  if (loading && !eventData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Iniciando Plataforma de Control para Productoras...
        </span>
      </div>
    );
  }

  // 🔒 MODAL BLOQUEANTE: Si el evento no ha sido configurado (is_configured === 0),
  // se muestra obligatoriamente antes de poder ver cualquier pantalla.
  const requiresSetup = eventData && (eventData.is_configured === 0 || eventData.is_configured === false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Modal Bloqueante Inicial (1 sola vez por evento) */}
      {requiresSetup && (
        <SetupModal
          eventId={currentEventId}
          defaultEventName={eventData?.name}
          onComplete={handleSetupComplete}
        />
      )}

      {/* Selector de Evento */}
      {showEventSelector && (
        <EventSelectorModal
          events={events}
          currentEventId={currentEventId}
          onSelectEvent={(id) => {
            setCurrentEventId(id);
            setShowEventSelector(false);
          }}
          onCreateEvent={handleCreateEvent}
          onDeleteEvent={handleDeleteEvent}
          onClose={() => setShowEventSelector(false)}
        />
      )}

      {/* Navbar Superior */}
      <Navbar
        eventData={eventData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenEventSelector={() => setShowEventSelector(true)}
      />

      {/* Contenido Principal según Pestaña Activa */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'finances' && (
          <FinanceModule
            eventId={currentEventId}
            financeData={financeData}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'attendees' && (
          <AttendeesModule
            eventId={currentEventId}
            attendees={attendees}
            tiers={eventData?.tiers || []}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'bar' && eventData?.has_bar && (
          <BarStockModule
            eventId={currentEventId}
            barData={barData}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'scanner' && (
          <ScannerModule
            eventId={currentEventId}
            onScanSuccess={handleRefresh}
          />
        )}

        {activeTab === 'audit' && (
          <AuditModule
            eventId={currentEventId}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistema de Control y Ciberseguridad para Productoras de Eventos</span>
          <span className="font-mono text-[11px] text-slate-500">v1.0.0 • SQLite/PostgreSQL Ready</span>
        </div>
      </footer>
    </div>
  );
}
