import React from 'react';
import { Camera, X, ChevronDown, Sparkles } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';

export const CustomPhotoOrderModal = ({ isOpen, onClose }) => {
    const [file, setFile] = React.useState(null);
    const [city, setCity] = React.useState('');
    const [sellers, setSellers] = React.useState([]);
    const [selectedSellerId, setSelectedSellerId] = React.useState('');
    const [isOpenDropdown, setIsOpenDropdown] = React.useState(false);
    const [notes, setNotes] = React.useState('');
    const [isUploading, setIsUploading] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
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
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file && !notes.trim()) return toast.error("Please provide an image or write an enquiry");
        if (!selectedSellerId) return toast.error("Please select a seller");

        try {
            setIsSubmitting(true);
            
            let photoUrl = "";
            if (file) {
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
            onClose();
            // Reset
            setFile(null);
            setCity('');
            setSelectedSellerId('');
            setNotes('');
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send photo order");
            setIsUploading(false);
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Camera size={18} className="text-brand-600" />
                        Send Enquiry / Photo
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
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
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center relative bg-slate-50 hover:bg-slate-100 transition-colors">
                            {file ? (
                                <div className="text-sm font-semibold text-brand-600 flex items-center gap-2">
                                    <Sparkles size={16} /> Selected: {file.name}
                                </div>
                            ) : (
                                <>
                                    <Camera size={24} className="text-slate-400 mb-2" />
                                    <span className="text-sm font-medium text-slate-600">Tap to select an image</span>
                                </>
                            )}
                            <input 
                                type="file" 
                                accept="image/*, .jpg, .jpeg, .png, .webp, .heic, .heif"
                                capture="environment"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
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
            </div>
        </div>
    );
};
export default CustomPhotoOrderModal;
