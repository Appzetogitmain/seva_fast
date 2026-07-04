import React, { useRef, useMemo } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useSettings } from '@core/context/SettingsContext';

const formatMoney = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const getPaymentLabel = (order) => {
  const method = String(
    order?.paymentMode || order?.payment?.method || '',
  ).toLowerCase();
  if (method === 'online') return 'Paid Online';
  if (method === 'cod' || method === 'cash') return 'Cash on Delivery';
  if (method === 'wallet') return 'Wallet';
  return method ? method.toUpperCase() : '—';
};

const getPaymentStatus = (order) => {
  const raw = String(
    order?.paymentStatus || order?.payment?.status || '',
  ).trim();
  if (!raw) return 'Pending';

  const normalized = raw.toUpperCase();
  const labels = {
    CREATED: 'Payment Pending',
    PENDING_CASH_COLLECTION: 'Pending Cash Collection',
    PAID: 'Paid',
    CASH_COLLECTED: 'Cash Collected',
    PARTIALLY_REMITTED: 'Partially Remitted',
    COD_RECONCILED: 'COD Reconciled',
    FAILED: 'Payment Failed',
    REFUNDED: 'Refunded',
    CAPTURED: 'Paid',
    CANCELLED: 'Cancelled',
    PENDING: 'Pending',
    COMPLETED: 'Paid',
  };

  if (labels[normalized]) return labels[normalized];

  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatOrderStatus = (status) => {
  const raw = String(status || 'pending').trim();
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const buildAddressLines = (address = {}) => {
  const lines = [];
  const street = address.address || address.completeAddress || address.fullAddress;
  if (street) lines.push(street);
  const cityLine = [address.landmark, address.city, address.pincode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  return lines;
};

const pdfText = (doc, text, x, y, maxWidth) => {
  const value = String(text ?? '');
  if (!maxWidth) {
    doc.text(value, x, y);
    return y;
  }
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 5;
};

const generateInvoicePdf = async ({
  order,
  settings,
  pricing,
  appName,
  invoiceId,
  billedToName,
  billedToPhone,
  addressLines,
  sellerName,
  sellerAddress,
  summaryRows,
}) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (needed = 12) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const row = (label, value, boldValue = false) => {
    ensureSpace(8);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text(label, margin, y);
    doc.setFont(undefined, boldValue ? 'bold' : 'normal');
    const nextY = pdfText(doc, value, margin + 42, y, contentWidth - 42);
    y = Math.max(y + 6, nextY + 1);
  };

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(appName, margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  if (settings?.companyName) {
    y = pdfText(doc, settings.companyName, margin, y, contentWidth) + 4;
  }
  if (settings?.address) {
    y = pdfText(doc, settings.address, margin, y, contentWidth) + 4;
  }
  if (settings?.taxId) {
    doc.text(`GSTIN: ${settings.taxId}`, margin, y);
    y += 6;
  }

  doc.setFont(undefined, 'bold');
  doc.setFontSize(14);
  doc.text('TAX INVOICE', pageWidth - margin, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`#${invoiceId}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`Date: ${formatDateTime(order.createdAt)}`, pageWidth - margin, 30, { align: 'right' });
  if (order.deliveredAt) {
    doc.text(`Delivered: ${formatDateTime(order.deliveredAt)}`, pageWidth - margin, 36, { align: 'right' });
  }
  doc.text(
    `Status: ${formatOrderStatus(order.status || order.orderStatus)}`,
    pageWidth - margin,
    order.deliveredAt ? 42 : 36,
    { align: 'right' },
  );

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Billed To', margin, y);
  doc.text('Shipped From', pageWidth / 2 + 4, y);
  y += 6;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  doc.text(billedToName, margin, y);
  doc.text(sellerName, pageWidth / 2 + 4, y);
  y += 5;

  doc.setFont(undefined, 'normal');
  doc.text(billedToPhone, margin, y);
  y += 5;

  const leftAddressY = y;
  addressLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4;
  });
  let rightY = leftAddressY;
  const sellerLines = doc.splitTextToSize(String(sellerAddress || '—'), contentWidth / 2 - 8);
  doc.text(sellerLines, pageWidth / 2 + 4, rightY);
  rightY += sellerLines.length * 4;
  if (order.seller?.phone) {
    doc.text(`Contact: ${order.seller.phone}`, pageWidth / 2 + 4, rightY + 2);
    rightY += 6;
  }
  y = Math.max(y, rightY) + 6;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  doc.text('Item', margin, y);
  doc.text('Rate', pageWidth - margin - 58, y, { align: 'right' });
  doc.text('Qty', pageWidth - margin - 38, y, { align: 'right' });
  doc.text('Amount', pageWidth - margin, y, { align: 'right' });
  y += 3;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont(undefined, 'normal');
  (order.items || []).forEach((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.price || 0);
    const nameLines = doc.splitTextToSize(String(item.name || 'Item'), contentWidth - 70);
    ensureSpace(nameLines.length * 5 + 8);
    doc.text(nameLines, margin, y);
    doc.text(formatMoney(rate).replace('₹', 'Rs. '), pageWidth - margin - 58, y, { align: 'right' });
    doc.text(String(qty), pageWidth - margin - 38, y, { align: 'right' });
    doc.text(formatMoney(rate * qty).replace('₹', 'Rs. '), pageWidth - margin, y, { align: 'right' });
    y += nameLines.length * 4 + 2;
    if (item.variantName) {
      doc.setFontSize(8);
      doc.text(item.variantName, margin + 2, y);
      doc.setFontSize(9);
      y += 4;
    }
  });

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  row('Payment Method', getPaymentLabel(order), true);
  row('Payment Status', getPaymentStatus(order), true);
  if (order.payment?.transactionId) {
    row('Transaction ID', order.payment.transactionId);
  }

  y += 2;
  summaryRows
    .filter((rowItem) => rowItem.show)
    .forEach((rowItem) => {
      ensureSpace(7);
      doc.setFont(undefined, 'normal');
      doc.text(rowItem.label, margin, y);
      doc.setFont(undefined, 'bold');
      doc.text(String(rowItem.value).replace('₹', 'Rs. '), pageWidth - margin, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 6;
    });

  ensureSpace(10);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text('Grand Total', margin, y);
  doc.text(formatMoney(pricing.total).replace('₹', 'Rs. '), pageWidth - margin, y, { align: 'right' });
  y += 10;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'This is a computer-generated invoice and does not require a physical signature.',
    pageWidth / 2,
    y,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);

  doc.save(`Invoice_${invoiceId}.pdf`);
};

const InvoiceModal = ({ isOpen, onClose, order }) => {
  const { settings } = useSettings();
  const invoiceRef = useRef(null);
  const appName = settings?.appName || 'Seva Fast';
  const primaryColor = settings?.primaryColor || '#4f46e5';

  const pricing = useMemo(() => {
    if (!order) return {};
    const p = order.pricing || {};
    const breakdown = order.paymentBreakdown || {};
    return {
      subtotal: Number(p.subtotal ?? breakdown.productSubtotal ?? 0),
      deliveryFee: Number(p.deliveryFee ?? breakdown.deliveryFeeCharged ?? 0),
      platformFee: Number(p.platformFee ?? breakdown.handlingFeeCharged ?? 0),
      gst: Number(p.gst ?? breakdown.taxTotal ?? 0),
      discount: Number(p.discount ?? breakdown.discountTotal ?? 0),
      walletAmount: Number(p.walletAmount ?? breakdown.walletAmount ?? 0),
      tip: Number(p.tip ?? breakdown.tipTotal ?? 0),
      total: Number(p.total ?? breakdown.grandTotal ?? 0),
    };
  }, [order]);

  if (!order) return null;

  const invoiceId = order.orderId || order.id;
  const billedToName = order.address?.name || order.customer?.name || 'Customer';
  const billedToPhone = order.address?.phone || order.customer?.phone || '—';
  const addressLines = buildAddressLines(order.address);
  const sellerName = order.seller?.shopName || order.seller?.name || 'Partner Store';
  const sellerAddress = order.seller?.address || settings?.address || '—';

  const summaryRows = [
    { label: 'Item Total', value: formatMoney(pricing.subtotal), show: true },
    {
      label: 'Delivery Fee',
      value: pricing.deliveryFee > 0 ? formatMoney(pricing.deliveryFee) : 'FREE',
      show: true,
    },
    {
      label: 'Handling Fee',
      value: formatMoney(pricing.platformFee),
      show: pricing.platformFee > 0,
    },
    {
      label: 'Tax (GST)',
      value: formatMoney(pricing.gst),
      show: pricing.gst > 0,
    },
    {
      label: 'Discount',
      value: `-${formatMoney(pricing.discount)}`,
      show: pricing.discount > 0,
      accent: 'text-emerald-600',
    },
    {
      label: 'Wallet Applied',
      value: `-${formatMoney(pricing.walletAmount)}`,
      show: pricing.walletAmount > 0,
      accent: 'text-emerald-600',
    },
    {
      label: 'Tip',
      value: formatMoney(pricing.tip),
      show: pricing.tip > 0,
    },
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      toast.info('Generating invoice PDF...');
      await generateInvoicePdf({
        order,
        settings,
        pricing,
        appName,
        invoiceId,
        billedToName,
        billedToPhone,
        addressLines,
        sellerName,
        sellerAddress,
        summaryRows,
      });
      toast.success('Invoice downloaded');
    } catch (error) {
      console.error('Invoice PDF failed:', error);
      toast.error('Failed to download invoice. Try Print instead.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl relative flex flex-col"
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Tax Invoice</h2>
                  <p className="text-xs text-slate-500 font-medium">#{invoiceId}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 bg-white rounded-full hover:bg-slate-200 transition-colors shadow-sm border border-slate-100"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-4 sm:p-6">
                <div
                  ref={invoiceRef}
                  id="printable-invoice"
                  className="bg-white text-slate-800 space-y-6 p-4 sm:p-6 rounded-2xl border border-slate-100"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight" style={{ color: primaryColor }}>
                        {appName}
                      </h1>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        {settings?.companyName || appName}
                        <br />
                        {settings?.address || '—'}
                        {settings?.taxId ? (
                          <>
                            <br />
                            GSTIN: {settings.taxId}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
                      <p>
                        <span className="font-bold text-slate-700">Invoice Date:</span>{' '}
                        {formatDateTime(order.createdAt)}
                      </p>
                      {order.deliveredAt ? (
                        <p>
                          <span className="font-bold text-slate-700">Delivered:</span>{' '}
                          {formatDateTime(order.deliveredAt)}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-bold text-slate-700">Status:</span>{' '}
                        {formatOrderStatus(order.status || order.orderStatus)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Billed To
                      </p>
                      <p className="font-bold text-slate-900">{billedToName}</p>
                      <p className="text-sm text-slate-600 mt-1">{billedToPhone}</p>
                      <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                        {addressLines.length > 0
                          ? addressLines.map((line) => <p key={line}>{line}</p>)
                          : <p>—</p>}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Shipped From
                      </p>
                      <p className="font-bold text-slate-900">{sellerName}</p>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{sellerAddress}</p>
                      {order.seller?.phone ? (
                        <p className="text-xs text-slate-600 mt-2">Contact: {order.seller.phone}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="border rounded-xl border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <tr>
                            <th className="px-3 py-3 min-w-[120px]">Item</th>
                            <th className="px-3 py-3 text-right whitespace-nowrap">Rate</th>
                            <th className="px-3 py-3 text-right whitespace-nowrap">Qty</th>
                            <th className="px-3 py-3 text-right whitespace-nowrap">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(order.items || []).map((item, idx) => {
                            const qty = Number(item.quantity || item.qty || 1);
                            const rate = Number(item.price || 0);
                            return (
                              <tr key={idx}>
                                <td className="px-3 py-3 text-slate-700 font-medium min-w-[120px]">
                                  <div className="break-words">{item.name}</div>
                                  {item.variantName ? (
                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.variantName}</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-3 text-slate-500 text-right whitespace-nowrap">
                                  {formatMoney(rate)}
                                </td>
                                <td className="px-3 py-3 text-slate-500 text-right whitespace-nowrap">{qty}</td>
                                <td className="px-3 py-3 text-slate-800 font-bold text-right whitespace-nowrap">
                                  {formatMoney(rate * qty)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Payment Details
                      </p>
                      <p className="text-slate-600">
                        Method: <span className="font-bold text-slate-900">{getPaymentLabel(order)}</span>
                      </p>
                      <p className="text-slate-600 mt-1">
                        Status: <span className="font-bold text-slate-900">{getPaymentStatus(order)}</span>
                      </p>
                      {order.payment?.transactionId ? (
                        <p className="text-xs text-slate-500 mt-2 break-all">
                          Txn ID: {order.payment.transactionId}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2 text-sm">
                      {summaryRows
                        .filter((row) => row.show)
                        .map((row) => (
                          <div key={row.label} className="flex justify-between text-slate-600">
                            <span>{row.label}</span>
                            <span className={`font-semibold ${row.accent || 'text-slate-800'}`}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      <div className="flex justify-between text-base font-black text-slate-900 pt-3 border-t border-slate-200">
                        <span>Grand Total</span>
                        <span style={{ color: primaryColor }}>{formatMoney(pricing.total)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
                    This is a computer-generated invoice and does not require a physical signature.
                  </p>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4 flex gap-3 print:hidden">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <Download size={18} />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <Printer size={18} />
                  Print
                </button>
              </div>
            </motion.div>
          </motion.div>

          <style>
            {`
              @media print {
                body * { visibility: hidden; }
                #printable-invoice, #printable-invoice * { visibility: visible; }
                #printable-invoice {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: none;
                  border-radius: 0;
                }
              }
            `}
          </style>
        </>
      )}
    </AnimatePresence>
  );
};

export default InvoiceModal;
