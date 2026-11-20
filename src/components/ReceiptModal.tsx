import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageCircle,
  Share2,
  X,
} from 'lucide-react';
import { BRAND_LOGO_URL } from '../data/seedData';
import { Customer, SalesTransaction, ShopProfile } from '../types';
import { isWebShareFileSupported, triggerBlobDownload } from '../services/storage';
import {
  formatDisplayDate,
  formatINR,
  formatQuantityWithPieces,
  isCaseUnit,
  sanitizeIndianPhone,
} from '../utils/format';
import { buildSalesReceiptText, buildWhatsAppUrl } from '../utils/whatsapp';

interface ReceiptModalProps {
  transaction: SalesTransaction | null;
  shopProfile: ShopProfile;
  customer?: Customer;
  onClose: () => void;
}

function getAddressLines(address: string): string[] {
  const raw = (address || '').trim();
  if (!raw) return ['Godhanpara, Near Canara Bank,', 'Murshidabad - 742308'];
  if (raw.includes('\n')) {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (/,\s*(?=Murshidabad)/i.test(raw)) {
    return raw.replace(/,\s*(?=Murshidabad)/i, ',\n').split('\n');
  }
  return [raw];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  shopProfile,
  customer,
  onClose,
}) => {
  const invoiceRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<'share' | 'download' | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  if (!transaction) return null;

  const receiptText = buildSalesReceiptText(transaction, shopProfile, customer);
  const whatsappUrl = buildWhatsAppUrl(transaction.customerPhone, receiptText);
  const cleanShopPhone = sanitizeIndianPhone(shopProfile.phone || '9609457208');
  const addressLines = getAddressLines(shopProfile.address);
  const totalPayable =
    Math.round((transaction.totalAmount + transaction.previousDue) * 100) / 100;
  const upiDisplay = (shopProfile.upiId || 'samir10kundu1@ibl').trim();
  const safeBillSlug = (transaction.billNo || 'Bill').replace(/[^a-zA-Z0-9_-]/g, '-');
  const jpgFilename = `Kundu-Enterprise-Bill-${safeBillSlug}.jpg`;

  const generateReceiptJpgBlob = async (): Promise<Blob> => {
    const target = invoiceRef.current;
    if (!target) {
      throw new Error('Invoice preview not ready.');
    }

    // Ensure images inside the invoice card are loaded before rasterizing
    const imgs = Array.from(target.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );

    const canvas = await html2canvas(target, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#FFFFFF',
      logging: false,
      onclone: (clonedDoc, clonedEl) => {
        // Strip Tailwind v4 stylesheets containing oklch()/color-mix() so html2canvas never fails parsing modern CSS colors.
        // The invoice card uses 100% explicit hex/rgba inline styles for deterministic ultra-crisp rendering.
        try {
          const styleNodes = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styleNodes.forEach((node) => {
            const href = node.getAttribute('href') || '';
            if (!href.includes('fonts.googleapis.com')) {
              node.parentNode?.removeChild(node);
            }
          });
          clonedDoc.documentElement.style.backgroundColor = '#FFFFFF';
          clonedDoc.documentElement.style.color = '#0F172A';
          clonedDoc.body.style.backgroundColor = '#FFFFFF';
          clonedDoc.body.style.color = '#0F172A';
          clonedDoc.body.style.margin = '0';

          // Force wide crisp layout (520px * scale 3 = 1560px) even on narrow mobile screens
          clonedEl.style.width = '520px';
          clonedEl.style.maxWidth = '520px';
          clonedEl.style.boxSizing = 'border-box';
          clonedEl.style.borderRadius = '0px';
          clonedEl.style.border = 'none';
        } catch {
          // Safe fallback if DOM clone styling is restricted
        }
      },
    });

    return await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not encode JPG image.'));
            }
          },
          'image/jpeg',
          0.95
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to export canvas.'));
      }
    });
  };

  const handleShareJpg = async () => {
    setBusyAction('share');
    setStatusNotice(null);
    try {
      const blob = await generateReceiptJpgBlob();

      if (isWebShareFileSupported()) {
        try {
          const file = new File([blob], jpgFilename, { type: 'image/jpeg' });
          const canShare =
            typeof navigator.canShare === 'function'
              ? navigator.canShare({ files: [file] })
              : false;
          if (canShare) {
            await navigator.share({
              title: `${shopProfile.shopName || 'Kundu Enterprise'} — Bill ${transaction.billNo}`,
              text: `Bill ${transaction.billNo} for ${transaction.customerName} (${formatINR(
                transaction.netDueAfter > 0 ? transaction.netDueAfter : transaction.totalAmount
              )})`,
              files: [file],
            });
            setStatusNotice({
              tone: 'success',
              text: 'High-resolution JPG bill shared successfully.',
            });
            return;
          }
        } catch (shareErr) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
          // Fall through to direct download if Web Share fails
        }
      }

      triggerBlobDownload(blob, jpgFilename);
      setStatusNotice({
        tone: 'info',
        text: 'Direct file share is not supported on this browser — HD JPG downloaded! Attach it in WhatsApp.',
      });
    } catch {
      setStatusNotice({
        tone: 'error',
        text: 'Could not generate JPG image on this device. You can still send via WhatsApp Text below.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadJpg = async () => {
    setBusyAction('download');
    setStatusNotice(null);
    try {
      const blob = await generateReceiptJpgBlob();
      triggerBlobDownload(blob, jpgFilename);
      setStatusNotice({
        tone: 'success',
        text: `Downloaded ${jpgFilename} (HD Quality).`,
      });
    } catch {
      setStatusNotice({
        tone: 'error',
        text: 'Could not download JPG image. Please try Copy Text or Send Text.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(receiptText);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = receiptText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard restriction
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold text-[#0B2C6F] truncate">
              {transaction.type === 'sale' ? 'Digital Bill Ready' : 'Payment Receipt Ready'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {transaction.billNo} · {transaction.customerName} · HD JPG &amp; WhatsApp
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt preview"
            className="min-h-[42px] min-w-[42px] -mr-1.5 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Branded Invoice Preview (100% Inline Hex Styles for html2canvas Zero-Pixelation Capture) */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-100/90">
          <div
            ref={invoiceRef}
            style={{
              width: '100%',
              maxWidth: '520px',
              margin: '0 auto',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid #CBD5E1',
              fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              boxSizing: 'border-box',
            }}
          >
            {/* 1. Royal Blue Header Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0B2C6F 0%, #0E4396 58%, #0284C7 100%)',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                color: '#FFFFFF',
              }}
            >
              <div
                style={{
                  width: '66px',
                  height: '66px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  padding: '4px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={BRAND_LOGO_URL}
                  alt="Kundu Enterprise"
                  crossOrigin="anonymous"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    display: 'block',
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    lineHeight: 1.15,
                    color: '#FFFFFF',
                  }}
                >
                  {(shopProfile.shopName || 'KUNDU ENTERPRISE').toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: '#FDBA74',
                    marginTop: '3px',
                  }}
                >
                  {(shopProfile.tagline || 'PURE WATER, HEALTHY LIFE').toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    lineHeight: 1.4,
                    color: '#E0F2FE',
                    marginTop: '6px',
                  }}
                >
                  {addressLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    marginTop: '4px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  Contact: {cleanShopPhone}
                </div>
              </div>
            </div>

            {/* 2. Bill & Customer Meta */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#64748B',
                  }}
                >
                  Billed To
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#0F172A',
                    marginTop: '2px',
                    lineHeight: 1.25,
                  }}
                >
                  {transaction.customerName}
                </div>
                {customer?.shopAddress && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: '#475569',
                      marginTop: '2px',
                      lineHeight: 1.35,
                    }}
                  >
                    {customer.shopAddress}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748B',
                    marginTop: '4px',
                  }}
                >
                  {customer?.customerType ? `${customer.customerType}` : 'Customer'}
                  {transaction.customerPhone ? ` · +91 ${transaction.customerPhone}` : ''}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#0284C7',
                  }}
                >
                  {transaction.type === 'sale' ? 'Cash / Credit Bill' : 'Payment Receipt'}
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#0B2C6F',
                    marginTop: '2px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  {transaction.billNo}
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#475569',
                    marginTop: '3px',
                  }}
                >
                  Date: {formatDisplayDate(transaction.date)}
                </div>
              </div>
            </div>

            {/* 3. Clean Itemized Table (or Jama Payment Summary) */}
            <div style={{ padding: '16px 20px 12px 20px' }}>
              {transaction.type === 'sale' && transaction.items.length > 0 ? (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#EFF6FF',
                        borderTop: '1px solid #BFDBFE',
                        borderBottom: '1px solid #BFDBFE',
                      }}
                    >
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '8px 8px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#0B2C6F',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Item
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '8px 6px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#0B2C6F',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Qty
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '8px 6px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#0B2C6F',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Rate
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '8px 8px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#0B2C6F',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaction.items.map((item, idx) => {
                      const isCase = isCaseUnit(item.unitLabel, item.piecesPerCase);
                      const displayTitle = item.productName
                        .toLowerCase()
                        .startsWith(item.brandName.toLowerCase())
                        ? item.productName
                        : `${item.brandName} ${item.productName}`;

                      return (
                        <tr
                          key={`${transaction.id}_${idx}`}
                          style={{
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                            borderBottom: '1px solid #E2E8F0',
                          }}
                        >
                          <td
                            style={{
                              padding: '9px 8px',
                              fontWeight: 700,
                              color: '#0F172A',
                              verticalAlign: 'top',
                              lineHeight: 1.3,
                            }}
                          >
                            {displayTitle}
                          </td>
                          <td
                            style={{
                              padding: '9px 6px',
                              verticalAlign: 'top',
                              lineHeight: 1.3,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>
                              {item.quantity}{' '}
                              {item.quantity === 1 ? item.unitLabel : item.unitPlural}
                            </div>
                            {isCase && item.piecesPerCase && (
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: '#0284C7',
                                  marginTop: '1px',
                                }}
                              >
                                ({item.quantity * item.piecesPerCase} Pcs)
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '9px 6px',
                              textAlign: 'right',
                              verticalAlign: 'top',
                              color: '#334155',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatINR(item.unitRate)}
                            <span style={{ fontSize: '10px', color: '#64748B' }}>
                              /{item.unitLabel}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '9px 8px',
                              textAlign: 'right',
                              verticalAlign: 'top',
                              fontWeight: 800,
                              color: '#0F172A',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatINR(item.subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#065F46' }}>
                      Payment Received (Jama)
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '2px' }}>
                      Mode: {transaction.paymentMode}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#047857',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    {formatINR(transaction.amountPaid)}
                  </div>
                </div>
              )}

              {transaction.note && transaction.note.trim() && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '7px 10px',
                    backgroundColor: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    color: '#9A3412',
                  }}
                >
                  <strong>Note:</strong> {transaction.note.trim()}
                </div>
              )}
            </div>

            {/* 4. Transparent Ledger Summary Box */}
            <div style={{ padding: '4px 20px 18px 20px' }}>
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}
              >
                {transaction.type === 'sale' && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    <span>Today&apos;s Bill Total</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#0F172A',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    >
                      {formatINR(transaction.totalAmount)}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12.5px',
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  <span>
                    {transaction.previousDue < 0 ? 'Previous Advance Credit' : 'Previous Pending Due'}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: transaction.previousDue > 0 ? '#B91C1C' : '#0F172A',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    {transaction.previousDue < 0
                      ? `-${formatINR(Math.abs(transaction.previousDue))}`
                      : formatINR(transaction.previousDue)}
                  </span>
                </div>

                {transaction.type === 'sale' && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#0B2C6F',
                      paddingTop: '7px',
                      marginTop: '6px',
                      marginBottom: '7px',
                      borderTop: '1px dashed #CBD5E1',
                    }}
                  >
                    <span>Total Payable</span>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    >
                      {formatINR(totalPayable)}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12.5px',
                    color: '#047857',
                    fontWeight: 700,
                    marginBottom: '10px',
                  }}
                >
                  <span>Amount Received Today ({transaction.paymentMode})</span>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    - {formatINR(transaction.amountPaid)}
                  </span>
                </div>

                {/* Highlighted Remaining Pending Balance Box */}
                <div
                  style={{
                    backgroundColor: transaction.netDueAfter > 0 ? '#FEF2F2' : '#ECFDF5',
                    border:
                      transaction.netDueAfter > 0
                        ? '1.5px solid #FCA5A5'
                        : '1.5px solid #6EE7B7',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 800,
                        color: transaction.netDueAfter > 0 ? '#991B1B' : '#065F46',
                      }}
                    >
                      {transaction.netDueAfter > 0
                        ? 'Remaining Pending Balance'
                        : transaction.netDueAfter < 0
                        ? 'Advance Credit Balance'
                        : 'Remaining Pending Balance'}
                    </div>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        color: transaction.netDueAfter > 0 ? '#B91C1C' : '#047857',
                        marginTop: '1px',
                      }}
                    >
                      {transaction.netDueAfter > 0
                        ? 'Total due carried forward'
                        : transaction.netDueAfter < 0
                        ? 'Credit available for next bill'
                        : 'Account fully cleared'}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '19px',
                      fontWeight: 900,
                      color: transaction.netDueAfter > 0 ? '#B91C1C' : '#047857',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {transaction.netDueAfter < 0
                      ? formatINR(Math.abs(transaction.netDueAfter))
                      : formatINR(transaction.netDueAfter)}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Payment Footer */}
            <div
              style={{
                backgroundColor: '#0B2C6F',
                color: '#FFFFFF',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  UPI ID: {upiDisplay}
                </div>
                <div
                  style={{
                    fontSize: '10.5px',
                    color: '#BAE6FD',
                    marginTop: '2px',
                  }}
                >
                  PhonePe / GPay / Paytm accepted
                </div>
              </div>

              <div
                style={{
                  textAlign: 'right',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#FDBA74',
                }}
              >
                Thank you for your business!
              </div>
            </div>
          </div>

          {/* Compact item summary note for accessibility / screen readers */}
          <p className="sr-only">
            {transaction.items
              .map(
                (i) =>
                  `${i.brandName} ${i.productName} ${formatQuantityWithPieces(
                    i.quantity,
                    i.unitLabel,
                    i.unitPlural,
                    i.piecesPerCase
                  )}`
              )
              .join(', ')}
          </p>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 space-y-2.5 bg-white rounded-b-2xl">
          {statusNotice && (
            <div
              role="status"
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                statusNotice.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusNotice.tone === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-sky-50 text-sky-900 border border-sky-200'
              }`}
            >
              {statusNotice.text}
            </div>
          )}

          {/* Prominent Primary Action: Share High-Res JPG on WhatsApp */}
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleShareJpg}
            className="w-full min-h-[50px] px-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm sm:text-base font-bold hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 transition-all shadow-sm"
          >
            {busyAction === 'share' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                <span>Generating HD JPG Bill...</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5 shrink-0" />
                <span>Share Bill Image (WhatsApp)</span>
              </>
            )}
          </button>

          {/* Secondary Actions: Download JPG, Send Text, Copy Text */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleDownloadJpg}
              className="min-h-[44px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 text-[#0B2C6F] text-xs font-bold hover:bg-sky-100 disabled:opacity-60 transition-colors"
            >
              {busyAction === 'download' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">Download JPG</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">Send Text</span>
              <ExternalLink className="w-3 h-3 shrink-0 opacity-70 hidden sm:inline" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 truncate">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" />
                  <span className="truncate">Copy Text</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
