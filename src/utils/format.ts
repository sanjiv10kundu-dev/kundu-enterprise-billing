export function formatINR(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const hasDecimals = Math.abs(abs - Math.round(abs)) > 0.001;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function formatUnitQty(qty: number, singular: string, plural: string): string {
  return `${qty} ${qty === 1 ? singular : plural}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isWithinLastDays(isoDate: string, days: number): boolean {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return false;
  const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(todayStart);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return target >= cutoff && target <= todayStart;
}

export function sanitizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Cleans phone numbers imported from a mobile phonebook/contacts directory.
 * Strips +91, 0091, leading zeros, spaces, dashes, and brackets to return a 10-digit Indian mobile number.
 */
export function cleanContactPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0091') && digits.length >= 14) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, '');
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
