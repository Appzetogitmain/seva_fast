import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Card from '@shared/components/ui/Card';
import Button from '@shared/components/ui/Button';
import Badge from '@shared/components/ui/Badge';
import Input from '@shared/components/ui/Input';
import {
    HiOutlineMagnifyingGlass,
    HiOutlineEye,
    HiOutlinePrinter,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineTruck,
    HiOutlineBanknotes,
    HiOutlineClock,
    HiOutlineArchiveBoxXMark,
    HiOutlineChartBar,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineInboxStack,
    HiOutlineMapPin,
    HiOutlinePhone,
    HiOutlineCalendarDays,
    HiOutlineDocumentText
} from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Orders Page

import { MagicCard } from '@/components/ui/magic-card';
import { BlurFade } from '@/components/ui/blur-fade';
import ShimmerButton from '@/components/ui/shimmer-button';
import { sellerApi } from '../services/sellerApi';
import { useToast } from '@shared/components/ui/Toast';
import { getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { Loader2 } from 'lucide-react';
import Pagination from '@shared/components/ui/Pagination';
import { DatePicker } from "@/components/ui/date-picker";
import { onSellerOrderNew, onOrderStatusUpdate } from '@core/services/orderSocket';
import { getSellerOrderEarning, getSellerEarningBreakdown, getCustomerOrderBill } from '@/shared/utils/sellerOrderEarning';
import { useLockBodyScroll, preventBackdropScroll } from '@/shared/hooks/useLockBodyScroll';
import { formatDate, formatTime } from '@shared/utils/formatDate';


const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState({
        totalOrders: 0,
        totalAmount: 0,
        pending: 0,
        confirmed: 0,
        packed: 0,
        outForDelivery: 0,
        delivered: 0,
        cancelled: 0,
        returned: 0,
        activeOrders: 0,
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isQuickViewModalOpen, setIsQuickViewModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const { showToast } = useToast();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [deliveryBoys, setDeliveryBoys] = useState([]);
    const [sellerProfile, setSellerProfile] = useState(null);
    const [ownDeliveryFormOrderId, setOwnDeliveryFormOrderId] = useState(null);
    const [ownDeliveryName, setOwnDeliveryName] = useState('');
    const [ownDeliveryPhone, setOwnDeliveryPhone] = useState('');
    const hasMountedRef = useRef(false);

    const fetchDeliveryBoys = async () => {
        try {
            const response = await sellerApi.getAvailableRiders();
            const list = Array.isArray(response.data.result) ? response.data.result : [];
            setDeliveryBoys(list);
        } catch (error) {
            console.error("Failed to fetch delivery partners:", error);
        }
    };

    // Printed receipts double as packing slips that travel with the order
    // past the seller (admin/subadmin/rider handling) — they need to show
    // which seller the order belongs to, so fetch shop identity once.
    const fetchSellerProfile = async () => {
        try {
            const response = await sellerApi.getProfile();
            setSellerProfile(response.data.result || null);
        } catch (error) {
            console.error("Failed to fetch seller profile:", error);
        }
    };

    useEffect(() => {
        fetchDeliveryBoys();
        fetchSellerProfile();
    }, []);

    const isAnyModalOpen = isDetailsModalOpen || isQuickViewModalOpen;
    useLockBodyScroll(isAnyModalOpen);

    const fetchOrders = async (requestedPage = 1, showPageLoader = false) => {
        try {
            if (showPageLoader) {
                setLoading(true);
            }
            const params = { page: requestedPage };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await sellerApi.getOrders(params);

            // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
            const payload = response.data.result || {};
            const rawOrders = Array.isArray(payload.items)
                ? payload.items
                : (response.data.results || []);

            const formattedOrders = (rawOrders || []).map(order => ({
                id: order.orderId,
                _id: order._id,
                customer: {
                    name: order.customer?.name || 'Unknown',
                    phone: order.customer?.phone || '',
                    avatar: (order.customer?.name || 'U').charAt(0)
                },
                items: (order.items || []).map(item => ({
                    name: item.name,
                    price: item.price,
                    qty: item.quantity,
                    image: item.image
                })),
                total: getSellerOrderEarning(order),
                sellerEarning: getSellerOrderEarning(order),
                sellerEarningBreakdown: order.sellerEarningBreakdown || null,
                customerBill: order.customerBill || null,
                status: getLegacyStatusFromOrder(order),
                workflowStatus: order.workflowStatus,
                workflowVersion: order.workflowVersion,
                date: formatDate(order.createdAt, ''),
                time: formatTime(order.createdAt, ''),
                address: order.address
                    ? `${order.address.address || ''}, ${order.address.city || ''}`.trim()
                    : '',
                location: order.address?.location || null,
                payment: order.payment?.method === 'cash' || order.payment?.method === 'cod'
                    ? 'Cash on Delivery'
                    : 'Online Paid',
                deliveryBoy: order.deliveryBoy
                    ? {
                        _id: order.deliveryBoy._id || order.deliveryBoy,
                        name: order.deliveryBoy.name,
                        phone: order.deliveryBoy.phone,
                    }
                    : null,
                deliveryMode: order.deliveryMode || 'platform',
                selfDeliveryPerson: order.selfDeliveryPerson || null,
            }));

            setOrders(formattedOrders);
            setSummary({
                totalOrders: Number(payload.summary?.totalOrders || payload.total || formattedOrders.length || 0),
                totalAmount: Number(payload.summary?.totalAmount || 0),
                pending: Number(payload.summary?.pending || 0),
                confirmed: Number(payload.summary?.confirmed || 0),
                packed: Number(payload.summary?.packed || 0),
                outForDelivery: Number(payload.summary?.outForDelivery || 0),
                delivered: Number(payload.summary?.delivered || 0),
                cancelled: Number(payload.summary?.cancelled || 0),
                returned: Number(payload.summary?.returned || 0),
                activeOrders: Number(payload.summary?.activeOrders || 0),
            });
            if (typeof payload.total === 'number') {
                setTotal(payload.total);
            } else {
                setTotal(formattedOrders.length);
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
            showToast("Failed to fetch orders", "error");
        } finally {
            if (showPageLoader) {
                setLoading(false);
            }
        }
    };

    // Initial load: show full-page loader once
    useEffect(() => {
        fetchOrders(page, true).finally(() => {
            hasMountedRef.current = true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Subsequent changes (page, date filters): update data without full page "refresh"
    useEffect(() => {
        if (!hasMountedRef.current) return;
        fetchOrders(page, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, startDate, endDate]);

    // Socket listener for new orders + live status updates
    useEffect(() => {
        const getToken = () => localStorage.getItem('auth_seller');
        const unSubNew = onSellerOrderNew(getToken, () => {
            showToast("New order received!", "info");
            fetchOrders(page, false);
        });
        const unSubStatus = onOrderStatusUpdate(getToken, (payload) => {
            const orderId = payload?.orderId;
            const ws = String(payload?.workflowStatus || "").toUpperCase();
            let nextStatus = String(payload?.status || "").toLowerCase();
            if (!nextStatus && ws) {
                if (ws === "CANCELLED") nextStatus = "cancelled";
                else if (ws === "DELIVERY_SEARCH" || ws === "SELLER_ACCEPTED" || ws === "DELIVERY_ASSIGNED") {
                    nextStatus = "confirmed";
                } else if (ws === "PICKUP_READY") nextStatus = "packed";
                else if (ws === "OUT_FOR_DELIVERY") nextStatus = "out_for_delivery";
                else if (ws === "DELIVERED") nextStatus = "delivered";
                else if (ws === "SELLER_PENDING" || ws === "CREATED") nextStatus = "pending";
            }
            if (orderId && nextStatus) {
                setOrders((prev) =>
                    prev.map((o) =>
                        o.id === orderId || o._id === orderId
                            ? {
                                ...o,
                                status: nextStatus,
                                workflowStatus: payload?.workflowStatus || o.workflowStatus,
                            }
                            : o,
                    ),
                );
                setSelectedOrder((prev) =>
                    prev && (prev.id === orderId || prev._id === orderId)
                        ? {
                            ...prev,
                            status: nextStatus,
                            workflowStatus: payload?.workflowStatus || prev.workflowStatus,
                        }
                        : prev,
                );
            }
            fetchOrders(page, false);
        });
        return () => {
            if (typeof unSubNew === 'function') unSubNew();
            if (typeof unSubStatus === 'function') unSubStatus();
        };
    }, [page, startDate, endDate]);

    const tabs = ['All', 'Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled'];
    const todayStr = new Date().toISOString().split('T')[0];

    const safeOrders = useMemo(
        () => (Array.isArray(orders) ? orders : []),
        [orders]
    );

    const filteredOrders = useMemo(() => {
        return safeOrders.filter(order => {
            const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customer.name.toLowerCase().includes(searchTerm.toLowerCase());
            const statusToMatch = activeTab === 'Out for Delivery' ? 'out_for_delivery' : activeTab.toLowerCase();
            const matchesTab = activeTab === 'All' || order.status.toLowerCase() === statusToMatch;
            return matchesSearch && matchesTab;
        });
    }, [safeOrders, searchTerm, activeTab]);

    const stats = useMemo(() => [
        {
            label: 'Total Orders',
            value: summary.totalOrders,
            icon: HiOutlineArchiveBoxXMark,
            color: 'text-brand-600',
            bg: 'bg-brand-50'
        },
        {
            label: 'Pending',
            value: summary.pending,
            icon: HiOutlineClock,
            color: 'text-amber-600',
            bg: 'bg-amber-50'
        },
        {
            label: 'Confirmed',
            value: summary.confirmed,
            icon: HiOutlineCheck,
            color: 'text-brand-600',
            bg: 'bg-brand-50'
        },
        {
            label: 'Delivered',
            value: summary.delivered,
            icon: HiOutlineCheck,
            color: 'text-brand-600',
            bg: 'bg-brand-50'
        }
    ], [summary]);

    const getStatusColor = (status) => {
        const s = status.toLowerCase();
        switch (s) {
            case 'pending': return 'warning';
            case 'confirmed': return 'info';
            case 'packed': return 'primary';
            case 'out_for_delivery': return 'secondary';
            case 'delivered': return 'success';
            case 'cancelled': return 'error';
            default: return 'secondary';
        }
    };

    const handleViewDetails = (order) => {
        setSelectedOrder(order);
        setIsDetailsModalOpen(true);
        fetchDeliveryBoys();
    };

    const handleThermalPrint = (order) => {
        const printWindow = window.open('', '_blank', 'width=550,height=800');
        if (!printWindow) {
            showToast("Please allow popups to print receipt", "warning");
            return;
        }

        const itemsHtml = order.items.map(item => {
            const name = item.name;
            const qtyStr = `x${item.qty}`;
            const priceStr = `₹${(item.price * item.qty).toFixed(0)}`;
            const left = `${name} <span style="font-weight: 800; color: #000;">${qtyStr}</span>`;
            return `<div style="font-size: 18px; font-weight: 700; display: flex; justify-content: space-between; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dotted #ccc;">
                <div style="padding-right: 12px; color: #000;">${left}</div>
                <div style="white-space: nowrap; font-weight: 900; color: #000;">${priceStr}</div>
            </div>`;
        }).join('');

        const { subtotal, deliveryFee, platformFee, gst, discount, tip, grandTotal } =
            getCustomerOrderBill(order);

        const formatRow = (label, value) => {
            return `<div style="font-size: 18px; font-weight: 700; display: flex; justify-content: space-between; margin-bottom: 5px; color: #000;">
                <div>${label}</div>
                <div style="white-space: nowrap; font-weight: 800;">${value}</div>
            </div>`;
        };

        const formatBoldRow = (label, value) => {
            return `<div style="font-size: 22px; font-weight: 900; display: flex; justify-content: space-between; margin-top: 10px; margin-bottom: 10px; color: #000;">
                <div>${label}</div>
                <div style="white-space: nowrap;">${value}</div>
            </div>`;
        };

        let pricingRows = '';
        pricingRows += formatRow('Subtotal:', `₹${subtotal.toFixed(0)}`);
        if (deliveryFee > 0) {
            pricingRows += formatRow('Delivery:', `₹${deliveryFee.toFixed(0)}`);
        }
        if (platformFee > 0) {
            pricingRows += formatRow('Platform Fee:', `₹${platformFee.toFixed(0)}`);
        }
        if (gst > 0) {
            pricingRows += formatRow('GST:', `₹${gst.toFixed(0)}`);
        }
        if (tip > 0) {
            pricingRows += formatRow('Tip:', `₹${tip.toFixed(0)}`);
        }
        if (discount > 0) {
            pricingRows += formatRow('Discount:', `-₹${discount.toFixed(0)}`);
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt ${order.id}</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, 'Courier New', monospace;
                        color: #000;
                        margin: 0;
                        padding: 0;
                        -webkit-font-smoothing: antialiased;
                    }
                    .divider {
                        margin: 12px 0;
                        border-top: 2px dashed #000;
                    }
                    .title {
                        font-size: 28px;
                        font-weight: 900;
                        letter-spacing: 1px;
                        margin-bottom: 4px;
                    }
                    .subtitle {
                        font-size: 18px;
                        font-weight: 800;
                        margin-bottom: 6px;
                    }
                    .info-row {
                        font-size: 18px;
                        font-weight: 700;
                        margin-bottom: 5px;
                        word-break: break-word;
                        color: #000;
                    }

                    @media screen {
                        body {
                            background-color: #f1f5f9;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            padding: 24px;
                        }
                        .receipt-card {
                            background: #ffffff;
                            width: 100%;
                            max-width: 480px;
                            padding: 28px 24px;
                            border-radius: 20px;
                            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                            border: 2px solid #cbd5e1;
                        }
                    }

                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body {
                            width: 76mm;
                            margin: 0 auto;
                            padding: 4px 2px;
                            background-color: #fff;
                        }
                        .receipt-card {
                            box-shadow: none;
                            border: none;
                            padding: 0;
                            width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-card">
                    <div style="text-align: center;" class="title">SEVA FAST</div>
                    <div style="text-align: center;" class="subtitle">CUSTOMER INVOICE</div>
                    <div class="divider"></div>
                    <div class="info-row"><strong>Seller:</strong> ${sellerProfile?.shopName || 'N/A'}</div>
                    ${sellerProfile?.phone ? `<div class="info-row"><strong>Seller Phone:</strong> ${sellerProfile.phone}</div>` : ''}
                    <div class="divider"></div>
                    <div class="info-row"><strong>Order:</strong> #${order.id}</div>
                    <div class="info-row"><strong>Status:</strong> ${order.status.toUpperCase()}</div>
                    <div class="info-row"><strong>Date:</strong> ${order.date} ${order.time}</div>
                    <div class="info-row"><strong>Payment:</strong> ${order.payment}</div>
                    <div class="divider"></div>
                    <div class="info-row"><strong>Customer:</strong> ${order.customer.name}</div>
                    <div class="info-row"><strong>Phone:</strong> ${order.customer.phone}</div>
                    <div class="info-row"><strong>Addr:</strong> ${order.address}</div>
                    <div class="divider"></div>
                    <div class="subtitle" style="text-align: center; margin-bottom: 12px;">ITEMS</div>
                    ${itemsHtml}
                    <div class="divider"></div>
                    ${pricingRows}
                    <div class="divider"></div>
                    ${formatBoldRow('TOTAL AMOUNT:', '₹' + grandTotal.toFixed(0))}
                    <div class="divider"></div>
                    <div style="text-align: center; margin-top: 20px; font-size: 18px; font-weight: 800;">Thank you for ordering!</div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.focus();
        setTimeout(() => {
            try {
                printWindow.print();
            } catch (e) {
                console.error("Print error:", e);
            }
        }, 400);

        printWindow.onafterprint = () => {
            try {
                printWindow.close();
            } catch (e) {
                // ignore
            }
        };
    };

    const handleNormalPrint = (order) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast("Please allow popups to print invoice", "warning");
            return;
        }

        const itemsHtml = order.items.map((item, index) => {
            const price = item.price;
            const total = item.price * item.qty;
            return `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${index + 1}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                        <div style="font-weight: bold; color: #1e293b;">${item.name}</div>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${price.toFixed(2)}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${total.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const { subtotal, deliveryFee, platformFee, gst, discount, tip, grandTotal } =
            getCustomerOrderBill(order);

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${order.id}</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        color: #334155;
                        line-height: 1.5;
                        margin: 0;
                        padding: 40px;
                        background: #fff;
                    }
                    .invoice-box {
                        max-width: 800px;
                        margin: auto;
                        border: 1px solid #e2e8f0;
                        padding: 40px;
                        border-radius: 8px;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 40px;
                    }
                    .header-left h1 {
                        margin: 0;
                        font-size: 28px;
                        color: #0f172a;
                    }
                    .header-right {
                        text-align: right;
                    }
                    .details {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 40px;
                        background: #f8fafc;
                        padding: 20px;
                        border-radius: 8px;
                    }
                    .details h3 {
                        margin-top: 0;
                        margin-bottom: 10px;
                        font-size: 14px;
                        text-transform: uppercase;
                        color: #64748b;
                        letter-spacing: 0.05em;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 40px;
                    }
                    th {
                        background: #f1f5f9;
                        padding: 12px;
                        text-align: left;
                        font-size: 13px;
                        text-transform: uppercase;
                        color: #475569;
                        border-bottom: 2px solid #cbd5e1;
                    }
                    .totals {
                        width: 300px;
                        margin-left: auto;
                    }
                    .totals-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .totals-row.grand-total {
                        font-weight: bold;
                        font-size: 18px;
                        color: #0f172a;
                        border-top: 2px solid #e2e8f0;
                        border-bottom: none;
                        padding-top: 12px;
                        margin-top: 12px;
                    }
                    @media print {
                        body { padding: 0; }
                        .invoice-box { border: none; padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-box">
                    <div class="header">
                        <div class="header-left">
                            <h1>SEVA FAST</h1>
                            <p style="margin: 5px 0 0 0; color: #64748b;">Customer Invoice</p>
                        </div>
                        <div class="header-right">
                            <h2 style="margin: 0; color: #0f172a; font-size: 16px;">Invoice #${order.id}</h2>
                            <p style="margin: 5px 0 0 0;">Date: ${order.date} ${order.time}</p>
                            <p style="margin: 5px 0 0 0;">Payment: <strong>${order.payment}</strong></p>
                            <p style="margin: 5px 0 0 0;">Status: <span style="text-transform: uppercase;">${order.status}</span></p>
                        </div>
                    </div>

                    <div class="details">
                        <div>
                            <h3>Sold By (Seller)</h3>
                            <div style="font-weight: bold; color: #0f172a; margin-bottom: 4px;">${sellerProfile?.shopName || 'N/A'}</div>
                            ${sellerProfile?.phone ? `<div>Phone: ${sellerProfile.phone}</div>` : ''}
                        </div>
                        <div>
                            <h3>Billed To</h3>
                            <div style="font-weight: bold; color: #0f172a; margin-bottom: 4px;">${order.customer.name}</div>
                            <div>Phone: ${order.customer.phone}</div>
                        </div>
                        <div style="text-align: right; max-width: 260px;">
                            <h3>Delivery Address</h3>
                            <div>${order.address}</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%">#</th>
                                <th style="width: 50%">Item Description</th>
                                <th style="width: 15%; text-align: center;">Qty</th>
                                <th style="width: 15%; text-align: right;">Unit Price</th>
                                <th style="width: 15%; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>₹${subtotal.toFixed(2)}</span>
                        </div>
                        ${deliveryFee > 0 ? `<div class="totals-row"><span>Delivery</span><span>₹${deliveryFee.toFixed(2)}</span></div>` : ''}
                        ${platformFee > 0 ? `<div class="totals-row"><span>Platform Fee</span><span>₹${platformFee.toFixed(2)}</span></div>` : ''}
                        ${gst > 0 ? `<div class="totals-row"><span>GST</span><span>₹${gst.toFixed(2)}</span></div>` : ''}
                        ${tip > 0 ? `<div class="totals-row"><span>Tip</span><span>₹${tip.toFixed(2)}</span></div>` : ''}
                        ${discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-₹${discount.toFixed(2)}</span></div>` : ''}
                        
                        <div class="totals-row grand-total">
                            <span>Total Amount</span>
                            <span>₹${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                        Thank you for your business! For any queries, please contact support.
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.focus();
        setTimeout(() => {
            try {
                printWindow.print();
            } catch (e) {
                console.error("Print error:", e);
            }
        }, 300);

        printWindow.onafterprint = () => {
            try {
                printWindow.close();
            } catch (e) {
                // ignore
            }
        };
    };

    const STATUS_RANK = { pending: 0, confirmed: 1, packed: 2, out_for_delivery: 3, delivered: 4, cancelled: 99 };

    const handleStatusUpdate = async (orderId, newStatus) => {
        const normalizedStatus = String(newStatus || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_");
        const mappedStatus =
            normalizedStatus === "processing" || normalizedStatus === "process"
                ? "confirmed"
                : normalizedStatus;

        const previousOrders = orders;
        const previousSelected = selectedOrder;

        // Optimistic UI update so status changes instantly without waiting for refresh.
        setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: mappedStatus } : o)),
        );
        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder({ ...selectedOrder, status: mappedStatus });
        }

        try {
            await sellerApi.updateOrderStatus(orderId, { status: mappedStatus });
            showToast(`Order status updated to ${mappedStatus.replace(/_/g, " ")}`, "success");
            fetchOrders(page, false);
        } catch (error) {
            console.error("Failed to update status:", error);
            setOrders(previousOrders);
            setSelectedOrder(previousSelected);
            showToast(
                error?.response?.data?.message || "Failed to update status",
                "error",
            );
        }
    };

    const handleAssignDeliveryBoy = async (orderId, deliveryBoyId) => {
        if (!deliveryBoyId) return;
        const current = orders.find((o) => o.id === orderId) || selectedOrder;
        const status = String(current?.status || "").toLowerCase();
        if (status !== "packed" && status !== "out_for_delivery") {
            showToast("Mark order as Packed before assigning a delivery partner", "error");
            return;
        }
        try {
            await sellerApi.updateOrderStatus(orderId, { deliveryBoyId });
            showToast("Delivery partner assigned successfully", "success");
            const assignedBoy = deliveryBoys.find(b => b._id === deliveryBoyId || b.id === deliveryBoyId);
            const deliveryBoy = assignedBoy
                ? { _id: assignedBoy._id, name: assignedBoy.name, phone: assignedBoy.phone }
                : null;
            setOrders(prev => prev.map(o => (
                o.id === orderId ? { ...o, deliveryBoy, deliveryMode: 'platform', selfDeliveryPerson: null } : o
            )));
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, deliveryBoy, deliveryMode: 'platform', selfDeliveryPerson: null });
            }
            fetchOrders(page, false);
        } catch (error) {
            console.error("Failed to assign delivery partner:", error);
            showToast(error?.response?.data?.message || "Failed to assign delivery partner", "error");
        }
    };

    const handleSetOwnDelivery = async (orderId, { name, phone } = {}) => {
        const current = orders.find((o) => o.id === orderId) || selectedOrder;
        const status = String(current?.status || "").toLowerCase();
        if (status !== "packed" && status !== "out_for_delivery") {
            showToast("Mark order as Packed before setting your own delivery person", "error");
            return;
        }
        try {
            await sellerApi.updateOrderStatus(orderId, { selfDelivery: { name, phone } });
            showToast("Order marked for your own delivery person", "success");
            const selfDeliveryPerson = { name: name || "", phone: phone || "" };
            setOrders(prev => prev.map(o => (
                o.id === orderId ? { ...o, deliveryMode: 'self', selfDeliveryPerson, deliveryBoy: null } : o
            )));
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, deliveryMode: 'self', selfDeliveryPerson, deliveryBoy: null });
            }
            setOwnDeliveryFormOrderId(null);
            setOwnDeliveryName('');
            setOwnDeliveryPhone('');
            fetchOrders(page, false);
        } catch (error) {
            console.error("Failed to set own delivery:", error);
            showToast(error?.response?.data?.message || "Failed to set own delivery person", "error");
        }
    };

    const exportOrders = () => {
        const data = filteredOrders;
        if (!data.length) {
            showToast("No orders to export", "warning");
            return;
        }
        const escapeCsv = (v) => {
            const s = String(v ?? "").replace(/"/g, '""');
            return /[",\n\r]/.test(s) ? `"${s}"` : s;
        };
        const headers = ["Order ID", "Customer", "Phone", "Date", "Time", "Your Earning (₹)", "Status", "Address", "Payment"];
        const rows = data.map((o) => [
            o.id,
            o.customer?.name ?? "",
            o.customer?.phone ?? "",
            o.date,
            o.time,
            o.total,
            o.status,
            o.address ?? "",
            o.payment ?? "",
        ]);
        const csvContent = [
            headers.map(escapeCsv).join(","),
            ...rows.map((row) => row.map(escapeCsv).join(",")),
        ].join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${data.length} order(s) as CSV`, "success");
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-16">
            <BlurFade delay={0.1}>
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                            Order Management
                            <Badge variant="primary" className="text-[10px] px-1.5 py-0 font-bold tracking-wider uppercase bg-brand-100 text-brand-700">Real-time</Badge>
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base mt-0.5 font-medium">Process and track your customer orders with ease.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <Button
                            onClick={exportOrders}
                            variant="outline"
                            className="flex items-center space-x-1.5 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 border-slate-200"
                        >
                            <HiOutlinePrinter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">EXPORT ALL</span>
                        </Button>
                        <ShimmerButton
                            onClick={() => setIsQuickViewModalOpen(true)}
                            className="px-4 py-2 sm:px-6 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white shadow-xl flex items-center space-x-1.5 sm:space-x-2"
                        >
                            <HiOutlineEye className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-0" />
                            <span className="hidden sm:inline">QUICK VIEW</span>
                        </ShimmerButton>
                    </div>
                </div>
            </BlurFade>

            {/* Quick Stats */}
            {loading ? (
                <div className="min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-slate-600 font-bold mt-4 uppercase tracking-widest text-xs">Fetching Active Orders...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {stats.map((stat, i) => (
                            <BlurFade key={i} delay={0.1 + (i * 0.05)}>
                                <MagicCard
                                    className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                                    gradientColor={stat.bg.includes('indigo') ? "#eef2ff" : stat.bg.includes('amber') ? "#fffbeb" : stat.bg.includes('emerald') ? "#ecfdf5" : "#fff1f2"}
                                >
                                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 relative z-10">
                                        <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-sm shrink-0", stat.bg, stat.color)}>
                                            <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest truncate">{stat.label}</p>
                                            <h4 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
                                        </div>
                                    </div>
                                </MagicCard>
                            </BlurFade>
                        ))}
                    </div>

                    {/* Main Content Area */}
                    <BlurFade delay={0.3}>
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-lg bg-white overflow-visible">
                            {/* Tabs */}
                            <div className="border-b border-slate-100 bg-slate-50/30 overflow-x-auto scrollbar-hide">
                                <div className="flex px-2.5 sm:px-6 items-center min-w-max">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "relative py-3 sm:py-4 px-2 sm:px-4 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all duration-300",
                                                activeTab === tab
                                                    ? "text-primary sm:scale-105"
                                                    : "text-slate-600 hover:text-slate-700"
                                            )}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <motion.div
                                                    layoutId="tab-underline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full mx-2 sm:mx-4"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toolbox */}
                            <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                                <div className="relative flex-1 group w-full">
                                    <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-primary transition-all" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search order ID or customer..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-lg text-sm font-semibold text-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
                                    />
                                </div>
                                <div className="flex gap-2.5 shrink-0 w-full lg:w-auto items-end justify-between flex-wrap">
                                    <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:items-center sm:gap-2 sm:w-auto">
                                        <div className="w-full sm:w-32">
                                            <DatePicker
                                                value={startDate}
                                                max={todayStr}
                                                align="left"
                                                onChange={(value) => {
                                                    if (!value) {
                                                        setStartDate("");
                                                        setPage(1);
                                                        return;
                                                    }
                                                    const today = new Date().toISOString().split("T")[0];
                                                    if (value > today) {
                                                        showToast("Start date cannot be in the future", "error");
                                                        return;
                                                    }
                                                    if (endDate && value > endDate) {
                                                        showToast("Start date cannot be after end date", "error");
                                                        return;
                                                    }
                                                    setPage(1);
                                                    setStartDate(value);
                                                }}
                                                placeholder="From date"
                                            />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                                            to
                                        </span>
                                        <div className="w-full sm:w-32">
                                            <DatePicker
                                                value={endDate}
                                                max={todayStr}
                                                min={startDate || undefined}
                                                align="right"
                                                popupClassName="mt-4"
                                                disabled={!startDate}
                                                onChange={(value) => {
                                                    if (!value) {
                                                        setEndDate("");
                                                        setPage(1);
                                                        return;
                                                    }
                                                    const today = new Date().toISOString().split("T")[0];
                                                    if (value > today) {
                                                        showToast("End date cannot be in the future", "error");
                                                        return;
                                                    }
                                                    if (startDate && value < startDate) {
                                                        showToast("End date cannot be before start date", "error");
                                                        return;
                                                    }
                                                    setPage(1);
                                                    setEndDate(value);
                                                }}
                                                placeholder="To date"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                                        className="text-xs font-semibold text-slate-600 hover:text-slate-700 ml-auto"
                                    >
                                        Clear dates
                                    </button>
                                </div>
                            </div>

                            {/* Mobile: Card list */}
                            <div className="md:hidden p-3 sm:p-4 space-y-3">
                                {filteredOrders.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 px-4">
                                        <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                                            <HiOutlineInboxStack className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">No orders found</h3>
                                        <p className="text-xs text-slate-600 font-medium text-center mt-1">Adjust filters or search.</p>
                                        <Button variant="outline" className="mt-4 rounded-xl text-xs" onClick={() => { setActiveTab('All'); setSearchTerm(''); }}>CLEAR FILTERS</Button>
                                    </div>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filteredOrders
                                            .slice((page - 1) * pageSize, page * pageSize)
                                            .map((order) => (
                                                <motion.div
                                                    key={order.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm active:bg-slate-50/50"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1" onClick={() => handleViewDetails(order)}>
                                                            <p className="text-xs font-black text-slate-900 truncate">#{order.id}</p>
                                                            <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                                                                <HiOutlineCalendarDays className="h-3 w-3 shrink-0" />
                                                                {order.date} • {order.time}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="h-7 w-7 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                                                                    {order.customer.avatar}
                                                                </div>
                                                                <p className="text-xs font-bold text-slate-800 truncate">{order.customer.name}</p>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">Your Earning</p>
                                                            <p className="text-sm font-black text-slate-900">₹{order.total.toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                                            <Badge variant={getStatusColor(order.status)} className="text-[10px] font-black uppercase px-2 py-0">
                                                                {order.status}
                                                            </Badge>
                                                            <select
                                                                value={order.status}
                                                                onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className={cn(
                                                                    "w-full min-w-[112px] text-[10px] pl-2 pr-6 py-1.5 rounded-lg font-black uppercase cursor-pointer appearance-none border outline-none",
                                                                    order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                                        order.status === 'delivered' ? "bg-brand-100 text-brand-700" :
                                                                            order.status === 'cancelled' ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                                                                )}
                                                            >
                                                                <option value="pending">Pending</option>
                                                                <option value="confirmed">Confirmed</option>
                                                                <option value="packed">Packed</option>
                                                                <option value="out_for_delivery">Out</option>
                                                                <option value="delivered">Delivered</option>
                                                                <option value="cancelled">Cancelled</option>
                                                            </select>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleThermalPrint(order);
                                                                    }}
                                                                    title="Thermal Print"
                                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                                                                >
                                                                    <HiOutlinePrinter className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleNormalPrint(order);
                                                                    }}
                                                                    title="Normal Print (A4)"
                                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                                                                >
                                                                    <HiOutlineDocumentText className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleViewDetails(order)}
                                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                                                                >
                                                                    <HiOutlineEye className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                    </AnimatePresence>
                                )}
                            </div>

                            {/* Desktop: Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[640px]">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-4 lg:px-6 py-3 lg:py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">Order Details</th>
                                            <th className="px-4 lg:px-6 py-3 lg:py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">Customer</th>
                                            <th className="px-4 lg:px-6 py-3 lg:py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">Your Earning</th>
                                            <th className="px-4 lg:px-6 py-3 lg:py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                                            <th className="px-4 lg:px-6 py-3 lg:py-4 text-xs font-bold text-slate-600 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        <AnimatePresence mode="popLayout">
                                            {filteredOrders
                                                .slice((page - 1) * pageSize, page * pageSize)
                                                .map((order) => (
                                                    <motion.tr
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        key={order.id}
                                                        className="hover:bg-slate-50/50 transition-colors group"
                                                    >
                                                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                                                            <div>
                                                                <span className="text-xs font-bold text-slate-900 group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleViewDetails(order)}>
                                                                    #{order.id}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mt-1">
                                                                    <HiOutlineCalendarDays className="h-3 w-3" />
                                                                    {order.date} • {order.time}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-2 ring-white">
                                                                    {order.customer.avatar}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-900">{order.customer.name}</p>
                                                                    <p className="text-xs font-semibold text-slate-600">{order.customer.phone}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-900">₹{order.total.toLocaleString()}</span>
                                                                <span className="text-xs font-semibold text-slate-600">{order.items.length} items</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                                                            <div className="relative inline-block w-36">
                                                                <select
                                                                    value={order.status}
                                                                    onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                                                                    className={cn(
                                                                        "w-full text-[10px] pl-2.5 pr-8 py-1.5 rounded-full font-black uppercase tracking-widest cursor-pointer appearance-none focus:ring-2 focus:ring-offset-1 transition-all border-none outline-none shadow-sm",
                                                                        order.status === 'pending' ? "bg-amber-100 text-amber-700 focus:ring-amber-200" :
                                                                            order.status === 'confirmed' ? "bg-brand-100 text-brand-700 focus:ring-brand-200" :
                                                                                order.status === 'packed' ? "bg-brand-100 text-brand-700 focus:ring-brand-200" :
                                                                                    order.status === 'out_for_delivery' ? "bg-purple-100 text-purple-700 focus:ring-purple-200" :
                                                                                        order.status === 'delivered' ? "bg-brand-100 text-brand-700 focus:ring-brand-200" :
                                                                                            order.status === 'cancelled' ? "bg-rose-100 text-rose-700 focus:ring-rose-200" :
                                                                                                "bg-slate-100 text-slate-700 focus:ring-slate-200"
                                                                    )}
                                                                >
                                                                    <option value="pending">Pending</option>
                                                                    <option value="confirmed">Confirmed</option>
                                                                    <option value="packed">Packed</option>
                                                                    <option value="out_for_delivery">Out for Delivery</option>
                                                                    <option value="delivered">Delivered</option>
                                                                    <option value="cancelled">Cancelled</option>
                                                                </select>
                                                                <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-right">
                                                            <div className="flex items-center justify-end space-x-1.5">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleThermalPrint(order);
                                                                    }}
                                                                    title="Thermal Print"
                                                                    className="p-1.5 hover:bg-white hover:text-primary rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100"
                                                                >
                                                                    <HiOutlinePrinter className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleNormalPrint(order);
                                                                    }}
                                                                    title="Normal Print (A4)"
                                                                    className="p-1.5 hover:bg-white hover:text-primary rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100"
                                                                >
                                                                    <HiOutlineDocumentText className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleViewDetails(order)}
                                                                    className="p-1.5 hover:bg-white hover:text-primary rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100"
                                                                >
                                                                    <HiOutlineEye className="h-4 w-4" />
                                                                </button>
                                                                {order.status === 'Pending' && (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleStatusUpdate(order.id, 'Processing');
                                                                            }}
                                                                            className="p-1.5 hover:bg-brand-50 hover:text-brand-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100"
                                                                        >
                                                                            <HiOutlineCheck className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleStatusUpdate(order.id, 'Cancelled');
                                                                            }}
                                                                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100"
                                                                        >
                                                                            <HiOutlineXMark className="h-4 w-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                                {filteredOrders.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 px-6">
                                        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                                            <HiOutlineInboxStack className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">No orders found</h3>
                                        <p className="text-xs text-slate-600 font-medium max-w-xs text-center mt-1">We couldn't find any orders matching your current filters. Try adjusting your search.</p>
                                        <Button variant="outline" className="mt-6 rounded-xl text-xs" onClick={() => { setActiveTab('All'); setSearchTerm(''); }}>CLEAR ALL FILTERS</Button>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 sm:p-4 border-t border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3 sm:px-6">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest text-center sm:text-left">
                                    Showing {filteredOrders.length} of {total || summary.totalOrders || filteredOrders.length} Orders
                                </p>
                                <div className="flex gap-1 justify-center sm:justify-end">
                                    <button className="p-1.5 rounded-lg border border-slate-200 text-slate-600 opacity-50 cursor-not-allowed" aria-hidden><HiOutlineChevronRight className="h-3.5 w-3.5 rotate-180" /></button>
                                    <button className="p-1.5 rounded-lg border border-slate-200 text-slate-600 opacity-50 cursor-not-allowed" aria-hidden><HiOutlineChevronRight className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        </Card>
                    </BlurFade>

                    <div className="mt-3 sm:mt-4 px-2 sm:px-0">
                        <Pagination
                            page={page}
                            totalPages={Math.ceil((total || filteredOrders.length) / pageSize) || 1}
                            total={total || filteredOrders.length}
                            pageSize={pageSize}
                            onPageChange={(p) => setPage(p)}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setPage(1);
                                fetchOrders(1, false);
                            }}
                            loading={loading}
                        />
                    </div>

                    {/* Order Details Modal */}
                    {/* ... (existing details modal) */}

                    {/* Quick View Summary Modal */}
                    {createPortal(
                        <AnimatePresence>
                            {isQuickViewModalOpen && (
                                <div
                                    data-lenis-prevent
                                    data-lenis-prevent-wheel
                                    className="fixed inset-0 z-[250] overflow-y-auto bg-slate-900/40 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center min-h-full"
                                    onClick={() => setIsQuickViewModalOpen(false)}
                                >
                                    <motion.div
                                        data-lenis-prevent
                                        data-lenis-prevent-wheel
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto text-left relative z-10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-9 w-9 sm:h-10 sm:w-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                                    <HiOutlineChartBar className="h-4 w-4 sm:h-5 sm:w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">Quick Snapshot</h3>
                                                    <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">Today's Performance</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setIsQuickViewModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600 shrink-0">
                                                <HiOutlineXMark className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                                            {/* Summary Grid */}
                                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                                <div className="p-3 sm:p-4 rounded-2xl bg-brand-50 border border-brand-100">
                                                    <p className="text-[10px] sm:text-xs font-bold text-brand-400 uppercase tracking-widest mb-1">Your Earnings</p>
                                                    <p className="text-base sm:text-xl font-black text-brand-700 truncate">₹{summary.totalAmount.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="p-3 sm:p-4 rounded-2xl bg-brand-50 border border-brand-100">
                                                    <p className="text-[10px] sm:text-xs font-bold text-brand-400 uppercase tracking-widest mb-1">Avg. Earning / Order</p>
                                                    <p className="text-base sm:text-xl font-black text-brand-700">₹{summary.totalOrders ? (summary.totalAmount / summary.totalOrders).toFixed(0) : '0'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100">
                                            <Button
                                                onClick={() => {
                                                    setIsQuickViewModalOpen(false);
                                                    setActiveTab('Pending');
                                                }}
                                                className="w-full py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold"
                                            >
                                                VIEW ALL PENDING ORDERS
                                            </Button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
                    {createPortal(
                        <AnimatePresence>
                            {isDetailsModalOpen && selectedOrder && (
                                <div
                                    className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 lg:p-12"
                                    data-lenis-prevent
                                >
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                                        onClick={() => setIsDetailsModalOpen(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]"
                                    >
                                        {/* Modal Header - pinned */}
                                        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex-shrink-0 bg-white">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                                                    <HiOutlineTruck className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900">Order Details</h3>
                                                    <div className="flex items-center space-x-2 mt-0.5">
                                                        <Badge variant={getStatusColor(selectedOrder.status)} className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0">{selectedOrder.status}</Badge>
                                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">#{selectedOrder.id}</span>
                                                    </div>
                                                    {(selectedOrder.date || selectedOrder.time) && (
                                                        <p className="text-[11px] font-bold text-slate-500 mt-1.5 flex items-center gap-1.5">
                                                            <HiOutlineCalendarDays className="h-3.5 w-3.5" />
                                                            {selectedOrder.date}
                                                            {selectedOrder.time && (
                                                                <>
                                                                    <span className="text-slate-300">•</span>
                                                                    <HiOutlineClock className="h-3.5 w-3.5" />
                                                                    {selectedOrder.time}
                                                                </>
                                                            )}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                                                <HiOutlineXMark className="h-5 w-5" />
                                            </button>
                                        </div>

                                        {/* Modal Body - scrollable in the middle */}
                                        <div className="overflow-y-auto flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-6 overscroll-contain">

                                            {/* Address & Contact Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                                            <HiOutlineMapPin className="h-3 w-3 text-primary" /> Delivery Address
                                                        </h4>
                                                        {selectedOrder.location &&
                                                            typeof selectedOrder.location.lat === "number" &&
                                                            typeof selectedOrder.location.lng === "number" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const { lat, lng } = selectedOrder.location;
                                                                        window.open(
                                                                            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                                                                            "_blank",
                                                                        );
                                                                    }}
                                                                    className="text-[10px] font-bold text-primary hover:underline"
                                                                >
                                                                    View on map
                                                                </button>
                                                            )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                                                        {selectedOrder.address}
                                                    </p>
                                                </div>

                                                {["packed", "out_for_delivery", "delivered"].includes(
                                                    String(selectedOrder.status || "").toLowerCase(),
                                                ) && (
                                                    <div>
                                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <HiOutlinePhone className="h-3 w-3 text-brand-500" /> Contact Info
                                                        </h4>
                                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                                                            <p className="text-xs font-bold text-slate-800">{selectedOrder.customer.name}</p>
                                                            <p className="text-xs font-semibold text-slate-600 mt-0.5">{selectedOrder.customer.phone}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedOrder.status.toLowerCase() !== 'pending' && selectedOrder.status.toLowerCase() !== 'cancelled' && (
                                                    <div>
                                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <HiOutlineTruck className="h-3 w-3 text-primary" /> Delivery Partner
                                                        </h4>
                                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                                                            {selectedOrder.deliveryMode === 'self' ? (
                                                                <div className="flex justify-between items-center">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-800">
                                                                            {selectedOrder.selfDeliveryPerson?.name || 'Own delivery person'}
                                                                        </p>
                                                                        {selectedOrder.selfDeliveryPerson?.phone && (
                                                                            <p className="text-[11px] font-semibold text-slate-600">{selectedOrder.selfDeliveryPerson.phone}</p>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Own Delivery</span>
                                                                </div>
                                                            ) : selectedOrder.deliveryBoy ? (
                                                                <div className="flex justify-between items-center">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-800">{selectedOrder.deliveryBoy.name}</p>
                                                                        <p className="text-[11px] font-semibold text-slate-600">{selectedOrder.deliveryBoy.phone}</p>
                                                                    </div>
                                                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Assigned</span>
                                                                </div>
                                                            ) : (
                                                                <p className="text-[11px] text-slate-500 font-medium">No delivery partner assigned.</p>
                                                            )}

                                                            {String(selectedOrder.status || "").toLowerCase() === "packed" && (
                                                                ownDeliveryFormOrderId === selectedOrder.id ? (
                                                                    <div className="space-y-2">
                                                                        <div className="h-px bg-slate-200 my-1" />
                                                                        <input
                                                                            type="text"
                                                                            value={ownDeliveryName}
                                                                            onChange={(e) => setOwnDeliveryName(e.target.value)}
                                                                            placeholder="Delivery person name (optional)"
                                                                            className="w-full text-xs px-3 py-2 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-200 outline-none shadow-sm font-semibold text-slate-800"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={ownDeliveryPhone}
                                                                            onChange={(e) => setOwnDeliveryPhone(e.target.value)}
                                                                            placeholder="Phone number (optional)"
                                                                            className="w-full text-xs px-3 py-2 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-200 outline-none shadow-sm font-semibold text-slate-800"
                                                                        />
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => handleSetOwnDelivery(selectedOrder.id, { name: ownDeliveryName, phone: ownDeliveryPhone })}
                                                                                className="flex-1 text-[11px] font-bold text-white bg-primary rounded-xl py-2 hover:opacity-90 transition-all"
                                                                            >
                                                                                Confirm Own Delivery
                                                                            </button>
                                                                            <button
                                                                                onClick={() => { setOwnDeliveryFormOrderId(null); setOwnDeliveryName(''); setOwnDeliveryPhone(''); }}
                                                                                className="px-3 text-[11px] font-bold text-slate-500 hover:text-slate-700"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="h-px bg-slate-200 my-1" />
                                                                        <div className="relative">
                                                                            <select
                                                                                value={selectedOrder.deliveryBoy?._id || selectedOrder.deliveryBoy?.id || ''}
                                                                                onChange={(e) => handleAssignDeliveryBoy(selectedOrder.id, e.target.value)}
                                                                                className="w-full text-xs pl-3 pr-8 py-2 bg-white rounded-xl border border-slate-200 appearance-none cursor-pointer focus:ring-2 focus:ring-brand-200 outline-none shadow-sm font-semibold text-slate-800"
                                                                            >
                                                                                <option value="">
                                                                                    {selectedOrder.deliveryBoy ? 'Change Rider...' : 'Assign Rider...'}
                                                                                </option>
                                                                                {deliveryBoys.length === 0 ? (
                                                                                    <option value="" disabled>No online riders available</option>
                                                                                ) : (
                                                                                    deliveryBoys
                                                                                        .filter(boy => (boy._id || boy.id) !== (selectedOrder.deliveryBoy?._id || selectedOrder.deliveryBoy?.id))
                                                                                        .map(boy => (
                                                                                            <option key={boy._id} value={boy._id}>{boy.name} ({boy.phone})</option>
                                                                                        ))
                                                                                )}
                                                                            </select>
                                                                            <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setOwnDeliveryFormOrderId(selectedOrder.id)}
                                                                            className="text-[11px] font-bold text-primary hover:underline"
                                                                        >
                                                                            {selectedOrder.deliveryMode === 'self' ? 'Edit own delivery details' : 'Use my own delivery person instead'}
                                                                        </button>
                                                                    </>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedOrder.status.toLowerCase() === "confirmed" && (
                                                    <div>
                                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <HiOutlineTruck className="h-3 w-3 text-primary" /> Delivery Partner
                                                        </h4>
                                                        <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shadow-sm">
                                                            <p className="text-[11px] text-amber-700 font-semibold">
                                                                Mark order as <span className="font-black">Packed</span> to assign a delivery partner.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Shipment Details (scheduled orders) */}
                                            {selectedOrder.deliveryType === "scheduled" && (
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <HiOutlineTruck className="h-3 w-3 text-indigo-500" /> Shipment Details
                                                    </h4>
                                                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 shadow-sm space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Shiprocket Fulfillment</span>
                                                        </div>
                                                        {selectedOrder.shipmentDetails?.awbCode ? (
                                                            <div className="text-xs font-semibold text-slate-700 mt-2 space-y-1">
                                                                <p><span className="text-slate-500 font-bold">Courier:</span> {selectedOrder.shipmentDetails.courierName || "Standard"}</p>
                                                                <p><span className="text-slate-500 font-bold">AWB Code:</span> {selectedOrder.shipmentDetails.awbCode}</p>
                                                                <p><span className="text-slate-500 font-bold">Status:</span> <span className="uppercase text-indigo-600 font-black">{selectedOrder.shipmentDetails.status || "Created"}</span></p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-slate-500 font-medium italic mt-2">Awaiting shipment details (creates on status packed)</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Pricing */}
                                            <div className="space-y-3">
                                                <div className="bg-slate-50 p-3 sm:p-4 rounded-3xl border border-slate-100">
                                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Order Amount (Customer)</h4>
                                                    <p className="text-lg font-black text-slate-900">₹{getCustomerOrderBill(selectedOrder).grandTotal.toFixed(2)}</p>
                                                    <div className="bg-primary/5 p-3 sm:p-4 rounded-3xl border border-primary/10 space-y-3 mt-4">
                                                        <h4 className="text-xs font-black text-primary uppercase tracking-widest">Financial Breakdown & Net Profit</h4>
                                                        <div className="space-y-2">
                                                            {(() => {
                                                                const { productSubtotal, adminCommission, productEarning, deliveryShare, total, totalCostPrice, sellerNetProfit, profitMarginPercent } = getSellerEarningBreakdown(selectedOrder);
                                                                return (
                                                                    <>
                                                                        <div className="flex justify-between text-xs">
                                                                            <span className="font-semibold text-slate-600">Product Subtotal</span>
                                                                            <span className="font-bold text-slate-900">₹{productSubtotal.toFixed(2)}</span>
                                                                        </div>
                                                                        {adminCommission > 0 && (
                                                                            <div className="flex justify-between text-xs text-rose-600">
                                                                                <span className="font-semibold">Platform Commission</span>
                                                                                <span className="font-bold">-₹{adminCommission.toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        {deliveryShare > 0 && (
                                                                            <div className="flex justify-between text-xs text-brand-600">
                                                                                <span className="font-semibold">Delivery Share (80%)</span>
                                                                                <span className="font-bold">+₹{deliveryShare.toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex justify-between text-xs font-bold text-slate-800 bg-white/60 p-2 rounded-xl border border-slate-100">
                                                                            <span>Payout (Your Earning)</span>
                                                                            <span className="text-primary">₹{total.toFixed(2)}</span>
                                                                        </div>
                                                                        {totalCostPrice > 0 && (
                                                                            <div className="flex justify-between text-xs text-slate-600">
                                                                                <span className="font-semibold">Product Cost (COGS)</span>
                                                                                <span className="font-bold text-rose-700">-₹{totalCostPrice.toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="h-px bg-primary/10 my-2" />
                                                                        <div className="flex justify-between items-center text-sm p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                                                                            <div>
                                                                                <p className="font-black text-emerald-900">Actual Net Profit</p>
                                                                                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Margin: {profitMarginPercent}%</p>
                                                                            </div>
                                                                            <span className="font-black text-lg text-emerald-700">₹{sellerNetProfit.toFixed(2)}</span>
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900 p-3 sm:p-4 rounded-3xl text-white shadow-xl shadow-slate-900/10">
                                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Payment Status</h4>
                                                    <div className="flex items-center gap-2">
                                                        <HiOutlineBanknotes className="h-5 w-5 text-brand-400" />
                                                        <span className="text-xs font-bold tracking-tight">{selectedOrder.payment}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Items */}
                                            <div>
                                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Items Ordered ({selectedOrder.items.length})</h4>
                                                <div className="space-y-3">
                                                    {selectedOrder.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white ring-1 ring-slate-100 rounded-2xl group hover:shadow-md transition-all">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200 flex-shrink-0">
                                                                    <img src={item.image} alt={item.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-900">{item.name}</p>
                                                                    <p className="text-xs font-semibold text-slate-600 mt-0.5">₹{item.price.toFixed(2)} × {item.qty}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-slate-900">₹{(item.price * item.qty).toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Modal Footer - pinned */}
                                        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-between flex-shrink-0">
                                            <button
                                                onClick={() => handleThermalPrint(selectedOrder)}
                                                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all shadow-sm"
                                            >
                                                <HiOutlinePrinter size={16} /> THERMAL PRINT
                                            </button>
                                            <div className="flex gap-2 items-center">
                                                <button onClick={() => setIsDetailsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">CLOSE</button>
                                                <div className="relative inline-block w-40">
                                                    <select
                                                        value={selectedOrder.status.toLowerCase()}
                                                        onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value)}
                                                        className={cn(
                                                            "w-full text-xs pl-3 pr-8 py-2 rounded-xl font-black uppercase tracking-wider border appearance-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all outline-none shadow-sm",
                                                            getStatusColor(selectedOrder.status) === 'warning' ? "bg-amber-100 text-amber-700 focus:ring-amber-200" :
                                                                getStatusColor(selectedOrder.status) === 'info' ? "bg-brand-100 text-brand-700 focus:ring-brand-200" :
                                                                    getStatusColor(selectedOrder.status) === 'primary' ? "bg-brand-100 text-brand-700 focus:ring-brand-200" :
                                                                        getStatusColor(selectedOrder.status) === 'secondary' ? "bg-purple-100 text-purple-700 focus:ring-purple-200" :
                                                                            getStatusColor(selectedOrder.status) === 'success' ? "bg-brand-100 text-brand-700 focus:ring-brand-200" :
                                                                                getStatusColor(selectedOrder.status) === 'error' ? "bg-rose-100 text-rose-700 focus:ring-rose-200" :
                                                                                    "bg-slate-100 text-slate-700 focus:ring-slate-200"
                                                        )}
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="confirmed">Confirmed</option>
                                                        <option value="packed">Packed</option>
                                                        <option value="out_for_delivery">Out for Delivery</option>
                                                        <option value="delivered">Delivered</option>
                                                        <option value="cancelled">Cancelled</option>
                                                    </select>
                                                    <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
                </>
            )}
        </div>
    );
};

export default Orders;
