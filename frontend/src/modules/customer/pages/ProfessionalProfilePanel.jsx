import React, { useState, useEffect } from 'react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import {
    Briefcase,
    Loader2,
    Sparkles,
    CheckCircle2,
    XCircle,
    Clock,
    Plus,
    Trash2,
    DollarSign,
    MapPin,
    Calendar,
    Phone,
    Mail,
    AlertCircle,
    User,
    ChevronRight,
    Edit2,
    X,
    Upload
} from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { formatDate } from '@shared/utils/formatDate';

const ProfessionalProfilePanel = () => {
    const { showToast } = useToast();
    const { settings } = useSettings();
    const [isLoading, setIsLoading] = useState(true);
    const [ad, setAd] = useState(null);
    const [categories, setCategories] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);

    // Form registration state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [profession, setProfession] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [categoryIds, setCategoryIds] = useState([]);
    const [experienceYears, setExperienceYears] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [lat, setLat] = useState('22.7196'); // Default Indore coordinates
    const [lng, setLng] = useState('75.8577');
    const [isLocating, setIsLocating] = useState(false);

    // Profile edit state
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editProfession, setEditProfession] = useState('');
    const [editExperienceYears, setEditExperienceYears] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editLat, setEditLat] = useState('22.7196');
    const [editLng, setEditLng] = useState('75.8577');

    // Navigation and tab states
    const [activeTab, setActiveTab] = useState('directory'); // 'directory' or 'banners'
    
    // Platform Ads (Banners) State
    const [platformAds, setPlatformAds] = useState([]);
    const [isSubmittingPlatformAd, setIsSubmittingPlatformAd] = useState(false);
    const [platTitle, setPlatTitle] = useState('');
    const [platContent, setPlatContent] = useState('');
    const [platMediaUrl, setPlatMediaUrl] = useState('');
    const [platMediaType, setPlatMediaType] = useState('none');
    const [platImageUrl, setPlatImageUrl] = useState('');
    const [platVideoUrl, setPlatVideoUrl] = useState('');
    const [activeMediaTab, setActiveMediaTab] = useState('image'); // 'image' or 'video'
    const [platTargetUrl, setPlatTargetUrl] = useState('');
    const [platCity, setPlatCity] = useState('');
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);

    // Categories edit state
    const [isEditingCategories, setIsEditingCategories] = useState(false);
    const [editCategoryIds, setEditCategoryIds] = useState([]);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

    // Catalog edit state
    const [isEditingCatalog, setIsEditingCatalog] = useState(false);
    const [servicesList, setServicesList] = useState([]);
    const [newServiceName, setNewServiceName] = useState('');
    const [newServicePrice, setNewServicePrice] = useState('');
    const [newServiceDesc, setNewServiceDesc] = useState('');

    const loadPlatformAds = async () => {
        try {
            const res = await customerApi.getMyPlatformAds();
            if (res.data?.success) {
                setPlatformAds(res.data.result || res.data.results || []);
            }
        } catch (error) {
            console.error("Failed to load platform ads", error);
        }
    };

    const loadProfile = async () => {
        try {
            setIsLoading(true);
            // Fetch categories first
            const catRes = await customerApi.getProfessionalCategories();
            if (catRes.data?.success) {
                setCategories(catRes.data.result || catRes.data.results || []);
            }

            // Fetch wallet balance from profile
            const profileRes = await customerApi.getProfile();
            if (profileRes.data?.success) {
                setWalletBalance(profileRes.data.result?.walletBalance || 0);
            }

            // Fetch ad profile
            const adRes = await customerApi.getProfessionalProfile();
            if (adRes.data?.success) {
                const profile = adRes.data.result;
                setAd(profile);
                if (profile) {
                    setServicesList(profile.services || []);
                }
            }
        } catch (error) {
            if (error.response?.status === 404) {
                // No profile created yet
                setAd(null);
            } else {
                console.error("Failed to load professional profile", error);
                showToast("Failed to load profile details", "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
        loadPlatformAds();
    }, []);

    useEffect(() => {
        if (isEditingCategories || isConfirmingPayment || isEditingProfile || isSubmittingPlatformAd) {
            document.body.style.overflow = 'hidden';
            const navbars = document.querySelectorAll('.fixed.bottom-0');
            navbars.forEach(nav => {
                nav.style.setProperty('display', 'none', 'important');
            });
        } else {
            document.body.style.overflow = '';
            const navbars = document.querySelectorAll('.fixed.bottom-0');
            navbars.forEach(nav => {
                nav.style.removeProperty('display');
            });
        }
        return () => {
            document.body.style.overflow = '';
            const navbars = document.querySelectorAll('.fixed.bottom-0');
            navbars.forEach(nav => {
                nav.style.removeProperty('display');
            });
        };
    }, [isEditingCategories, isConfirmingPayment, isEditingProfile, isSubmittingPlatformAd]);

    const handleUploadMediaFile = async (e, targetSetUrl, targetSetType) => {
        const file = e.target.files[0];
        if (!file) return;

        const type = file.type.startsWith('video/') ? 'video' : 'image';

        try {
            setIsUploadingMedia(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await customerApi.uploadMedia(formData);
            if (res.data?.success && (res.data.result?.secureUrl || res.data.result?.url)) {
                targetSetUrl(res.data.result.secureUrl || res.data.result.url);
                targetSetType(type);
                showToast('Media uploaded successfully', 'success');
            } else if (res.data?.secureUrl || res.data?.url) {
                targetSetUrl(res.data.secureUrl || res.data.url);
                targetSetType(type);
                showToast('Media uploaded successfully', 'success');
            } else {
                showToast('Failed to upload media', 'error');
            }
        } catch (error) {
            console.error("Media upload error:", error, error.response?.data);
            showToast(error.response?.data?.message || 'Error uploading media file', 'error');
        } finally {
            setIsUploadingMedia(false);
        }
    };

    const handleOpenEditProfile = () => {
        if (!ad) return;
        setEditName(ad.name || '');
        setEditPhone(ad.phone || '');
        setEditEmail(ad.email || '');
        setEditProfession(ad.profession || '');
        setEditExperienceYears(ad.experienceYears || '0');
        setEditDescription(ad.description || '');
        setEditAddress(ad.address || '');
        setEditCity(ad.city || '');
        setEditLat(ad.location?.coordinates?.[1] || '22.7196');
        setEditLng(ad.location?.coordinates?.[0] || '75.8577');
        setIsEditingProfile(true);
    };

    const handleUpdateProfileSubmit = async (e) => {
        e.preventDefault();
        if (!editName || !editPhone || !editProfession || !editDescription || !editAddress || !editCity) {
            return showToast("Please fill all required fields", "error");
        }
        if (editPhone.length !== 10) {
            return showToast("Phone number must be exactly 10 digits", "error");
        }
        try {
            setIsLoading(true);
            const payload = {
                name: editName,
                phone: editPhone,
                email: editEmail,
                profession: editProfession,
                experienceYears: Number(editExperienceYears) || 0,
                description: editDescription,
                address: editAddress,
                city: editCity,
                lat: parseFloat(editLat) || 22.7196,
                lng: parseFloat(editLng) || 75.8577
            };
            const res = await customerApi.updateProfessionalProfile(payload);
            if (res.data?.success) {
                showToast("Profile details updated successfully! Your listing is pending admin moderation.", "success");
                setIsEditingProfile(false);
                loadProfile();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to update profile", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoDetectLocation = () => {
        if (!navigator.geolocation) {
            return showToast("Geolocation is not supported by your browser", "error");
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLat(position.coords.latitude.toFixed(6));
                setLng(position.coords.longitude.toFixed(6));
                setIsLocating(false);
                showToast("Coordinates detected successfully!", "success");
            },
            (error) => {
                console.error("Geolocation error:", error);
                setIsLocating(false);
                showToast("Failed to detect location. Please type manually or enable location access.", "error");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const finalCategoryIds = categoryIds.length > 0 ? categoryIds : (categoryId ? [categoryId] : []);
        if (!name || !phone || !profession || finalCategoryIds.length === 0 || !description || !address || !city) {
            return showToast("Please fill all required fields and select at least one category", "error");
        }
        if (phone.length !== 10) {
            return showToast("Phone number must be exactly 10 digits", "error");
        }
        try {
            setIsLoading(true);
            const payload = {
                name,
                phone,
                email,
                profession,
                categoryId: finalCategoryIds[0],
                categoryIds: finalCategoryIds,
                experienceYears: Number(experienceYears) || 0,
                description,
                address,
                city,
                lat: parseFloat(lat) || 22.7196,
                lng: parseFloat(lng) || 75.8577
            };
            const res = await customerApi.createProfessionalProfile(payload);
            if (res.data?.success) {
                showToast("Professional profile registered successfully!", "success");
                loadProfile();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Registration failed", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitPlatformAd = async (e) => {
        e.preventDefault();
        if (!platTitle.trim() || !platContent.trim() || !platCity.trim()) {
            return showToast("Title, Description, and City are required", "error");
        }
        try {
            setIsLoading(true);
            const payload = {
                title: platTitle,
                content: platContent,
                mediaUrl: platVideoUrl || platImageUrl || '',
                mediaType: platVideoUrl ? 'video' : (platImageUrl ? 'image' : 'none'),
                imageUrl: platImageUrl,
                videoUrl: platVideoUrl,
                targetUrl: platTargetUrl,
                city: platCity
            };
            const res = await customerApi.createPlatformAd(payload);
            if (res.data?.success) {
                const newAd = res.data.result;
                setIsSubmittingPlatformAd(false);
                setPlatTitle('');
                setPlatContent('');
                setPlatMediaUrl('');
                setPlatMediaType('none');
                setPlatImageUrl('');
                setPlatVideoUrl('');
                setPlatTargetUrl('');
                setPlatCity('');
                
                // Trigger Razorpay payment flow immediately
                await handlePayPlatformAd(newAd);
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to submit request", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayPlatformAd = async (adItem) => {
        const id = typeof adItem === 'string' ? adItem : adItem?._id;
        const price = typeof adItem === 'object' 
            ? (adItem.price || settings?.platformAdListingFee || 999) 
            : (settings?.platformAdListingFee || 999);

        try {
            setIsLoading(true);
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                showToast("Failed to load Razorpay SDK. Check your internet connection.", "error");
                return;
            }

            const initRes = await customerApi.initiatePayPlatformAd(id);
            if (!initRes.data?.success) {
                showToast(initRes.data?.message || "Failed to initiate payment", "error");
                return;
            }

            const { orderId, amount, keyId } = initRes.data.result;

            const options = {
                key: keyId,
                amount: amount,
                currency: "INR",
                name: "Seva Fast",
                description: `Platform Banner Ad Subscription Fee`,
                order_id: orderId,
                handler: async (response) => {
                    try {
                        setIsLoading(true);
                        const verifyRes = await customerApi.verifyPayPlatformAd(id, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        if (verifyRes.data?.success) {
                            showToast("Payment successful! Banner ad request submitted for admin review.", "success");
                            loadPlatformAds();
                        } else {
                            showToast(verifyRes.data?.message || "Payment verification failed", "error");
                        }
                    } catch (err) {
                        showToast(err.response?.data?.message || "Verification request failed", "error");
                    } finally {
                        setIsLoading(false);
                    }
                },
                prefill: {
                    name: ad?.name || "",
                    email: ad?.email || "",
                    contact: ad?.phone || ""
                },
                theme: {
                    color: "#000000"
                },
                modal: {
                    ondismiss: () => {
                        showToast("Payment cancelled. Complete payment from dashboard to submit.", "info");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            showToast(error.response?.data?.message || "Payment initiation failed", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const getListingPriceToShow = () => {
        const defaultFee = settings?.professionalAdListingFee ?? 499;

        if (!ad) {
            // New registration preview
            const selectedCats = categories.filter(c => categoryIds.includes(c._id));
            const paidCats = selectedCats.filter(c => c.priceType === 'paid');
            if (paidCats.length === 0) return 0;
            return paidCats.reduce((sum, c) => sum + (c.price ?? defaultFee), 0);
        }
        const targetCategories = ad.categories && ad.categories.length > 0 ? ad.categories : (ad.category ? [ad.category] : []);
        if (targetCategories.length === 0) return defaultFee;

        const hasPaidCategory = targetCategories.some(cat => {
            const resolved = typeof cat === 'string' ? categories.find(c => c._id === cat) : cat;
            return resolved?.priceType === 'paid';
        });
        if (!hasPaidCategory) return 0;

        const paidCategories = targetCategories.filter(cat => {
            const resolved = typeof cat === 'string' ? categories.find(c => c._id === cat) : cat;
            return resolved?.priceType === 'paid';
        });
        const prices = paidCategories.map(cat => {
            const resolved = typeof cat === 'string' ? categories.find(c => c._id === cat) : cat;
            return resolved?.price ?? defaultFee;
        });
        return prices.reduce((sum, val) => sum + val, 0);
    };

    const handleSaveCategories = async () => {
        if (editCategoryIds.length === 0) {
            return showToast("Please select at least one category", "error");
        }
        try {
            setIsLoading(true);
            const res = await customerApi.updateProfessionalProfile({
                categoryIds: editCategoryIds
            });
            if (res.data?.success) {
                showToast("Categories updated successfully! Your ad is pending admin moderation.", "success");
                setIsEditingCategories(false);
                loadProfile();
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to update categories", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePayListing = () => {
        setIsConfirmingPayment(true);
    };

    const executePayment = async () => {
        const fee = getListingPriceToShow();
        if (fee === 0) {
            try {
                setIsLoading(true);
                setIsConfirmingPayment(false);
                const res = await customerApi.payProfessionalProfile();
                if (res.data?.success) {
                    showToast("Listing activation successful!", "success");
                    loadProfile();
                }
            } catch (error) {
                showToast(error.response?.data?.message || "Activation failed", "error");
            } finally {
                setIsLoading(false);
            }
            return;
        }

        try {
            setIsLoading(true);
            setIsConfirmingPayment(false);
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                showToast("Failed to load Razorpay SDK. Check your internet connection.", "error");
                return;
            }

            const initRes = await customerApi.initiatePayProfessionalProfile();
            if (!initRes.data?.success) {
                showToast(initRes.data?.message || "Failed to initiate payment", "error");
                return;
            }

            const { orderId, amount, keyId } = initRes.data.result;

            const options = {
                key: keyId,
                amount: amount,
                currency: "INR",
                name: "Seva Fast",
                description: `Professional Directory Listing Fee`,
                order_id: orderId,
                handler: async (response) => {
                    try {
                        setIsLoading(true);
                        const verifyRes = await customerApi.verifyPayProfessionalProfile({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        if (verifyRes.data?.success) {
                            showToast("Listing payment verified and activated successfully!", "success");
                            loadProfile();
                        } else {
                            showToast(verifyRes.data?.message || "Payment verification failed", "error");
                        }
                    } catch (err) {
                        showToast(err.response?.data?.message || "Verification request failed", "error");
                    } finally {
                        setIsLoading(false);
                    }
                },
                prefill: {
                    name: ad?.name || "",
                    email: ad?.email || "",
                    contact: ad?.phone || ""
                },
                theme: {
                    color: "#000000"
                },
                modal: {
                    ondismiss: () => {
                        showToast("Payment cancelled", "info");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            showToast(error.response?.data?.message || "Payment initiation failed", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddServiceItem = () => {
        if (!newServiceName.trim() || !newServicePrice) {
            return showToast("Service name and price are required", "error");
        }
        const newItem = {
            name: newServiceName.trim(),
            price: parseFloat(newServicePrice) || 0,
            description: newServiceDesc.trim(),
            durationMinutes: 30
        };
        setServicesList([...servicesList, newItem]);
        setNewServiceName('');
        setNewServicePrice('');
        setNewServiceDesc('');
    };

    const handleRemoveServiceItem = (index) => {
        setServicesList(servicesList.filter((_, i) => i !== index));
    };

    const handleSaveCatalog = async () => {
        try {
            setIsLoading(true);
            const res = await customerApi.updateProfessionalServices({ services: servicesList });
            if (res.data?.success) {
                showToast("Service catalog updated and is pending moderation approval.", "success");
                setIsEditingCatalog(false);
                loadProfile();
            }
        } catch (error) {
            showToast("Failed to save services list", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Professional Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-750 pb-20">
            {/* TABS HEADER */}
            <div className="flex border-b border-slate-100 gap-8 mb-8">
                <button
                    onClick={() => setActiveTab('directory')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                        activeTab === 'directory' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Directory Listing
                    {activeTab === 'directory' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full animate-in fade-in" />}
                </button>
                <button
                    onClick={() => setActiveTab('banners')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                        activeTab === 'banners' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Promotional Banners
                    {activeTab === 'banners' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full animate-in fade-in" />}
                </button>
            </div>

            {activeTab === 'directory' && (
                ad ? (
                /* PROFILE DASHBOARD DISPLAY */
                <div className="space-y-8">
                    {/* ALERT BANNER FOR UNPAID / PENDING APPROVAL */}
                    {(ad.paymentStatus !== 'paid' || ad.approvalStatus !== 'approved') && (
                        <div className="bg-amber-50/60 border border-amber-100 p-6 rounded-[32px] flex items-start gap-4 shadow-sm animate-in slide-in-from-top duration-500">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1 flex-1">
                                <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider">
                                    {ad.paymentStatus !== 'paid' && ad.approvalStatus !== 'approved' ? 'Action Required: Complete Listing Setup' :
                                     ad.paymentStatus !== 'paid' ? 'Action Required: Activate Listing' : 'Pending Admin Verification'}
                                </h3>
                                <p className="text-xs text-amber-700 font-bold leading-relaxed">
                                    {ad.paymentStatus !== 'paid' && ad.approvalStatus !== 'approved' ? (
                                        `Your listing is currently unpaid and pending admin verification. Please activate the listing to make it visible to customers.`
                                    ) : ad.paymentStatus !== 'paid' ? (
                                        `Your service categories have been updated. Please pay the listing fee of ₹${getListingPriceToShow()} from your wallet balance to activate your profile.`
                                    ) : (
                                        "Your service profile details are submitted and currently pending admin verification. It will be published in the public directory once approved."
                                    )}
                                </p>
                                {ad.paymentStatus !== 'paid' && (
                                    <button
                                        onClick={handlePayListing}
                                        className="mt-3 px-5 py-2.5 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                    >
                                        {getListingPriceToShow() === 0 ? 'Activate Free Listing' : `Pay ₹${getListingPriceToShow()} Now`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Header profile block */}
                    <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-955">{ad.name}</h1>
                                <span className="px-3 py-1 bg-brand-50 rounded-full text-xs font-black text-brand-600 uppercase tracking-wider">{ad.profession}</span>
                                <button
                                    onClick={handleOpenEditProfile}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-wider rounded-full transition-all border border-slate-100 shadow-sm"
                                >
                                    <Edit2 className="h-3 w-3" /> Edit Profile Details
                                </button>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" /> {ad.city} ({ad.address})</span>
                                <span className="flex items-center gap-1"><Phone className="h-4 w-4 text-slate-400" /> {ad.phone}</span>
                                <span className="flex items-center gap-1"><Calendar className="h-4 w-4 text-slate-400" /> {ad.experienceYears} Yrs Exp</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Categories:</span>
                                {ad.categories && ad.categories.length > 0 ? (
                                    ad.categories.filter(Boolean).map((c) => {
                                        const categoryName = typeof c === 'string'
                                            ? (categories.find(cat => cat._id === c)?.name || c)
                                            : (c.name || c._id);
                                        const keyId = typeof c === 'string' ? c : c._id;
                                        return (
                                            <span key={keyId} className="px-2.5 py-0.5 bg-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                                {categoryName}
                                            </span>
                                        );
                                    })
                                ) : ad.category ? (
                                    <span className="px-2.5 py-0.5 bg-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                        {typeof ad.category === 'string'
                                            ? (categories.find(cat => cat._id === ad.category)?.name || ad.category)
                                            : (ad.category.name || ad.category._id)}
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-400 italic">None</span>
                                )}
                                <button
                                    onClick={() => {
                                        try {
                                            const ids = (ad.categories && ad.categories.length > 0)
                                                ? ad.categories.filter(Boolean).map(c => typeof c === 'string' ? c : (c._id || c.id || c))
                                                : (ad.category ? [typeof ad.category === 'string' ? ad.category : (ad.category._id || ad.category.id)] : []);
                                            setEditCategoryIds(ids);
                                            setIsEditingCategories(true);
                                        } catch (err) {
                                            console.error("Error setting edit categories:", err);
                                            setEditCategoryIds([]);
                                            setIsEditingCategories(true);
                                        }
                                    }}
                                    className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[9px] font-black uppercase tracking-wider rounded-full transition-all border border-brand-100/50 shadow-sm"
                                >
                                    <Plus className="h-3 w-3" /> Add / Edit Service
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-1 bg-slate-50 p-4 rounded-3xl border border-slate-100 w-full md:w-auto min-w-[150px]">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wallet Balance</span>
                            <span className="text-xl font-black text-slate-900">₹{walletBalance}</span>
                        </div>
                    </div>

                    {/* Verification & Subscription Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Approval Status Card */}
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${
                                ad.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                ad.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                                {ad.approvalStatus === 'approved' ? <CheckCircle2 className="h-8 w-8" /> :
                                 ad.approvalStatus === 'rejected' ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Verification Status</span>
                                <h3 className="text-lg font-black text-slate-900 capitalize">{ad.approvalStatus}</h3>
                                {ad.rejectionReason && (
                                    <p className="text-xs font-bold text-rose-500 mt-1">Reason: {ad.rejectionReason}</p>
                                )}
                            </div>
                        </div>

                        {/* Subscription Status Card */}
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-2xl ${
                                    ad.paymentStatus === 'paid' ? 'bg-sky-50 text-sky-600' : 'bg-slate-50 text-slate-400'
                                }`}>
                                    <DollarSign className="h-8 w-8" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ad Subscription Status</span>
                                    <h3 className="text-lg font-black text-slate-900 capitalize">{ad.paymentStatus}</h3>
                                    {ad.expiresAt && ad.paymentStatus === 'paid' && (
                                        <p className="text-xs font-semibold text-slate-400">Expires on: {formatDate(ad.expiresAt)}</p>
                                    )}
                                </div>
                            </div>
                            {ad.paymentStatus !== 'paid' && (
                                <button
                                    onClick={handlePayListing}
                                    className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105"
                                >
                                    {getListingPriceToShow() === 0 ? 'Activate Free Listing' : `Pay ₹${getListingPriceToShow()}`}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Catalog Services Editor */}
                    <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-955">Service Price Catalog</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">Manage individual service task items you offer to customers.</p>
                            </div>
                            {!isEditingCatalog ? (
                                <button
                                    onClick={() => setIsEditingCatalog(true)}
                                    className="w-full sm:w-auto px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit2 className="h-4 w-4" /> Edit List
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={handleSaveCatalog}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingCatalog(false);
                                            setServicesList(ad.services || []);
                                        }}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {isEditingCatalog ? (
                            /* Editing Catalog Inputs */
                            <div className="space-y-6">
                                <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="space-y-1 md:col-span-4">
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Service Title</label>
                                        <input
                                            type="text"
                                            value={newServiceName}
                                            onChange={(e) => setNewServiceName(e.target.value)}
                                            placeholder="e.g. Tap Leak Repair"
                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500/20"
                                        />
                                    </div>
                                    <div className="space-y-1 md:col-span-3">
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pricing (₹)</label>
                                        <input
                                            type="number"
                                            value={newServicePrice}
                                            onChange={(e) => setNewServicePrice(e.target.value)}
                                            placeholder="e.g. 199"
                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500/20"
                                        />
                                    </div>
                                    <div className="space-y-1 md:col-span-4">
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Description</label>
                                        <input
                                            type="text"
                                            value={newServiceDesc}
                                            onChange={(e) => setNewServiceDesc(e.target.value)}
                                            placeholder="Brief summary..."
                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500/20"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <button
                                            type="button"
                                            onClick={handleAddServiceItem}
                                            className="w-full h-[46px] bg-black hover:bg-slate-900 text-white rounded-xl transition-all flex items-center justify-center shadow-lg shadow-black/10"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {servicesList.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-6 font-bold">No services added to your catalog yet.</p>
                                    ) : (
                                        servicesList.map((svc, i) => (
                                            <div key={i} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900">{svc.name}</h4>
                                                    {svc.description && <p className="text-xs text-slate-400 font-bold">{svc.description}</p>}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-black text-emerald-600">₹{svc.price}</span>
                                                    <button
                                                        onClick={() => handleRemoveServiceItem(i)}
                                                        className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-all"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Ready Catalog View Only */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {ad.services?.length > 0 ? (
                                    ad.services.map((svc, i) => (
                                        <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900">{svc.name}</h4>
                                                {svc.description && <p className="text-xs text-slate-400 font-bold mt-0.5">{svc.description}</p>}
                                            </div>
                                            <span className="text-sm font-black text-emerald-600">₹{svc.price}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-6 space-y-4">
                                        <div className="p-3 bg-brand-50 rounded-full text-brand-600">
                                            <Plus className="h-6 w-6" />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-sm font-black text-slate-800">Your Service Catalog is Empty</p>
                                            <p className="text-xs text-slate-400 font-bold max-w-xs">List individual service task offerings (e.g. Pipe Fitting, Fan Repair) with pricing.</p>
                                        </div>
                                        <button
                                            onClick={() => setIsEditingCatalog(true)}
                                            className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 shadow-sm"
                                        >
                                            Add Your First Service
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* SERVICE PROFESSIONAL REGISTRATION WIZARD */
                <div className="bg-white p-8 md:p-12 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-950 flex items-center gap-2">
                            List Your Professional Service
                            <Sparkles className="h-5 w-5 text-brand-500" />
                        </h1>
                        <p className="text-sm text-slate-400 font-bold mt-1">Get verified, advertise your service category, and connect with local customers.</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone Number</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder="10-digit mobile number"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email Address (Optional)</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="yourname@domain.com"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Profession Service Title</label>
                                <input
                                    type="text"
                                    required
                                    value={profession}
                                    onChange={(e) => setProfession(e.target.value)}
                                    placeholder="e.g. Master Plumber, AC Mechanic"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-2 col-span-1 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Service Categories (Choose one or more)</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {categories.map((cat) => {
                                        const isSelected = categoryIds.includes(cat._id);
                                        return (
                                            <label
                                                key={cat._id}
                                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                                                    isSelected
                                                        ? 'bg-brand-50 border-brand-500/20 text-slate-900 shadow-sm'
                                                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100/75'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    value={cat._id}
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCategoryIds([...categoryIds, cat._id]);
                                                        } else {
                                                            setCategoryIds(categoryIds.filter(id => id !== cat._id));
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold">{cat.name}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                                                        {cat.priceType === 'free' ? 'Free' : `₹${cat.price ?? 499}`}
                                                    </span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Years of Experience</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={experienceYears}
                                    onChange={(e) => setExperienceYears(e.target.value)}
                                    placeholder="e.g. 5"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Operational City</label>
                                <input
                                    type="text"
                                    required
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="e.g. Indore"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Address</label>
                                <input
                                    type="text"
                                    required
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Detailed shop or service area address"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2 p-5 bg-indigo-50/40 rounded-3xl border border-indigo-100/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800">Set Service Location Coordinates</h4>
                                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                                        Customers will locate you based on these coordinates. Use auto-detect for accuracy.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAutoDetectLocation}
                                    disabled={isLocating}
                                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-60 shrink-0"
                                >
                                    {isLocating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Detecting...
                                        </>
                                    ) : (
                                        <>
                                            <MapPin className="h-4 w-4" />
                                            Detect My Location
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Latitude Coordinate</label>
                                <input
                                    type="text"
                                    required
                                    value={lat}
                                    onChange={(e) => setLat(e.target.value)}
                                    placeholder="e.g. 22.7196"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Longitude Coordinate</label>
                                <input
                                    type="text"
                                    required
                                    value={lng}
                                    onChange={(e) => setLng(e.target.value)}
                                    placeholder="e.g. 75.8577"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                        </div>


                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Service Profile Description</label>
                            <textarea
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Introduce your plumbing/electrician services, specializations, tools, and booking callout policies..."
                                rows="4"
                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                            />
                        </div>

                        {(() => {
                            const selectedCats = categories.filter(c => categoryIds.includes(c._id));
                            const paidCats = selectedCats.filter(c => c.priceType === 'paid');
                            const isFree = paidCats.length === 0;
                            const fee = paidCats.reduce((sum, c) => sum + (c.price ?? 499), 0);
                            return (
                                <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">Advertisement Listing Subscription Fee</h4>
                                        <p className="text-xs text-amber-700 font-bold leading-relaxed">
                                            {isFree ? (
                                                "Registration creates a pending profile. You can activate this listing for free once registered."
                                            ) : (
                                                `Registration creates a pending profile. You will need to pay ₹${fee} via wallet balance to activate the listing for a 30-day period.`
                                            )}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        <button
                            type="submit"
                            className="w-full py-5 bg-black hover:scale-[1.01] transition-all text-white rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 mt-8 shadow-xl shadow-brand-100"
                        >
                            Register Profile Details <ChevronRight className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            ))}

            {activeTab === 'banners' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-black text-slate-955 flex items-center gap-2">
                                Promotional Banners
                                <Sparkles className="h-5 w-5 text-brand-500 animate-pulse" />
                            </h1>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed max-w-xl">
                                Run custom banner images or video advertisements on SevaFast platform. Gated behind admin approval (₹{settings?.platformAdListingFee ?? 999} / 30 Days).
                            </p>
                        </div>
                        <button
                            onClick={() => setIsSubmittingPlatformAd(true)}
                            className="w-full sm:w-auto px-6 py-3.5 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 shrink-0"
                        >
                            <Plus className="h-4 w-4" /> Create Ad Request
                        </button>
                    </div>

                    {/* LIST OF BANNERS */}
                    <div className="space-y-6">
                        {platformAds.length === 0 ? (
                            <div className="bg-white p-12 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                                <div className="p-4 bg-slate-50 rounded-full text-slate-400">
                                    <Sparkles className="h-8 w-8" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-slate-800">No Banner Ads Submitted Yet</p>
                                    <p className="text-xs text-slate-400 font-bold max-w-sm">Create an ad request to promote your service, store, or clinic at the top banner positions on SevaFast.</p>
                                </div>
                                <button
                                    onClick={() => setIsSubmittingPlatformAd(true)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Submit First Banner Ad
                                </button>
                            </div>
                        ) : (
                            platformAds.map((adItem) => (
                                <div key={adItem._id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    {/* Media preview */}
                                    <div className="md:col-span-4 grid grid-cols-2 gap-2">
                                        {(adItem.imageUrl || (adItem.mediaUrl && adItem.mediaType === 'image')) ? (
                                            <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative aspect-video flex items-center justify-center">
                                                <img src={adItem.imageUrl || adItem.mediaUrl} alt={adItem.title} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative aspect-video flex items-center justify-center">
                                                <span className="text-[9px] font-black uppercase text-slate-400">No Image</span>
                                            </div>
                                        )}
                                        {(adItem.videoUrl || (adItem.mediaUrl && adItem.mediaType === 'video')) ? (
                                            <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative aspect-video flex items-center justify-center">
                                                <video src={adItem.videoUrl || adItem.mediaUrl} controls className="w-full h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative aspect-video flex items-center justify-center">
                                                <span className="text-[9px] font-black uppercase text-slate-400">No Video</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ad Details */}
                                    <div className="md:col-span-5 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-black text-slate-900">{adItem.title}</h3>
                                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">{adItem.city}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-3">{adItem.content}</p>
                                        {adItem.targetUrl && (
                                            <a href={adItem.targetUrl} target="_blank" rel="noreferrer" className="inline-flex text-[10px] font-black text-brand-600 hover:text-brand-700 underline truncate max-w-full">
                                                Target link: {adItem.targetUrl}
                                            </a>
                                        )}
                                        {adItem.approvalStatus === 'rejected' && adItem.rejectionReason && (
                                            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100">
                                                Rejection Reason: {adItem.rejectionReason}
                                            </div>
                                        )}
                                    </div>

                                    {/* Status and Action */}
                                    <div className="md:col-span-3 flex flex-col gap-2 items-start md:items-end justify-between h-full min-h-[100px]">
                                        <div className="flex flex-col gap-1 items-start md:items-end w-full">
                                            {/* Approval status badge */}
                                            {adItem.paymentStatus === 'unpaid' ? (
                                                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500">
                                                    Draft (Unpaid)
                                                </span>
                                            ) : (
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider capitalize ${
                                                    adItem.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                                    adItem.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                    {adItem.approvalStatus === 'pending' ? 'Pending Admin Approval' : adItem.approvalStatus}
                                                </span>
                                            )}
                                            {/* Payment status badge */}
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider capitalize ${
                                                adItem.paymentStatus === 'paid' ? 'bg-sky-50 text-sky-700' : 'bg-slate-50 text-slate-500'
                                            }`}>
                                                {adItem.paymentStatus}
                                            </span>
                                        </div>

                                        {adItem.paymentStatus === 'unpaid' && (
                                            <button
                                                onClick={() => handlePayPlatformAd(adItem)}
                                                className="w-full px-4 py-2.5 bg-black hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-center"
                                            >
                                                Pay ₹{adItem.price || settings?.platformAdListingFee || 999} to Submit Request
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* CREATE PLATFORM AD MODAL */}
            {isSubmittingPlatformAd && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto scrollbar-none animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">New Banner Ad Request</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">Submit banner files and details to run local/global ads.</p>
                            </div>
                            <button
                                onClick={() => setIsSubmittingPlatformAd(false)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitPlatformAd} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ad Campaign Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={platTitle}
                                        onChange={(e) => setPlatTitle(e.target.value)}
                                        placeholder="e.g. Special Discount Offer"
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Link / URL (Optional)</label>
                                    <input
                                        type="url"
                                        value={platTargetUrl}
                                        onChange={(e) => setPlatTargetUrl(e.target.value)}
                                        placeholder="https://example.com/promo"
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Operational City</label>
                                    <input
                                        type="text"
                                        required
                                        value={platCity}
                                        onChange={(e) => setPlatCity(e.target.value)}
                                        placeholder="e.g. Indore"
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ad Content / Description</label>
                                <textarea
                                    required
                                    value={platContent}
                                    onChange={(e) => setPlatContent(e.target.value)}
                                    placeholder="Write a clear call-to-action description or information about this advertisement banner..."
                                    rows="3"
                                    className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none resize-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">Choose Media Type</span>
                                    <div className="flex bg-slate-200/60 p-1 rounded-xl gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setActiveMediaTab('image')}
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                activeMediaTab === 'image'
                                                    ? "bg-white text-black shadow-sm"
                                                    : "text-slate-500 hover:text-slate-800"
                                            }`}
                                        >
                                            Image {platImageUrl && "✓"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveMediaTab('video')}
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                activeMediaTab === 'video'
                                                    ? "bg-white text-black shadow-sm"
                                                    : "text-slate-500 hover:text-slate-800"
                                            }`}
                                        >
                                            Video {platVideoUrl && "✓"}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {/* PHOTO UPLOAD */}
                                    {activeMediaTab === 'image' && (
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2 relative animate-in fade-in duration-200">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Banner Photo (Image)</h4>
                                            <label className="cursor-pointer flex flex-col items-center justify-center h-32 w-full bg-white hover:bg-slate-50 border border-slate-200 border-dashed rounded-xl transition-all relative overflow-hidden group">
                                                {isUploadingMedia ? (
                                                    <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                                                ) : platImageUrl ? (
                                                    <img src={platImageUrl} alt="Preview" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-slate-600">
                                                        <Upload className="h-5 w-5" />
                                                        <span className="text-[8px] font-black uppercase mt-1">Upload Photo</span>
                                                        <span className="text-[7px] text-slate-400 font-bold mt-0.5">JPEG, PNG up to 10MB</span>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        handleUploadMediaFile(e, setPlatImageUrl, () => {});
                                                    }}
                                                    disabled={isUploadingMedia}
                                                />
                                            </label>
                                            {platImageUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setPlatImageUrl(''); }}
                                                    className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-700"
                                                >
                                                    Remove Photo
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* VIDEO UPLOAD */}
                                    {activeMediaTab === 'video' && (
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2 relative animate-in fade-in duration-200">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Banner Video</h4>
                                            <label className="cursor-pointer flex flex-col items-center justify-center h-32 w-full bg-white hover:bg-slate-50 border border-slate-200 border-dashed rounded-xl transition-all relative overflow-hidden group">
                                                {isUploadingMedia ? (
                                                    <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                                                ) : platVideoUrl ? (
                                                    <video src={platVideoUrl} className="h-full w-full object-cover" controls />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-slate-600">
                                                        <Upload className="h-5 w-5" />
                                                        <span className="text-[8px] font-black uppercase mt-1">Upload Video</span>
                                                        <span className="text-[7px] text-slate-400 font-bold mt-0.5">MP4, WebM up to 10MB</span>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="video/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        handleUploadMediaFile(e, setPlatVideoUrl, () => {});
                                                    }}
                                                    disabled={isUploadingMedia}
                                                />
                                            </label>
                                            {platVideoUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setPlatVideoUrl(''); }}
                                                    className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-700"
                                                >
                                                    Remove Video
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                                 <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                 <div className="space-y-0.5">
                                     <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-800">Advertisement Price: ₹{settings?.platformAdListingFee ?? 999}</h4>
                                     <p className="text-[10px] text-amber-700 font-bold leading-normal">
                                         The subscription runs for 30 days. After payment, your request is submitted for admin review and approval.
                                     </p>
                                 </div>
                             </div>

                             <div className="flex gap-3 pt-4 border-t border-slate-100">
                                 <button
                                     type="button"
                                     onClick={() => setIsSubmittingPlatformAd(false)}
                                     className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider text-center"
                                 >
                                     Cancel
                                 </button>
                                 <button
                                     type="submit"
                                     disabled={isUploadingMedia}
                                     className="flex-1 py-3.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider text-center hover:scale-[1.01] disabled:opacity-60"
                                 >
                                     Pay & Submit Request
                                 </button>
                             </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT CATEGORIES MODAL */}
            {isEditingCategories && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto scrollbar-none">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Manage Service Categories</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">Select one or more service categories you offer.</p>
                            </div>
                            <button
                                onClick={() => setIsEditingCategories(false)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {categories.map((cat) => {
                                const isSelected = editCategoryIds.includes(cat._id);
                                return (
                                    <label
                                        key={cat._id}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                                            isSelected
                                                ? 'bg-brand-50 border-brand-500/20 text-slate-900 shadow-sm'
                                                : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100/75'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            value={cat._id}
                                            checked={isSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setEditCategoryIds([...editCategoryIds, cat._id]);
                                                } else {
                                                    setEditCategoryIds(editCategoryIds.filter(id => id !== cat._id));
                                                }
                                            }}
                                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">{cat.name}</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                                                {cat.priceType === 'free' ? 'Free' : `₹${cat.price ?? 499}`}
                                            </span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setIsEditingCategories(false)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCategories}
                                className="flex-1 py-4 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center hover:scale-[1.01]"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM PAYMENT MODAL */}
            {isConfirmingPayment && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900">Activate Service Listing</h2>
                            <button
                                onClick={() => setIsConfirmingPayment(false)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-500">Listing Activation Fee</span>
                                    <span className="font-black text-slate-800">₹{getListingPriceToShow()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-500">Your Wallet Balance</span>
                                    <span className="font-black text-slate-800">
                                        ₹{walletBalance}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 text-emerald-800 text-xs font-semibold leading-relaxed">
                                <Sparkles className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">Payment Activation Ready</p>
                                    <p className="mt-0.5 text-emerald-600">Click below to deduct ₹{getListingPriceToShow()} from your wallet balance and activate the ad listing.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsConfirmingPayment(false)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executePayment}
                                className="flex-1 py-4 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center hover:scale-[1.01]"
                            >
                                Pay ₹{getListingPriceToShow()} Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT PROFILE DETAILS & MEDIA MODAL */}
            {isEditingProfile && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto scrollbar-none animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Edit Profile Details</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">Update your professional details.</p>
                            </div>
                            <button
                                onClick={() => setIsEditingProfile(false)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone Number</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={10}
                                        value={editPhone}
                                        onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email Address (Optional)</label>
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Profession Service Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={editProfession}
                                        onChange={(e) => setEditProfession(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Years of Experience</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={editExperienceYears}
                                        onChange={(e) => setEditExperienceYears(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Operational City</label>
                                    <input
                                        type="text"
                                        required
                                        value={editCity}
                                        onChange={(e) => setEditCity(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Address</label>
                                    <input
                                        type="text"
                                        required
                                        value={editAddress}
                                        onChange={(e) => setEditAddress(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Latitude Coordinate</label>
                                    <input
                                        type="text"
                                        required
                                        value={editLat}
                                        onChange={(e) => setEditLat(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Longitude Coordinate</label>
                                    <input
                                        type="text"
                                        required
                                        value={editLng}
                                        onChange={(e) => setEditLng(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Service Profile Description</label>
                                <textarea
                                    required
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows="3"
                                    className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none resize-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingProfile(false)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider text-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploadingMedia}
                                    className="flex-1 py-3.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider text-center hover:scale-[1.01] disabled:opacity-60"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfessionalProfilePanel;
