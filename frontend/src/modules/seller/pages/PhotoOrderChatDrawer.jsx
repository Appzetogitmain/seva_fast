import React, { useState, useEffect, useRef } from "react";
import { X, Send, Phone, MessageCircle, FileText, IndianRupee } from "lucide-react";
import axiosInstance from "@core/api/axios";
import { useAuth } from "@core/context/AuthContext";
import { joinPhotoChatRoom, leavePhotoChatRoom, onPhotoChatMessage } from "@core/services/orderSocket";
import { toast } from "sonner";
import { formatTime } from "@shared/utils/formatDate";

export const PhotoOrderChatDrawer = ({ isOpen, onClose, order }) => {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    // Reply Card state
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyNote, setReplyNote] = useState("");
    const [estimatedPrice, setEstimatedPrice] = useState("");

    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !order) return;

        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const res = await axiosInstance.get(`/seller-photo-orders/${order._id}/chat`);
                setMessages(res.data.result || res.data.results || []);
            } catch (err) {
                toast.error("Failed to load chat messages");
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();

        // Socket setup
        const getToken = () => token || localStorage.getItem('auth_seller') || localStorage.getItem('auth_customer');
        joinPhotoChatRoom(order._id, getToken);

        const unSubMsg = onPhotoChatMessage(getToken, (msg) => {
            if (!msg) return;
            setMessages((prev) => {
                const exists = prev.some(m => (m._id && msg._id && m._id === msg._id));
                return exists ? prev : [...prev, msg];
            });
        });

        return () => {
            leavePhotoChatRoom(order._id, getToken);
            if (typeof unSubMsg === 'function') unSubMsg();
            setShowReplyForm(false);
        };
    }, [isOpen, order, token]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen, showReplyForm]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const textToSend = newMessage.trim();
        if (!textToSend) return;

        try {
            setNewMessage("");
            const res = await axiosInstance.post(`/seller-photo-orders/${order._id}/chat`, {
                text: textToSend,
                type: 'text'
            });
            const sentMsg = res.data.result || res.data.results;
            if (sentMsg) {
                setMessages((prev) => {
                    const exists = prev.some(m => (m._id && sentMsg._id && m._id === sentMsg._id));
                    return exists ? prev : [...prev, sentMsg];
                });
            }
        } catch (err) {
            toast.error("Failed to send message");
            setNewMessage(textToSend);
        }
    };

    const handleSendReplyCard = async () => {
        if (!replyNote.trim()) {
            toast.error("Please enter a reply note");
            return;
        }

        try {
            const res = await axiosInstance.post(`/seller-photo-orders/${order._id}/chat`, {
                text: replyNote,
                type: 'reply_card',
                estimatedPrice: estimatedPrice ? Number(estimatedPrice) : undefined
            });
            const sentMsg = res.data.result || res.data.results;
            if (sentMsg) {
                setMessages((prev) => {
                    const exists = prev.some(m => (m._id && sentMsg._id && m._id === sentMsg._id));
                    return exists ? prev : [...prev, sentMsg];
                });
            }
            setShowReplyForm(false);
            setReplyNote("");
            setEstimatedPrice("");
            toast.success("Reply card sent");
        } catch (err) {
            toast.error("Failed to send reply card");
        }
    };

    const handleShareContact = async () => {
        try {
            const res = await axiosInstance.post(`/seller-photo-orders/${order._id}/chat`, {
                type: 'contact_card',
                sellerContactPhone: user?.phone || ""
            });
            const sentMsg = res.data.result || res.data.results;
            if (sentMsg) {
                setMessages((prev) => {
                    const exists = prev.some(m => (m._id && sentMsg._id && m._id === sentMsg._id));
                    return exists ? prev : [...prev, sentMsg];
                });
            }
            toast.success("Contact shared with customer");
        } catch (err) {
            toast.error("Failed to share contact");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 z-[600] w-full sm:w-96 bg-slate-50 shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                <div>
                    <h3 className="font-bold text-slate-800">Chat with {order?.customer?.name || "Customer"}</h3>
                    <p className="text-xs text-slate-500 font-medium">Order #{order?._id?.slice(-6)}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Actions Bar */}
            <div className="bg-white px-4 py-2 border-b border-slate-200 flex gap-2">
                <button 
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-semibold transition-colors"
                >
                    <FileText size={14} /> Send Quote
                </button>
                <button 
                    onClick={handleShareContact}
                    disabled={order?.sellerContactShared}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition-colors"
                >
                    <Phone size={14} /> Share Contact
                </button>
            </div>

            {/* Reply Form (Collapsible) */}
            {showReplyForm && (
                <div className="bg-white p-4 border-b border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                    <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Reply Note / Items availability</label>
                        <textarea 
                            rows="2"
                            value={replyNote}
                            onChange={(e) => setReplyNote(e.target.value)}
                            className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                            placeholder="e.g., All items are available..."
                        />
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Estimated Price (₹) - Optional</label>
                        <input 
                            type="number" 
                            value={estimatedPrice}
                            onChange={(e) => setEstimatedPrice(e.target.value)}
                            className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                            placeholder="e.g., 450"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowReplyForm(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button onClick={handleSendReplyCard} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Send Reply Card</button>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {/* Initial Context Message */}
                <div className="flex flex-col items-center mb-6">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full">Order Request</span>
                    <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full text-sm text-slate-700">
                        {order?.photoUrl && (
                            <img src={order.photoUrl} alt="Order" className="w-full h-32 object-cover rounded-lg mb-2" />
                        )}
                        {order?.notes && <p className="whitespace-pre-wrap">{order.notes}</p>}
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-4 text-slate-400 text-sm">Loading messages...</div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderRole === "seller" || (user && (msg.senderId === user._id || msg.senderId === user.id));
                        
                        // Special cards
                        if (msg.type === "reply_card") {
                            return (
                                <div key={msg._id || msg.createdAt} className="flex justify-center my-4">
                                    <div className="bg-white border-2 border-indigo-100 rounded-xl p-3 w-4/5 shadow-sm text-center">
                                        <div className="flex justify-center mb-1"><FileText size={20} className="text-indigo-500" /></div>
                                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Your Quote & Reply</div>
                                        <p className="text-sm text-slate-700 mb-2">{msg.text}</p>
                                        {msg.estimatedPrice && (
                                            <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
                                                <IndianRupee size={14} /> {msg.estimatedPrice}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        if (msg.type === "contact_card") {
                            return (
                                <div key={msg._id || msg.createdAt} className="flex justify-center my-4">
                                    <div className="bg-white border-2 border-emerald-100 rounded-xl p-3 w-4/5 shadow-sm text-center">
                                        <div className="flex justify-center mb-1"><Phone size={20} className="text-emerald-500" /></div>
                                        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Contact Shared</div>
                                        <p className="text-xs text-slate-500">You shared your contact number with the customer.</p>
                                    </div>
                                </div>
                            );
                        }

                        // Normal text bubble
                        return (
                            <div key={msg._id || msg.createdAt} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border border-slate-200"}`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    <span className={`text-[10px] mt-1 block text-right ${isMe ? "text-indigo-200" : "text-slate-400"}`}>
                                        {formatTime(msg.createdAt)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="bg-white p-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                    <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-100 border-none focus:ring-0 rounded-full px-4 py-2.5 text-sm outline-none"
                    />
                    <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};
