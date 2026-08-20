import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, ChevronDown, Sparkles, Crop, ZoomIn, ZoomOut, Check, RotateCw, MessageSquare, ChevronRight, History } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { useAuth } from '@core/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Helper to compress camera/large photos before upload
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
                        if (!blob) {
                            resolve(file);
                            return;
                        }
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

    // Crop state
    const [isCropping, setIsCropping] = useState(false);
    const [rawImageSrc, setRawImageSrc] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const cropContainerRef = useRef(null);
    const cropImgRef = useRef(null);

    useEffect(() => {
        if (isOpen && city.length > 2) {
            fetchSellers();
        }
    }, [city, isOpen]);

    const fetchSellers = async () => {
        try {
            const res = await axiosInstance.get(`/photo-orders/sellers?city=${city}`);
            setSellers(res.data.result || res.data.results || []);
        } catch (error) {
            console.error("Failed to fetch sellers:", error);
        }
    };

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

    // Crop dragging
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
        setCropOffset({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleApplyCrop = async () => {
        if (!cropContainerRef.current || !cropImgRef.current) return;
        
        try {
            const container = cropContainerRef.current.getBoundingClientRect();
            const img = cropImgRef.current;

            const canvas = document.createElement('canvas');
            const targetWidth = 800;
            const targetHeight = 800;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
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
                    const croppedFile = new File([blob], `order_photo_${Date.now()}.jpg`, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
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

    const handleCancelCrop = () => {
        setIsCropping(false);
        setRawImageSrc(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Check if user is logged in
        if (!isAuthenticated || !user) {
            toast.error("Please login first to send photo order!");
            onClose();
            navigate('/login');
            return;
        }

        if (!file && !notes.trim()) return toast.error("Please provide an image or write an enquiry");
        if (!selectedSellerId) return toast.error("Please select a seller");

        try {
            setIsSubmitting(true);
            
            let photoUrl = "";
            if (file) {
                if (file.size > 10 * 1024 * 1024) {
                    toast.error("Photo size bahut badi hai (Max 10MB)! Kripya choti photo upload karein.");
                    setIsSubmitting(false);
                    return;
                }

                setIsUploading(true);
                const formData = new FormData();
                formData.append('file', file);
                
                const uploadRes = await axiosInstance.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                photoUrl = uploadRes.data.result.url;
                setIsUploading(false);
            }

            await axiosInstance.post('/photo-orders', {
                sellerId: selectedSellerId,
                photoUrl,
                notes,
                city
            });

            toast.success("Enquiry/Order sent to seller!");
            setIsSubmitting(false);
            setIsUploading(false);
            onClose();
            // Reset
            setFile(null);
            setFilePreview('');
            setCity('');
            setSelectedSellerId('');
            setNotes('');
            // Direct navigate to orders page photo tab
            navigate('/orders?tab=photo');
        } catch (error) {
            setIsUploading(false);
            setIsSubmitting(false);

            const status = error.response?.status;
            if (status === 401 || status === 403) {
                toast.error("Please login first!");
                onClose();
                navigate('/login');
            } else if (error.response?.data?.message?.includes("file size") || error.response?.data?.message?.includes("File too large")) {
                toast.error("Photo size bahut badi hai! Kripya choti photo select karein.");
            } else {
                toast.error(error.response?.data?.message || "Order bhejne me samasya aayi. Kripya punah prayas karein.");
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in duration-200">
                
                {/* Image Cropper View */}
                {isCropping && rawImageSrc ? (
                    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
                        <div className="p-4 flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Crop size={18} className="text-brand-400" />
                                <span className="font-semibold text-sm">Crop & Adjust Photo</span>
                            </div>
                            <button onClick={handleCancelCrop} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Crop Area */}
                        <div 
                            className="relative w-full h-72 bg-black flex items-center justify-center overflow-hidden cursor-move touch-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                        >
                            <img
                                ref={cropImgRef}
                                src={rawImageSrc}
                                alt="Crop target"
                                style={{
                                    transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${zoom})`,
                                    maxWidth: 'none',
                                    maxHeight: 'none',
                                    userSelect: 'none',
                                    pointerEvents: 'none',
                                }}
                                className="transition-transform duration-75"
                            />
                            {/* Visual Crop Frame */}
                            <div 
                                ref={cropContainerRef}
                                className="absolute pointer-events-none w-56 h-56 border-2 border-dashed border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                            />
                        </div>

                        {/* Controls */}
                        <div className="p-4 bg-slate-950 space-y-4">
                            <div className="flex items-center gap-3">
                                <ZoomOut size={16} className="text-slate-400" />
                                <input
                                    type="range"
                                    min="0.8"
                                    max="3"
                                    step="0.05"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <ZoomIn size={16} className="text-slate-400" />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCancelCrop}
                                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyCrop}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                                >
                                    <Check size={16} /> Apply Crop
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Main Form */
                    <>
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Camera size={18} className="text-brand-600" />
                                Custom Photo Order
                            </h3>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X size={18} />
                            </button>
                        </div>

                        {/* 2 Options Bar */}
                        <div className="flex border-b border-slate-200 bg-white">
                            <button
                                type="button"
                                className="flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 border-brand-600 text-brand-600 flex items-center justify-center gap-1.5 bg-brand-50/50"
                            >
                                <Camera size={16} /> 1. Send New Photo
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    navigate('/orders?tab=photo');
                                }}
                                className="flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center gap-1.5 transition-all group"
                            >
                                <MessageSquare size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                                <span>2. My Orders & Chats</span>
                                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Shortcut card to My Orders */}
                            <div 
                                onClick={() => {
                                    onClose();
                                    navigate('/orders?tab=photo');
                                }}
                                className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all shadow-sm group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                        <History size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Track Previous Photo Orders</p>
                                        <p className="text-[11px] text-slate-500 font-medium">Check seller replies, quotes & chat</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 flex items-center group-hover:translate-x-1 transition-transform">
                                    View Orders <ChevronRight size={14} />
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your City</label>
                                <input 
                                    type="text" 
                                    placeholder="Type your city to find sellers..." 
                                    value={city} 
                                    onChange={(e) => setCity(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors"
                                />
                            </div>
                            
                            {city.length > 2 && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Seller</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsOpenDropdown(!isOpenDropdown)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors text-left flex items-center justify-between font-semibold text-slate-700"
                                        >
                                            <span>
                                                {selectedSellerId 
                                                    ? `${sellers.find(s => s._id === selectedSellerId)?.name || 'Seller'} (${sellers.find(s => s._id === selectedSellerId)?.shopName || 'Store'})` 
                                                    : '-- Choose a seller --'
                                                }
                                            </span>
                                            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpenDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isOpenDropdown && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                <div 
                                                    onClick={() => {
                                                        setSelectedSellerId('');
                                                        setIsOpenDropdown(false);
                                                    }}
                                                    className="px-4 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-400 cursor-pointer transition-colors"
                                                >
                                                    -- Choose a seller --
                                                </div>
                                                {sellers.length === 0 ? (
                                                    <div className="px-4 py-3 text-xs font-semibold text-slate-400 text-center">
                                                        No enabled sellers found in this city
                                                    </div>
                                                ) : (
                                                    sellers.map(s => (
                                                        <div
                                                            key={s._id}
                                                            onClick={() => {
                                                                setSelectedSellerId(s._id);
                                                                setIsOpenDropdown(false);
                                                            }}
                                                            className="px-4 py-2.5 hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer border-t border-slate-50 transition-colors flex items-center justify-between"
                                                        >
                                                            <span>{s.name}</span>
                                                            <span className="text-xs text-slate-400 font-normal">({s.shopName || 'Store'})</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload Photo (Optional)</label>
                                {filePreview ? (
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center gap-3">
                                        <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-slate-800 truncate">{file?.name}</div>
                                            <div className="text-[11px] text-green-600 font-medium">Ready & Cropped</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFile(null);
                                                setFilePreview('');
                                            }}
                                            className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center relative bg-slate-50 hover:bg-slate-100 transition-colors">
                                        <Camera size={24} className="text-slate-400 mb-2" />
                                        <span className="text-sm font-medium text-slate-600">Tap to select or capture image</span>
                                        <span className="text-[11px] text-slate-400 mt-0.5">Crop & zoom available on select</span>
                                        <input 
                                            type="file" 
                                            accept="image/*, .jpg, .jpeg, .png, .webp, .heic, .heif"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">General Enquiry / Notes {file ? '(Optional)' : '(Required if no photo)'}</label>
                                <textarea 
                                    rows="2"
                                    placeholder="Type your general enquiry, list of items, or specific instructions..." 
                                    value={notes} 
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors resize-none"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting || (!file && !notes.trim()) || !selectedSellerId}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Camera size={18} />
                                )}
                                {isUploading ? "Uploading Image..." : "Send Request"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
export default CustomPhotoOrderModal;

