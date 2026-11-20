import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  PackagePlus,
  Phone,
  ReceiptText,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react';
import { CustomersView } from './components/CustomersView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { PurchaseView } from './components/PurchaseView';
import { QuickBillView } from './components/QuickBillView';
import { ReceiptModal } from './components/ReceiptModal';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { Toast, ToastMessage } from './components/Toast';
import { BRAND_LOGO_URL, BUSINESS_MODULES } from './data/seedData';
import {
  buildTransactionsCsv,
  dataRepository,
  shareBackupFile,
  triggerFileDownload,
} from './services/storage';
import {
  AppDataState,
  BillLineItem,
  Customer,
  NavTab,
  PaymentMode,
  Product,
  PurchaseLineItem,
  SalesTransaction,
  ShopProfile,
  Supplier,
} from './types';
import { pickPhoneContact } from './utils/contacts';
import { generateId, getTodayISO } from './utils/format';

const NAV_ITEMS: { id: NavTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'quick-bill', label: 'Quick Bill', shortLabel: 'Quick Bill', icon: ReceiptText },
  { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: Users },
  { id: 'purchase', label: 'Company Purchase', shortLabel: 'Purchase', icon: PackagePlus },
  { id: 'reports', label: 'Reports & History', shortLabel: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const [state, setState] = useState<AppDataState>(() => dataRepository.load());
  const [activeTab, setActiveTab] = useState<NavTab>('quick-bill');
  const [selectedBillingCustomerId, setSelectedBillingCustomerId] = useState<string | null>(null);
  const [openAddCustomerModal, setOpenAddCustomerModal] = useState(false);
  const [prefillContact, setPrefillContact] = useState<{ name: string; phone: string } | null>(
    null
  );
  const [receiptTxn, setReceiptTxn] = useState<SalesTransaction | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    dataRepository.save(state);
  }, [state]);

  const showToast = (text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
    }, 3200);
  };

  const handleStartAddCustomer = async () => {
    const result = await pickPhoneContact();
    if (result.status === 'selected') {
      setPrefillContact({ name: result.name, phone: result.phone });
    } else {
      setPrefillContact(null);
    }
    setOpenAddCustomerModal(true);
    setActiveTab('customers');
  };

  const activeModule = useMemo(
    () =>
      BUSINESS_MODULES.find((m) => m.id === state.activeModuleId) ?? BUSINESS_MODULES[0],
    [state.activeModuleId]
  );

  // Filter suppliers & products by active module (Water & Beverages)
  const moduleSuppliers = useMemo(
    () => state.suppliers.filter((s) => s.moduleId === state.activeModuleId),
    [state.suppliers, state.activeModuleId]
  );

  const moduleProducts = useMemo(
    () => state.products.filter((p) => p.moduleId === state.activeModuleId),
    [state.products, state.activeModuleId]
  );

  // Save Sale Bill (Quick Bill)
  const handleSaveSale = (payload: {
    customerId: string;
    date: string;
    items: BillLineItem[];
    amountPaid: number;
    paymentMode: PaymentMode;
    note: string;
  }): SalesTransaction => {
    const customer = state.customers.find((c) => c.id === payload.customerId)!;
    const totalAmount =
      Math.round(payload.items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
    const previousDue = customer.dueBalance;
    const netDueAfter =
      Math.round((previousDue + totalAmount - payload.amountPaid) * 100) / 100;

    const prefix = state.shopProfile.billPrefix.trim() || 'KE';
    const billNo = `${prefix}-${state.billSequence}`;

    const newTxn: SalesTransaction = {
      id: generateId('txn'),
      moduleId: state.activeModuleId,
      type: payload.items.length > 0 ? 'sale' : 'payment',
      billNo,
      date: payload.date,
      createdAt: new Date().toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      items: payload.items,
      totalAmount,
      previousDue,
      amountPaid: payload.amountPaid,
      paymentMode: payload.paymentMode,
      netDueAfter,
      note: payload.note || undefined,
    };

    // Build quantity deduction map
    const deductedUnits: Record<string, number> = {};
    payload.items.forEach((item) => {
      deductedUnits[item.productId] = (deductedUnits[item.productId] ?? 0) + item.quantity;
    });

    setState((prev) => ({
      ...prev,
      billSequence: prev.billSequence + 1,
      customers: prev.customers.map((c) =>
        c.id === customer.id ? { ...c, dueBalance: netDueAfter } : c
      ),
      products: prev.products.map((p) =>
        deductedUnits[p.id]
          ? { ...p, stockUnits: Math.max(0, p.stockUnits - deductedUnits[p.id]) }
          : p
      ),
      transactions: [newTxn, ...prev.transactions],
    }));

    showToast(`Bill ${billNo} saved for ${customer.name}`);
    return newTxn;
  };

  // Record Standalone Payment (Jama) from Customer Profile
  const handleRecordPayment = (payload: {
    customerId: string;
    amountPaid: number;
    paymentMode: PaymentMode;
    date: string;
    note: string;
  }): SalesTransaction => {
    const customer = state.customers.find((c) => c.id === payload.customerId)!;
    const previousDue = customer.dueBalance;
    const netDueAfter = Math.round((previousDue - payload.amountPaid) * 100) / 100;
    const prefix = state.shopProfile.billPrefix.trim() || 'KE';
    const billNo = `${prefix}-J${state.billSequence}`;

    const newTxn: SalesTransaction = {
      id: generateId('jama'),
      moduleId: state.activeModuleId,
      type: 'payment',
      billNo,
      date: payload.date,
      createdAt: new Date().toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      items: [],
      totalAmount: 0,
      previousDue,
      amountPaid: payload.amountPaid,
      paymentMode: payload.paymentMode,
      netDueAfter,
      note: payload.note || undefined,
    };

    setState((prev) => ({
      ...prev,
      billSequence: prev.billSequence + 1,
      customers: prev.customers.map((c) =>
        c.id === customer.id ? { ...c, dueBalance: netDueAfter } : c
      ),
      transactions: [newTxn, ...prev.transactions],
    }));

    showToast(`Payment received saved for ${customer.name}`);
    return newTxn;
  };

  // Delete Transaction & Revert Stock/Due cleanly
  const handleDeleteTransaction = (txnId: string) => {
    const target = state.transactions.find((t) => t.id === txnId);
    if (!target) return;

    const restoredUnits: Record<string, number> = {};
    target.items.forEach((item) => {
      restoredUnits[item.productId] = (restoredUnits[item.productId] ?? 0) + item.quantity;
    });

    const dueDelta = target.totalAmount - target.amountPaid;

    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== txnId),
      products: prev.products.map((p) =>
        restoredUnits[p.id] ? { ...p, stockUnits: p.stockUnits + restoredUnits[p.id] } : p
      ),
      customers: prev.customers.map((c) =>
        c.id === target.customerId
          ? {
              ...c,
              dueBalance: Math.round((c.dueBalance - dueDelta) * 100) / 100,
            }
          : c
      ),
    }));

    showToast(`Deleted ${target.billNo} and reverted balance`, 'info');
  };

  // Save / Edit Customer
  const handleSaveCustomer = (
    payload: Omit<Customer, 'id' | 'createdAt'> & { id?: string }
  ) => {
    if (payload.id) {
      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === payload.id
            ? {
                ...c,
                name: payload.name,
                phone: payload.phone,
                shopAddress: payload.shopAddress,
                customerType: payload.customerType,
                dueBalance: payload.dueBalance,
                customRates: payload.customRates,
                isSample: false,
              }
            : c
        ),
      }));
      showToast(`Updated ${payload.name}`);
    } else {
      const newCustomer: Customer = {
        id: generateId('cust'),
        name: payload.name,
        phone: payload.phone,
        shopAddress: payload.shopAddress,
        customerType: payload.customerType,
        dueBalance: payload.dueBalance,
        customRates: payload.customRates,
        createdAt: new Date().toISOString(),
        isSample: false,
      };
      setState((prev) => ({
        ...prev,
        customers: [newCustomer, ...prev.customers],
      }));
      showToast(`Added customer ${newCustomer.name}`);
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== customerId),
    }));
    if (selectedBillingCustomerId === customerId) {
      setSelectedBillingCustomerId(null);
    }
    showToast('Customer removed', 'info');
  };

  // Save Company Purchase & Increase Stock
  const handleSavePurchase = (payload: {
    supplierId: string;
    invoiceNo: string;
    date: string;
    items: PurchaseLineItem[];
    amountPaid: number;
    paymentMode: PaymentMode | 'Bank Transfer';
    note: string;
  }) => {
    const supplier = state.suppliers.find((s) => s.id === payload.supplierId);
    if (!supplier) return;

    const totalAmount =
      Math.round(payload.items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
    const balanceDue = Math.max(0, Math.round((totalAmount - payload.amountPaid) * 100) / 100);

    const addedUnits: Record<string, number> = {};
    payload.items.forEach((item) => {
      addedUnits[item.productId] = (addedUnits[item.productId] ?? 0) + item.quantity;
    });

    const newPurchase = {
      id: generateId('pur'),
      moduleId: state.activeModuleId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      invoiceNo: payload.invoiceNo,
      date: payload.date,
      createdAt: new Date().toISOString(),
      items: payload.items,
      totalAmount,
      amountPaid: payload.amountPaid,
      paymentMode: payload.paymentMode,
      balanceDue,
      note: payload.note || undefined,
    };

    setState((prev) => ({
      ...prev,
      purchases: [newPurchase, ...prev.purchases],
      products: prev.products.map((p) =>
        addedUnits[p.id] ? { ...p, stockUnits: p.stockUnits + addedUnits[p.id] } : p
      ),
    }));

    showToast(`Purchase ${payload.invoiceNo} saved — stock updated`);
  };

  const handleSettlePurchaseDue = (purchaseId: string, payAmount: number) => {
    setState((prev) => ({
      ...prev,
      purchases: prev.purchases.map((pur) =>
        pur.id === purchaseId
          ? {
              ...pur,
              amountPaid: Math.round((pur.amountPaid + payAmount) * 100) / 100,
              balanceDue: Math.max(0, Math.round((pur.balanceDue - payAmount) * 100) / 100),
            }
          : pur
      ),
    }));
    showToast('Supplier payment marked as settled');
  };

  const handleAdjustStock = (productId: string, nextStock: number) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, stockUnits: nextStock } : p
      ),
    }));
    showToast('Stock count updated');
  };

  // Settings Handlers
  const handleUpdateShopProfile = (profile: ShopProfile) => {
    setState((prev) => ({ ...prev, shopProfile: profile }));
    showToast('Shop details saved');
  };

  const handleUpdateSupplier = (supplier: Supplier) => {
    setState((prev) => ({
      ...prev,
      suppliers: prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s)),
    }));
    showToast(`Updated ${supplier.name} details`);
  };

  const handleUpdateProduct = (product: Product) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === product.id ? product : p)),
    }));
  };

  const handleAddProduct = (product: Omit<Product, 'id'>) => {
    const created: Product = { ...product, id: generateId('prod') };
    setState((prev) => ({
      ...prev,
      products: [...prev.products, created],
    }));
    showToast(`Added ${created.brandName} ${created.name}`);
  };

  const handleExportJson = () => {
    const json = dataRepository.exportJson(state);
    triggerFileDownload(
      json,
      `kundu-enterprise-backup-${getTodayISO()}.json`,
      'application/json'
    );
    showToast('JSON backup downloaded');
  };

  const handleShareJson = async () => {
    const json = dataRepository.exportJson(state);
    const filename = `kundu-enterprise-backup-${getTodayISO()}.json`;
    const result = await shareBackupFile(
      json,
      filename,
      'application/json',
      'Kundu Enterprise Data Backup'
    );
    if (result === 'shared') {
      showToast('Backup shared successfully');
    } else if (result === 'fallback_downloaded') {
      showToast('Share unavailable on this browser — backup downloaded instead', 'info');
    }
  };

  const handleExportCsv = () => {
    const csv = buildTransactionsCsv(state);
    triggerFileDownload(
      csv,
      `kundu-enterprise-transactions-${getTodayISO()}.csv`,
      'text/csv;charset=utf-8;'
    );
    showToast('CSV transactions report downloaded');
  };

  const handleImportJson = (raw: string) => {
    const imported = dataRepository.parseImportJson(raw);
    setState(imported);
    setSelectedBillingCustomerId(null);
    showToast('Backup restored successfully');
  };

  const handleClearSampleData = () => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => !c.isSample),
      transactions: prev.transactions.filter((t) => !t.isSample),
      purchases: prev.purchases.filter((p) => !p.isSample),
      products: prev.products.map((p) => ({ ...p, stockUnits: 0 })),
      billSequence: 1001,
    }));
    setSelectedBillingCustomerId(null);
    showToast('Sample data cleared — ready for live records', 'info');
  };

  const pageMeta: Record<NavTab, { title: string; subtitle: string }> = {
    'quick-bill': {
      title: 'Quick Bill',
      subtitle: `${activeModule.name} · Unit-wise delivery & WhatsApp dispatch`,
    },
    customers: {
      title: 'Customers & Khata',
      subtitle: `${activeModule.name} · Pending dues, payments & custom unit rates`,
    },
    purchase: {
      title: 'Company Purchase & Stock',
      subtitle: `${activeModule.name} · Desertmina & Tata stock entries`,
    },
    reports: {
      title: 'Reports & History',
      subtitle: `${activeModule.name} · Daily sales, collections & unit volume`,
    },
    settings: {
      title: 'Settings',
      subtitle: `${activeModule.name} · Suppliers, per-unit rates & data backup`,
    },
  };

  const receiptCustomer = useMemo(
    () =>
      receiptTxn
        ? state.customers.find((c) => c.id === receiptTxn.customerId)
        : undefined,
    [receiptTxn, state.customers]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar (Compact 52px on mobile, 56px on desktop) */}
      <header className="sticky top-0 z-30 h-13 md:h-14 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark with Logo Icon */}
          <button
            type="button"
            onClick={() => setActiveTab('quick-bill')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
          >
            <img
              src={BRAND_LOGO_URL}
              alt="Kundu Enterprise logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
            />
            <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#0B2C6F] group-hover:text-sky-700 transition-colors">
              {state.shopProfile.shopName || 'KUNDU ENTERPRISE'}
            </span>
          </button>

          {/* Zone 2: 5 Concise Single-Line Desktop Nav Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-semibold"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-orange-500 text-[#0B2C6F]'
                      : 'border-transparent text-slate-600 hover:text-[#0B2C6F] hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Contextual Action */}
          <div className="flex items-center shrink-0">
            <PWAInstallButton
              variant="compact"
              fallback={
                <button
                  type="button"
                  onClick={handleExportJson}
                  title="Download JSON backup"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-semibold text-[#0B2C6F] hover:bg-sky-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-orange-600" />
                  <span>Backup</span>
                </button>
              }
            />
          </div>
        </div>
      </header>

      {/* Main Responsive Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 pb-24 md:pb-10">
        {/* Prominent Brand Identity Banner + Active Page Context */}
        <section className="mb-5 rounded-2xl bg-gradient-to-r from-[#0B2C6F] via-[#0E4396] to-[#0284C7] text-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1 shadow-md shrink-0 overflow-hidden ring-2 ring-white/30">
                <img
                  src={BRAND_LOGO_URL}
                  alt="Kundu Enterprise — Pure Water, Healthy Life"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white truncate">
                  {state.shopProfile.shopName || 'KUNDU ENTERPRISE'}
                </h1>
                <p className="text-xs sm:text-sm font-bold tracking-wide text-orange-300 mt-0.5 truncate">
                  {state.shopProfile.tagline || 'PURE WATER, HEALTHY LIFE'}
                </p>
                <div className="mt-1.5 space-y-1 text-xs text-sky-100">
                  {state.shopProfile.phone && (
                    <div>
                      <a
                        href={`tel:+91${state.shopProfile.phone}`}
                        className="inline-flex items-center gap-1 font-mono font-bold text-white hover:text-orange-200 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-orange-300 shrink-0" />
                        <span>{state.shopProfile.phone}</span>
                      </a>
                    </div>
                  )}
                  {state.shopProfile.address && (
                    <div className="leading-snug text-sky-100 break-words whitespace-normal">
                      {(() => {
                        const raw = state.shopProfile.address.trim();
                        const lines = raw.includes('\n')
                          ? raw.split('\n').map((l) => l.trim()).filter(Boolean)
                          : /,\s*(?=Murshidabad)/i.test(raw)
                          ? raw.replace(/,\s*(?=Murshidabad)/i, ',\n').split('\n')
                          : [raw];
                        return lines.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 border-white/15 pt-2.5 sm:pt-0 shrink-0">
              <div className="text-sm sm:text-base font-bold text-white">
                {pageMeta[activeTab].title}
              </div>
              <div className="text-xs text-sky-100 mt-0.5">
                {pageMeta[activeTab].subtitle}
              </div>
            </div>
          </div>
        </section>

        {/* Active Tab View */}
        {activeTab === 'quick-bill' && (
          <QuickBillView
            customers={state.customers}
            suppliers={moduleSuppliers}
            products={moduleProducts}
            shopProfile={state.shopProfile}
            selectedCustomerId={selectedBillingCustomerId}
            onSelectCustomer={setSelectedBillingCustomerId}
            onSaveSale={handleSaveSale}
            onOpenReceipt={setReceiptTxn}
            onNavigateAddCustomer={handleStartAddCustomer}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={state.customers}
            suppliers={moduleSuppliers}
            products={moduleProducts}
            transactions={state.transactions}
            shopProfile={state.shopProfile}
            openAddModalOnMount={openAddCustomerModal}
            prefillContact={prefillContact}
            onConsumedAddModal={() => {
              setOpenAddCustomerModal(false);
              setPrefillContact(null);
            }}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onRecordPayment={handleRecordPayment}
            onQuickBillCustomer={(customerId) => {
              setSelectedBillingCustomerId(customerId);
              setActiveTab('quick-bill');
            }}
            onOpenReceipt={setReceiptTxn}
          />
        )}

        {activeTab === 'purchase' && (
          <PurchaseView
            suppliers={moduleSuppliers}
            products={moduleProducts}
            purchases={state.purchases}
            onSavePurchase={handleSavePurchase}
            onSettlePurchaseDue={handleSettlePurchaseDue}
            onAdjustStock={handleAdjustStock}
            onNavigateSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            transactions={state.transactions}
            customers={state.customers}
            suppliers={moduleSuppliers}
            products={moduleProducts}
            onOpenReceipt={setReceiptTxn}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            state={state}
            onUpdateShopProfile={handleUpdateShopProfile}
            onUpdateSupplier={handleUpdateSupplier}
            onUpdateProduct={handleUpdateProduct}
            onAddProduct={handleAddProduct}
            onExportJson={handleExportJson}
            onShareJson={handleShareJson}
            onExportCsv={handleExportCsv}
            onImportJson={handleImportJson}
            onClearSampleData={handleClearSampleData}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Compact 60px, 44px+ tap targets) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-[60px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[44px] px-1 transition-colors ${
                  isActive ? 'text-[#0B2C6F]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 bg-orange-500 rounded-b-full" />
                )}
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'stroke-[2.5] text-[#0B2C6F]' : 'stroke-[1.9]'
                  }`}
                />
                <span
                  className={`mt-1 text-[10px] leading-none whitespace-nowrap ${
                    isActive ? 'font-bold text-[#0B2C6F]' : 'font-medium'
                  }`}
                >
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Shared Receipt Modal, Offline Indicator & Toast */}
      <ReceiptModal
        transaction={receiptTxn}
        shopProfile={state.shopProfile}
        customer={receiptCustomer}
        onClose={() => setReceiptTxn(null)}
      />
      <OfflineIndicator />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
