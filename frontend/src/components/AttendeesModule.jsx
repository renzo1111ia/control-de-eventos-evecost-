import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  QrCode, 
  Mail, 
  CheckCircle2, 
  Clock, 
  Download, 
  X,
  CreditCard,
  AlertCircle,
  Trash2,
  Ticket,
  Plus
} from 'lucide-react';
import { validarRUT, formatearRUT } from '../utils/rut.js';

export default function AttendeesModule({ eventId, attendees = [], tiers = [], onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(null); // Contiene datos para modal de entrada QR emitida
  const [showTiersModal, setShowTiersModal] = useState(false); // Modal para configurar tipos de entrada

  // Form State - Emitir Entrada
  const [fullName, setFullName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTierId, setSelectedTierId] = useState(tiers[0]?.id || '');
  const [pricePaid, setPricePaid] = useState(tiers[0]?.price || '');
  const [rutError, setRutError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form State - Crear Tipo de Entrada
  const [newTierName, setNewTierName] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [newTierCapacity, setNewTierCapacity] = useState('100');
  const [tierLoading, setTierLoading] = useState(false);

  // Sincronizar selección de tier si cambia la lista
  React.useEffect(() => {
    if (tiers.length > 0 && (!selectedTierId || !tiers.some(t => t.id === selectedTierId))) {
      setSelectedTierId(tiers[0].id);
      setPricePaid(tiers[0].price);
    }
  }, [tiers]);

  // Manejar cambio en tier para autocompletar precio
  const handleTierChange = (tierId) => {
    setSelectedTierId(tierId);
    const tier = tiers.find(t => t.id === tierId);
    if (tier) setPricePaid(tier.price);
  };

  // Crear nuevo tipo de entrada
  const handleCreateTier = async (e) => {
    e.preventDefault();
    if (!newTierName.trim() || newTierPrice === '') return;
    try {
      setTierLoading(true);
      const res = await fetch(`http://localhost:4000/api/events/${eventId}/tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTierName.trim(),
          price: Number(newTierPrice),
          capacity: Number(newTierCapacity) || 100
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear tipo de entrada');
      }
      const created = await res.json();
      setNewTierName('');
      setNewTierPrice('');
      setNewTierCapacity('100');
      onRefresh();
      setSelectedTierId(created.id);
      setPricePaid(created.price);
    } catch (err) {
      alert(err.message);
    } finally {
      setTierLoading(false);
    }
  };

  // Eliminar tipo de entrada
  const handleDeleteTier = async (tierId, tierName) => {
    if (!confirm(`¿Eliminar el tipo de entrada "${tierName}"?`)) return;
    try {
      const res = await fetch(`http://localhost:4000/api/events/${eventId}/tiers/${tierId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar');
      }
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRutChange = (e) => {
    const val = e.target.value;
    setRut(val);
    if (val.length >= 8) {
      if (!validarRUT(val)) {
        setRutError('RUT inválido (revisa el dígito verificador)');
      } else {
        setRutError('');
      }
    } else {
      setRutError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarRUT(rut)) {
      setRutError('Debes ingresar un RUT chileno válido.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`http://localhost:4000/api/events/${eventId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          rut: rut.trim(),
          email: email.trim(),
          tierId: selectedTierId,
          pricePaid: Number(pricePaid)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al emitir entrada');
      }

      const data = await res.json();
      setShowAddModal(false);
      setShowTicketModal(data); // Mostrar popup con el QR listo
      onRefresh();

      // Reset form
      setFullName('');
      setRut('');
      setEmail('');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de asistentes
  const filtered = attendees.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.full_name?.toLowerCase().includes(term) ||
      a.rut?.toLowerCase().includes(term) ||
      a.email?.toLowerCase().includes(term)
    );
  });

  const checkedInCount = attendees.filter(a => a.is_checked_in).length;
  const totalRevenueTickets = attendees.reduce((acc, a) => acc + Number(a.price_paid || 0), 0);

  const handleDeleteAttendee = async (attendeeId, attendeeName) => {
    if (!confirm(`¿Estás seguro de eliminar la entrada de "${attendeeName}"? Esto también anulará el ingreso registrado en finanzas.`)) return;
    try {
      const res = await fetch(`http://localhost:4000/api/events/${eventId}/attendees/${attendeeId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar');
      }
      onRefresh();
    } catch (err) {
      alert('Error al eliminar asistente: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen Superior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Total Entradas</span>
            <div className="text-2xl font-black text-white font-mono mt-1">{attendees.length}</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Ingresados en Puerta</span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {checkedInCount} <span className="text-xs text-slate-500 font-normal">/ {attendees.length}</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Recaudación Entradas</span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              ${totalRevenueTickets.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Acciones */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por Nombre, RUT o Correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowTiersModal(true)}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-emerald-500/50 px-4 py-2.5 rounded-xl font-bold text-xs transition active:scale-[0.99] whitespace-nowrap shadow-md"
            title="Definir tipos de entrada: Preventa, General, VIP con sus precios y cupos"
          >
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span>+ Ingreso de Entradas</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono font-bold">
              {tiers.length}
            </span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs transition shadow-lg shadow-emerald-500/20 active:scale-[0.99] whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Emitir Entrada & Enviar QR</span>
          </button>
        </div>
      </div>

      {/* Tabla de Asistentes */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Asistente</th>
                <th className="p-3.5">RUT</th>
                <th className="p-3.5">Correo</th>
                <th className="p-3.5">Tipo Entrada</th>
                <th className="p-3.5 text-right">Pagado</th>
                <th className="p-3.5 text-center">Estado Puerta</th>
                <th className="p-3.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No se encontraron asistentes con ese criterio.
                  </td>
                </tr>
              ) : (
                filtered.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-bold text-white">{att.full_name}</td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">{att.rut}</td>
                    <td className="p-3.5 text-slate-400">{att.email}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        {att.tier_name || 'General'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-white">
                      ${Number(att.price_paid).toLocaleString('es-CL')}
                    </td>
                    <td className="p-3.5 text-center">
                      {att.is_checked_in ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                          <CheckCircle2 className="w-3 h-3" />
                          INGRESÓ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full text-[10px] font-medium">
                          <Clock className="w-3 h-3" />
                          PENDIENTE
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleDeleteAttendee(att.id, att.full_name)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition inline-flex items-center justify-center"
                        title="Eliminar entrada registrada por error"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Emitir Entrada */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold">Emitir Entrada QR</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Daniel Gómez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  RUT Chileno (con o sin puntos/guión)
                </label>
                <input
                  type="text"
                  required
                  placeholder="12.345.678-9"
                  value={rut}
                  onChange={handleRutChange}
                  className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono ${
                    rutError ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
                {rutError && (
                  <span className="text-[11px] text-red-400 mt-1 block">{rutError}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="asistente@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Se enviará el QR automáticamente con el remitente de la productora.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">Tipo de Entrada</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setShowTiersModal(true);
                      }}
                      className="text-[10px] text-emerald-400 hover:underline font-bold"
                    >
                      + Configurar
                    </button>
                  </div>
                  {tiers.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setShowTiersModal(true);
                      }}
                      className="w-full py-2 px-3 bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs rounded-lg font-bold text-left hover:bg-amber-500/20 transition"
                    >
                      ⚠️ Sin entradas creadas. Clic para crear →
                    </button>
                  ) : (
                    <select
                      value={selectedTierId}
                      onChange={(e) => handleTierChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    >
                      {tiers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (${t.price.toLocaleString('es-CL')})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Precio Pagado ($)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pricePaid}
                    onChange={(e) => setPricePaid(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition disabled:opacity-50"
                >
                  {loading ? 'Generando QR...' : 'Emitir y Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup de Ticket Emitido con QR */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-white text-center relative">
            <button
              onClick={() => setShowTicketModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
              ¡Entrada Emitida con Éxito!
            </span>

            <h3 className="text-xl font-black mt-2 text-white">
              {showTicketModal.attendee.full_name}
            </h3>
            <p className="text-emerald-400 font-mono font-bold text-sm">
              RUT: {showTicketModal.attendee.rut}
            </p>

            <div className="bg-white p-4 rounded-xl my-4 inline-block shadow-lg">
              <img
                src={showTicketModal.qrDataUrl}
                alt="Código QR"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div>Tipo: <strong className="text-white">{showTicketModal.attendee.tier_name}</strong></div>
              <div>Correo: <strong className="text-white">{showTicketModal.attendee.email}</strong></div>
              {showTicketModal.emailSent ? (
                <div className="text-emerald-400 text-[11px] pt-1">
                  ✓ Correo enviado con el remitente de la productora
                </div>
              ) : (
                <div className="text-amber-400 text-[11px] pt-1">
                  ℹ️ QR generado localmente listo para escanear
                </div>
              )}
            </div>

            <button
              onClick={() => setShowTicketModal(null)}
              className="w-full mt-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
            >
              Listo / Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Configuración / Ingreso de Tipos de Entrada */}
      {showTiersModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Ingreso / Tipos de Entrada</h3>
                  <p className="text-[11px] text-slate-400">
                    Define las categorías de entradas (Preventa, General, VIP) para tu evento
                  </p>
                </div>
              </div>
              <button onClick={() => setShowTiersModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario Crear Tipo de Entrada */}
            <form onSubmit={handleCreateTier} className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <Plus className="w-4 h-4" />
                <span>Crear Nueva Categoría de Entrada</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Nombre de la Entrada</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Preventa 1, VIP, General"
                    value={newTierName}
                    onChange={(e) => setNewTierName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Precio ($ CLP)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="15000"
                    value={newTierPrice}
                    onChange={(e) => setNewTierPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Capacidad / Cupo</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={newTierCapacity}
                    onChange={(e) => setNewTierCapacity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={tierLoading || !newTierName.trim() || newTierPrice === ''}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition disabled:opacity-50 shadow-md shadow-emerald-500/20"
              >
                {tierLoading ? 'Guardando...' : '+ Guardar Tipo de Entrada'}
              </button>
            </form>

            {/* Lista de Tipos de Entrada Existentes */}
            <div className="mt-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Entradas Configuradas para este Evento ({tiers.length})
              </span>

              {tiers.length === 0 ? (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center text-xs text-slate-500">
                  No hay tipos de entrada creados aún. Ingresa el primero arriba.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {tiers.map((t) => {
                    const soldCount = attendees.filter(a => a.tier_id === t.id || a.tier_name === t.name).length;
                    return (
                      <div
                        key={t.id}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span className="truncate">{t.name}</span>
                            <span className="text-emerald-400 font-mono font-bold text-xs">
                              ${Number(t.price).toLocaleString('es-CL')}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cupo: {soldCount} emitidas / {t.capacity || 'Ilimitado'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTier(t.id, t.name)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                          title="Eliminar este tipo de entrada"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTiersModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
              >
                Listo / Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
