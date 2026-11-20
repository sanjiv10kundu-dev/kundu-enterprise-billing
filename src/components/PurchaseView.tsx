import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  PackagePlus,
  Phone,
  Settings as SettingsIcon,
} from 'lucide-react';
import { CompanyPurchase, PaymentMode, Product, PurchaseLineItem, Supplier } from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatQuantityWithPieces,
  getTodayISO,
  isCaseUnit,
} from '../utils/format';

interface PurchaseViewProps {
  suppliers: Supplier[];
  products: Product[];
  purchases: CompanyPurchase[];
  onSavePurchase: (payload: {
    supplierId: string;
    invoiceNo: string;
    date: string;
    items: PurchaseLineItem[];
    amountPaid: number;
    paymentMode: PaymentMode | 'Bank Transfer';
    note: string;
  }) => void;
  onSettlePurchaseDue: (purchaseId: string, payAmount: number) => void;
  onAdjustStock: (productId: string, nextStock: number) => void;
  onNavigateSettings: () => void;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  suppliers,
  products,
  purchases,
  onSavePurchase,
  onSettlePurchaseDue,
  onAdjustStock,
  onNavigateSettings,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.id ?? 'sup_desertmina'
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(getTodayISO());
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [unitQuantities, setUnitQuantities] = useState<Record<string, number>>({});
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | 'Bank Transfer'>('UPI');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState<string>('');

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) ?? suppliers[0],
    [suppliers, selectedSupplierId]
  );

  const supplierProducts = useMemo(
    () => products.filter((p) => p.supplierId === selectedSupplier?.id),
    [products, selectedSupplier]
  );

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stockUnits <= p.lowStockThreshold),
    [products]
  );

  const supplierStats = useMemo(() => {
    const map: Record<string, { totalBought: number; totalDue: number; count: number }> = {};
    suppliers.forEach((s) => {
      map[s.id] = { totalBought: 0, totalDue: 0, count: 0 };
    });
    purchases.forEach((pur) => {
      if (!map[pur.supplierId]) {
        map[pur.supplierId] = { totalBought: 0, totalDue: 0, count: 0 };
      }
      map[pur.supplierId].totalBought += pur.totalAmount;
      map[pur.supplierId].totalDue += pur.balanceDue;
      map[pur.supplierId].count += 1;
    });
    return map;
  }, [suppliers, purchases]);

  const getPurchaseRate = (prod: Product): number => {
    const raw = rateInputs[prod.id];
    if (raw !== undefined && raw.trim() !== '') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return prod.defaultPurchaseRate;
  };

  const purchaseItems: PurchaseLineItem[] = useMemo(() => {
    return supplierProducts
      .filter((p) => (unitQuantities[p.id] ?? 0) > 0)
      .map((p) => {
        const qty = unitQuantities[p.id] ?? 0;
        const rate = getPurchaseRate(p);
        return {
          productId: p.id,
          productName: p.name,
          unitLabel: p.unitLabel,
          unitPlural: p.unitPlural,
          piecesPerCase: p.piecesPerCase,
          quantity: qty,
          purchaseRate: rate,
          subtotal: Math.round(qty * rate * 100) / 100,
        };
      });
  }, [supplierProducts, unitQuantities, rateInputs]);

  const totalBillAmount = useMemo(
    () => Math.round(purchaseItems.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
    [purchaseItems]
  );

  const amountPaid = amountPaidInput.trim() === '' ? 0 : Math.max(0, Number(amountPaidInput) || 0);
  const balanceDue = Math.max(0, Math.round((totalBillAmount - amountPaid) * 100) / 100);

  const handleSelectSupplier = (supId: string) => {
    setSelectedSupplierId(supId);
    setUnitQuantities({});
    setRateInputs({});
    setAmountPaidInput('');
    setError('');
  };

  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    if (purchaseItems.length === 0) {
      setError('Enter purchased Cases, Jars, or Pieces for at least one product.');
      return;
    }
    const cleanInvoice = invoiceNo.trim() || `${selectedSupplier.name.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    onSavePurchase({
      supplierId: selectedSupplier.id,
      invoiceNo: cleanInvoice,
      date: invoiceDate,
      items: purchaseItems,
      amountPaid,
      paymentMode,
      note: note.trim(),
    });

    setInvoiceNo('');
    setUnitQuantities({});
    setRateInputs({});
    setAmountPaidInput('');
    setNote('');
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Supplier Cards (Desertmina & Tata) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => {
          const isSelected = sup.id === selectedSupplier?.id;
          const stats = supplierStats[sup.id] ?? { totalBought: 0, totalDue: 0, count: 0 };

          return (
            <div
              key={sup.id}
              className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
                isSelected
                  ? 'bg-sky-50/70 border-sky-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handleSelectSupplier(sup.id)}
                    className="text-left group"
                  >
                    <h2 className="text-lg font-extrabold text-slate-900 group-hover:text-sky-800">
                      {sup.name}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span>{sup.address}</span>
                    </div>
                  </button>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
                    {sup.phone ? (
                      <a
                        href={`tel:+91${sup.phone}`}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call +91 {sup.phone}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={onNavigateSettings}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
                      >
                        <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>Add Contact in Settings</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelectSupplier(sup.id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-bold ${
                        isSelected
                          ? 'bg-sky-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? 'Selected for Purchase' : 'Log Purchase'}
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-500">Pending Balance</div>
                  <div
                    className={`font-mono text-base font-extrabold tabular-nums ${
                      stats.totalDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatINR(stats.totalDue)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    Bought {formatINR(stats.totalBought)} · {stats.count} bills
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main 2-column Workspace: Log Company Purchase + Live Unit Stock Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Log Company Purchase Form */}
        <form
          onSubmit={handleSubmitPurchase}
          className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-4 bg-[#0B2C6F]/5 border-b border-slate-200">
            <h3 className="text-base font-extrabold text-[#0B2C6F]">
              Log Stock Purchase — {selectedSupplier?.name}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Enter Cases, Jars, or Pieces purchased directly to auto-update stock in hand.
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Bill / Invoice No.
                </label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="e.g., DM-2026-419"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>
            </div>

            {/* Product Unit Entry Rows */}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {supplierProducts.map((prod) => {
                const qty = unitQuantities[prod.id] ?? 0;
                const rate = getPurchaseRate(prod);
                const subtotal = Math.round(qty * rate * 100) / 100;
                const isCase = isCaseUnit(prod.unitLabel, prod.piecesPerCase);

                return (
                  <div
                    key={prod.id}
                    className={`p-3.5 space-y-2.5 ${qty > 0 ? 'bg-sky-50/40' : 'bg-white'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {prod.name}
                          {isCase && (
                            <span className="ml-2 text-xs font-semibold text-sky-800">
                              ({prod.piecesPerCase} Pcs/Case)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          In stock:{' '}
                          {formatQuantityWithPieces(
                            prod.stockUnits,
                            prod.unitLabel,
                            prod.unitPlural,
                            prod.piecesPerCase
                          )}{' '}
                          · Unit: {prod.unitLabel}
                        </div>
                      </div>
                      {qty > 0 && isCase && (
                        <div className="text-xs font-mono font-bold text-sky-900 tabular-nums">
                          {formatQuantityWithPieces(
                            qty,
                            prod.unitLabel,
                            prod.unitPlural,
                            prod.piecesPerCase
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Total {prod.unitPlural}
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={qty === 0 ? '' : String(qty)}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setUnitQuantities((prev) => {
                              if (val === 0) {
                                const c = { ...prev };
                                delete c[prod.id];
                                return c;
                              }
                              return { ...prev, [prod.id]: val };
                            });
                          }}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white font-mono text-sm font-bold text-slate-900 tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Purchase Rate (₹/{prod.unitLabel})
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          value={
                            rateInputs[prod.id] !== undefined
                              ? rateInputs[prod.id]
                              : String(prod.defaultPurchaseRate)
                          }
                          onChange={(e) =>
                            setRateInputs((prev) => ({ ...prev, [prod.id]: e.target.value }))
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white font-mono text-sm font-bold text-slate-900 tabular-nums"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1 text-right pb-2">
                        <div className="text-[11px] text-slate-500">Line Total</div>
                        <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {formatINR(subtotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Purchase Settlement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Made to {selectedSupplier?.name} (₹)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-300 font-mono text-base font-bold text-slate-900 tabular-nums"
                />
                {totalBillAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput(String(totalBillAmount))}
                    className="mt-1.5 text-xs font-semibold text-sky-700 hover:underline"
                  >
                    Fill Full Bill ({formatINR(totalBillAmount)})
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100">
                  {(['Cash', 'UPI', 'Bank Transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMode(m)}
                      className={`min-h-[38px] px-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                        paymentMode === m ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {m === 'Bank Transfer' ? 'Bank' : m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g., Vehicle number, pickup details)"
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:border-sky-600 focus:outline-none"
            />

            <div className="rounded-xl bg-[#0B2C6F] text-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-sky-200 font-semibold">Total Purchase Bill</div>
                <div className="font-mono text-xl font-extrabold tabular-nums">
                  {formatINR(totalBillAmount)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-sky-200 font-semibold">Balance Due to Supplier</div>
                <div className="font-mono text-lg font-extrabold text-orange-300 tabular-nums">
                  {formatINR(balanceDue)}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[50px] rounded-xl bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <PackagePlus className="w-5 h-5" />
              <span>Save Company Purchase &amp; Add Stock</span>
            </button>
          </div>
        </form>

        {/* Right: Live Unit Stock Inventory with Low-Stock Alerts */}
        <section className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Unit Stock in Hand</h3>
                <p className="text-xs text-slate-500">
                  Auto-updated from company purchases &amp; customer bills
                </p>
              </div>
              {lowStockProducts.length > 0 && (
                <div className="text-xs font-bold text-amber-700 inline-flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{lowStockProducts.length} Low</span>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {suppliers.map((sup) => (
                <div key={sup.id}>
                  <div className="px-4 py-2 bg-slate-50 text-xs font-bold text-sky-900">
                    {sup.name} ({sup.address})
                  </div>
                  <div className="divide-y divide-slate-100">
                    {products
                      .filter((p) => p.supplierId === sup.id)
                      .map((prod) => {
                        const isLow = prod.stockUnits <= prod.lowStockThreshold;
                        const isEditing = editingStockId === prod.id;
                        return (
                          <div
                            key={prod.id}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {prod.name}
                              </div>
                              <div className="text-xs text-slate-500 tabular-nums">
                                Buy {formatINR(prod.defaultPurchaseRate)} · Sell{' '}
                                {formatINR(prod.defaultSellingRate)} / {prod.unitLabel}
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  value={stockDraft}
                                  onChange={(e) => setStockDraft(e.target.value)}
                                  className="w-20 min-h-[36px] px-2 text-right rounded-lg border border-sky-500 font-mono text-sm font-bold text-slate-900 tabular-nums"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAdjustStock(
                                      prod.id,
                                      Math.max(0, parseInt(stockDraft, 10) || 0)
                                    );
                                    setEditingStockId(null);
                                  }}
                                  className="min-h-[36px] px-2.5 rounded-lg bg-sky-700 text-white text-xs font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStockId(prod.id);
                                  setStockDraft(String(prod.stockUnits));
                                }}
                                title="Tap to adjust stock count"
                                className="text-right shrink-0 group"
                              >
                                <div
                                  className={`font-mono text-sm font-extrabold tabular-nums ${
                                    isLow ? 'text-amber-700' : 'text-slate-900'
                                  }`}
                                >
                                  {formatQuantityWithPieces(
                                    prod.stockUnits,
                                    prod.unitLabel,
                                    prod.unitPlural,
                                    prod.piecesPerCase
                                  )}
                                </div>
                                <div className="text-[11px] flex items-center justify-end gap-1">
                                  {isLow ? (
                                    <span className="text-amber-700 font-semibold inline-flex items-center gap-0.5">
                                      <AlertTriangle className="w-3 h-3" /> Low Stock
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 group-hover:text-sky-700">
                                      Tap to edit
                                    </span>
                                  )}
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Company Purchases Log */}
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recent Purchase Invoices</h3>
              <span className="text-xs text-slate-500 tabular-nums">{purchases.length} bills</span>
            </div>

            {purchases.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No company purchases logged yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {purchases
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((pur) => (
                    <div key={pur.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {pur.supplierName} · {pur.invoiceNo}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDisplayDate(pur.date)} · {pur.paymentMode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-extrabold text-slate-900 tabular-nums">
                            {formatINR(pur.totalAmount)}
                          </div>
                          {pur.balanceDue > 0 ? (
                            <div className="text-[11px] font-semibold text-rose-700 tabular-nums">
                              Due: {formatINR(pur.balanceDue)}
                            </div>
                          ) : (
                            <div className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-0.5 tabular-nums">
                        {pur.items.map((item, i) => (
                          <div key={`${pur.id}_${i}`}>
                            {item.productName}:{' '}
                            {formatQuantityWithPieces(
                              item.quantity,
                              item.unitLabel,
                              item.unitPlural,
                              item.piecesPerCase
                            )}{' '}
                            × {formatINR(item.purchaseRate)}/{item.unitLabel} ={' '}
                            {formatINR(item.subtotal)}
                          </div>
                        ))}
                      </div>

                      {pur.balanceDue > 0 && (
                        <button
                          type="button"
                          onClick={() => onSettlePurchaseDue(pur.id, pur.balanceDue)}
                          className="min-h-[36px] px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100"
                        >
                          Mark Balance Paid ({formatINR(pur.balanceDue)})
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
