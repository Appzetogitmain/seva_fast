import React, { useState, useEffect, useRef } from "react";
import { X, Send, Phone, FileText, IndianRupee } from "lucide-react";
import axiosInstance from "@core/api/axios";
import { useAuth } from "@core/context/AuthContext";
import { joinPhotoChatRoom, leavePhotoChatRoom, onPhotoChatMessage } from "@core/services/orderSocket";
import { toast } from "sonner";
import { formatTime } from "@shared/utils/formatDate";
import { FaWhatsapp } from "react-icons/fa";

export const PhotoOrderChatSheet = ({ isOpen, onClose, order }) => {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !order) return;

        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const res = await axiosInstance.get(`/photo-orders/${order._id}/chat`);
                setMessages(res.data.result || res.data.results || []);
            } catch (err) {
                toast.error("Failed to load chat messages");
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();

        // Socket setup with authenticated token
        const getToken = () => token || localStorage.getItem('auth_customer');
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
        };
    }, [isOpen, order, token]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const textToSend = newMessage.trim();
        if (!textToSend) return;

        try {
            setNewMessage("");
            const res = await axiosInstance.post(`/photo-orders/${order._id}/chat`, {
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
            setNewMessage(textToSend); // restore on error
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 z-[600] w-full sm:w-96 bg-slate-50 shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                <div>
                    <h3 className="font-bold text-slate-800">{order?.seller?.shopName || "Seller"}</h3>
                    <p className="text-xs text-slate-500 font-medium">Order #{order?._id?.slice(-6)}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {/* Initial Context Message */}
                <div className="flex flex-col items-center mb-6">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full">Your Request</span>
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
                        const isMe = msg.senderRole === "customer" || (user && (msg.senderId === user._id || msg.senderId === user.id));
                        
                        // Special cards (Only shown when seller explicitly sends them)
                        if (msg.type === "reply_card") {
                            return (
                                <div key={msg._id || msg.createdAt} className="flex justify-center my-4">
                                    <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 w-11/12 shadow-sm text-center relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                                        <div className="flex justify-center mb-2"><FileText size={24} className="text-indigo-500" /></div>
                                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Seller Quote</div>
                                        <p className="text-sm text-slate-700 mb-3">{msg.text}</p>
                                        {msg.estimatedPrice && (
                                            <div className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                                                Estimated Price: <IndianRupee size={14} /> {msg.estimatedPrice}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        if (msg.type === "contact_card" && msg.sellerContactPhone) {
                            return (
                                <div key={msg._id || msg.createdAt} className="flex justify-center my-4">
                                    <div className="bg-white border-2 border-emerald-100 rounded-xl p-4 w-11/12 shadow-sm text-center relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                                        <div className="flex justify-center mb-2"><Phone size={24} className="text-emerald-500" /></div>
                                        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Seller Contact Info</div>
                                        <p className="text-xs text-slate-500 mb-4">The seller has shared their contact information with you.</p>
                                        
                                        <div className="flex gap-2 justify-center">
                                            <a 
                                                href={`tel:${msg.sellerContactPhone}`}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold transition-colors border border-emerald-200"
                                            >
                                                <Phone size={16} /> Call
                                            </a>
                                            <a 
                                                href={`https://wa.me/91${msg.sellerContactPhone}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-sm font-semibold transition-colors border border-green-200"
                                            >
                                                <FaWhatsapp size={16} /> WhatsApp
                                            </a>
                                        </div>
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
