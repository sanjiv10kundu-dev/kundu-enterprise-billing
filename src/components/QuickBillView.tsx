import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  UserPlus,
} from 'lucide-react';
import {
  BillLineItem,
  Customer,
  PaymentMode,
  Product,
  SalesTransaction,
  ShopProfile,
  Supplier,
} from '../types';
import {
  formatINR,
  formatQuantityWithPieces,
  getTodayISO,
  isCaseUnit,
} from '../utils/format';

interface QuickBillViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  shopProfile: ShopProfile;
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string | null) => void;
  onSaveSale: (payload: {
    customerId: string;
    date: string;
    items: BillLineItem[];
    amountPaid: number;
    paymentMode: PaymentMode;
    note: string;
  }) => SalesTransaction;
  onOpenReceipt: (txn: SalesTransaction) => void;
  onNavigateAddCustomer: () => void;
}

export const QuickBillView: React.FC<QuickBillViewProps> = ({
  customers,
  suppliers,
  products,
  shopProfile: _shopProfile,
  selectedCustomerId,
  onSelectCustomer,
  onSaveSale,
  onOpenReceipt,
  onNavigateAddCustomer,
}) => {
  const [customerSearch, setCustomerSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [billDate, setBillDate] = useState<string>(getTodayISO());
  const [note, setNote] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shopAddress.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  const productsBySupplier = useMemo(() => {
    return suppliers.map((supplier) => ({
      supplier,
      items: products.filter((p) => p.supplierId === supplier.id),
    }));
  }, [suppliers, products]);

  const resetForm = () => {
    setQuantities({});
    setRateOverrides({});
    setAmountPaidInput('');
    setPaymentMode('Cash');
    setBillDate(getTodayISO());
    setNote('');
    setFormError('');
  };

  const handleChooseCustomer = (customerId: string) => {
    if (customerId !== selectedCustomerId) {
      resetForm();
      onSelectCustomer(customerId);
    }
  };

  const getEffectiveRate = (product: Product): number => {
    const overrideStr = rateOverrides[product.id];
    if (overrideStr !== undefined && overrideStr.trim() !== '') {
      const parsed = Number(overrideStr);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    if (selectedCustomer && typeof selectedCustomer.customRates[product.id] === 'number') {
      return selectedCustomer.customRates[product.id];
    }
    return product.defaultSellingRate;
  };

  const setProductQty = (productId: string, nextQty: number) => {
    const clamped = Math.max(0, Math.floor(Number.isFinite(nextQty) ? nextQty : 0));
    setFormError('');
    setQuantities((prev) => {
      if (clamped === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: clamped };
    });
  };

  const lineItems: BillLineItem[] = useMemo(() => {
    return products
      .filter((p) => (quantities[p.id] ?? 0) > 0)
      .map((p) => {
        const qty = quantities[p.id] ?? 0;
        const unitRate = getEffectiveRate(p);
        return {
          productId: p.id,
          supplierId: p.supplierId,
          brandName: p.brandName,
          productName: p.name,
          unitLabel: p.unitLabel,
          unitPlural: p.unitPlural,
          piecesPerCase: p.piecesPerCase,
          quantity: qty,
          unitRate,
          subtotal: Math.round(qty * unitRate * 100) / 100,
        };
      });
  }, [products, quantities, rateOverrides, selectedCustomer]);

  const todayTotal = useMemo(
    () => Math.round(lineItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100,
    [lineItems]
  );

  const totalUnitsCount = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity, 0),
    [lineItems]
  );

  const totalPiecesCount = useMemo(
    () =>
      lineItems.reduce(
        (sum, item) =>
          sum +
          (isCaseUnit(item.unitLabel, item.piecesPerCase)
            ? item.quantity * (item.piecesPerCase ?? 1)
            : item.quantity),
        0
      ),
    [lineItems]
  );

  const previousDue = selectedCustomer?.dueBalance ?? 0;
  const grandPayable = Math.round((todayTotal + previousDue) * 100) / 100;
  const amountPaid = amountPaidInput.trim() === '' ? 0 : Math.max(0, Number(amountPaidInput) || 0);
  const netDueAfter = Math.round((grandPayable - amountPaid) * 100) / 100;

  const handleSave = (openReceiptModal: boolean) => {
    if (!selectedCustomer) {
      setFormError('Select a customer first to create a bill.');
      return;
    }
    if (lineItems.length === 0 && amountPaid === 0) {
      setFormError('Enter at least 1 Case / Jar / Piece delivered or an amount paid today.');
      return;
    }

    const savedTxn = onSaveSale({
      customerId: selectedCustomer.id,
      date: billDate,
      items: lineItems,
      amountPaid,
      paymentMode,
      note: note.trim(),
    });

    if (openReceiptModal) {
      onOpenReceipt(savedTxn);
    }
    resetForm();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Customer Selector (Full-width on mobile when no customer selected, sticky sidebar on desktop) */}
      <section
        className={`lg:col-span-4 lg:sticky lg:top-20 ${
          selectedCustomer ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Select Customer</h2>
                <p className="text-xs text-slate-500">Tap a customer to start instant billing</p>
              </div>
              <button
                type="button"
                onClick={onNavigateAddCustomer}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-sky-100 transition-colors whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>New</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search name, shop, or phone..."
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[68vh] overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No customers found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add a new customer to start unit-wise billing.
                </p>
                <button
                  type="button"
                  onClick={onNavigateAddCustomer}
                  className="mt-4 min-h-[44px] px-4 py-2 rounded-xl bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 transition-colors"
                >
                  Add First Customer
                </button>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isSelected = customer.id === selectedCustomerId;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleChooseCustomer(customer.id)}
                    className={`w-full text-left px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-sky-50' : 'hover:bg-slate-50 active:bg-sky-50/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold truncate ${
                            isSelected ? 'text-sky-900' : 'text-slate-900'
                          }`}
                        >
                          {customer.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-sky-700 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {customer.customerType} · {customer.shopAddress || customer.phone}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono text-sm font-bold tabular-nums ${
                          customer.dueBalance > 0
                            ? 'text-rose-700'
                            : customer.dueBalance < 0
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {customer.dueBalance > 0
                          ? formatINR(customer.dueBalance)
                          : customer.dueBalance < 0
                          ? `Adv ${formatINR(Math.abs(customer.dueBalance))}`
                          : '₹0'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {customer.dueBalance > 0 ? 'Due' : customer.dueBalance < 0 ? 'Credit' : 'Clear'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Right Column: Active Quick Billing Workspace */}
      <section className={`lg:col-span-8 ${selectedCustomer ? 'block' : 'hidden lg:block'}`}>
        {!selectedCustomer ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
            <h2 className="text-xl font-bold text-slate-900">Ready for Quick Billing</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Choose a customer from the list on the left to enter Case / Jar quantities for
              Desertmina and Tata products and share a high-resolution JPG receipt on WhatsApp.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active Customer Context Header */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(null)}
                    aria-label="Back to customer list"
                    className="lg:hidden min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                      {selectedCustomer.name}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 truncate">
                      {selectedCustomer.customerType}
                      {selectedCustomer.shopAddress ? ` · ${selectedCustomer.shopAddress}` : ''}
                      {selectedCustomer.phone ? ` · +91 ${selectedCustomer.phone}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-auto">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Previous Due</div>
                    <div
                      className={`font-mono text-base font-bold tabular-nums ${
                        previousDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatINR(previousDue)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Unit-Wise Product Entry Grouped by Supplier */}
            {productsBySupplier.map(({ supplier, items }) => (
              <div
                key={supplier.id}
                className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
              >
                <div className="px-4 sm:px-5 py-3.5 bg-[#0B2C6F]/5 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-extrabold text-[#0B2C6F]">{supplier.name}</h2>
                    <p className="text-xs text-slate-600">
                      {supplier.address} · Case &amp; Jar billing
                    </p>
                  </div>
                  <div className="text-xs font-bold text-orange-700 tabular-nums">
                    {items.reduce((s, p) => s + (quantities[p.id] ?? 0), 0)} selected
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {items.map((product) => {
                    const qty = quantities[product.id] ?? 0;
                    const effectiveRate = getEffectiveRate(product);
                    const hasCustomRate =
                      typeof selectedCustomer.customRates[product.id] === 'number';
                    const isLowStock = product.stockUnits <= product.lowStockThreshold;
                    const lineSubtotal = Math.round(qty * effectiveRate * 100) / 100;
                    const isCase = isCaseUnit(product.unitLabel, product.piecesPerCase);

                    return (
                      <div
                        key={product.id}
                        className={`p-4 sm:px-5 transition-colors ${
                          qty > 0 ? 'bg-sky-50/40' : 'bg-white'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Product info & rate */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between sm:justify-start gap-2">
                              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                {product.name}
                              </h3>
                              <span className="text-xs font-semibold text-sky-800">
                                {isCase
                                  ? `Per Case (${product.piecesPerCase} Pcs/Case)`
                                  : `Per ${product.unitLabel}`}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                Rate:
                                <span className="font-mono font-bold text-slate-900 tabular-nums">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  min="0"
                                  aria-label={`Rate per ${product.unitLabel} for ${product.brandName} ${product.name}`}
                                  value={
                                    rateOverrides[product.id] !== undefined
                                      ? rateOverrides[product.id]
                                      : String(effectiveRate)
                                  }
                                  onChange={(e) =>
                                    setRateOverrides((prev) => ({
                                      ...prev,
                                      [product.id]: e.target.value,
                                    }))
                                  }
                                  className="w-18 px-1.5 py-0.5 rounded-md border border-slate-200 bg-white font-mono text-xs font-bold text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                                />
                                /{product.unitLabel}
                              </span>
                              {hasCustomRate && (
                                <span className="text-sky-700 font-semibold">Custom rate</span>
                              )}
                              <span aria-hidden="true">·</span>
                              <span
                                className={`tabular-nums inline-flex items-center gap-1 ${
                                  isLowStock ? 'text-amber-700 font-semibold' : 'text-slate-500'
                                }`}
                              >
                                {isLowStock && <AlertTriangle className="w-3.5 h-3.5" />}
                                In stock:{' '}
                                {formatQuantityWithPieces(
                                  product.stockUnits,
                                  product.unitLabel,
                                  product.unitPlural,
                                  product.piecesPerCase
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Touch-friendly stepper + direct Case / Jar / Piece entry */}
                          <div className="flex items-center justify-between sm:justify-end gap-2">
                            <span className="sm:hidden text-xs font-semibold text-slate-500">
                              Qty ({product.unitPlural})
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setProductQty(product.id, qty - 1)}
                                disabled={qty === 0}
                                aria-label={`Decrease ${product.name} ${product.unitPlural}`}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 active:scale-95 transition-all"
                              >
                                <Minus className="w-4 h-4" />
                              </button>

                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                aria-label={`${product.brandName} ${product.name} quantity in ${product.unitPlural}`}
                                value={qty === 0 ? '' : String(qty)}
                                placeholder="0"
                                onChange={(e) =>
                                  setProductQty(product.id, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-20 min-h-[44px] text-center rounded-xl border border-slate-300 bg-white font-mono text-base font-bold text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                              />

                              <button
                                type="button"
                                onClick={() => setProductQty(product.id, qty + 1)}
                                aria-label={`Increase ${product.name} ${product.unitPlural}`}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-sky-700 text-white hover:bg-sky-800 active:scale-95 transition-all"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {qty > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-sky-100 flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-slate-700 font-medium tabular-nums">
                              {formatQuantityWithPieces(
                                qty,
                                product.unitLabel,
                                product.unitPlural,
                                product.piecesPerCase
                              )}{' '}
                              × {formatINR(effectiveRate)}/{product.unitLabel}
                            </span>
                            <span className="font-mono font-bold text-sky-900 tabular-nums">
                              = {formatINR(lineSubtotal)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bill Totals, Payment Settlement & One-Tap WhatsApp Dispatch */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Bill Summary & Payment</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    aria-label="Bill date"
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:bg-white focus:border-sky-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={resetForm}
                    title="Clear current entries"
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Calculation rows */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    Today&apos;s Total ({totalUnitsCount} items
                    {totalPiecesCount > totalUnitsCount ? ` · ${totalPiecesCount} Pcs` : ''})
                  </span>
                  <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatINR(todayTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Previous Due Balance</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {formatINR(previousDue)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-semibold text-slate-900">
                  <span>Grand Payable</span>
                  <span className="font-mono text-lg font-extrabold text-sky-900 tabular-nums">
                    {formatINR(grandPayable)}
                  </span>
                </div>
              </div>

              {/* Payment input + mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label
                    htmlFor="amount-paid-today"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Amount Paid Today (₹)
                  </label>
                  <input
                    id="amount-paid-today"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white font-mono text-lg font-bold text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setAmountPaidInput(todayTotal > 0 ? String(todayTotal) : '')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 whitespace-nowrap"
                    >
                      Today&apos;s ({formatINR(todayTotal)})
                    </button>
                    {grandPayable > 0 && grandPayable !== todayTotal && (
                      <button
                        type="button"
                        onClick={() => setAmountPaidInput(String(grandPayable))}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-50 text-xs font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap"
                      >
                        Full ({formatINR(grandPayable)})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAmountPaidInput('')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                    >
                      ₹0
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Payment Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
                    {(['Cash', 'UPI'] as PaymentMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`min-h-[42px] rounded-lg text-sm font-bold transition-all ${
                          paymentMode === mode
                            ? 'bg-white text-sky-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional delivery note..."
                    className="mt-2.5 w-full min-h-[40px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Updated Net Due Highlight */}
              <div className="rounded-xl bg-[#0B2C6F] text-white p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-sky-200 font-semibold">
                    Updated Net Due Balance
                  </div>
                  <div className="text-xs text-orange-300 mt-0.5 font-medium">
                    {netDueAfter > 0
                      ? 'Pending after today’s bill'
                      : netDueAfter < 0
                      ? 'Customer advance credit'
                      : 'Account fully settled'}
                  </div>
                </div>
                <div className="font-mono text-2xl font-extrabold tabular-nums">
                  {formatINR(netDueAfter)}
                </div>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-800 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="sm:col-span-2 min-h-[52px] px-5 rounded-xl bg-emerald-600 text-white text-sm sm:text-base font-bold hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-5 h-5 shrink-0" />
                  <span>Save &amp; Share Bill (JPG / WhatsApp)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="min-h-[52px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>Save Only</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
