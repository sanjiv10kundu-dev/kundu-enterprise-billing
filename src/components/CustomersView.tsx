import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  IndianRupee,
  MessageCircle,
  Phone,
  Plus,
  Receipt,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Customer,
  CustomerType,
  PaymentMode,
  Product,
  SalesTransaction,
  ShopProfile,
  Supplier,
} from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatUnitQty,
  getTodayISO,
  sanitizeIndianPhone,
} from '../utils/format';
import { buildSalesReceiptText, buildWhatsAppUrl } from '../utils/whatsapp';

interface CustomersViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  transactions: SalesTransaction[];
  shopProfile: ShopProfile;
  openAddModalOnMount?: boolean;
  onConsumedAddModal?: () => void;
  onSaveCustomer: (customer: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => void;
  onDeleteCustomer: (customerId: string) => void;
  onRecordPayment: (payload: {
    customerId: string;
    amountPaid: number;
    paymentMode: PaymentMode;
    date: string;
    note: string;
  }) => SalesTransaction;
  onQuickBillCustomer: (customerId: string) => void;
  onOpenReceipt: (txn: SalesTransaction) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  suppliers,
  products,
  transactions,
  shopProfile,
  openAddModalOnMount,
  onConsumedAddModal,
  onSaveCustomer,
  onDeleteCustomer,
  onRecordPayment,
  onQuickBillCustomer,
  onOpenReceipt,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'Retailer' | 'Regular' | 'due'>('all');
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState<boolean>(Boolean(openAddModalOnMount));
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showJamaForm, setShowJamaForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Customer editor form state
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [typeInput, setTypeInput] = useState<CustomerType>('Retailer');
  const [openingDueInput, setOpeningDueInput] = useState('0');
  const [customRatesInput, setCustomRatesInput] = useState<Record<string, string>>({});
  const [editorError, setEditorError] = useState('');

  // Standalone Jama (payment received) state
  const [jamaAmount, setJamaAmount] = useState('');
  const [jamaMode, setJamaMode] = useState<PaymentMode>('Cash');
  const [jamaDate, setJamaDate] = useState(getTodayISO());
  const [jamaNote, setJamaNote] = useState('');
  const [jamaError, setJamaError] = useState('');

  React.useEffect(() => {
    if (openAddModalOnMount) {
      openCreateModal();
      onConsumedAddModal?.();
    }
  }, [openAddModalOnMount]);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === activeCustomerId) ?? null,
    [customers, activeCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === 'Retailer' && c.customerType !== 'Retailer') return false;
      if (filter === 'Regular' && c.customerType !== 'Regular') return false;
      if (filter === 'due' && c.dueBalance <= 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.shopAddress.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    });
  }, [customers, search, filter]);

  const totalMarketDue = useMemo(
    () => customers.reduce((sum, c) => sum + Math.max(0, c.dueBalance), 0),
    [customers]
  );

  const pendingAccountsCount = useMemo(
    () => customers.filter((c) => c.dueBalance > 0).length,
    [customers]
  );

  const customerLedger = useMemo(() => {
    if (!activeCustomer) return [];
    return transactions
      .filter((t) => t.customerId === activeCustomer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [transactions, activeCustomer]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setNameInput('');
    setPhoneInput('');
    setAddressInput('');
    setTypeInput('Retailer');
    setOpeningDueInput('0');
    setCustomRatesInput({});
    setEditorError('');
    setShowEditor(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setNameInput(cust.name);
    setPhoneInput(cust.phone);
    setAddressInput(cust.shopAddress);
    setTypeInput(cust.customerType);
    setOpeningDueInput(String(cust.dueBalance));
    const rateStrings: Record<string, string> = {};
    Object.entries(cust.customRates).forEach(([pid, rate]) => {
      rateStrings[pid] = String(rate);
    });
    setCustomRatesInput(rateStrings);
    setEditorError('');
    setShowEditor(true);
  };

  const handleSaveCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    const cleanPhone = sanitizeIndianPhone(phoneInput);

    if (!trimmedName) {
      setEditorError('Customer name is required.');
      return;
    }
    if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
      setEditorError('Enter a valid 10-digit WhatsApp mobile number (or leave blank).');
      return;
    }

    const customRates: Record<string, number> = {};
    Object.entries(customRatesInput).forEach(([pid, val]) => {
      const trimmed = val.trim();
      if (trimmed !== '') {
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          customRates[pid] = parsed;
        }
      }
    });

    onSaveCustomer({
      id: editingCustomer?.id,
      name: trimmedName,
      phone: cleanPhone,
      shopAddress: addressInput.trim(),
      customerType: typeInput,
      dueBalance: Number(openingDueInput) || 0,
      customRates,
    });
    setShowEditor(false);
  };

  const handleSaveJama = (sendWhatsApp: boolean) => {
    if (!activeCustomer) return;
    const amt = Math.max(0, Number(jamaAmount) || 0);
    if (amt <= 0) {
      setJamaError('Enter a valid payment amount received.');
      return;
    }

    const saved = onRecordPayment({
      customerId: activeCustomer.id,
      amountPaid: amt,
      paymentMode: jamaMode,
      date: jamaDate,
      note: jamaNote.trim(),
    });

    if (sendWhatsApp) {
      const text = buildSalesReceiptText(saved, shopProfile, activeCustomer);
      const waUrl = buildWhatsAppUrl(saved.customerPhone, text);
      const anchor = document.createElement('a');
      anchor.href = waUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    setShowJamaForm(false);
    setJamaAmount('');
    setJamaNote('');
    setJamaError('');
    onOpenReceipt(saved);
  };

  const productsBySupplier = useMemo(
    () =>
      suppliers.map((sup) => ({
        supplier: sup,
        items: products.filter((p) => p.supplierId === sup.id),
      })),
    [suppliers, products]
  );

  return (
    <div className="space-y-5">
      {/* Top KPI Summary Row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-3.5 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Total Customers</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
            {customers.length}
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-3.5 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Market Due</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-rose-700 tabular-nums">
            {formatINR(totalMarketDue)}
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-3.5 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Pending Accounts</div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-sky-800 tabular-nums">
            {pendingAccountsCount}
          </div>
        </div>
      </div>

      {/* Main Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Customer Directory List */}
        <section
          className={`lg:col-span-5 ${activeCustomer ? 'hidden lg:block' : 'block'}`}
        >
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Customer Khata</h2>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Customer</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, shop, or mobile..."
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'due', label: 'Pending Due' },
                    { id: 'Retailer', label: 'Retailer' },
                    { id: 'Regular', label: 'Regular' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`flex-1 min-h-[36px] px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      filter === tab.id
                        ? 'bg-white text-sky-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No customers match this filter.
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isActive = cust.id === activeCustomerId;
                  const customCount = Object.keys(cust.customRates).length;
                  return (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => {
                        setActiveCustomerId(cust.id);
                        setShowJamaForm(false);
                      }}
                      className={`w-full text-left px-4 py-3.5 min-h-[70px] flex items-center justify-between gap-3 transition-colors ${
                        isActive ? 'bg-sky-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 truncate">{cust.name}</div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {cust.customerType}
                          {cust.shopAddress ? ` · ${cust.shopAddress}` : ''}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {cust.phone ? `+91 ${cust.phone}` : 'No phone'}
                          {customCount > 0 ? ` · ${customCount} custom rates` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div
                            className={`font-mono text-sm font-bold tabular-nums ${
                              cust.dueBalance > 0
                                ? 'text-rose-700'
                                : cust.dueBalance < 0
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {formatINR(cust.dueBalance)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {cust.dueBalance > 0 ? 'Pending' : cust.dueBalance < 0 ? 'Advance' : 'Clear'}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Customer Profile & Ledger View */}
        <section
          className={`lg:col-span-7 ${activeCustomer ? 'block' : 'hidden lg:block'}`}
        >
          {!activeCustomer ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
              <h2 className="text-lg font-bold text-slate-900">Select a Customer Profile</h2>
              <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                Tap any customer to inspect their complete unit-wise transaction history, custom
                selling rates, or record a Jama payment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Profile Header Card */}
              <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setActiveCustomerId(null)}
                      aria-label="Back to customers list"
                      className="lg:hidden min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-xl font-extrabold text-slate-900 truncate">
                        {activeCustomer.name}
                      </h2>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {activeCustomer.customerType}
                        {activeCustomer.shopAddress ? ` · ${activeCustomer.shopAddress}` : ''}
                      </p>
                      {activeCustomer.phone && (
                        <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                          <a
                            href={`tel:+91${activeCustomer.phone}`}
                            className="inline-flex items-center gap-1.5 text-sky-700 hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>+91 {activeCustomer.phone}</span>
                          </a>
                          <a
                            href={`https://wa.me/91${activeCustomer.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp Chat</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(activeCustomer)}
                      aria-label="Edit customer and custom rates"
                      className="min-h-[42px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit &amp; Rates</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activeCustomer.id)}
                      aria-label="Delete customer"
                      className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {confirmDeleteId === activeCustomer.id && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-rose-900">
                      Remove {activeCustomer.name} from your customer list? (Past bills stay in Reports.)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteCustomer(activeCustomer.id);
                          setActiveCustomerId(null);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[36px] px-3 rounded-lg bg-rose-700 text-white text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                    <div className="text-xs text-slate-500">Current Due</div>
                    <div
                      className={`mt-0.5 font-mono text-lg font-extrabold tabular-nums ${
                        activeCustomer.dueBalance > 0
                          ? 'text-rose-700'
                          : activeCustomer.dueBalance < 0
                          ? 'text-emerald-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {formatINR(activeCustomer.dueBalance)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                    <div className="text-xs text-slate-500">Special Rates</div>
                    <div className="mt-0.5 font-mono text-lg font-extrabold text-slate-900 tabular-nums">
                      {Object.keys(activeCustomer.customRates).length} Items
                    </div>
                  </div>
                </div>

                {/* Profile Primary Actions */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onQuickBillCustomer(activeCustomer.id)}
                    className="min-h-[46px] px-4 rounded-xl bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-4 h-4 shrink-0" />
                    <span>New Bill</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowJamaForm((v) => !v);
                      setJamaError('');
                    }}
                    className="min-h-[46px] px-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <IndianRupee className="w-4 h-4 shrink-0" />
                    <span>Receive Payment (Jama)</span>
                  </button>
                </div>

                {/* Standalone Payment (Jama) Form */}
                {showJamaForm && (
                  <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-emerald-950">
                        Record Payment Received (Jama)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowJamaForm(false)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Amount Received (₹)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={jamaAmount}
                          onChange={(e) => setJamaAmount(e.target.value)}
                          placeholder={
                            activeCustomer.dueBalance > 0
                              ? String(activeCustomer.dueBalance)
                              : '0'
                          }
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white font-mono text-base font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Payment Mode
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white border border-slate-200">
                          {(['Cash', 'UPI'] as PaymentMode[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setJamaMode(m)}
                              className={`min-h-[34px] rounded-lg text-xs font-bold ${
                                jamaMode === m
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Payment Date
                        </label>
                        <input
                          type="date"
                          value={jamaDate}
                          onChange={(e) => setJamaDate(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={jamaNote}
                      onChange={(e) => setJamaNote(e.target.value)}
                      placeholder="Optional note (e.g., Received at shop counter)"
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                    />

                    {jamaError && (
                      <p className="text-xs font-semibold text-rose-700">{jamaError}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveJama(true)}
                        className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" />
                        <span>Save &amp; WhatsApp Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveJama(false)}
                        className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold hover:bg-slate-50"
                      >
                        Save Payment Only
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Unit Rates Summary */}
                {Object.keys(activeCustomer.customRates).length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 mb-2">
                      Active Custom Per-Unit Selling Rates
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-700">
                      {Object.entries(activeCustomer.customRates).map(([pid, rate]) => {
                        const prod = products.find((p) => p.id === pid);
                        if (!prod) return null;
                        return (
                          <span key={pid} className="tabular-nums">
                            {prod.brandName} {prod.name}:{' '}
                            <strong className="font-mono text-sky-800">
                              {formatINR(rate)}/{prod.unitLabel}
                            </strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Complete Transaction & Payment Ledger */}
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Unit-Wise Transaction &amp; Payment Ledger
                  </h3>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {customerLedger.length} entries
                  </span>
                </div>

                {customerLedger.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No bills or payments recorded for this customer yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {customerLedger.map((txn) => (
                      <div key={txn.id} className="p-4 sm:px-5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {txn.type === 'sale' ? `Sale Bill ${txn.billNo}` : `Payment Jama ${txn.billNo}`}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDisplayDate(txn.date)} · Paid via {txn.paymentMode}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenReceipt(txn)}
                            className="min-h-[36px] px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1 hover:bg-emerald-100 shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </div>

                        {txn.items.length > 0 && (
                          <div className="space-y-1 text-xs text-slate-700 bg-slate-50 rounded-xl p-3">
                            {txn.items.map((item, idx) => (
                              <div
                                key={`${txn.id}_${idx}`}
                                className="flex items-center justify-between gap-2 tabular-nums"
                              >
                                <span className="truncate">
                                  {item.brandName} {item.productName} —{' '}
                                  {formatUnitQty(item.quantity, item.unitLabel, item.unitPlural)} ×{' '}
                                  {formatINR(item.unitRate)}
                                </span>
                                <span className="font-mono font-semibold text-slate-900 shrink-0">
                                  {formatINR(item.subtotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 tabular-nums">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                            {txn.type === 'sale' && (
                              <span>
                                Bill:{' '}
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
                            Due After: {formatINR(txn.netDueAfter)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Add / Edit Customer Modal with Custom Per-Unit Rate Overrides */}
      {showEditor && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowEditor(false)}
        >
          <div
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCustomer ? `Edit ${editingCustomer.name}` : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCustomerSubmit}
              className="p-5 overflow-y-auto flex-1 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g., Subrata Saha"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Mobile (10-digit)
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(sanitizeIndianPhone(e.target.value))}
                    placeholder="9832XXXXXX"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Shop Name / Address
                </label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="e.g., Saha General Store, Khagra Market"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Type
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
                    {(['Retailer', 'Regular'] as CustomerType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeInput(t)}
                        className={`min-h-[36px] rounded-lg text-xs font-bold ${
                          typeInput === t
                            ? 'bg-white text-sky-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingCustomer ? 'Current Due (₹)' : 'Opening Due (₹)'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={openingDueInput}
                    onChange={(e) => setOpeningDueInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 tabular-nums"
                  />
                </div>
              </div>

              {/* Custom Per-Unit Rate Overrides */}
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-900">
                  Custom Per-Unit Selling Rates (Optional)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  Leave blank to automatically use the default per-unit selling rate from Settings.
                </p>

                <div className="space-y-4">
                  {productsBySupplier.map(({ supplier, items }) => (
                    <div key={supplier.id} className="space-y-2">
                      <div className="text-xs font-bold text-sky-900">{supplier.name}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((prod) => (
                          <div
                            key={prod.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/70"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {prod.name}
                              </div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                Default: {formatINR(prod.defaultSellingRate)}/{prod.unitLabel}
                              </div>
                            </div>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              value={customRatesInput[prod.id] ?? ''}
                              onChange={(e) =>
                                setCustomRatesInput((prev) => ({
                                  ...prev,
                                  [prod.id]: e.target.value,
                                }))
                              }
                              placeholder={String(prod.defaultSellingRate)}
                              aria-label={`Custom rate for ${prod.brandName} ${prod.name}`}
                              className="w-20 min-h-[38px] px-2 text-right rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {editorError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  {editorError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingCustomer ? 'Save Changes' : 'Create Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
