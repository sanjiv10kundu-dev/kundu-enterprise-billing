/**
 * Modular domain schema for Kundu Enterprise.
 * Structured cleanly so LocalStorage can be swapped for Firebase Firestore or Supabase later.
 */

export type BusinessModuleId =
  | 'water_beverages'
  | 'cold_drinks'
  | 'computer_accessories';

export interface BusinessModuleMeta {
  id: BusinessModuleId;
  name: string;
  shortName: string;
  description: string;
  status: 'active' | 'planned';
  sampleItems: string[];
}

export type UnitType = 'Case' | 'Jar' | 'Piece' | 'Bottle' | 'Bottle/Pack' | 'Pack' | 'Ream';

export type PaymentMode = 'Cash' | 'UPI';

export type CustomerType = 'Retailer' | 'Regular';

export interface ShopProfile {
  shopName: string;
  tagline: string;
  phone: string;
  address: string;
  billPrefix: string;
  upiId: string;
}

export interface Supplier {
  id: string;
  moduleId: BusinessModuleId;
  name: string;
  address: string;
  phone: string;
  notes?: string;
}

export interface Product {
  id: string;
  moduleId: BusinessModuleId;
  supplierId: string;
  brandName: string;
  name: string;
  unitLabel: UnitType;
  unitPlural: string;
  piecesPerCase: number; // > 1 for Case-based products (24, 12, 9), 1 for Jar/Piece
  defaultPurchaseRate: number;
  defaultSellingRate: number;
  stockUnits: number;
  lowStockThreshold: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // 10-digit Indian mobile number for WhatsApp
  shopAddress: string;
  customerType: CustomerType;
  dueBalance: number; // Positive = customer owes Kundu Enterprise, Negative = advance
  customRates: Record<string, number>; // productId -> overridden per-unit selling rate
  createdAt: string;
  isSample?: boolean;
}

export interface BillLineItem {
  productId: string;
  supplierId: string;
  brandName: string;
  productName: string;
  unitLabel: UnitType;
  unitPlural: string;
  piecesPerCase?: number;
  quantity: number;
  unitRate: number;
  subtotal: number;
}

export interface SalesTransaction {
  id: string;
  moduleId: BusinessModuleId;
  type: 'sale' | 'payment';
  billNo: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: BillLineItem[];
  totalAmount: number; // Today's bill total (0 for standalone payment)
  previousDue: number;
  amountPaid: number;
  paymentMode: PaymentMode;
  netDueAfter: number;
  note?: string;
  isSample?: boolean;
}

export interface PurchaseLineItem {
  productId: string;
  productName: string;
  unitLabel: UnitType;
  unitPlural: string;
  piecesPerCase?: number;
  quantity: number;
  purchaseRate: number;
  subtotal: number;
}

export interface CompanyPurchase {
  id: string;
  moduleId: BusinessModuleId;
  supplierId: string;
  supplierName: string;
  invoiceNo: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  items: PurchaseLineItem[];
  totalAmount: number;
  amountPaid: number;
  paymentMode: PaymentMode | 'Bank Transfer';
  balanceDue: number;
  note?: string;
  isSample?: boolean;
}

export interface AppDataState {
  schemaVersion: number;
  activeModuleId: BusinessModuleId;
  shopProfile: ShopProfile;
  suppliers: Supplier[];
  products: Product[];
  customers: Customer[];
  transactions: SalesTransaction[];
  purchases: CompanyPurchase[];
  billSequence: number;
}

export type NavTab = 'quick-bill' | 'customers' | 'purchase' | 'reports' | 'settings';
