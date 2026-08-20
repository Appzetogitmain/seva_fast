import React, { useState, useEffect, useRef } from 'react';
import {
    Camera, X, ChevronDown, Sparkles, Crop, ZoomIn, ZoomOut,
    Check, MessageSquare, ChevronRight, History, Upload,
    MapPin, Store, FileText, Send, ImagePlus, Trash2
} from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { useAuth } from '@core/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/* ─── image compression helper ─── */
const compressImage = async (file, maxWidth = 1280, maxHeight = 1280, quality = 0.8) => {
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) { resolve(file); return; }
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
};

/* ════════════════════════════════════════════════════════════ */

export const CustomPhotoOrderModal = ({ isOpen, onClose }) => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState('');
    const [city, setCity] = useState('');
    const [sellers, setSellers] = useState([]);
    const [selectedSellerId, setSelectedSellerId] = useState('');
    const [isOpenDropdown, setIsOpenDropdown] = useState(false);
    const [notes, setNotes] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /* crop state */
    const [isCropping, setIsCropping] = useState(false);
    const [rawImageSrc, setRawImageSrc] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const cropContainerRef = useRef(null);
    const cropImgRef = useRef(null);

    useEffect(() => {
        if (isOpen && city.length > 2) fetchSellers();
    }, [city, isOpen]);

    const fetchSellers = async () => {
        try {
            const res = await axiosInstance.get(`/photo-orders/sellers?city=${city}`);
            setSellers(res.data.result || res.data.results || []);
        } catch (error) {
            console.error("Failed to fetch sellers:", error);
        }
    };

    /* ─── file & crop handlers ─── */
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.size > 25 * 1024 * 1024) {
                toast.error("Photo size bahut badi hai! Kripya choti photo upload karein.");
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                setRawImageSrc(reader.result);
                setZoom(1);
                setCropOffset({ x: 0, y: 0 });
                setIsCropping(true);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
        setDragStart({ x: clientX - cropOffset.x, y: clientY - cropOffset.y });
    };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
        setCropOffset({ x: clientX - dragStart.x, y: clientY - dragStart.y });
    };
    const handleMouseUp = () => setIsDragging(false);

    const handleApplyCrop = async () => {
        if (!cropContainerRef.current || !cropImgRef.current) return;
        try {
            const container = cropContainerRef.current.getBoundingClientRect();
            const img = cropImgRef.current;
            const canvas = document.createElement('canvas');
            const targetWidth = 800, targetHeight = 800;
            canvas.width = targetWidth; canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            const renderedImgRect = img.getBoundingClientRect();
            const scaleX = img.naturalWidth / renderedImgRect.width;
            const scaleY = img.naturalHeight / renderedImgRect.height;
            const sx = (container.left - renderedImgRect.left) * scaleX;
            const sy = (container.top - renderedImgRect.top) * scaleY;
            const sWidth = container.width * scaleX;
            const sHeight = container.height * scaleY;
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const croppedFile = new File([blob], `order_photo_${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
                    const compressed = await compressImage(croppedFile);
                    setFile(compressed);
                    setFilePreview(URL.createObjectURL(compressed));
                    setIsCropping(false);
                    toast.success("Photo cropped successfully!");
                }
            }, 'image/jpeg', 0.85);
        } catch (err) {
            console.error("Crop error:", err);
            toast.error("Failed to crop image");
            setIsCropping(false);
        }
    };
    const handleCancelCrop = () => { setIsCropping(false); setRawImageSrc(null); };

    /* ─── submit ─── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isAuthenticated || !user) { toast.error("Please login first to send photo order!"); onClose(); navigate('/login'); return; }
        if (!file && !notes.trim()) return toast.error("Please provide an image or write an enquiry");
        if (!selectedSellerId) return toast.error("Please select a seller");

        try {
            setIsSubmitting(true);
            let photoUrl = "";
            if (file) {
                if (file.size > 10 * 1024 * 1024) { toast.error("Photo size bahut badi hai (Max 10MB)!"); setIsSubmitting(false); return; }
                setIsUploading(true);
                const formData = new FormData();
                formData.append('file', file);
                const uploadRes = await axiosInstance.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                photoUrl = uploadRes.data.result.url;
                setIsUploading(false);
            }
            await axiosInstance.post('/photo-orders', { sellerId: selectedSellerId, photoUrl, notes, city });
            toast.success("Enquiry/Order sent to seller!");
            setIsSubmitting(false); setIsUploading(false); onClose();
            setFile(null); setFilePreview(''); setCity(''); setSelectedSellerId(''); setNotes('');
            navigate('/orders?tab=photo');
        } catch (error) {
            setIsUploading(false); setIsSubmitting(false);
            const status = error.response?.status;
            if (status === 401 || status === 403) { toast.error("Please login first!"); onClose(); navigate('/login'); }
            else if (error.response?.data?.message?.includes("file size") || error.response?.data?.message?.includes("File too large")) {
                toast.error("Photo size bahut badi hai! Kripya choti photo select karein.");
            } else { toast.error(error.response?.data?.message || "Order bhejne me samasya aayi. Kripya punah prayas karein."); }
        }
    };

    if (!isOpen) return null;

    const selectedSeller = sellers.find(s => s._id === selectedSellerId);

    /* ─────────── CROP VIEW ─────────── */
    if (isCropping && rawImageSrc) {
        return (
            <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
                <div className="bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="p-4 flex items-center justify-between border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                <Crop size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-white">Crop & Adjust</p>
                                <p className="text-[10px] text-slate-400">Drag to reposition • Zoom to resize</p>
                            </div>
                        </div>
                        <button onClick={handleCancelCrop} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div
                        className="relative w-full h-72 bg-black flex items-center justify-center overflow-hidden cursor-move touch-none"
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
                    >
                        <img ref={cropImgRef} src={rawImageSrc} alt="Crop target"
                            style={{ transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${zoom})`, maxWidth: 'none', maxHeight: 'none', userSelect: 'none', pointerEvents: 'none' }}
                            className="transition-transform duration-75"
                        />
                        <div ref={cropContainerRef}
                            className="absolute pointer-events-none w-56 h-56 border-2 border-dashed border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                        />
                    </div>

                    <div className="p-4 bg-slate-950/80 space-y-4">
                        <div className="flex items-center gap-3">
                            <ZoomOut size={16} className="text-slate-400 shrink-0" />
                            <input type="range" min="0.8" max="3" step="0.05" value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <ZoomIn size={16} className="text-slate-400 shrink-0" />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={handleCancelCrop}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={handleApplyCrop}
                                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all">
                                <Check size={16} /> Apply Crop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ─────────── MAIN FORM VIEW ─────────── */
    return (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[92vh]">

                {/* ── Gradient Header ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-5 py-4">
                    {/* decorative circles */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-sm" />
                    <div className="absolute -left-4 -bottom-8 w-20 h-20 rounded-full bg-white/5" />

                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                                <Camera size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base tracking-tight">Custom Photo Order</h3>
                                <p className="text-[11px] text-indigo-200 font-medium">Send enquiry with photo to any seller</p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white/80 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ── Track Orders Banner ── */}
                <div
                    onClick={() => { onClose(); navigate('/orders?tab=photo'); }}
                    className="mx-4 mt-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/70 rounded-xl px-3.5 py-3 flex items-center gap-3 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all group active:scale-[0.98]"
                >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-200">
                        <History size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 leading-tight">Track Previous Orders</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">View replies, quotes & chat with sellers</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                        <span className="text-[11px] font-bold hidden sm:inline">View</span>
                        <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>

                {/* ── Form Body ── */}
                <form onSubmit={handleSubmit} className="px-4 pt-4 pb-5 space-y-4 overflow-y-auto flex-1">

                    {/* City Input */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <MapPin size={12} className="text-indigo-500" />
                            Your City
                        </label>
                        <input
                            type="text"
                            placeholder="Type your city to find sellers..."
                            value={city}
                            onChange={(e) => setCity(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                        />
                    </div>

                    {/* Seller Dropdown */}
                    {city.length > 2 && (
                        <div className="space-y-1.5 relative">
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <Store size={12} className="text-indigo-500" />
                                Select Seller
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsOpenDropdown(!isOpenDropdown)}
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm outline-none transition-all text-left flex items-center justify-between font-semibold ${
                                    isOpenDropdown ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                                } ${selectedSellerId ? 'text-slate-800' : 'text-slate-400'}`}
                            >
                                <span className="truncate">
                                    {selectedSeller
                                        ? `${selectedSeller.name} — ${selectedSeller.shopName || 'Store'}`
                                        : '— Choose a seller —'}
                                </span>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${isOpenDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {isOpenDropdown && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150">
                                    <div onClick={() => { setSelectedSellerId(''); setIsOpenDropdown(false); }}
                                        className="px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-400 cursor-pointer transition-colors">
                                        — Choose a seller —
                                    </div>
                                    {sellers.length === 0 ? (
                                        <div className="px-4 py-4 text-center">
                                            <Store size={20} className="text-slate-300 mx-auto mb-1.5" />
                                            <p className="text-xs font-semibold text-slate-400">No sellers found in this city</p>
                                        </div>
                                    ) : (
                                        sellers.map(s => (
                                            <div key={s._id}
                                                onClick={() => { setSelectedSellerId(s._id); setIsOpenDropdown(false); }}
                                                className={`px-4 py-2.5 hover:bg-indigo-50 text-sm cursor-pointer border-t border-slate-50 transition-colors flex items-center justify-between gap-2 ${selectedSellerId === s._id ? 'bg-indigo-50' : ''}`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-black">
                                                        {(s.name || 'S')[0].toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{s.shopName || 'Store'}</p>
                                                    </div>
                                                </div>
                                                {selectedSellerId === s._id && (
                                                    <Check size={16} className="text-indigo-600 shrink-0" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload Photo */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <ImagePlus size={12} className="text-indigo-500" />
                            Upload Photo <span className="normal-case font-medium text-slate-400">(Optional)</span>
                        </label>

                        {filePreview ? (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center gap-3 p-3">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-sm">
                                        <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{file?.name}</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[11px] text-emerald-600 font-semibold">Ready & Cropped</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {file ? `${(file.size / 1024).toFixed(0)} KB` : ''}
                                        </p>
                                    </div>
                                    <button type="button"
                                        onClick={() => { setFile(null); setFilePreview(''); }}
                                        className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center bg-gradient-to-b from-slate-50 to-white hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group cursor-pointer">
                                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                                    <Upload size={22} />
                                </div>
                                <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">
                                    Tap to select or capture
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    JPG, PNG, WEBP • Max 25 MB • Crop & zoom included
                                </p>
                                <input
                                    type="file"
                                    accept="image/*, .jpg, .jpeg, .png, .webp, .heic, .heif"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        )}
                    </div>

                    {/* Notes / Enquiry */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <FileText size={12} className="text-indigo-500" />
                            Enquiry / Notes
                            <span className="normal-case font-medium text-slate-400">
                                {file ? '(Optional)' : '(Required if no photo)'}
                            </span>
                        </label>
                        <textarea
                            rows="3"
                            placeholder="Describe your requirements, list items, or special instructions..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || (!file && !notes.trim()) || !selectedSellerId}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] hover:bg-right text-white font-bold rounded-xl shadow-lg shadow-indigo-200/50 transition-all duration-500 active:scale-[0.97] flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:shadow-none disabled:active:scale-100 text-sm"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                        {isUploading ? "Uploading Photo..." : isSubmitting ? "Sending..." : "Send Request to Seller"}
                    </button>
                </form>
            </div>
        </div>
    );
};
export default CustomPhotoOrderModal;
