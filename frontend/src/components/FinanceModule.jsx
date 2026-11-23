import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  Trash2, 
  PieChart, 
  CheckCircle, 
  AlertCircle,
  Tag,
  CreditCard
} from 'lucide-react';

export default function FinanceModule({ eventId, financeData, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('EXPENSE'); // 'INCOME' o 'EXPENSE'
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('ALL');

  const { summary = {}, breakdown = {}, transactions = [] } = financeData || {};
  const { totalIncome = 0, totalExpense = 0, netMargin = 0, breakEvenPercentage = 0, isProfitable = false } = summary;

  const expenseCategories = [
    'Honorarios DJs / Artistas',
    'Sonido e Iluminación',
    'Arriendo Local / Predio',
    'Seguridad y Control',
    'Permisos y Derechos de Autor (SCD)',
    'Marketing y Publicidad',
    'Catering y Camarines',
    'Compra Barra',
    'Imprevistos y Logística'
  ];

  const incomeCategories = [
    'Entradas',
    'Venta Barra',
    'Auspicios y Marcas',
    'Preventas Externas',
    'Merchandising',
    'Otros Ingresos'
  ];

  const handleOpenModal = (type) => {
    setModalType(type);
    setCategory(type === 'EXPENSE' ? expenseCategories[0] : incomeCategories[0]);
    setDescription('');
    setAmount('');
    setShowModal(true);
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert('Ingresa un monto válido.');

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: modalType,
          category,
          description: description.trim(),
          amount: Number(amount),
          paymentMethod
        })
      });

      if (!res.ok) throw new Error('Error al guardar movimiento');
      setShowModal(false);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (txId) => {
    if (!confirm('¿Estás seguro de eliminar este registro contable?')) return;
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/transactions/${txId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Error al eliminar');
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'ALL') return true;
    return tx.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingresos Totales</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            ${totalIncome.toLocaleString('es-CL')}
          </div>
          <span className="text-xs text-emerald-400/80 mt-1 block">Entradas + Barra + Auspicios</span>
        </div>

        {/* Gastos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastos Totales</span>
            <div className="p-2 bg-red-500/10 rounded-xl text-red-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            ${totalExpense.toLocaleString('es-CL')}
          </div>
          <span className="text-xs text-red-400/80 mt-1 block">Técnica + Local + Barra + Staff</span>
        </div>

        {/* Margen Neto */}
        <div className={`border rounded-2xl p-5 relative overflow-hidden ${
          isProfitable ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Utilidad Neta</span>
            <div className={`p-2 rounded-xl ${isProfitable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black mt-2 font-mono ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            ${netMargin.toLocaleString('es-CL')}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {isProfitable ? '🎉 Evento en Ganancia Operativa' : '⚠️ Aún en zona de inversión/recuperación'}
          </span>
        </div>

        {/* Break-even Progress */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Punto de Equilibrio</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{breakEvenPercentage}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                breakEvenPercentage >= 100 ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(breakEvenPercentage, 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            {breakEvenPercentage >= 100 ? '✅ Costos 100% cubiertos' : `Faltan $${Math.max(totalExpense - totalIncome, 0).toLocaleString('es-CL')} para equilibrar`}
          </span>
        </div>
      </div>

      {/* Botones de Acción Rápida y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({transactions.length})
          </button>
          <button
            onClick={() => setFilterType('INCOME')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Ingresos
          </button>
          <button
            onClick={() => setFilterType('EXPENSE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'EXPENSE' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-red-400'
            }`}
          >
            Gastos
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal('INCOME')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ingreso Manual</span>
          </button>

          <button
            onClick={() => handleOpenModal('EXPENSE')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-400" />
            Libro de Movimientos Financieros
          </h3>
          <span className="text-xs text-slate-400">{filteredTransactions.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Categoría</th>
                <th className="p-3.5">Descripción</th>
                <th className="p-3.5">Método</th>
                <th className="p-3.5 text-right">Monto</th>
                <th className="p-3.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No hay transacciones registradas para este evento.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        tx.type === 'INCOME'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tx.type === 'INCOME' ? 'INGRESO' : 'GASTO'}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-white">{tx.category}</td>
                    <td className="p-3.5 text-slate-300 max-w-xs truncate">{tx.description || '-'}</td>
                    <td className="p-3.5 text-slate-400 font-mono text-[11px]">{tx.payment_method}</td>
                    <td className={`p-3.5 text-right font-mono font-bold text-sm ${
                      tx.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {tx.type === 'INCOME' ? '+' : '-'}${Number(tx.amount).toLocaleString('es-CL')}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Gasto / Ingreso */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white">
            <h3 className="text-lg font-bold">
              {modalType === 'EXPENSE' ? 'Registrar Gasto de Producción' : 'Registrar Ingreso Adicional'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Impactará inmediatamente el balance financiero del evento.
            </p>

            <form onSubmit={handleSaveTransaction} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                >
                  {(modalType === 'EXPENSE' ? expenseCategories : incomeCategories).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Descripción / Proveedor</label>
                <input
                  type="text"
                  placeholder="Ej: Pago 50% anticipo DJ Principal"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Monto ($ CLP)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ej: 250000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                >
                  <option value="TRANSFER">Transferencia Bancaria</option>
                  <option value="CASH">Efectivo / Caja Chica</option>
                  <option value="CARD">Tarjeta de Débito / Crédito</option>
                  <option value="INVOICE">Factura / Vale a Crédito</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-2.5 font-black rounded-xl text-xs transition ${
                    modalType === 'EXPENSE'
                      ? 'bg-red-500 hover:bg-red-400 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {loading ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
