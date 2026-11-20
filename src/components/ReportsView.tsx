import React, { useMemo, useState } from 'react';
import { AlertTriangle, MessageCircle, Trash2 } from 'lucide-react';
import { Customer, Product, SalesTransaction, Supplier } from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatQuantityWithPieces,
  getTodayISO,
  isCaseUnit,
  isWithinLastDays,
} from '../utils/format';

interface ReportsViewProps {
  transactions: SalesTransaction[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  onOpenReceipt: (txn: SalesTransaction) => void;
  onDeleteTransaction: (txnId: string) => void;
}

type DateFilter = 'today' | 'week' | 'all' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  customers,
  suppliers,
  products,
  onOpenReceipt,
  onDeleteTransaction,
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState<string>(getTodayISO());
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'payment'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayISO = getTodayISO();

  // Top KPI Metrics (always focused on Today + Live Stock & Market Totals)
  const kpis = useMemo(() => {
    const todayTxns = transactions.filter((t) => t.date === todayISO);
    const todaySalesTxns = todayTxns.filter((t) => t.type === 'sale');
    const todaySalesTotal = todaySalesTxns.reduce((s, t) => s + t.totalAmount, 0);
    const todayCash = todayTxns
      .filter((t) => t.paymentMode === 'Cash')
      .reduce((s, t) => s + t.amountPaid, 0);
    const todayUpi = todayTxns
      .filter((t) => t.paymentMode === 'UPI')
      .reduce((s, t) => s + t.amountPaid, 0);
    const todayCollected = todayCash + todayUpi;
    const todayNewCredit = Math.max(0, todaySalesTotal - todayCollected);
    const totalMarketDue = customers.reduce((s, c) => s + Math.max(0, c.dueBalance), 0);
    const totalStockCases = products
      .filter((p) => isCaseUnit(p.unitLabel, p.piecesPerCase))
      .reduce((s, p) => s + p.stockUnits, 0);
    const totalStockCasePieces = products
      .filter((p) => isCaseUnit(p.unitLabel, p.piecesPerCase))
      .reduce((s, p) => s + p.stockUnits * p.piecesPerCase, 0);
    const totalStockJarsPieces = products
      .filter((p) => !isCaseUnit(p.unitLabel, p.piecesPerCase))
      .reduce((s, p) => s + p.stockUnits, 0);
    const lowStockCount = products.filter((p) => p.stockUnits <= p.lowStockThreshold).length;

    return {
      todaySalesTotal,
      todayBillsCount: todaySalesTxns.length,
      todayCash,
      todayUpi,
      todayCollected,
      todayNewCredit,
      totalMarketDue,
      totalStockCases,
      totalStockCasePieces,
      totalStockJarsPieces,
      lowStockCount,
    };
  }, [transactions, customers, products, todayISO]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((txn) => {
        if (dateFilter === 'today' && txn.date !== todayISO) return false;
        if (dateFilter === 'week' && !isWithinLastDays(txn.date, 7)) return false;
        if (dateFilter === 'custom' && txn.date !== customDate) return false;
        if (customerFilter !== 'all' && txn.customerId !== customerFilter) return false;
        if (typeFilter !== 'all' && txn.type !== typeFilter) return false;
        if (brandFilter !== 'all') {
          if (txn.type !== 'sale') return false;
          const hasBrand = txn.items.some((i) => i.supplierId === brandFilter);
          if (!hasBrand) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [transactions, dateFilter, customDate, brandFilter, customerFilter, typeFilter, todayISO]);

  // Filtered Product Case/Unit Breakdown
  const productBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        brandName: string;
        productName: string;
        unitLabel: string;
        unitPlural: string;
        piecesPerCase?: number;
        units: number;
        revenue: number;
      }
    > = {};
    filteredTransactions.forEach((txn) => {
      txn.items.forEach((item) => {
        if (brandFilter !== 'all' && item.supplierId !== brandFilter) return;
        if (!map[item.productId]) {
          map[item.productId] = {
            brandName: item.brandName,
            productName: item.productName,
            unitLabel: item.unitLabel,
            unitPlural: item.unitPlural,
            piecesPerCase: item.piecesPerCase,
            units: 0,
            revenue: 0,
          };
        }
        map[item.productId].units += item.quantity;
        map[item.productId].revenue += item.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions, brandFilter]);

  const filteredSummary = useMemo(() => {
    const totalSales = filteredTransactions.reduce((s, t) => s + t.totalAmount, 0);
    const totalPaid = filteredTransactions.reduce((s, t) => s + t.amountPaid, 0);
    return { totalSales, totalPaid };
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Today&apos;s Total Sales</div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-sky-900 tabular-nums">
            {formatINR(kpis.todaySalesTotal)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {kpis.todayBillsCount} {kpis.todayBillsCount === 1 ? 'bill' : 'bills'} today
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Cash / UPI Collected</div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
            {formatINR(kpis.todayCollected)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Cash {formatINR(kpis.todayCash)} · UPI {formatINR(kpis.todayUpi)}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">New Market Credit (Due)</div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-rose-700 tabular-nums">
            {formatINR(kpis.todayNewCredit)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Total Market Due: {formatINR(kpis.totalMarketDue)}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Current Stock</div>
          <div className="mt-1.5 font-mono text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">
            {kpis.totalStockCases} Cases{' '}
            <span className="text-xs font-bold text-slate-500">
              ({kpis.totalStockCasePieces} Pcs)
            </span>
          </div>
          <div className="mt-1 text-xs tabular-nums">
            {kpis.lowStockCount > 0 ? (
              <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {kpis.lowStockCount} low · {kpis.totalStockJarsPieces} Jars/Pcs
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                + {kpis.totalStockJarsPieces} Jars &amp; Pcs in stock
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom Date' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateFilter(opt.id)}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                  dateFilter === opt.id
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Brand</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sky-600 focus:outline-none"
            >
              <option value="all">All Brands (Desertmina &amp; Tata)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sky-600 focus:outline-none"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Entry Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'sale' | 'payment')}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sky-600 focus:outline-none"
            >
              <option value="all">All Entries (Sales &amp; Jama)</option>
              <option value="sale">Sales Bills Only</option>
              <option value="payment">Payments (Jama) Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Filtered Transactions + Unit Sales Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Transaction History</h2>
              <p className="text-xs text-slate-500 tabular-nums">
                {filteredTransactions.length} entries · Billed{' '}
                <strong className="font-mono text-slate-800">
                  {formatINR(filteredSummary.totalSales)}
                </strong>{' '}
                · Collected{' '}
                <strong className="font-mono text-emerald-700">
                  {formatINR(filteredSummary.totalPaid)}
                </strong>
              </p>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No transactions found for the selected filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map((txn) => (
                <div key={txn.id} className="p-4 sm:px-5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {txn.customerName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {txn.type === 'sale' ? 'Sale Bill' : 'Payment Jama'} · {txn.billNo} ·{' '}
                        {formatDisplayDate(txn.date)} · {txn.paymentMode}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(txn)}
                        className="min-h-[38px] px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1 hover:bg-emerald-100"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(txn.id)}
                        aria-label={`Delete ${txn.billNo}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {confirmDeleteId === txn.id && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-rose-900">
                        Delete {txn.billNo} from history? (Reverts stock &amp; customer due)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[34px] px-2.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteTransaction(txn.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-rose-700 text-white font-semibold"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {txn.items.length > 0 && (
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5 space-y-1 text-xs text-slate-700 tabular-nums">
                      {txn.items
                        .filter((i) => brandFilter === 'all' || i.supplierId === brandFilter)
                        .map((item, idx) => (
                          <div key={`${txn.id}_${idx}`} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {item.brandName} {item.productName}:{' '}
                              {formatQuantityWithPieces(
                                item.quantity,
                                item.unitLabel,
                                item.unitPlural,
                                item.piecesPerCase
                              )}{' '}
                              × {formatINR(item.unitRate)}/{item.unitLabel}
                            </span>
                            <span className="font-mono font-semibold text-slate-900 shrink-0">
                              {formatINR(item.subtotal)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                      {txn.type === 'sale' && (
                        <span>
                          Total:{' '}
                          <strong className="font-mono text-slate-900">
                            {formatINR(txn.totalAmount)}
                          </strong>
                        </span>
                      )}
                      <span>
                        Paid:{' '}
                        <strong className="font-mono text-emerald-700">
                          {formatINR(txn.amountPaid)}
                        </strong>
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      Net Due: {formatINR(txn.netDueAfter)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Unit-Wise Product Sales Breakdown */}
        <section className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Units Sold Breakdown</h3>
            <p className="text-xs text-slate-500">Exact unit volume for active filter</p>
          </div>

          {productBreakdown.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No product sales in this period.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {productBreakdown.map((row, idx) => (
                <div
                  key={`${row.brandName}_${row.productName}_${idx}`}
                  className="px-4 py-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {row.brandName} {row.productName}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {formatQuantityWithPieces(
                        row.units,
                        row.unitLabel,
                        row.unitPlural,
                        row.piecesPerCase
                      )}{' '}
                      sold
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold text-sky-900 tabular-nums shrink-0">
                    {formatINR(row.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
