import React, { useState, useEffect } from "react";
import { X, Phone, MessageSquare, Download, Ban, CheckCircle2 } from "lucide-react";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";

const AdminPhotoOrderChatModal = ({ isOpen, onClose, orderId, orderDetails }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isChatDisabled, setIsChatDisabled] = useState(false);
    const [disabledReason, setDisabledReason] = useState("");
    const [isToggling, setIsToggling] = useState(false);

    useEffect(() => {
        if (orderDetails) {
            setIsChatDisabled(orderDetails.chatDisabled || false);
            setDisabledReason(orderDetails.chatDisabledReason || "");
        }
    }, [orderDetails]);

    // Admin panel scrolls the <html> element itself (see .admin-app-scroll in index.css),
    // so lock overflow on both html and body while the modal is open — otherwise wheel
    // events skip the chat's inner scroll box and scroll the page/sidebar behind it.
    useEffect(() => {
        if (!isOpen) return;
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;
        html.style.overflow = "hidden";
        body.style.overflow = "hidden";
        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!orderId || !isOpen) return;
            setIsLoading(true);
            try {
                const res = await adminApi.getAdminPhotoOrderChat(orderId);
                const rawData = res.data?.results || res.data?.result || res.data;
                const msgArray = Array.isArray(rawData) ? rawData : [];
                setMessages(msgArray);
            } catch (error) {
                toast.error("Failed to load chat history");
            } finally {
                setIsLoading(false);
            }
        };
        fetchMessages();
    }, [orderId, isOpen]);

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: '2-digit' }).format(d);
    };

    const handleDownload = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `admin-photo-${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            toast.error("Failed to download image");
        }
    };

    const handleToggleChat = async () => {
        const newStatus = !isChatDisabled;
        let reason = "";
        
        if (newStatus) {
            reason = window.prompt("Enter a reason for disabling this chat:");
            if (reason === null) return; // User cancelled
        }

        setIsToggling(true);
        try {
            const res = await adminApi.toggleAdminPhotoOrderChat(orderId, {
                chatDisabled: newStatus,
                chatDisabledReason: reason
            });
            setIsChatDisabled(res.data?.result?.chatDisabled ?? newStatus);
            setDisabledReason(res.data?.result?.chatDisabledReason ?? reason);
            toast.success(`Chat has been ${newStatus ? 'disabled' : 'enabled'}`);
        } catch (error) {
            toast.error("Failed to toggle chat status");
        } finally {
            setIsToggling(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[88vh] bg-slate-50 border-0 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </button>

                <div className="p-4 bg-white border-b border-slate-200 shrink-0">
                    <div className="text-lg font-bold text-slate-800 flex items-center justify-between pr-8">
                        <span>Chat Monitoring: Order #{orderId.slice(-6).toUpperCase()}</span>
                        <button
                            onClick={handleToggleChat}
                            disabled={isToggling}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                                isChatDisabled
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isChatDisabled ? <><CheckCircle2 size={14} /> Enable Chat</> : <><Ban size={14} /> Disable Chat</>}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
                        <span className="text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
                            Customer: <span className="text-slate-900 font-bold">{orderDetails?.customer?.name || 'N/A'}</span>
                        </span>
                        <span className="text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
                            Seller: <span className="text-slate-900 font-bold">{orderDetails?.seller?.shopName || orderDetails?.seller?.name || 'N/A'}</span>
                        </span>
                        {(orderDetails?.seller?.city || orderDetails?.seller?.address) && (
                            <span className="text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
                                Location: <span className="text-slate-900 font-bold">{orderDetails?.seller?.city || orderDetails?.seller?.address}</span>
                            </span>
                        )}
                        {orderDetails?.seller?._id && (
                            <span className="text-slate-500 font-mono text-[11px] bg-slate-100 px-2.5 py-1 rounded-md">
                                Seller ID: {orderDetails.seller._id.slice(-8).toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>

                {isChatDisabled && (
                    <div className="bg-red-50 border-b border-red-100 p-3 flex flex-col items-center justify-center text-red-700 shrink-0">
                        <div className="flex items-center gap-2 font-bold text-sm">
                            <Ban size={16} /> Chat Disabled by Admin
                        </div>
                        {disabledReason && <div className="text-xs mt-1 opacity-90">{disabledReason}</div>}
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
                    {/* Initial Context Message */}
                    {orderDetails?.photoUrl || orderDetails?.notes ? (
                        <div className="flex flex-col items-center mb-6">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-200 px-2.5 py-1 rounded-full">Order Request Content</span>
                            <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full text-sm text-slate-700 max-w-lg">
                                {orderDetails.photoUrl && (
                                    <div className="relative group mb-2">
                                        <img src={orderDetails.photoUrl} alt="Order" className="w-full h-auto max-h-48 object-cover rounded-lg pointer-events-none" />
                                        <button 
                                            onClick={() => handleDownload(orderDetails.photoUrl)}
                                            className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                        >
                                            <Download size={14} />
                                        </button>
                                    </div>
                                )}
                                {orderDetails.notes && <p className="whitespace-pre-wrap">{orderDetails.notes}</p>}
                            </div>
                        </div>
                    ) : null}

                    {isLoading ? (
                        <div className="text-center py-4 text-slate-400 text-sm">Loading chat history...</div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 opacity-50">
                            <MessageSquare size={48} className="text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">No messages yet.</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isCustomer = msg.senderRole === "customer";
                            
                            // Special cards
                            if (msg.type === "reply_card") {
                                return (
                                    <div key={msg._id || msg.createdAt} className="flex justify-center my-4">
                                        <div className="bg-white border-2 border-indigo-100 rounded-xl p-3 w-4/5 max-w-sm shadow-sm text-center">
                                            <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Seller Sent Quote</div>
                                            <div className="text-sm font-medium text-slate-700 mb-3 whitespace-pre-wrap">{msg.text}</div>
                                            <div className="text-2xl font-black text-slate-900">₹{msg.estimatedPrice}</div>
                                        </div>
                                    </div>
                                );
                            }

                            if (msg.type === "contact_card") {
                                return (
                                    <div key={msg._id || msg.createdAt} className="flex justify-center my-4">
                                        <div className="bg-white border-2 border-emerald-100 rounded-xl p-3 w-4/5 max-w-sm shadow-sm text-center">
                                            <div className="flex justify-center mb-1"><Phone size={20} className="text-emerald-500" /></div>
                                            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Contact Shared</div>
                                            <p className="text-xs text-slate-500">Seller shared contact details.</p>
                                        </div>
                                    </div>
                                );
                            }

                            if (msg.type === "image" && msg.imageUrl) {
                                return (
                                    <div key={msg._id || msg.createdAt} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                                        <div className={`max-w-[80%] rounded-2xl p-1.5 shadow-sm ${isCustomer ? "bg-white border border-slate-200 rounded-bl-none" : "bg-indigo-600 rounded-br-none"}`}>
                                            <div className="px-2 pt-1 pb-1 text-[10px] font-bold tracking-wider uppercase opacity-70">
                                                {isCustomer ? 'Customer' : 'Seller'}
                                            </div>
                                            <div className="relative group">
                                                <img src={msg.imageUrl} alt="Chat Attachment" className="w-full h-auto max-h-64 object-cover rounded-xl pointer-events-none" />
                                                <button 
                                                    onClick={() => handleDownload(msg.imageUrl)}
                                                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                    title="Download Photo"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                            <span className={`text-[10px] mt-1 mb-1 block px-2 ${isCustomer ? "text-right text-slate-400" : "text-right text-indigo-200"}`}>
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            // Normal text bubble
                            return (
                                <div key={msg._id || msg.createdAt} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isCustomer ? "bg-white text-slate-800 rounded-bl-none border border-slate-200" : "bg-indigo-600 text-white rounded-br-none"}`}>
                                        <div className="pb-1 text-[10px] font-bold tracking-wider uppercase opacity-70">
                                            {isCustomer ? 'Customer' : 'Seller'}
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                        <span className={`text-[10px] mt-1 block text-right ${isCustomer ? "text-slate-400" : "text-indigo-200"}`}>
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPhotoOrderChatModal;
