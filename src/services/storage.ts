import { createInitialSeedState } from '../data/seedData';
import { AppDataState, Customer, Product, SalesTransaction, CompanyPurchase } from '../types';

const STORAGE_KEY = 'kundu_enterprise_pwa_v1';

/**
 * Modular repository interface so Firebase Firestore or Supabase
 * can later replace LocalStorage without touching UI components.
 */
export interface DataRepository {
  load(): AppDataState;
  save(state: AppDataState): void;
  exportJson(state: AppDataState): string;
  parseImportJson(raw: string): AppDataState;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeCustomer(c: Partial<Customer>): Customer {
  return {
    id: typeof c.id === 'string' && c.id ? c.id : `cust_${Date.now()}`,
    name: typeof c.name === 'string' ? c.name : 'Unnamed Customer',
    phone: typeof c.phone === 'string' ? c.phone : '',
    shopAddress: typeof c.shopAddress === 'string' ? c.shopAddress : '',
    customerType: c.customerType === 'Regular' ? 'Regular' : 'Retailer',
    dueBalance: typeof c.dueBalance === 'number' && Number.isFinite(c.dueBalance) ? c.dueBalance : 0,
    customRates:
      c.customRates && typeof c.customRates === 'object' && !Array.isArray(c.customRates)
        ? c.customRates
        : {},
    createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
    isSample: Boolean(c.isSample),
  };
}

function normalizeProduct(p: Partial<Product>): Product {
  return {
    id: typeof p.id === 'string' && p.id ? p.id : `prod_${Date.now()}`,
    moduleId: p.moduleId ?? 'water_beverages',
    supplierId: typeof p.supplierId === 'string' ? p.supplierId : 'sup_desertmina',
    brandName: typeof p.brandName === 'string' ? p.brandName : 'Desertmina',
    name: typeof p.name === 'string' ? p.name : 'Water Unit',
    unitLabel: p.unitLabel ?? 'Bottle',
    unitPlural: typeof p.unitPlural === 'string' ? p.unitPlural : 'Bottles',
    defaultPurchaseRate: Number.isFinite(Number(p.defaultPurchaseRate))
      ? Number(p.defaultPurchaseRate)
      : 0,
    defaultSellingRate: Number.isFinite(Number(p.defaultSellingRate))
      ? Number(p.defaultSellingRate)
      : 0,
    stockUnits: Number.isFinite(Number(p.stockUnits)) ? Math.max(0, Number(p.stockUnits)) : 0,
    lowStockThreshold: Number.isFinite(Number(p.lowStockThreshold))
      ? Math.max(0, Number(p.lowStockThreshold))
      : 10,
    defaultUnitsPerBox: Number.isFinite(Number(p.defaultUnitsPerBox))
      ? Math.max(1, Number(p.defaultUnitsPerBox))
      : 1,
  };
}

function normalizeTransaction(t: Partial<SalesTransaction>): SalesTransaction {
  return {
    id: typeof t.id === 'string' && t.id ? t.id : `txn_${Date.now()}`,
    moduleId: t.moduleId ?? 'water_beverages',
    type: t.type === 'payment' ? 'payment' : 'sale',
    billNo: typeof t.billNo === 'string' ? t.billNo : 'KE-0000',
    date: typeof t.date === 'string' ? t.date : new Date().toISOString().slice(0, 10),
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    customerId: typeof t.customerId === 'string' ? t.customerId : '',
    customerName: typeof t.customerName === 'string' ? t.customerName : 'Customer',
    customerPhone: typeof t.customerPhone === 'string' ? t.customerPhone : '',
    items: Array.isArray(t.items) ? t.items : [],
    totalAmount: Number.isFinite(Number(t.totalAmount)) ? Number(t.totalAmount) : 0,
    previousDue: Number.isFinite(Number(t.previousDue)) ? Number(t.previousDue) : 0,
    amountPaid: Number.isFinite(Number(t.amountPaid)) ? Number(t.amountPaid) : 0,
    paymentMode: t.paymentMode === 'UPI' ? 'UPI' : 'Cash',
    netDueAfter: Number.isFinite(Number(t.netDueAfter)) ? Number(t.netDueAfter) : 0,
    note: typeof t.note === 'string' ? t.note : undefined,
    isSample: Boolean(t.isSample),
  };
}

function normalizePurchase(pur: Partial<CompanyPurchase>): CompanyPurchase {
  return {
    id: typeof pur.id === 'string' && pur.id ? pur.id : `pur_${Date.now()}`,
    moduleId: pur.moduleId ?? 'water_beverages',
    supplierId: typeof pur.supplierId === 'string' ? pur.supplierId : 'sup_desertmina',
    supplierName: typeof pur.supplierName === 'string' ? pur.supplierName : 'Desertmina',
    invoiceNo: typeof pur.invoiceNo === 'string' ? pur.invoiceNo : 'INV',
    date: typeof pur.date === 'string' ? pur.date : new Date().toISOString().slice(0, 10),
    createdAt: typeof pur.createdAt === 'string' ? pur.createdAt : new Date().toISOString(),
    items: Array.isArray(pur.items) ? pur.items : [],
    totalAmount: Number.isFinite(Number(pur.totalAmount)) ? Number(pur.totalAmount) : 0,
    amountPaid: Number.isFinite(Number(pur.amountPaid)) ? Number(pur.amountPaid) : 0,
    paymentMode:
      pur.paymentMode === 'Cash' || pur.paymentMode === 'Bank Transfer' ? pur.paymentMode : 'UPI',
    balanceDue: Number.isFinite(Number(pur.balanceDue)) ? Number(pur.balanceDue) : 0,
    note: typeof pur.note === 'string' ? pur.note : undefined,
    isSample: Boolean(pur.isSample),
  };
}

class LocalStorageRepository implements DataRepository {
  load(): AppDataState {
    try {
      const storage = getSafeStorage();
      const raw = storage ? storage.getItem(STORAGE_KEY) : null;
      if (!raw) {
        const seed = createInitialSeedState();
        this.save(seed);
        return seed;
      }
      const parsed = JSON.parse(raw) as Partial<AppDataState> | null;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products) || !Array.isArray(parsed.suppliers)) {
        const seed = createInitialSeedState();
        this.save(seed);
        return seed;
      }
      const fallback = createInitialSeedState();
      const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
      const isLegacyV1 = version < 2;
      const isLegacyV2 = version < 3;
      const legacyAddresses = new Set([
        '',
        'Station Road, Berhampur, Murshidabad, WB',
        'Polsonda / Berhampur | Murshidabad',
      ]);
      const currentAddr =
        typeof parsed.shopProfile?.address === 'string' ? parsed.shopProfile.address.trim() : '';

