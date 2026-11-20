import React, { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { Customer, SalesTransaction, ShopProfile } from '../types';
import { buildSalesReceiptText, buildWhatsAppUrl } from '../utils/whatsapp';
import { formatINR } from '../utils/format';

interface ReceiptModalProps {
  transaction: SalesTransaction | null;
  shopProfile: ShopProfile;
  customer?: Customer;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  shopProfile,
  customer,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const receiptText = buildSalesReceiptText(transaction, shopProfile, customer);
  const whatsappUrl = buildWhatsAppUrl(transaction.customerPhone, receiptText);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = receiptText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {transaction.type === 'sale' ? 'Bill Saved & Ready' : 'Payment Saved & Ready'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {transaction.billNo} · {transaction.customerName} · Net Due{' '}
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatINR(transaction.netDueAfter)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt preview"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-all">
            {receiptText}
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-slate-100 space-y-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.99] transition-all shadow-sm"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
            <span>Send on WhatsApp ({transaction.customerPhone || 'Pick Contact'})</span>
            <ExternalLink className="w-4 h-4 shrink-0 opacity-80" />
          </a>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
