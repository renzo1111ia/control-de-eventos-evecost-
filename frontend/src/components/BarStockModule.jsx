import React, { useState } from 'react';
import {
  Wine,
  Plus,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Package,
  Layers,
  ClipboardList,
  History,
  X,
  ChevronDown,
  ChevronUp,
  Gift,
  Users,
  Trash2,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  UserPlus
} from 'lucide-react';

// --- Badges de Rol de Cortesía ---
const RoleBadge = ({ role }) => {
  const map = {
    PRODUCCION: { label: 'Producción', cls: 'bg-violet-900/60 text-violet-300 border border-violet-700' },
    DJ: { label: 'DJ', cls: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
    INVITADO: { label: 'Invitado', cls: 'bg-amber-900/60 text-amber-300 border border-amber-700' },
    OTRO: { label: 'Otro', cls: 'bg-slate-800 text-slate-300 border border-slate-600' },
  };
  const cfg = map[role] || map['OTRO'];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export default function BarStockModule({ eventId, barData = {}, onRefresh }) {
  const {
    inventory = [],
    sales = [],
    closings = [],
    courtesyRecipients = [],
    courtesies = []
  } = barData;

  // --- Estados Form agregar producto ---
  const [productName, setProductName] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [initialStock, setInitialStock] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Modal Arqueo Físico ---
  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [breakdownItems, setBreakdownItems] = useState([]);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [closingResult, setClosingResult] = useState(null);
  const [expandedClosingId, setExpandedClosingId] = useState(null);

  // --- Modal Cortesía ---
  const [courtesyModal, setCourtesyModal] = useState(null); // { product } | null
  const [courtesyRecipientId, setCourtesyRecipientId] = useState('');
  const [courtesyQty, setCourtesyQty] = useState(1);
  const [courtesyNotes, setCourtesyNotes] = useState('');
  const [courtesyMsg, setCourtesyMsg] = useState(null); // { type: 'ok'|'err', text }

  // --- Control de Cortesías (sección colapsable) ---
  const [showCourtesySection, setShowCourtesySection] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientRole, setNewRecipientRole] = useState('PRODUCCION');
  const [newRecipientBudget, setNewRecipientBudget] = useState('');
  const [recipientLoading, setRecipientLoading] = useState(false);

  // Calcular consumo por destinatario
  const getRecipientUsage = (recipientId) => {
    return courtesies
      .filter(c => c.recipient_id === recipientId)
      .reduce((acc, c) => acc + Number(c.quantity || 0), 0);
  };

  const selectedRecipientObj = courtesyRecipients.find(r => r.id === courtesyRecipientId);
  const selectedRecipientUsed = selectedRecipientObj ? getRecipientUsage(selectedRecipientObj.id) : 0;
  const selectedRecipientBudget = selectedRecipientObj ? Number(selectedRecipientObj.courtesy_budget || 0) : 0;
  const selectedRecipientRemaining = selectedRecipientBudget > 0 ? Math.max(0, selectedRecipientBudget - selectedRecipientUsed) : null;

  // ============================================================
  // ARQUEO
  // ============================================================
  const handleOpenArqueo = () => {
    const items = inventory.map(item => ({
      productId: item.id,
      productName: item.product_name,
      initialStock: item.initial_stock,
      leftoverStock: item.current_stock,
      salePrice: item.sale_price,
    }));
    setBreakdownItems(items);
    setActualCash('');
    setNotes('');
    setClosingResult(null);
    setShowArqueoModal(true);
  };

  const handleLeftoverChange = (index, value) => {
    const updated = [...breakdownItems];
    updated[index].leftoverStock = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setBreakdownItems(updated);
  };

  const calculateTheoreticalTotal = () =>
    breakdownItems.reduce((acc, item) => {
      const consumed = Math.max(0, item.initialStock - item.leftoverStock);
      return acc + consumed * item.salePrice;
    }, 0);

  const theoreticalTotal = calculateTheoreticalTotal();
  const actualCashNum = Number(actualCash || 0);
  const liveDiscrepancy = actualCashNum - theoreticalTotal;

  // ============================================================
  // ELIMINAR PRODUCTO DE BARRA REGISTRADO POR ERROR
  // ============================================================
  const handleDeleteProduct = async (productId, productName) => {
    if (!confirm(`¿Eliminar el producto "${productName}" de la barra? También se anulará el gasto de compra inicial en finanzas.`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar/${productId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar producto');
      }
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ANULAR ENTREGA DE CORTESÍA (devuelve stock al producto)
  // ============================================================
  const handleCancelCourtesy = async (courtesyId, productName, recipientName, qty) => {
    if (!confirm(`¿Anular la entrega de ${qty}x "${productName}" a ${recipientName}? El stock será devuelto automáticamente al inventario.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar/courtesy/${courtesyId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al anular cortesía');
      }
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  // ============================================================
  // AGREGAR PRODUCTO AL STOCK
  // ============================================================
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!productName || !unitCost || !salePrice || !initialStock) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          unitCost: Number(unitCost),
          salePrice: Number(salePrice),
          initialStock: Number(initialStock)
        })
      });
      if (!res.ok) throw new Error('Error al registrar producto en barra');
      setProductName(''); setUnitCost(''); setSalePrice(''); setInitialStock('');
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // VENTA RÁPIDA POS
  // ============================================================
  const handleQuickSale = async (product, qty = 1, method = 'CARD') => {
    if (product.current_stock < qty) {
      alert(`¡Stock agotado! No quedan unidades de ${product.product_name}`);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar/sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: qty, paymentMethod: method })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error en la venta');
      }
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  // ============================================================
  // CORTESÍA — abrir modal
  // ============================================================
  const handleOpenCourtesy = (product) => {
    setCourtesyModal({ product });
    setCourtesyRecipientId('');
    setCourtesyQty(1);
    setCourtesyNotes('');
    setCourtesyMsg(null);
  };

  // ============================================================
  // CORTESÍA — enviar entrega
  // ============================================================
  const handleSubmitCourtesy = async (e) => {
    e.preventDefault();
    if (!courtesyRecipientId) {
      setCourtesyMsg({ type: 'err', text: 'Debes seleccionar un destinatario.' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar/courtesy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: courtesyModal.product.id,
          recipientId: courtesyRecipientId,
          quantity: courtesyQty,
          notes: courtesyNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cortesía');
      setCourtesyMsg({ type: 'ok', text: `✅ Cortesía entregada: ${data.quantity}x ${data.productName} → ${data.recipientName}` });
      onRefresh();
      setTimeout(() => setCourtesyModal(null), 1800);
    } catch (err) {
      setCourtesyMsg({ type: 'err', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CONTROL DE CORTESÍAS — agregar destinatario
  // ============================================================
  const handleAddRecipient = async (e) => {
    e.preventDefault();
    if (!newRecipientName.trim()) return;
    try {
      setRecipientLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar/courtesy-recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRecipientName.trim(), role: newRecipientRole, courtesyBudget: parseInt(newRecipientBudget, 10) || 0 })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setNewRecipientName('');
      setNewRecipientBudget('');
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setRecipientLoading(false);
    }
  };

  // ============================================================
  // CONTROL DE CORTESÍAS — eliminar destinatario
  // ============================================================
  const handleDeleteRecipient = async (recipientId) => {
    if (!confirm('¿Eliminar este destinatario?')) return;
    try {
      await fetch(`${API_URL}/api/events/${eventId}/bar/courtesy-recipients/${recipientId}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  // ============================================================
  // ARQUEO — guardar cierre
  // ============================================================
  const handleSaveClosing = async (e) => {
    e.preventDefault();
    if (!actualCash) {
      alert('Debes ingresar el dinero total contado en caja.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/bar/closing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCashReported: actualCashNum,
          itemsBreakdown: breakdownItems,
          notes
        })
      });
      const data = await res.json();
      setClosingResult(data);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // TOTALES
  // ============================================================
  const totalSalesAmount = sales.reduce((s, v) => s + Number(v.total_amount || 0), 0);
  const totalUnitsSold = sales.reduce((s, v) => s + Number(v.quantity || 0), 0);
  const totalCourtesiesQty = courtesies.reduce((s, c) => s + Number(c.quantity || 0), 0);
  const lowStockItems = inventory.filter(i => i.current_stock <= 2 && i.current_stock > 0);
  const outOfStockItems = inventory.filter(i => i.current_stock === 0);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6 pb-20">

      {/* ===== KPIs Superiores ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <DollarSign className="w-4 h-4" />, label: 'Recaudado POS', value: `$${totalSalesAmount.toLocaleString('es-CL')}`, color: 'text-emerald-400' },
          { icon: <ShoppingCart className="w-4 h-4" />, label: 'Ventas POS', value: `${totalUnitsSold} un.`, color: 'text-blue-400' },
          { icon: <Gift className="w-4 h-4" />, label: 'Cortesías', value: `${totalCourtesiesQty} un.`, color: 'text-amber-400' },
          { icon: <Package className="w-4 h-4" />, label: 'Productos', value: `${inventory.length}`, color: 'text-violet-400' },
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-400">{kpi.icon}<span className="text-[10px] uppercase tracking-wider font-bold">{kpi.label}</span></div>
            <div className={`font-mono font-black text-lg ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ===== Alertas de Stock ===== */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="space-y-2">
          {outOfStockItems.map(i => (
            <div key={i.id} className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><strong>{i.product_name}</strong> — ¡AGOTADO!</span>
            </div>
          ))}
          {lowStockItems.map(i => (
            <div key={i.id} className="flex items-center gap-2 bg-amber-950/40 border border-amber-800/50 rounded-xl px-3 py-2 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><strong>{i.product_name}</strong> — Stock bajo: {i.current_stock} un.</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== GRID PRINCIPAL ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ---- Cargar Stock ---- */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl"><Plus className="w-4 h-4 text-emerald-400" /></div>
            <h2 className="font-bold text-sm text-white">Cargar Stock a Barra</h2>
          </div>
          <form onSubmit={handleAddProduct} className="space-y-3">
            <input
              placeholder="Nombre del producto (ej: Pisco Mistral 35° 1L)"
              value={productName} onChange={e => setProductName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">Costo Unit.</label>
                <input type="number" placeholder="$3.000" value={unitCost} onChange={e => setUnitCost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">Precio Venta</label>
                <input type="number" placeholder="$5.000" value={salePrice} onChange={e => setSalePrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">Cantidad</label>
                <input type="number" placeholder="30" value={initialStock} onChange={e => setInitialStock(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:border-emerald-500 outline-none" />
              </div>
            </div>
            {unitCost && salePrice && initialStock && (
              <div className="text-[10px] text-slate-400 bg-slate-950 rounded-lg px-3 py-1.5">
                Costo total: <span className="text-red-400 font-bold">${(Number(unitCost) * Number(initialStock)).toLocaleString('es-CL')}</span>
                {' '} · Margen unit.: <span className="text-emerald-400 font-bold">${(Number(salePrice) - Number(unitCost)).toLocaleString('es-CL')}</span>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition disabled:opacity-50">
              {loading ? 'Registrando...' : '+ Agregar a Stock de Barra'}
            </button>
          </form>
        </div>

        {/* ---- Inventario actual ---- */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-xl"><Layers className="w-4 h-4 text-blue-400" /></div>
              <h2 className="font-bold text-sm text-white">Inventario Actual</h2>
            </div>
            {inventory.length > 0 && (
              <button onClick={handleOpenArqueo}
                className="text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-800/50 hover:bg-orange-500/20 rounded-lg px-2 py-1 transition">
                Arqueo / Cierre
              </button>
            )}
          </div>
          {inventory.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Sin productos cargados aún.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {inventory.map(item => (
                <div key={item.id} className="bg-slate-950 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{item.product_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Venta: <span className="text-emerald-400">${Number(item.sale_price).toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`font-mono font-black text-sm ${
                      item.current_stock === 0 ? 'text-red-400' : item.current_stock <= 2 ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {item.current_stock} un.
                    </div>
                    <button
                      onClick={() => handleDeleteProduct(item.id, item.product_name)}
                      className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Eliminar producto de barra"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== TERMINAL POS — Venta Rápida ===== */}
      {inventory.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-violet-500/10 rounded-xl"><ShoppingCart className="w-4 h-4 text-violet-400" /></div>
            <h2 className="font-bold text-sm text-white">Terminal POS — Venta Rápida</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inventory.map(item => (
              <div key={item.id} className={`bg-slate-950 rounded-2xl p-4 border ${
                item.current_stock === 0
                  ? 'border-red-900/50 opacity-60'
                  : item.current_stock <= 2
                  ? 'border-amber-800/50'
                  : 'border-slate-800'
              }`}>
                <div className="flex items-start justify-between gap-1 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-white leading-tight truncate">{item.product_name}</div>
                    <div className="font-mono font-black text-emerald-400 text-base mt-0.5">
                      ${Number(item.sale_price).toLocaleString('es-CL')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Stock: <span className={item.current_stock === 0 ? 'text-red-400 font-bold' : 'text-slate-300'}>{item.current_stock} un.</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(item.id, item.product_name)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                    title="Eliminar producto de barra registrado por error"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {item.current_stock === 0 ? (
                  <div className="text-center text-xs font-bold text-red-400 py-2">AGOTADO</div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Tarjeta */}
                    <button
                      onClick={() => handleQuickSale(item, 1, 'CARD')}
                      className="flex items-center justify-center gap-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-[11px] transition active:scale-95"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Tarjeta
                    </button>
                    {/* Efectivo */}
                    <button
                      onClick={() => handleQuickSale(item, 1, 'CASH')}
                      className="flex items-center justify-center gap-1 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-[11px] transition active:scale-95"
                    >
                      <Banknote className="w-3.5 h-3.5" /> Efec.
                    </button>
                    {/* Transferencia */}
                    <button
                      onClick={() => handleQuickSale(item, 1, 'TRANSFER')}
                      className="flex items-center justify-center gap-1 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-xl text-[11px] transition active:scale-95"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer.
                    </button>
                    {/* Cortesía */}
                    <button
                      onClick={() => handleOpenCourtesy(item)}
                      disabled={courtesyRecipients.length === 0}
                      title={courtesyRecipients.length === 0 ? 'Primero agrega destinatarios en Control de Cortesías' : 'Entregar como cortesía'}
                      className="flex items-center justify-center gap-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-[11px] transition active:scale-95"
                    >
                      <Gift className="w-3.5 h-3.5" /> Cortesía
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {courtesyRecipients.length === 0 && (
            <p className="text-[10px] text-amber-500/70 mt-3 text-center">
              💡 El botón Cortesía se activa cuando hay destinatarios registrados en "Control de Cortesías" ↓
            </p>
          )}
        </div>
      )}

      {/* ===== CONTROL DE CORTESÍAS (Collapsible) ===== */}
      <div className="bg-slate-900 border border-amber-800/40 rounded-3xl overflow-hidden">
        <button
          onClick={() => setShowCourtesySection(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl"><Gift className="w-4 h-4 text-amber-400" /></div>
            <div className="text-left">
              <div className="font-bold text-sm text-white">Control de Cortesías</div>
              <div className="text-[10px] text-slate-400">
                {courtesyRecipients.length} destinatarios · {courtesies.length} entregas registradas
              </div>
            </div>
          </div>
          {showCourtesySection
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showCourtesySection && (
          <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-5">

            {/* Formulario agregar destinatario */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Registrar Destinatario</span>
              </div>
              <form onSubmit={handleAddRecipient} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    placeholder="Nombre completo (ej: Juan Pérez)"
                    value={newRecipientName}
                    onChange={e => setNewRecipientName(e.target.value)}
                    className="sm:col-span-5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                  />
                  <select
                    value={newRecipientRole}
                    onChange={e => setNewRecipientRole(e.target.value)}
                    className="sm:col-span-3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="PRODUCCION">Producción</option>
                    <option value="DJ">DJ</option>
                    <option value="INVITADO">Invitado</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Cant. estimada (ej: 4)"
                    value={newRecipientBudget}
                    onChange={e => setNewRecipientBudget(e.target.value)}
                    className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={recipientLoading || !newRecipientName.trim()}
                    className="sm:col-span-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 shrink-0 text-center"
                  >
                    {recipientLoading ? '...' : '+ Agregar'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  💡 <strong>Cant. estimada:</strong> Límite o cupo de tragos/productos autorizados para esta persona durante el evento.
                </p>
              </form>
            </div>

            {/* Lista de destinatarios */}
            {courtesyRecipients.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destinatarios Registrados</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {courtesyRecipients.map(r => {
                    const used = getRecipientUsage(r.id);
                    const budget = Number(r.courtesy_budget || 0);
                    const isExceeded = budget > 0 && used >= budget;
                    return (
                      <div key={r.id} className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-white truncate">{r.name}</span>
                          <RoleBadge role={r.role} />
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                            budget > 0
                              ? (isExceeded ? 'bg-red-950/70 text-red-400 border border-red-800' : 'bg-amber-950/40 text-amber-300 border border-amber-800/50')
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {budget > 0 ? `${used} / ${budget} entregadas` : `${used} entregadas (Sin tope)`}
                          </span>
                        </div>
                        <button onClick={() => handleDeleteRecipient(r.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition shrink-0"
                          title="Eliminar destinatario">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Historial de cortesías entregadas */}
            {courtesies.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Historial de Entregas</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {courtesies.map(c => (
                    <div key={c.id} className="bg-slate-950 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-amber-400">{c.quantity}x {c.product_name}</span>
                          <span className="text-[10px] text-slate-300">→ {c.recipient_name}</span>
                          <RoleBadge role={c.recipient_role} />
                        </div>
                        {c.notes && <p className="text-[10px] text-slate-500 mt-0.5 italic">{c.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(c.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleCancelCourtesy(c.id, c.product_name, c.recipient_name, c.quantity)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          title="Anular entrega de cortesía por error (devuelve el stock)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {courtesyRecipients.length === 0 && courtesies.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                Registra destinatarios para habilitar el botón Cortesía en el POS.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ===== Últimas Ventas POS ===== */}
      {sales.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-slate-700/50 rounded-xl"><History className="w-4 h-4 text-slate-400" /></div>
            <h2 className="font-bold text-sm text-white">Últimas Ventas POS</h2>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {sales.slice(0, 20).map(sale => (
              <div key={sale.id} className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2 gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white">{sale.quantity}x {sale.product_name}</span>
                  <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    sale.payment_method === 'CARD' ? 'bg-emerald-900/60 text-emerald-400' :
                    sale.payment_method === 'CASH' ? 'bg-slate-700 text-slate-300' :
                    'bg-blue-900/60 text-blue-400'
                  }`}>
                    {sale.payment_method === 'CARD' ? '💳' : sale.payment_method === 'CASH' ? '💵' : '🏦'}
                    {' '}{sale.payment_method === 'CARD' ? 'Tarjeta' : sale.payment_method === 'CASH' ? 'Efectivo' : 'Transfer.'}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-emerald-400 shrink-0">
                  +${Number(sale.total_amount).toLocaleString('es-CL')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Historial de Arqueos ===== */}
      {closings.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-500/10 rounded-xl"><ClipboardList className="w-4 h-4 text-orange-400" /></div>
            <h2 className="font-bold text-sm text-white">Historial de Arqueos / Cierres</h2>
          </div>
          <div className="space-y-2">
            {closings.map(closing => {
              const isExpanded = expandedClosingId === closing.id;
              const breakdown = closing.items_breakdown ? JSON.parse(closing.items_breakdown) : null;
              return (
                <div key={closing.id} className="bg-slate-950 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedClosingId(isExpanded ? null : closing.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition"
                  >
                    <div className="text-left">
                      <div className={`text-xs font-black ${
                        closing.discrepancy === 0 ? 'text-emerald-400' :
                        closing.discrepancy < 0 ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        {closing.discrepancy === 0 ? '✅ CUADRADO' :
                          closing.discrepancy < 0 ? `⚠️ FALTANTE: $${Math.abs(closing.discrepancy).toLocaleString('es-CL')}` :
                          `ℹ️ SOBRANTE: $${Math.abs(closing.discrepancy).toLocaleString('es-CL')}`}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Recaudado: ${Number(closing.actual_cash_reported).toLocaleString('es-CL')} · Teórico: ${Number(closing.total_sales_calculated).toLocaleString('es-CL')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(closing.closed_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </button>
                  {isExpanded && breakdown && (
                    <div className="px-4 pb-3 border-t border-slate-800 pt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Desglose Físico por Producto</p>
                      <div className="space-y-1">
                        {breakdown.map((b, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-300">{b.productName}</span>
                            <span className="font-mono text-slate-400">
                              Inicial: {b.initialStock} · Sobrante: {b.leftoverStock} · Consumido: {Math.max(0, b.initialStock - b.leftoverStock)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {closing.notes && (
                        <p className="text-[10px] text-slate-500 italic mt-2">{closing.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== MODAL CORTESÍA ===== */}
      {courtesyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-700/50 rounded-3xl w-full max-w-sm shadow-2xl shadow-amber-900/20">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-xl"><Gift className="w-4 h-4 text-amber-400" /></div>
                <div>
                  <div className="font-black text-sm text-white">Entregar Cortesía</div>
                  <div className="text-[10px] text-amber-400 font-bold">{courtesyModal.product.product_name}</div>
                </div>
              </div>
              <button onClick={() => setCourtesyModal(null)} className="p-1.5 text-slate-400 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCourtesy} className="p-5 space-y-4">
              {/* Destinatario */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">Destinatario *</label>
                <select
                  value={courtesyRecipientId}
                  onChange={e => setCourtesyRecipientId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none"
                >
                  <option value="">— Seleccionar destinatario —</option>
                  {courtesyRecipients.map(r => {
                    const used = getRecipientUsage(r.id);
                    const b = Number(r.courtesy_budget || 0);
                    const labelRole = r.role === 'PRODUCCION' ? 'Producción' : r.role === 'DJ' ? 'DJ' : r.role === 'INVITADO' ? 'Invitado' : 'Otro';
                    const cupoInfo = b > 0 ? `${used}/${b} entregadas` : `${used} entregadas`;
                    return (
                      <option key={r.id} value={r.id}>
                        {r.name} ({labelRole}) — [{cupoInfo}]
                      </option>
                    );
                  })}
                </select>

                {/* Info de cupo del destinatario seleccionado */}
                {selectedRecipientObj && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px]">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Cupo estimado:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {selectedRecipientBudget > 0 ? `${selectedRecipientBudget} unidades` : 'Ilimitado'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 mt-1">
                      <span>Entregadas hasta ahora:</span>
                      <span className="font-mono text-white font-bold">{selectedRecipientUsed} un.</span>
                    </div>
                    {selectedRecipientBudget > 0 && (
                      <div className="flex justify-between items-center text-slate-400 mt-1 pt-1 border-t border-slate-800/80">
                        <span>Disponibles en cupo:</span>
                        <span className={`font-mono font-bold ${selectedRecipientRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {selectedRecipientRemaining} un.
                        </span>
                      </div>
                    )}
                    {selectedRecipientBudget > 0 && selectedRecipientRemaining === 0 && (
                      <div className="mt-2 text-red-400 text-[10px] font-bold bg-red-950/50 p-1.5 rounded-lg border border-red-800/60 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>¡Cupo estimado alcanzado! Puedes entregar más si está autorizado.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cantidad */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">
                  Cantidad a entregar <span className="text-slate-500 font-normal">(Stock: {courtesyModal.product.current_stock} un.)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={courtesyModal.product.current_stock}
                  value={courtesyQty}
                  onChange={e => setCourtesyQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Rider técnico, bienvenida artista..."
                  value={courtesyNotes}
                  onChange={e => setCourtesyNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                />
              </div>

              {/* Mensaje feedback */}
              {courtesyMsg && (
                <div className={`text-xs rounded-xl px-3 py-2 font-bold ${
                  courtesyMsg.type === 'ok'
                    ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                    : 'bg-red-950/60 border border-red-700 text-red-300'
                }`}>
                  {courtesyMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setCourtesyModal(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition disabled:opacity-50">
                  {loading ? 'Registrando...' : '🎁 Confirmar Cortesía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL ARQUEO ===== */}
      {showArqueoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-orange-800/50 rounded-3xl w-full max-w-lg shadow-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500/10 rounded-xl"><ClipboardList className="w-4 h-4 text-orange-400" /></div>
                <div>
                  <div className="font-black text-sm text-white">Arqueo y Cierre de Barra</div>
                  <div className="text-[10px] text-slate-400">Ingresa lo que sobró físicamente por producto</div>
                </div>
              </div>
              <button onClick={() => setShowArqueoModal(false)} className="p-1.5 text-slate-400 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!closingResult ? (
              <form onSubmit={handleSaveClosing} className="p-5 space-y-4">
                <div className="space-y-2">
                  {breakdownItems.map((item, index) => {
                    const consumed = Math.max(0, item.initialStock - item.leftoverStock);
                    const revenue = consumed * item.salePrice;
                    return (
                      <div key={item.productId} className="bg-slate-950 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Inicial: {item.initialStock} · Teórico consumido: {consumed}
                            {revenue > 0 && <span className="text-emerald-400"> · ${revenue.toLocaleString('es-CL')}</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-400 shrink-0">Sobrante físico:</label>
                          <input
                            type="number"
                            min={0}
                            max={item.initialStock}
                            value={item.leftoverStock}
                            onChange={e => handleLeftoverChange(index, e.target.value)}
                            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:border-orange-500 outline-none"
                          />
                          <span className="text-[10px] text-slate-500">unidades</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-950 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Ingreso teórico según sobrantes:</span>
                    <span className="font-mono font-bold text-white">${theoreticalTotal.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Dinero total contado en caja ($)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={actualCash}
                    onChange={e => setActualCash(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-orange-500 outline-none"
                  />
                </div>

                {actualCash && (
                  <div className={`flex items-center justify-between p-3 rounded-xl border text-sm font-bold ${
                    liveDiscrepancy === 0 ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400' :
                    liveDiscrepancy < 0 ? 'bg-red-950/40 border-red-700 text-red-400' :
                    'bg-blue-950/40 border-blue-700 text-blue-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {liveDiscrepancy === 0
                        ? <CheckCircle className="w-5 h-5 shrink-0" />
                        : <AlertTriangle className="w-5 h-5 shrink-0" />}
                      <div>
                        <div className="font-bold">
                          {liveDiscrepancy === 0 && '¡Caja 100% Cuadrada!'}
                          {liveDiscrepancy < 0 && `¡ALERTA FALTANTE! Faltan $${Math.abs(liveDiscrepancy).toLocaleString('es-CL')}`}
                          {liveDiscrepancy > 0 && `Sobrante de caja: +$${Math.abs(liveDiscrepancy).toLocaleString('es-CL')}`}
                        </div>
                        {liveDiscrepancy < 0 && (
                          <div className="text-[10px] opacity-80">Posible merma, cortesía no registrada o descuadre.</div>
                        )}
                      </div>
                    </div>
                    <div className="font-mono font-black text-sm whitespace-nowrap">
                      {liveDiscrepancy === 0 ? '$0' : `${liveDiscrepancy < 0 ? '-' : '+'}$${Math.abs(liveDiscrepancy).toLocaleString('es-CL')}`}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Observaciones / Mermas</label>
                  <input
                    type="text"
                    placeholder="Ej: Se rompieron 2 botellas, cortesías autorizadas..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowArqueoModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs">
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                    {loading ? 'Procesando Cierre...' : 'Guardar y Cerrar Barra'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 mt-2 space-y-4 text-center">
                <div className={`p-6 rounded-3xl border ${
                  closingResult.discrepancy === 0 ? 'bg-emerald-950/60 border-emerald-500' :
                  closingResult.discrepancy < 0 ? 'bg-red-950/60 border-red-500' :
                  'bg-blue-950/60 border-blue-500'
                }`}>
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-300">Resultado Final del Arqueo</span>
                  <div className={`text-3xl font-black mt-1 font-mono ${
                    closingResult.discrepancy === 0 ? 'text-emerald-400' :
                    closingResult.discrepancy < 0 ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {closingResult.status}: ${Math.abs(closingResult.discrepancy).toLocaleString('es-CL')}
                  </div>
                  <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto">
                    {closingResult.discrepancy === 0 && '✅ Todo el stock sobrante fue actualizado y la caja cuadró con las ventas teóricas.'}
                    {closingResult.discrepancy < 0 && '⚠️ Se guardó el arqueo con registro de faltante. El inventario fue actualizado con los sobrantes físicos.'}
                    {closingResult.discrepancy > 0 && 'ℹ️ Se guardó el arqueo con saldo a favor respecto a lo consumido.'}
                  </p>
                </div>
                <button onClick={() => setShowArqueoModal(false)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs transition">
                  Listo / Volver a la Barra
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