      const mergedShop = {
        ...fallback.shopProfile,
        ...(parsed.shopProfile && typeof parsed.shopProfile === 'object' ? parsed.shopProfile : {}),
        shopName:
          isLegacyV1 &&
          (parsed.shopProfile?.shopName === 'Kundu Enterprise' || !parsed.shopProfile?.shopName)
            ? fallback.shopProfile.shopName
            : parsed.shopProfile?.shopName || fallback.shopProfile.shopName,
        tagline: parsed.shopProfile?.tagline || fallback.shopProfile.tagline,
        phone:
          isLegacyV1 &&
          (parsed.shopProfile?.phone === '9832012345' || !parsed.shopProfile?.phone)
            ? fallback.shopProfile.phone
            : parsed.shopProfile?.phone ?? fallback.shopProfile.phone,
        address:
          isLegacyV2 && legacyAddresses.has(currentAddr)
            ? fallback.shopProfile.address
            : parsed.shopProfile?.address ?? fallback.shopProfile.address,
      };

      const mergedSuppliers = (
        parsed.suppliers.length > 0 ? parsed.suppliers : fallback.suppliers
      ).map((sup) =>
        isLegacyV1 && sup.id === 'sup_desertmina' && !sup.phone
          ? { ...sup, phone: '9609457208' }
          : sup
      );

