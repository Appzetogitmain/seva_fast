import React, { useState, useEffect } from "react";
import {
    Star,
    CheckCircle,
    XCircle,
    Loader2,
    MessageSquare,
    Video,
    ShoppingBag,
    User,
    Store,
    Phone,
    Calendar,
    Package,
    IndianRupee,
    Image as ImageIcon,
} from "lucide-react";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

const InfoChip = ({ icon: Icon, label, value, color = "slate" }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-${color}-50 border border-${color}-100`}>
        <Icon size={13} className={`text-${color}-500 flex-shrink-0`} />
        <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-widest text-${color}-400`}>{label}</p>
            <p className={`text-xs font-bold text-${color}-800 truncate`}>{value || "—"}</p>
        </div>
    </div>
);

const AdminReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("pending");
    const [actionLoading, setActionLoading] = useState(null);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getPendingReviews({ status: statusFilter });
            setReviews(res.data?.result?.items || []);
        } catch (error) {
            console.error("Failed to fetch reviews", error);
            toast.error("Failed to fetch reviews");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [statusFilter]);

    const handleUpdateStatus = async (id, status) => {
        setActionLoading(id + status);
        try {
            await adminApi.updateReviewStatus(id, { status });
            toast.success(`Review ${status} successfully`);
            setReviews(prev => prev.filter(r => r._id !== id));
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update review status");
        } finally {
            setActionLoading(null);
        }
    };

    const statusConfig = {
        pending:  { bg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-600"  },
        approved: { bg: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-600" },
        rejected: { bg: "bg-red-50",     border: "border-red-200",    text: "text-red-600"     },
    };

    return (
        <div className="p-6 md:p-10 min-h-screen bg-slate-50 pb-24" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <div className="max-w-5xl mx-auto space-y-8">

                {/* ── Header ─────────────────────────────── */}
                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Star className="text-amber-400 fill-amber-400" size={32} />
                            Product Reviews
                        </h1>
                        <p className="text-slate-400 font-medium mt-1 text-sm">
                            Approve or reject customer reviews before they go live.
                        </p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        {["pending", "approved", "rejected"].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all whitespace-nowrap ${
                                    statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Content ────────────────────────────── */}
                {loading ? (
                    <div className="flex justify-center items-center py-24">
                        <Loader2 className="animate-spin text-amber-400" size={40} />
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
                        <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No {statusFilter} reviews</h3>
                        <p className="text-slate-400 font-medium mt-1 text-sm">Nothing matches this filter right now.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <AnimatePresence mode="popLayout">
                            {reviews.map((review) => {
                                const sc = statusConfig[review.status] || statusConfig.pending;
                                const product   = review.productId;
                                const customer  = review.userId;
                                const order     = review.orderId;
                                const seller    = order?.seller;

                                /* find the ordered item to get price */
                                const orderedItem = order?.items?.find(
                                    i => String(i.product) === String(product?._id)
                                );
                                const itemPrice = orderedItem
                                    ? `₹${orderedItem.price} × ${orderedItem.quantity}`
                                    : product?.price ? `₹${product.price}` : null;

                                return (
                                    <motion.div
                                        key={review._id}
                                        layout
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                                        className="bg-white rounded-3xl shadow-sm border border-slate-100"
                                    >
                                        {/* ── Row 1: Customer + Seller + Order info ── */}
                                        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
                                            <div className="flex flex-wrap gap-3">
                                                <InfoChip icon={User}       label="Customer"    value={customer?.name}                            color="indigo" />
                                                <InfoChip icon={Phone}      label="Phone"       value={customer?.phone || "N/A"}                  color="indigo" />
                                                <InfoChip icon={Store}      label="Seller"      value={seller?.shopName || seller?.name}           color="blue"   />
                                                <InfoChip icon={Phone}      label="Seller Ph."  value={seller?.phone || "N/A"}                    color="blue"   />
                                                <InfoChip icon={ShoppingBag}label="Order ID"    value={order?.orderId ? `#${String(order.orderId).slice(-8)}` : "—"} color="violet" />
                                                <InfoChip icon={Calendar}   label="Order Date"  value={order?.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"} color="slate" />
                                                <InfoChip icon={Calendar}   label="Review Date" value={new Date(review.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })} color="slate" />
                                                {itemPrice && <InfoChip icon={IndianRupee} label="Price" value={itemPrice} color="emerald" />}
                                            </div>
                                        </div>

                                        {/* ── Row 2: Product + Review ── */}
                                        <div className="px-6 py-5 flex flex-col md:flex-row gap-6 border-b border-slate-100">

                                            {/* Product image + name */}
                                            <div className="flex-shrink-0 flex flex-col items-center gap-3 w-full md:w-44">
                                                <div className="w-full h-40 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                                                    <img
                                                        src={applyCloudinaryTransform(product?.mainImage || product?.images?.[0]) || "/placeholder.jpg"}
                                                        alt={product?.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                                        <Package size={9} /> Product
                                                    </p>
                                                    <p className="text-sm font-bold text-slate-800 mt-0.5 line-clamp-2">{product?.name || "—"}</p>
                                                </div>
                                            </div>

                                            {/* Review content */}
                                            <div className="flex-1 flex flex-col gap-4">
                                                {/* Stars + status */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex gap-1">
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <Star key={s} size={20}
                                                                className={s <= review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}
                                                            />
                                                        ))}
                                                        <span className="ml-2 text-sm font-bold text-slate-600">{review.rating}/5</span>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                                                        {review.status}
                                                    </span>
                                                </div>

                                                {/* Comment */}
                                                <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 min-h-[72px] text-sm">
                                                    {review.comment || <span className="italic text-slate-400">No comment.</span>}
                                                </p>

                                                {/* Customer uploaded media */}
                                                {((review.images?.length > 0) || review.video) && (
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                            <ImageIcon size={10} /> Customer Media
                                                        </p>
                                                        <div className="flex flex-wrap gap-3">
                                                            {review.images?.filter(Boolean).map((img, i) => (
                                                                <a key={i} href={img} target="_blank" rel="noopener noreferrer"
                                                                    className="group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 block bg-slate-100">
                                                                    <img src={applyCloudinaryTransform(img)} alt={`img-${i}`}
                                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                </a>
                                                            ))}
                                                            {review.video && (
                                                                <div className="flex flex-col gap-1">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                        <Video size={9} /> Video
                                                                    </p>
                                                                    <video
                                                                        src={review.video}
                                                                        controls
                                                                        preload="metadata"
                                                                        className="rounded-xl border border-slate-200 shadow-sm bg-black"
                                                                        style={{ width: "260px", maxHeight: "160px" }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Action buttons ── always full-width bottom row */}
                                        {review.status === "pending" && (
                                            <div className="px-6 py-4 flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => handleUpdateStatus(review._id, "rejected")}
                                                    disabled={!!actionLoading}
                                                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100 disabled:opacity-50"
                                                >
                                                    {actionLoading === review._id + "rejected"
                                                        ? <Loader2 size={14} className="animate-spin" />
                                                        : <XCircle size={15} />}
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(review._id, "approved")}
                                                    disabled={!!actionLoading}
                                                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-orange-500 bg-orange-50 hover:bg-orange-100 transition-colors flex items-center gap-2 border border-orange-200 shadow-sm disabled:opacity-50"
                                                >
                                                    {actionLoading === review._id + "approved"
                                                        ? <Loader2 size={14} className="animate-spin" />
                                                        : <CheckCircle size={15} />}
                                                    Approve
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminReviews;
