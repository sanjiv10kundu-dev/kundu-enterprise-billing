import { Customer, SalesTransaction, ShopProfile } from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatQuantityWithPieces,
  sanitizeIndianPhone,
} from './format';

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
      const unitStr = formatQuantityWithPieces(
        item.quantity,
        item.unitLabel,
        item.unitPlural,
        item.piecesPerCase
      );
      lines.push(
        `${item.brandName} ${item.productName}: ${unitStr} x ${formatINR(item.unitRate)}/${item.unitLabel} = ${formatINR(item.subtotal)}`
      );
    });
    lines.push('------------------------------');
    lines.push(`Today's Bill Total: ${formatINR(txn.totalAmount)}`);
    if (txn.previousDue !== 0) {
      lines.push(
        txn.previousDue > 0
          ? `Previous Pending Due: ${formatINR(txn.previousDue)}`
          : `Previous Advance: ${formatINR(Math.abs(txn.previousDue))}`
      );
    }
    const totalPayable = Math.round((txn.totalAmount + txn.previousDue) * 100) / 100;
    lines.push(`Total Payable: ${formatINR(totalPayable)}`);
    lines.push(`Amount Received Today (${txn.paymentMode}): ${formatINR(txn.amountPaid)}`);
    lines.push(
      txn.netDueAfter > 0
        ? `*Remaining Pending Balance: ${formatINR(txn.netDueAfter)}*`
        : txn.netDueAfter < 0
        ? `*Advance Credit Balance: ${formatINR(Math.abs(txn.netDueAfter))}*`
        : `*Remaining Pending Balance: ₹0 (Cleared)*`
    );
  } else {
    lines.push('*Payment Received (Jama)*');
    lines.push(`Previous Pending Due: ${formatINR(txn.previousDue)}`);
    lines.push(`Received (${txn.paymentMode}): ${formatINR(txn.amountPaid)}`);
    lines.push(
      txn.netDueAfter > 0
        ? `*Remaining Pending Balance: ${formatINR(txn.netDueAfter)}*`
        : txn.netDueAfter < 0
        ? `*Advance Credit: ${formatINR(Math.abs(txn.netDueAfter))}*`
        : `*Remaining Pending Balance: ₹0 (Cleared)*`
    );
  }

  if (txn.note && txn.note.trim()) {
    lines.push(`Note: ${txn.note.trim()}`);
  }

  if (shop.upiId.trim()) {
    lines.push('------------------------------');
    lines.push(`UPI ID: ${shop.upiId.trim()}`);
    lines.push('PhonePe / GPay / Paytm accepted');
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