      return {
        schemaVersion: 3,
        activeModuleId: parsed.activeModuleId ?? 'water_beverages',
        shopProfile: mergedShop,
        suppliers: mergedSuppliers,
        products:
          parsed.products.length > 0
            ? parsed.products.map((p) => normalizeProduct(p))
            : fallback.products,
        customers: Array.isArray(parsed.customers)
          ? parsed.customers.map((c) => normalizeCustomer(c))
          : [],
        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions.map((t) => normalizeTransaction(t))
          : [],
        purchases: Array.isArray(parsed.purchases)
          ? parsed.purchases.map((pur) => normalizePurchase(pur))
          : [],
        billSequence:
          typeof parsed.billSequence === 'number' && Number.isFinite(parsed.billSequence)
            ? parsed.billSequence
            : 1001,
      };
    } catch {
      return createInitialSeedState();
    }
  }

  save(state: AppDataState): void {
    try {
      const storage = getSafeStorage();
      if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Ignore storage quota or restricted-mode errors gracefully
    }
  }

  exportJson(state: AppDataState): string {
    return JSON.stringify(state, null, 2);
  }

  parseImportJson(raw: string): AppDataState {
    const parsed = JSON.parse(raw) as Partial<AppDataState> | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.suppliers) ||
      !Array.isArray(parsed.customers)
    ) {
      throw new Error('Invalid Kundu Enterprise backup file structure.');
    }
    const fallback = createInitialSeedState();
    return {
      schemaVersion: 3,
      activeModuleId: parsed.activeModuleId ?? 'water_beverages',
      shopProfile: {
        ...fallback.shopProfile,
        ...(parsed.shopProfile && typeof parsed.shopProfile === 'object' ? parsed.shopProfile : {}),
      },
      suppliers: parsed.suppliers.length > 0 ? parsed.suppliers : fallback.suppliers,
      products:
        parsed.products.length > 0
          ? parsed.products.map((p) => normalizeProduct(p))
          : fallback.products,
      customers: parsed.customers.map((c) => normalizeCustomer(c)),
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions.map((t) => normalizeTransaction(t))
        : [],
      purchases: Array.isArray(parsed.purchases)
        ? parsed.purchases.map((pur) => normalizePurchase(pur))
        : [],
      billSequence:
        typeof parsed.billSequence === 'number' && Number.isFinite(parsed.billSequence)
          ? parsed.billSequence
          : 1001,
    };
  }
}

export const dataRepository: DataRepository = new LocalStorageRepository();

export function buildTransactionsCsv(state: AppDataState): string {
  const header = [
    'Bill No',
    'Date',
    'Type',
    'Customer',
    'Phone',
    'Items Breakdown',
    'Bill Total (INR)',
    'Previous Due (INR)',
    'Paid Today (INR)',
    'Payment Mode',
    'Net Due After (INR)',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = (state.transactions ?? []).map((t) => {
    const breakdown = (t.items ?? [])
      .map((i) => `${i.brandName} ${i.productName}: ${i.quantity} ${i.unitPlural} x ${i.unitRate}`)
      .join(' | ');
    return [
      t.billNo,
      t.date,
      t.type === 'sale' ? 'Sale' : 'Payment (Jama)',
      t.customerName,
      t.customerPhone,
      breakdown || (t.note ?? 'Payment received'),
      t.totalAmount,
      t.previousDue,
      t.amountPaid,
      t.paymentMode,
      t.netDueAfter,
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [header.map(escapeCsv).join(','), ...rows].join('\n');
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch {
    // Gracefully ignore download errors in unsupported environments
  }
}

export function isWebShareFileSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      typeof File === 'function'
    );
  } catch {
    return false;
  }
}

export async function shareBackupFile(
  content: string,
  filename: string,
  mimeType: string,
  title: string
): Promise<'shared' | 'cancelled' | 'fallback_downloaded'> {
  try {
    if (isWebShareFileSupported()) {
      const file = new File([content], filename, { type: mimeType });
      const canShare =
        typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;
      if (canShare) {
        await navigator.share({
          title,
          text: `${title} (${filename})`,
          files: [file],
        });
        return 'shared';
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return 'cancelled';
    }
    // Fall through to direct download on any non-abort share error
  }

  triggerFileDownload(content, filename, mimeType);
  return 'fallback_downloaded';
}
