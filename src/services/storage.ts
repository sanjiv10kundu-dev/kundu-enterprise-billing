import { createInitialSeedState } from '../data/seedData';
import { AppDataState } from '../types';

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

class LocalStorageRepository implements DataRepository {
  load(): AppDataState {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = createInitialSeedState();
        this.save(seed);
        return seed;
      }
      const parsed = JSON.parse(raw) as Partial<AppDataState>;
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.suppliers)) {
        const seed = createInitialSeedState();
        this.save(seed);
        return seed;
      }
      const fallback = createInitialSeedState();
      const version = parsed.schemaVersion ?? 1;
      const isLegacyV1 = version < 2;
      const isLegacyV2 = version < 3;
      const legacyAddresses = new Set([
        '',
        'Station Road, Berhampur, Murshidabad, WB',
        'Polsonda / Berhampur | Murshidabad',
      ]);
      const currentAddr = parsed.shopProfile?.address?.trim() ?? '';

      const mergedShop = {
        ...fallback.shopProfile,
        ...(parsed.shopProfile ?? {}),
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
        products: parsed.products.length > 0 ? parsed.products : fallback.products,
        customers: Array.isArray(parsed.customers) ? parsed.customers : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
        billSequence: typeof parsed.billSequence === 'number' ? parsed.billSequence : 1001,
      };
    } catch {
      const seed = createInitialSeedState();
      return seed;
    }
  }

  save(state: AppDataState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }

  exportJson(state: AppDataState): string {
    return JSON.stringify(state, null, 2);
  }

  parseImportJson(raw: string): AppDataState {
    const parsed = JSON.parse(raw) as Partial<AppDataState>;
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
      schemaVersion: parsed.schemaVersion ?? 1,
      activeModuleId: parsed.activeModuleId ?? 'water_beverages',
      shopProfile: { ...fallback.shopProfile, ...(parsed.shopProfile ?? {}) },
      suppliers: parsed.suppliers,
      products: parsed.products,
      customers: parsed.customers,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      billSequence: typeof parsed.billSequence === 'number' ? parsed.billSequence : 1001,
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

  const rows = state.transactions.map((t) => {
    const breakdown = t.items
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
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
