import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  FileSpreadsheet,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Upload,
} from 'lucide-react';
import { BRAND_LOGO_URL, BUSINESS_MODULES } from '../data/seedData';
import { AppDataState, Product, ShopProfile, Supplier, UnitType } from '../types';
import { sanitizeIndianPhone } from '../utils/format';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  state: AppDataState;
  onUpdateShopProfile: (profile: ShopProfile) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onExportJson: () => void;
  onShareJson: () => void;
  onExportCsv: () => void;
  onImportJson: (raw: string) => void;
  onClearSampleData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateShopProfile,
  onUpdateSupplier,
  onUpdateProduct,
  onAddProduct,
  onExportJson,
  onShareJson,
  onExportCsv,
  onImportJson,
  onClearSampleData,
}) => {
  const [shopDraft, setShopDraft] = useState<ShopProfile>(state.shopProfile);
  const [shopSaved, setShopSaved] = useState(false);

  const [supplierDrafts, setSupplierDrafts] = useState<Record<string, Supplier>>(() => {
    const map: Record<string, Supplier> = {};
    state.suppliers.forEach((s) => {
      map[s.id] = { ...s };
    });
    return map;
  });

  React.useEffect(() => {
    setShopDraft(state.shopProfile);
  }, [state.shopProfile]);

  React.useEffect(() => {
    const map: Record<string, Supplier> = {};
    state.suppliers.forEach((s) => {
      map[s.id] = { ...s };
    });
    setSupplierDrafts(map);
  }, [state.suppliers]);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProdSupplierId, setNewProdSupplierId] = useState(state.suppliers[0]?.id ?? 'sup_desertmina');
  const [newProdName, setNewProdName] = useState('');
  const [newProdUnit, setNewProdUnit] = useState<UnitType>('Bottle');
  const [newProdBuyRate, setNewProdBuyRate] = useState('');
  const [newProdSellRate, setNewProdSellRate] = useState('');
  const [newProdBoxUnits, setNewProdBoxUnits] = useState('12');

  const [confirmClearSample, setConfirmClearSample] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateShopProfile({
      ...shopDraft,
      phone: sanitizeIndianPhone(shopDraft.phone),
    });
    setShopSaved(true);
    setTimeout(() => setShopSaved(false), 2000);
  };

  const handleSaveSupplier = (supId: string) => {
    const draft = supplierDrafts[supId];
    if (!draft) return;
    onUpdateSupplier({
      ...draft,
      phone: sanitizeIndianPhone(draft.phone),
    });
  };

  const handleAddNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = state.suppliers.find((s) => s.id === newProdSupplierId);
    if (!supplier || !newProdName.trim()) return;

    const unitPluralMap: Record<UnitType, string> = {
      Bottle: 'Bottles',
      Jar: 'Jars',
      Piece: 'Pieces',
      'Bottle/Pack': 'Packs',
      Pack: 'Packs',
      Ream: 'Reams',
    };

    onAddProduct({
      moduleId: 'water_beverages',
      supplierId: supplier.id,
      brandName: supplier.name,
      name: newProdName.trim(),
      unitLabel: newProdUnit,
      unitPlural: unitPluralMap[newProdUnit],
      defaultPurchaseRate: Math.max(0, Number(newProdBuyRate) || 0),
      defaultSellingRate: Math.max(0, Number(newProdSellRate) || 0),
      stockUnits: 0,
      lowStockThreshold: 12,
      defaultUnitsPerBox: Math.max(1, parseInt(newProdBoxUnits, 10) || 1),
    });

    setNewProdName('');
    setNewProdBuyRate('');
    setNewProdSellRate('');
    setShowAddProduct(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setImportError('');
        onImportJson(String(reader.result ?? ''));
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to import JSON backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasSampleData =
    state.customers.some((c) => c.isSample) ||
    state.transactions.some((t) => t.isSample) ||
    state.purchases.some((p) => p.isSample);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Shop Profile & Suppliers */}
        <div className="lg:col-span-5 space-y-6">
          {/* Shop Profile */}
          <form
            onSubmit={handleSaveShop}
            className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">Shop Profile (Receipt Header)</h2>
              <p className="text-xs text-slate-500">
                Appears at the top of every WhatsApp bill dispatched to customers.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={shopDraft.shopName}
                  onChange={(e) => setShopDraft({ ...shopDraft, shopName: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={shopDraft.tagline ?? ''}
                  onChange={(e) => setShopDraft({ ...shopDraft, tagline: e.target.value })}
                  placeholder="PURE WATER, HEALTHY LIFE"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Mobile
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={shopDraft.phone}
                    onChange={(e) =>
                      setShopDraft({ ...shopDraft, phone: sanitizeIndianPhone(e.target.value) })
                    }
                    placeholder="10-digit mobile"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bill Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={shopDraft.billPrefix}
                    onChange={(e) =>
                      setShopDraft({ ...shopDraft, billPrefix: e.target.value.toUpperCase() })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Shop Address
                </label>
                <textarea
                  rows={2}
                  value={shopDraft.address}
                  onChange={(e) => setShopDraft({ ...shopDraft, address: e.target.value })}
                  placeholder={'Godhanpara, Near Canara Bank,\nMurshidabad - 742308'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 leading-snug resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  UPI ID (optional, shown on pending due bills)
                </label>
                <input
                  type="text"
                  value={shopDraft.upiId}
                  onChange={(e) => setShopDraft({ ...shopDraft, upiId: e.target.value })}
                  placeholder="e.g., kunduenterprise@upi"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 inline-flex items-center justify-center gap-2"
            >
              {shopSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Shop Profile Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Shop Details</span>
                </>
              )}
            </button>
          </form>

          {/* Supplier Companies (Desertmina & Tata) */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Supplier Companies</h2>
              <p className="text-xs text-slate-500">
                Add supplier contact numbers to enable one-tap calling from Company Purchase.
              </p>
            </div>

            <div className="space-y-4">
              {state.suppliers.map((sup) => {
                const draft = supplierDrafts[sup.id] ?? sup;
                return (
                  <div
                    key={sup.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                  >
                    <div className="text-sm font-extrabold text-sky-950">{sup.name}</div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Supplier Address
                      </label>
                      <input
                        type="text"
                        value={draft.address}
                        onChange={(e) =>
                          setSupplierDrafts((prev) => ({
                            ...prev,
                            [sup.id]: { ...draft, address: e.target.value },
                          }))
                        }
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Supplier Contact Number (10-digit)
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={draft.phone}
                          onChange={(e) =>
                            setSupplierDrafts((prev) => ({
                              ...prev,
                              [sup.id]: {
                                ...draft,
                                phone: sanitizeIndianPhone(e.target.value),
                              },
                            }))
                          }
                          placeholder="Add supplier mobile number..."
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveSupplier(sup.id)}
                        className="min-h-[40px] px-3.5 rounded-lg bg-sky-700 text-white text-xs font-bold hover:bg-sky-800 shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Install PWA + Data Backup & Sample Reset */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 overflow-hidden shadow-xs">
                <img
                  src={BRAND_LOGO_URL}
                  alt="Kundu Enterprise app launcher icon"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0B2C6F]">
                  Data Backup &amp; App Install
                </h2>
                <p className="text-xs text-slate-500">
                  Export offline records or install Kundu Enterprise on your home screen.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onExportJson}
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-sky-700" />
                <span>Download JSON</span>
              </button>

              <button
                type="button"
                onClick={onShareJson}
                className="min-h-[44px] px-3.5 rounded-xl border border-sky-200 bg-sky-50 text-[#0B2C6F] text-xs font-bold hover:bg-sky-100 inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-sky-700" />
                <span>Share Backup</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-sky-700" />
                <span>Import JSON Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={onExportCsv}
                className="min-h-[44px] px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs font-bold hover:bg-emerald-100 inline-flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export CSV (Excel)</span>
              </button>
            </div>

            {importError && (
              <p className="text-xs font-semibold text-rose-700">{importError}</p>
            )}

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <PWAInstallButton variant="settings" />

              {!confirmClearSample ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearSample(true)}
                  className="min-h-[42px] px-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{hasSampleData ? 'Clear Sample Data' : 'Reset Ledger Data'}</span>
                </button>
              ) : (
                <div className="w-full rounded-xl bg-rose-50 border border-rose-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-rose-900">
                    Clear sample customers, bills, and purchases? Desertmina &amp; Tata product
                    catalog and rates will remain intact.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmClearSample(false)}
                      className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClearSampleData();
                        setConfirmClearSample(false);
                      }}
                      className="min-h-[36px] px-3 rounded-lg bg-rose-700 text-white text-xs font-bold"
                    >
                      Confirm Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Default Per-Unit Rates + Modular Expansion Architecture */}
        <div className="lg:col-span-7 space-y-6">
          {/* Unit-Wise Product Rates */}
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Per-Unit Product Catalog &amp; Default Rates
                </h2>
                <p className="text-xs text-slate-500">
                  Every product is priced strictly per Bottle, Jar, Piece, or Pack.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProduct((v) => !v)}
                className="min-h-[40px] px-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-sky-100"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>

            {showAddProduct && (
              <form
                onSubmit={handleAddNewProduct}
                className="p-4 bg-sky-50/70 border-b border-sky-200 space-y-3"
              >
                <div className="text-xs font-bold text-sky-950">
                  New Product (Water &amp; Beverages)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={newProdSupplierId}
                    onChange={(e) => setNewProdSupplierId(e.target.value)}
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                  >
                    {state.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="Product Name (e.g., 250ml Bottle)"
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value as UnitType)}
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                  >
                    <option value="Bottle">Unit: Bottle</option>
                    <option value="Jar">Unit: Jar</option>
                    <option value="Piece">Unit: Piece</option>
                    <option value="Bottle/Pack">Unit: Bottle/Pack</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={newProdBoxUnits}
                    onChange={(e) => setNewProdBoxUnits(e.target.value)}
                    placeholder="Units per box"
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={newProdBuyRate}
                    onChange={(e) => setNewProdBuyRate(e.target.value)}
                    placeholder="Default Buy Rate (₹/unit)"
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={newProdSellRate}
                    onChange={(e) => setNewProdSellRate(e.target.value)}
                    placeholder="Default Sell Rate (₹/unit)"
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddProduct(false)}
                    className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[36px] px-4 rounded-lg bg-sky-700 text-white text-xs font-bold"
                  >
                    Add Item
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-slate-200">
              {state.suppliers.map((sup) => (
                <div key={sup.id}>
                  <div className="px-4 sm:px-5 py-2.5 bg-slate-50 text-xs font-bold text-sky-950">
                    {sup.name} — {sup.address}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {state.products
                      .filter((p) => p.supplierId === sup.id)
                      .map((prod) => (
                        <div
                          key={prod.id}
                          className="p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                        >
                          <div className="sm:col-span-5">
                            <div className="text-sm font-bold text-slate-900">{prod.name}</div>
                            <div className="text-xs text-slate-500">
                              Unit: {prod.unitLabel} · Box helper: {prod.defaultUnitsPerBox}{' '}
                              {prod.unitPlural}
                            </div>
                          </div>

                          <div className="sm:col-span-7 grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Buy ₹/{prod.unitLabel}
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                value={prod.defaultPurchaseRate}
                                onChange={(e) =>
                                  onUpdateProduct({
                                    ...prod,
                                    defaultPurchaseRate: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900 tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Sell ₹/{prod.unitLabel}
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                value={prod.defaultSellingRate}
                                onChange={(e) =>
                                  onUpdateProduct({
                                    ...prod,
                                    defaultSellingRate: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full min-h-[40px] px-2.5 rounded-lg border border-sky-300 bg-sky-50/40 font-mono text-xs font-bold text-sky-950 tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Low Alert
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                value={prod.lowStockThreshold}
                                onChange={(e) =>
                                  onUpdateProduct({
                                    ...prod,
                                    lowStockThreshold: Math.max(
                                      0,
                                      parseInt(e.target.value, 10) || 0
                                    ),
                                  })
                                }
                                className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900 tabular-nums"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Business Modules Architecture (Future Expansion Hooks) */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-700" />
              <h2 className="text-base font-bold text-slate-900">
                Modular Business Categories
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              All products, bills, and stock tables are scoped by business module so additional
              divisions can be enabled cleanly without changing existing ledgers.
            </p>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {BUSINESS_MODULES.map((mod) => (
                <div
                  key={mod.id}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    mod.status === 'active' ? 'bg-sky-50/50' : 'bg-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {mod.name}{' '}
                      <span
                        className={`ml-1.5 text-xs font-semibold ${
                          mod.status === 'active' ? 'text-sky-700' : 'text-slate-400'
                        }`}
                      >
                        · {mod.status === 'active' ? 'Active Module' : 'Ready for Future Update'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{mod.description}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Catalog hooks: {mod.sampleItems.join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
