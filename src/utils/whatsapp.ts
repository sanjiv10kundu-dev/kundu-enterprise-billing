import { Customer, SalesTransaction, ShopProfile } from '../types';
import { formatDisplayDate, formatINR, formatUnitQty, sanitizeIndianPhone } from './format';

export function buildSalesReceiptText(
  txn: SalesTransaction,
  shop: ShopProfile,
  customer?: Customer
): string {
  const lines: string[] = [];
  lines.push(`💧 *${shop.shopName.toUpperCase()}* 💧`);
  if (shop.tagline?.trim()) {
    lines.push(shop.tagline.trim());
  }
  if (shop.address.trim()) {
    lines.push(`(${shop.address.trim().replace(/\s*\n\s*/g, ' ')})`);
  }
  if (shop.phone.trim()) {
    lines.push(`Contact: ${sanitizeIndianPhone(shop.phone)}`);
  }
  lines.push('------------------------------');
  lines.push(`Date: ${formatDisplayDate(txn.date)} | Bill No: ${txn.billNo}`);
  lines.push(`Customer: ${txn.customerName}`);
  if (customer?.shopAddress) {
    lines.push(`Shop: ${customer.shopAddress}`);
  }
  lines.push('------------------------------');

  if (txn.type === 'sale') {
    lines.push('*Items Delivered:*');
    txn.items.forEach((item) => {
      const unitStr = formatUnitQty(item.quantity, item.unitLabel, item.unitPlural);
      lines.push(
        `${item.brandName} ${item.productName}: ${unitStr} x ${formatINR(item.unitRate)} = ${formatINR(item.subtotal)}`
      );
    });
    lines.push('------------------------------');
    lines.push(`Today's Total: ${formatINR(txn.totalAmount)}`);
    if (txn.previousDue !== 0) {
      lines.push(
        txn.previousDue > 0
          ? `Previous Due: ${formatINR(txn.previousDue)}`
          : `Previous Advance: ${formatINR(Math.abs(txn.previousDue))}`
      );
    }
    lines.push(`Paid (${txn.paymentMode}): ${formatINR(txn.amountPaid)}`);
    lines.push(
      txn.netDueAfter > 0
        ? `*Total Pending Balance: ${formatINR(txn.netDueAfter)}*`
        : txn.netDueAfter < 0
        ? `*Advance Balance: ${formatINR(Math.abs(txn.netDueAfter))}*`
        : `*Total Pending Balance: ₹0 (Cleared)*`
    );
  } else {
    lines.push('*Payment Received (Jama)*');
    lines.push(`Previous Due: ${formatINR(txn.previousDue)}`);
    lines.push(`Received (${txn.paymentMode}): ${formatINR(txn.amountPaid)}`);
    lines.push(
      txn.netDueAfter > 0
        ? `*Remaining Pending Balance: ${formatINR(txn.netDueAfter)}*`
        : txn.netDueAfter < 0
        ? `*Advance Credit: ${formatINR(Math.abs(txn.netDueAfter))}*`
        : `*Pending Balance: ₹0 (Cleared)*`
    );
  }

  if (txn.note && txn.note.trim()) {
    lines.push(`Note: ${txn.note.trim()}`);
  }

  if (shop.upiId.trim() && txn.netDueAfter > 0) {
    lines.push('------------------------------');
    lines.push(`UPI ID: ${shop.upiId.trim()}`);
  }

  lines.push('Thank you for your business!');
  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = sanitizeIndianPhone(phone);
  const encoded = encodeURIComponent(message);
  if (cleanPhone.length === 10) {
    return `https://wa.me/91${cleanPhone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
