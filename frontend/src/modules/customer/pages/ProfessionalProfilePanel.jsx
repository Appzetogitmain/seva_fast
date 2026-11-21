import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getDateLocale } from '@core/i18n';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import {
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
    AlertCircle,
    ChevronRight,
    Edit2,
    X,
    Upload,
    ChevronLeft,
    ExternalLink,
    Briefcase,
    Image as ImageIcon,
    Video as VideoIcon,
    Play,
    MessageCircle,
    Eye,
    PhoneCall,
    Star
} from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useLockBodyScroll, preventBackdropScroll } from '@shared/hooks/useLockBodyScroll';

const ProfessionalProfilePanel = () => {
    const { t } = useTranslation('customer');
    const navigate = useNavigate();
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
    const [lng, setLng] = useState('75.8577'); // Default Indore coordinates
    const [isLocating, setIsLocating] = useState(false);

    // Form validation states
    const [regErrors, setRegErrors] = useState({});
    const [editErrors, setEditErrors] = useState({});
    const [bannerErrors, setBannerErrors] = useState({});

    const clearRegError = (fieldName) => {
        setRegErrors((prev) => {
            if (!prev[fieldName]) return prev;
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    const clearEditError = (fieldName) => {
        setEditErrors((prev) => {
            if (!prev[fieldName]) return prev;
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    const clearBannerError = (fieldName) => {
        setBannerErrors((prev) => {
            if (!prev[fieldName]) return prev;
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    // Profile photo states
    const [regProfileImage, setRegProfileImage] = useState('');
    const [isUploadingRegImage, setIsUploadingRegImage] = useState(false);
    const [editMediaUrl, setEditMediaUrl] = useState('');
    const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);

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
    const [editingPlatformAdId, setEditingPlatformAdId] = useState(null);
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

    // Platform Ad destination & showcase state
    const [platDestinationType, setPlatDestinationType] = useState('showcase'); // 'showcase' or 'website'
    const [platBusinessName, setPlatBusinessName] = useState('');
    const [platContactPhone, setPlatContactPhone] = useState('');
    const [platWhatsapp, setPlatWhatsapp] = useState('');
    const [platAddress, setPlatAddress] = useState('');
    const [platPosters, setPlatPosters] = useState([]);
    const [platVideos, setPlatVideos] = useState([]);
    const [isUploadingPoster, setIsUploadingPoster] = useState(false);
    const [isUploadingBannerVideo, setIsUploadingBannerVideo] = useState(false);

    // Service catalog photo & video state
    const [newServiceImages, setNewServiceImages] = useState([]);
    const [newServiceVideo, setNewServiceVideo] = useState('');
    const [isUploadingServiceMedia, setIsUploadingServiceMedia] = useState(false);
    const [activeVideoModal, setActiveVideoModal] = useState(null);

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
                showToast(t('pro.msg.loadFailed'), "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
        loadPlatformAds();
    }, []);

    useLockBodyScroll(Boolean(isEditingCategories || isConfirmingPayment || isEditingProfile || isSubmittingPlatformAd || activeVideoModal));

    const handleUploadProfilePhoto = async (e, setUrl, setLoading) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (JPEG, PNG, WEBP)', 'error');
            e.target.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
            showToast(`Photo exceeds 10 MB limit (Selected: ${sizeInMb} MB)`, 'error');
            e.target.value = '';
            return;
        }

        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('file', file);
            const res = await customerApi.uploadMedia(formData);
            const url = res.data?.result?.secureUrl || res.data?.result?.url || res.data?.secureUrl || res.data?.url;
            if (url) {
                setUrl(url);
                showToast('Profile photo uploaded successfully', 'success');
            } else {
                showToast('Failed to upload photo', 'error');
            }
        } catch (error) {
            console.error('Photo upload error:', error);
            showToast(error.response?.data?.message || 'Error uploading photo', 'error');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleUploadServiceImage = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                showToast('Please select only image files (JPEG, PNG, WEBP)', 'error');
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
                showToast(`Image ${file.name} exceeds 10 MB limit (${sizeInMb} MB)`, 'error');
                continue;
            }

            try {
                setIsUploadingServiceMedia(true);
                const formData = new FormData();
                formData.append('file', file);

                const res = await customerApi.uploadMedia(formData);
                const url = res.data?.result?.secureUrl || res.data?.result?.url || res.data?.secureUrl || res.data?.url;
                if (url) {
                    setNewServiceImages(prev => [...prev, url]);
                    showToast('Service photo added successfully', 'success');
                } else {
                    showToast(t('pro.msg.mediaFailed') || 'Failed to upload photo', 'error');
                }
            } catch (error) {
                console.error('Service photo upload error:', error);
                showToast(error.response?.data?.message || t('pro.msg.mediaError') || 'Upload failed', 'error');
            } finally {
                setIsUploadingServiceMedia(false);
            }
        }
        e.target.value = '';
    };

    const handleRemoveNewServiceImage = (index) => {
        setNewServiceImages(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleUploadPosterFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
            showToast(`Poster image exceeds 10 MB limit (Selected: ${sizeInMb} MB).`, 'error');
            e.target.value = '';
            return;
        }

        try {
            setIsUploadingPoster(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await customerApi.uploadMedia(formData);
            const url = res.data?.result?.secureUrl || res.data?.result?.url || res.data?.secureUrl || res.data?.url;
            if (url) {
                setPlatPosters(prev => [...prev, url]);
                setPlatImageUrl(prev => prev || url);
                clearBannerError('media');
                showToast('Poster uploaded successfully', 'success');
            } else {
                showToast(t('pro.msg.mediaFailed'), 'error');
            }
        } catch (error) {
            console.error('Poster upload error:', error);
            showToast(error.response?.data?.message || t('pro.msg.mediaError'), 'error');
        } finally {
            setIsUploadingPoster(false);
        }
    };

    const handleUploadBannerVideoFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
            showToast(`Promotional video exceeds 20 MB limit (Selected: ${sizeInMb} MB). Please choose a video under 20 MB.`, 'error');
            e.target.value = '';
            return;
        }

        try {
            setIsUploadingBannerVideo(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await customerApi.uploadMedia(formData);
            const url = res.data?.result?.secureUrl || res.data?.result?.url || res.data?.secureUrl || res.data?.url;
            if (url) {
                setPlatVideos(prev => [...prev, url]);
                setPlatVideoUrl(prev => prev || url);
                clearBannerError('media');
                showToast('Promotional video uploaded successfully', 'success');
            } else {
                showToast(t('pro.msg.mediaFailed'), 'error');
            }
        } catch (error) {
            console.error('Banner video upload error:', error);
            showToast(error.response?.data?.message || t('pro.msg.mediaError'), 'error');
        } finally {
            setIsUploadingBannerVideo(false);
        }
    };

    // The main banner image/video and the gallery lists must stay in sync:
    // the main slot falls back to the first gallery item, and on save the main
    // item is put back into the gallery. Removing or replacing a file therefore
    // has to update BOTH, otherwise the "removed" file reappears.
    const handleRemovePoster = (index) => {
        const removed = platPosters[index];
        setPlatPosters(prev => prev.filter((_, idx) => idx !== index));
        if (removed && removed === platImageUrl) setPlatImageUrl('');
    };

    const handleRemoveBannerVideo = (index) => {
        const removed = platVideos[index];
        setPlatVideos(prev => prev.filter((_, idx) => idx !== index));
        if (removed && removed === platVideoUrl) setPlatVideoUrl('');
    };

    const primaryBannerImage = platImageUrl || platPosters[0] || '';
    const primaryBannerVideo = platVideoUrl || platVideos[0] || '';

    // Replace the main image: drop the previous main one from the gallery too.
    const replacePrimaryBannerImage = (newUrl) => {
        const previous = primaryBannerImage;
        if (previous) setPlatPosters(prev => prev.filter(u => u !== previous));
        setPlatImageUrl(newUrl);
    };

    const removePrimaryBannerImage = () => {
        const previous = primaryBannerImage;
        if (previous) setPlatPosters(prev => prev.filter(u => u !== previous));
        setPlatImageUrl('');
    };

    const replacePrimaryBannerVideo = (newUrl) => {
        const previous = primaryBannerVideo;
        if (previous) setPlatVideos(prev => prev.filter(u => u !== previous));
        setPlatVideoUrl(newUrl);
    };

    const removePrimaryBannerVideo = () => {
        const previous = primaryBannerVideo;
        if (previous) setPlatVideos(prev => prev.filter(u => u !== previous));
        setPlatVideoUrl('');
    };

    const handleUploadMediaFile = async (e, targetSetUrl, targetSetType) => {
        const file = e.target.files[0];
        if (!file) return;

        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const maxBytes = type === 'video' ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxBytes) {
            const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
            showToast(`${type === 'video' ? 'Video' : 'Photo'} exceeds limit (Selected: ${sizeInMb} MB). Maximum allowed is ${type === 'video' ? '20 MB' : '10 MB'}.`, 'error');
            e.target.value = '';
            return;
        }

        try {
            setIsUploadingMedia(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await customerApi.uploadMedia(formData);
            if (res.data?.success && (res.data.result?.secureUrl || res.data.result?.url)) {
                targetSetUrl(res.data.result.secureUrl || res.data.result.url);
                targetSetType(type);
                clearBannerError('media');
                showToast(t('pro.msg.mediaUploaded'), 'success');
            } else if (res.data?.secureUrl || res.data?.url) {
                targetSetUrl(res.data.secureUrl || res.data.url);
                targetSetType(type);
                clearBannerError('media');
                showToast(t('pro.msg.mediaUploaded'), 'success');
            } else {
                showToast(t('pro.msg.mediaFailed'), 'error');
            }
        } catch (error) {
            console.error("Media upload error:", error, error.response?.data);
            showToast(error.response?.data?.message || t('pro.msg.mediaError'), 'error');
        } finally {
            setIsUploadingMedia(false);
        }
    };

    const handleAutoDetectLocation = () => {
        if (!navigator.geolocation) {
            return showToast(t('pro.msg.noGeo'), "error");
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLat(position.coords.latitude.toFixed(6));
                setLng(position.coords.longitude.toFixed(6));
                setIsLocating(false);
                showToast(t('pro.msg.coordsDetected'), "success");
            },
            (error) => {
                console.error("Geolocation error:", error);
                setIsLocating(false);
                showToast(t('pro.msg.coordsFailed'), "error");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const validateRegistrationForm = () => {
        const errs = {};
        const trimmedName = String(name || '').trim();
        const trimmedPhone = String(phone || '').trim();
        const trimmedEmail = String(email || '').trim();
        const trimmedProfession = String(profession || '').trim();
        const trimmedCity = String(city || '').trim();
        const trimmedAddress = String(address || '').trim();
        const trimmedDesc = String(description || '').trim();
        const finalCategoryIds = categoryIds.length > 0 ? categoryIds : (categoryId ? [categoryId] : []);

        if (!trimmedName) {
            errs.name = "Full Name is required";
        } else if (trimmedName.length < 2) {
            errs.name = "Full Name must be at least 2 characters";
        }

        if (!trimmedPhone) {
            errs.phone = "Mobile Number is required";
        } else if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
            errs.phone = "Enter a valid 10-digit mobile number (starts with 6, 7, 8, or 9)";
        }

        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            errs.email = "Please enter a valid email address";
        }

        if (!trimmedProfession) {
            errs.profession = "Profession title is required (e.g. Electrician, Plumber)";
        } else if (trimmedProfession.length < 2) {
            errs.profession = "Profession must be at least 2 characters";
        }

        if (finalCategoryIds.length === 0) {
            errs.categoryIds = "Please select at least one service category";
        }

        if (experienceYears === '' || experienceYears === null || experienceYears === undefined) {
            errs.experienceYears = "Experience in years is required (enter 0 for beginner)";
        } else if (Number(experienceYears) < 0 || Number(experienceYears) > 70) {
            errs.experienceYears = "Enter valid experience years (0-70)";
        }

        if (!trimmedCity) {
            errs.city = "Operating City is required";
        } else if (trimmedCity.length < 2) {
            errs.city = "City name must be at least 2 characters";
        }

        if (!trimmedAddress) {
            errs.address = "Service Area / Address is required";
        } else if (trimmedAddress.length < 4) {
            errs.address = "Please enter a complete address (minimum 4 characters)";
        }

        if (!trimmedDesc) {
            errs.description = "Service description is required";
        } else if (trimmedDesc.length < 10) {
            errs.description = "Please describe your services in at least 10 characters";
        }

        return errs;
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const errs = validateRegistrationForm();
        setRegErrors(errs);

        if (Object.keys(errs).length > 0) {
            const firstKey = Object.keys(errs)[0];
            showToast(errs[firstKey], "error");
            const el = document.querySelector(`[name="${firstKey}"]`) || document.querySelector(`#reg-${firstKey}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (typeof el.focus === 'function') el.focus();
            }
            return;
        }

        try {
            setIsLoading(true);
            const finalCategoryIds = categoryIds.length > 0 ? categoryIds : (categoryId ? [categoryId] : []);
            const payload = {
                name: String(name).trim(),
                phone: String(phone).trim(),
                email: String(email).trim(),
                profession: String(profession).trim(),
                categoryId: finalCategoryIds[0],
                categoryIds: finalCategoryIds,
                experienceYears: Number(experienceYears) || 0,
                description: String(description).trim(),
                address: String(address).trim(),
                city: String(city).trim(),
                lat: parseFloat(lat) || 22.7196,
                lng: parseFloat(lng) || 75.8577
            };
            const res = await customerApi.createProfessionalProfile(payload);
            if (res.data?.success) {
                showToast(t('pro.msg.registered'), "success");
                setRegErrors({});
                loadProfile();
            }
        } catch (error) {
            showToast(error.response?.data?.message || t('pro.msg.registerFailed'), "error");
        } finally {
            setIsLoading(false);
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
        setEditMediaUrl(ad.mediaUrl || (Array.isArray(ad.portfolioImages) ? ad.portfolioImages[0] : '') || '');
        setEditErrors({});
        setIsEditingProfile(true);
    };

    const validateEditProfileForm = () => {
        const errs = {};
        const trimmedName = String(editName || '').trim();
        const trimmedPhone = String(editPhone || '').trim();
        const trimmedEmail = String(editEmail || '').trim();
        const trimmedProfession = String(editProfession || '').trim();
        const trimmedCity = String(editCity || '').trim();
        const trimmedAddress = String(editAddress || '').trim();
        const trimmedDesc = String(editDescription || '').trim();

        if (!trimmedName) {
            errs.name = "Full Name is required";
        } else if (trimmedName.length < 2) {
            errs.name = "Full Name must be at least 2 characters";
        }

        if (!trimmedPhone) {
            errs.phone = "Mobile Number is required";
        } else if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
            errs.phone = "Enter a valid 10-digit mobile number (starts with 6-9)";
        }

        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            errs.email = "Please enter a valid email address";
        }

        if (!trimmedProfession) {
            errs.profession = "Profession title is required";
        } else if (trimmedProfession.length < 2) {
            errs.profession = "Profession must be at least 2 characters";
        }

        if (editExperienceYears === '' || editExperienceYears === null || editExperienceYears === undefined) {
            errs.experienceYears = "Experience in years is required (enter 0 for beginner)";
        } else if (Number(editExperienceYears) < 0 || Number(editExperienceYears) > 70) {
            errs.experienceYears = "Enter valid experience years (0-70)";
        }

        if (!trimmedCity) {
            errs.city = "City is required";
        } else if (trimmedCity.length < 2) {
            errs.city = "City name must be at least 2 characters";
        }

        if (!trimmedAddress) {
            errs.address = "Address is required";
        } else if (trimmedAddress.length < 4) {
            errs.address = "Address must be at least 4 characters";
        }

        if (!trimmedDesc) {
            errs.description = "Service description is required";
        } else if (trimmedDesc.length < 10) {
            errs.description = "Please describe your services in at least 10 characters";
        }

        return errs;
    };

    const handleUpdateProfileSubmit = async (e) => {
        e.preventDefault();
        const errs = validateEditProfileForm();
        setEditErrors(errs);

        if (Object.keys(errs).length > 0) {
            const firstKey = Object.keys(errs)[0];
            showToast(errs[firstKey], "error");
            const el = document.querySelector(`[name="edit-${firstKey}"]`) || document.querySelector(`#edit-${firstKey}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (typeof el.focus === 'function') el.focus();
            }
            return;
        }

        try {
            setIsLoading(true);
            const payload = {
                name: String(editName).trim(),
                phone: String(editPhone).trim(),
                email: String(editEmail).trim(),
                profession: String(editProfession).trim(),
                experienceYears: Number(editExperienceYears) || 0,
                description: String(editDescription).trim(),
                address: String(editAddress).trim(),
                city: String(editCity).trim(),
                lat: parseFloat(editLat) || 22.7196,
                lng: parseFloat(editLng) || 75.8577
            };
            const res = await customerApi.updateProfessionalProfile(payload);
            if (res.data?.success) {
                showToast(t('pro.msg.profileUpdated'), "success");
                setIsEditingProfile(false);
                setEditErrors({});
                loadProfile();
            }
        } catch (error) {
            showToast(error.response?.data?.message || t('pro.msg.updateFailed'), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditPlatformAd = (adItem) => {
        setPlatTitle(adItem.title || '');
        setPlatContent(adItem.content || '');
        setPlatMediaUrl(adItem.mediaUrl || '');
        setPlatMediaType(adItem.mediaType || 'none');
        setPlatImageUrl(adItem.imageUrl || (Array.isArray(adItem.posters) ? adItem.posters[0] : '') || '');
        setPlatVideoUrl(adItem.videoUrl || (Array.isArray(adItem.videos) ? adItem.videos[0] : '') || '');
        setPlatTargetUrl(adItem.targetUrl || '');
        setPlatCity(adItem.city || '');
        setPlatDestinationType(adItem.hasExternalUrl ? 'website' : 'showcase');
        setPlatBusinessName(adItem.businessName || '');
        setPlatContactPhone(adItem.contactPhone || '');
        setPlatWhatsapp(adItem.whatsapp || '');
        setPlatAddress(adItem.address || '');
        setPlatPosters(Array.isArray(adItem.posters) ? adItem.posters : (adItem.imageUrl ? [adItem.imageUrl] : []));
        setPlatVideos(Array.isArray(adItem.videos) ? adItem.videos : (adItem.videoUrl ? [adItem.videoUrl] : []));
        setEditingPlatformAdId(adItem._id);
        setBannerErrors({});
        setIsSubmittingPlatformAd(true);
    };

    const resetPlatformAdForm = () => {
        setIsSubmittingPlatformAd(false);
        setEditingPlatformAdId(null);
        setPlatTitle('');
        setPlatContent('');
        setPlatMediaUrl('');
        setPlatMediaType('none');
        setPlatImageUrl('');
        setPlatVideoUrl('');
        setPlatTargetUrl('');
        setPlatCity('');
        setPlatDestinationType('showcase');
        setPlatBusinessName('');
        setPlatContactPhone('');
        setPlatWhatsapp('');
        setPlatAddress('');
        setPlatPosters([]);
        setPlatVideos([]);
        setBannerErrors({});
    };

    const validateBannerForm = () => {
        const errs = {};
        const trimmedTitle = String(platTitle || '').trim();
        const trimmedCity = String(platCity || '').trim();
        const trimmedContent = String(platContent || '').trim();
        const trimmedTargetUrl = String(platTargetUrl || '').trim();

        if (!trimmedTitle) {
            errs.title = "Ad title is required";
        } else if (trimmedTitle.length < 3) {
            errs.title = "Ad title must be at least 3 characters";
        }

        if (!trimmedCity) {
            errs.city = "Target city is required";
        }

        if (!trimmedContent) {
            errs.content = "Ad description is required";
        } else if (trimmedContent.length < 10) {
            errs.content = "Ad description must be at least 10 characters";
        }

        if (trimmedTargetUrl) {
            if (!/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/i.test(trimmedTargetUrl)) {
                errs.targetUrl = "Please enter a valid website link (e.g. https://example.com)";
            }
        }

        if (!platImageUrl && !platVideoUrl && platPosters.length === 0 && platVideos.length === 0) {
            errs.media = "Please upload a promotional photo or video";
        }

        setBannerErrors(errs);
        return {
            isValid: Object.keys(errs).length === 0,
            errors: errs,
        };
    };

    const handleSubmitPlatformAd = async (e) => {
        e.preventDefault();
        const { isValid, errors } = validateBannerForm();
        if (!isValid) {
            const firstMsg = Object.values(errors)[0] || "Please fill in all required fields.";
            return showToast(firstMsg, "error");
        }
        try {
            setIsLoading(true);
            const finalPosters = [...platPosters];
            if (platImageUrl && !finalPosters.includes(platImageUrl)) {
                finalPosters.unshift(platImageUrl);
            }
            const finalVideos = [...platVideos];
            if (platVideoUrl && !finalVideos.includes(platVideoUrl)) {
                finalVideos.unshift(platVideoUrl);
            }

            const effectiveMediaUrl = platVideoUrl || finalVideos[0] || platImageUrl || finalPosters[0] || '';
            const effectiveMediaType = (platVideoUrl || finalVideos.length > 0) ? 'video' : (effectiveMediaUrl ? 'image' : 'none');

            const payload = {
                title: platTitle.trim(),
                content: platContent.trim(),
                mediaUrl: effectiveMediaUrl,
                mediaType: effectiveMediaType,
                imageUrl: platImageUrl || finalPosters[0] || '',
                videoUrl: platVideoUrl || finalVideos[0] || '',
                targetUrl: platDestinationType === 'website' ? platTargetUrl.trim() : '',
                hasExternalUrl: platDestinationType === 'website' && Boolean(platTargetUrl.trim()),
                businessName: platBusinessName.trim() || platTitle.trim(),
                contactPhone: platContactPhone.trim(),
                whatsapp: platWhatsapp.trim(),
                address: platAddress.trim(),
                posters: finalPosters,
                videos: finalVideos,
                callToActionText: platDestinationType === 'website' ? 'Visit Website' : 'Contact Us',
                city: platCity.trim()
            };

            let res;
            if (editingPlatformAdId) {
                res = await customerApi.updatePlatformAd(editingPlatformAdId, payload);
            } else {
                res = await customerApi.createPlatformAd(payload);
            }

            if (res.data?.success) {
                const updatedAd = res.data.result;
                resetPlatformAdForm();
                loadPlatformAds();

                // Trigger Razorpay payment flow immediately if it's a new ad or unpaid
                if (!editingPlatformAdId || updatedAd.paymentStatus === 'unpaid') {
                    await handlePayPlatformAd(updatedAd);
                } else {
                    showToast(t('pro.msg.adUpdated'), "success");
                }
            }
        } catch (error) {
            showToast(error.response?.data?.message || t('pro.msg.requestFailed'), "error");
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
                showToast(t('pro.msg.sdkFailed'), "error");
                return;
            }

            const initRes = await customerApi.initiatePayPlatformAd(id);
            if (!initRes.data?.success) {
                showToast(initRes.data?.message || t('pro.msg.paymentInit'), "error");
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
                            showToast(t('pro.msg.adPaid'), "success");
                            loadPlatformAds();
                        } else {
                            showToast(verifyRes.data?.message || t('pro.msg.verifyFailed'), "error");
                        }
                    } catch (err) {
                        showToast(err.response?.data?.message || t('pro.msg.verifyRequestFailed'), "error");
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
                        showToast(t('pro.msg.adPaymentCancelled'), "info");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            showToast(error.response?.data?.message || t('pro.msg.paymentInitFailed'), "error");
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
            return showToast(t('pro.msg.selectCategory'), "error");
        }
        try {
            setIsLoading(true);
            const res = await customerApi.updateProfessionalProfile({
                categoryIds: editCategoryIds
            });
            if (res.data?.success) {
                showToast(t('pro.msg.categoriesUpdated'), "success");
                setIsEditingCategories(false);
                loadProfile();
            }
        } catch (error) {
            showToast(error.response?.data?.message || t('pro.msg.categoriesFailed'), "error");
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
                    showToast(t('pro.msg.activated'), "success");
                    loadProfile();
                }
            } catch (error) {
                showToast(error.response?.data?.message || t('pro.msg.activationFailed'), "error");
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
                showToast(t('pro.msg.sdkFailed'), "error");
                return;
            }

            const initRes = await customerApi.initiatePayProfessionalProfile();
            if (!initRes.data?.success) {
                showToast(initRes.data?.message || t('pro.msg.paymentInit'), "error");
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
                            showToast(t('pro.msg.listingPaid'), "success");
                            loadProfile();
                        } else {
                            showToast(verifyRes.data?.message || t('pro.msg.verifyFailed'), "error");
                        }
                    } catch (err) {
                        showToast(err.response?.data?.message || t('pro.msg.verifyRequestFailed'), "error");
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
                        showToast(t('pro.msg.paymentCancelled'), "info");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            showToast(error.response?.data?.message || t('pro.msg.paymentInitFailed'), "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddServiceItem = () => {
        if (!newServiceName.trim() || !newServicePrice) {
            return showToast(t('pro.msg.serviceRequired'), "error");
        }
        const finalImages = [...newServiceImages];
        const newItem = {
            name: newServiceName.trim(),
            price: parseFloat(newServicePrice) || 0,
            description: newServiceDesc.trim(),
            images: finalImages,
            image: finalImages[0] || '',
            durationMinutes: 30
        };
        setServicesList([...servicesList, newItem]);
        setNewServiceName('');
        setNewServicePrice('');
        setNewServiceDesc('');
        setNewServiceImages([]);
    };

    const handleRemoveServiceItem = (index) => {
        setServicesList(servicesList.filter((_, i) => i !== index));
    };

    const handleSaveCatalog = async () => {
        try {
            setIsLoading(true);
            let finalServices = [...servicesList];
            if (newServiceName.trim() && newServicePrice) {
                const finalImages = [...newServiceImages];
                finalServices.push({
                    name: newServiceName.trim(),
                    price: parseFloat(newServicePrice) || 0,
                    description: newServiceDesc.trim(),
                    images: finalImages,
                    image: finalImages[0] || '',
                    durationMinutes: 30
                });
                setServicesList(finalServices);
                setNewServiceName('');
                setNewServicePrice('');
                setNewServiceDesc('');
                setNewServiceImages([]);
            }
            const res = await customerApi.updateProfessionalServices({ services: finalServices });
            if (res.data?.success) {
                showToast(t('pro.msg.catalogUpdated'), "success");
                setIsEditingCatalog(false);
                loadProfile();
            }
        } catch (error) {
            showToast(t('pro.msg.catalogFailed'), "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{t('pro.loading')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8 animate-in fade-in duration-750 pb-20">
            {/* Top Switcher & Directory Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-6 bg-slate-50 border border-slate-200/80 p-2.5 sm:p-3.5 rounded-2xl">
                <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition border border-slate-200 shadow-sm active:scale-95"
                >
                    <ChevronLeft className="h-4 w-4 shrink-0 text-slate-600" />
                    <span>Switch to Customer Profile</span>
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/professionals')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider transition border border-indigo-200/60 shadow-sm active:scale-95"
                >
                    <span>View Public Directory</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-indigo-500" />
                </button>
            </div>

            {/* TABS HEADER */}
            <div className="flex items-center justify-center border-b border-slate-200/80 gap-6 sm:gap-10 mb-8 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('directory')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'directory' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    {t('pro.tabListing')}
                    {activeTab === 'directory' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full animate-in fade-in" />}
                </button>
                <button
                    onClick={() => setActiveTab('banners')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'banners' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Promotional Banners
                    {activeTab === 'banners' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full animate-in fade-in" />}
                </button>
            </div>

            {activeTab === 'directory' && (
                ad ? (
                    <div className="space-y-8">
                        {/* STATUS BANNER */}
                        {ad.approvalStatus === 'pending' && (
                            <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl flex items-start gap-3.5 shadow-sm animate-in slide-in-from-top duration-300">
                                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                            Free Listing Submitted — Under Admin Review
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-200/70 text-amber-800">
                                            Pending
                                        </span>
                                    </div>
                                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                        Your service profile is submitted for free. Our admin team will verify your details shortly, after which your listing will be published in the public directory for nearby customers.
                                    </p>
                                </div>
                            </div>
                        )}

                        {ad.approvalStatus === 'approved' && (
                            <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl flex items-start gap-3.5 shadow-sm animate-in slide-in-from-top duration-300">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                                            Profile Active & Live
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-200/70 text-emerald-800">
                                            Published
                                        </span>
                                    </div>
                                    <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                                        Your service profile is live in the customer directory! Nearby customers can now discover your services and call or WhatsApp you directly.
                                    </p>
                                </div>
                            </div>
                        )}

                        {ad.approvalStatus === 'rejected' && (
                            <div className="bg-rose-50/70 border border-rose-200 p-5 rounded-2xl flex items-start gap-3.5 shadow-sm animate-in slide-in-from-top duration-300">
                                <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                                            Profile Rejected by Admin
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-200/70 text-rose-800">
                                            Action Required
                                        </span>
                                    </div>
                                    <p className="text-xs text-rose-700 font-medium leading-relaxed">
                                        {ad.rejectionReason || "Please review your profile details, update the information, and resubmit for approval."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleOpenEditProfile}
                                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" /> Edit Profile & Resubmit
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Header profile block */}
                        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-start gap-4 min-w-0 flex-1">
                                {(ad.mediaUrl || (Array.isArray(ad.portfolioImages) && ad.portfolioImages[0])) ? (
                                    <img
                                        src={ad.mediaUrl || ad.portfolioImages[0]}
                                        alt={ad.name}
                                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl sm:rounded-3xl object-cover border-2 border-slate-200 shadow-sm shrink-0"
                                    />
                                ) : (
                                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl sm:rounded-3xl bg-brand-50 border-2 border-brand-100 flex items-center justify-center shrink-0 text-brand-600 font-black text-xl sm:text-2xl">
                                        {ad.name?.charAt(0)?.toUpperCase() || 'P'}
                                    </div>
                                )}
                                <div className="space-y-3 min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                                    <h1 className="text-xl sm:text-2xl font-black text-slate-955 break-words">{ad.name}</h1>
                                    <span className="px-3 py-1 bg-brand-50 rounded-full text-xs font-black text-brand-600 uppercase tracking-wider shrink-0">{ad.profession}</span>
                                    <button
                                        onClick={handleOpenEditProfile}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-wider rounded-full transition-all border border-slate-100 shadow-sm"
                                    >
                                        <Edit2 className="h-3 w-3" /> {t('pro.editTitle')}
                                    </button>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 flex-wrap">
                                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" /> {ad.city} ({ad.address})</span>
                                    <span className="flex items-center gap-1"><Phone className="h-4 w-4 text-slate-400" /> {ad.phone}</span>
                                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4 text-slate-400" /> {t('pro.yearsExp', { count: ad.experienceYears })}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{t('pro.categoriesLabel')}</span>
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
                            </div>
                            <div className="flex flex-col items-start md:items-end gap-1 bg-slate-50 p-4 rounded-3xl border border-slate-100 w-full md:w-auto min-w-[150px]">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.walletBalance')}</span>
                                <span className="text-xl font-black text-slate-900">₹{walletBalance}</span>
                            </div>
                        </div>

                        {/* PERFORMANCE & VISITOR INSIGHTS (Instagram-style 24h metrics) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Card 1: Unique Profile Visits */}
                            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                                    <Eye className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">Total Profile Visits</span>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black text-slate-900">{ad.visitsCount || 0}</h4>
                                        <span className="text-[10px] font-bold text-slate-400">views</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">All-Time Total (Lifetime)</p>
                                </div>
                            </div>

                            {/* Card 2: Total Customer Inquiries */}
                            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                                    <PhoneCall className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">Total Inquiries</span>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black text-slate-900">{ad.contactsCount || 0}</h4>
                                        <span className="text-[10px] font-bold text-slate-400">leads</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">All-Time Leads (Lifetime)</p>
                                </div>
                            </div>

                            {/* Card 3: Phone Calls Initiated */}
                            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="p-3.5 bg-sky-50 text-sky-600 rounded-2xl shrink-0">
                                    <Phone className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">Call Clicks</span>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black text-slate-900">{ad.callClicksCount || 0}</h4>
                                        <span className="text-[10px] font-bold text-slate-400">calls</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">All-Time Direct Calls</p>
                                </div>
                            </div>

                            {/* Card 4: WhatsApp Chats Initiated */}
                            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                                    <MessageCircle className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">WhatsApp Chats</span>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black text-slate-900">{ad.whatsappClicksCount || 0}</h4>
                                        <span className="text-[10px] font-bold text-slate-400">chats</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">All-Time WhatsApp Chats</p>
                                </div>
                            </div>

                            {/* Card 5: Verified Customer Rating */}
                            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="p-3.5 bg-amber-50 text-amber-500 rounded-2xl shrink-0">
                                    <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">Customer Rating</span>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black text-slate-900">
                                            {ad.ratingCount > 0 ? Number(ad.rating || 5.0).toFixed(1) : '5.0'}
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {ad.ratingCount > 0 ? `(${ad.ratingCount} reviews)` : 'new'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">Verified Client Ratings</p>
                                </div>
                            </div>
                        </div>

                        {/* Verification & Subscription Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Approval Status Card */}
                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className={`p-4 rounded-2xl ${ad.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                        ad.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                    {ad.approvalStatus === 'approved' ? <CheckCircle2 className="h-8 w-8" /> :
                                        ad.approvalStatus === 'rejected' ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.verificationStatus')}</span>
                                    <h3 className="text-lg font-black text-slate-900 capitalize">{t(`pro.status.${ad.approvalStatus}`, { defaultValue: ad.approvalStatus })}</h3>
                                    {ad.rejectionReason && (
                                        <p className="text-xs font-bold text-rose-500 mt-1">{t('pro.reason', { reason: ad.rejectionReason })}</p>
                                    )}
                                </div>
                            </div>

                            {/* Subscription Status Card */}
                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${ad.paymentStatus === 'paid' ? 'bg-sky-50 text-sky-600' : 'bg-slate-50 text-slate-400'
                                        }`}>
                                        <DollarSign className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.subscriptionStatus')}</span>
                                        <h3 className="text-lg font-black text-slate-900 capitalize">{t(`pro.status.${ad.paymentStatus}`, { defaultValue: ad.paymentStatus })}</h3>
                                        {ad.expiresAt && ad.paymentStatus === 'paid' && (
                                            <p className="text-xs font-semibold text-slate-400">{t('pro.expiresOn', { date: new Date(ad.expiresAt).toLocaleDateString(getDateLocale()) })}</p>
                                        )}
                                    </div>
                                </div>
                                {ad.paymentStatus !== 'paid' && (
                                    <button
                                        onClick={handlePayListing}
                                        className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105"
                                    >
                                        {getListingPriceToShow() === 0 ? t('pro.activateFree') : t('pro.pay', { amount: getListingPriceToShow() })}
                                    </button>
                                )}
                            </div>
                        </div>

                    {/* Catalog Services Editor */}
                    <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-955">{t('pro.catalogTitle')}</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">{t('pro.catalogSub')}</p>
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
                                        {t('checkout.saveChanges')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingCatalog(false);
                                            setServicesList(ad.services || []);
                                        }}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                                    >
                                        {t('common:actions.cancel')}
                                    </button>
                                </div>
                            )}
                        </div>



                            {isEditingCatalog ? (
                                <div className="space-y-6">
                                    {/* Editing Catalog Inputs */}
                                    <div className="p-5 md:p-6 bg-slate-50 rounded-[28px] border border-slate-100 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                            <div className="space-y-1 sm:col-span-7">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">{t('pro.serviceTitle')}</label>
                                                <input
                                                    type="text"
                                                    value={newServiceName}
                                                    onChange={(e) => setNewServiceName(e.target.value)}
                                                    placeholder={t('pro.serviceTitlePlaceholder')}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500/20"
                                                />
                                            </div>
                                            <div className="space-y-1 sm:col-span-5">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">{t('pro.pricing')}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newServicePrice}
                                                    onChange={(e) => setNewServicePrice(e.target.value.replace(/[^0-9]/g, ''))}
                                                    placeholder="e.g. 199"
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500/20"
                                                />
                                            </div>
                                            <div className="space-y-1 sm:col-span-12">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Description</label>
                                                <input
                                                    type="text"
                                                    value={newServiceDesc}
                                                    onChange={(e) => setNewServiceDesc(e.target.value)}
                                                    placeholder={t('pro.summaryPlaceholder')}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500/20"
                                                />
                                            </div>
                                        </div>

                                        {/* Multi-Photo Picker for Service */}
                                        <div className="space-y-2 pt-2 border-t border-slate-200/60">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                                                    Service Photos ({newServiceImages.length}) <span className="text-slate-400 font-normal">(Multiple photos allowed)</span>
                                                </label>
                                                <span className="text-[9px] text-slate-400 font-bold">Max 10 MB each</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                {newServiceImages.map((imgUrl, imgIdx) => (
                                                    <div key={imgIdx} className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 group shrink-0">
                                                        <img src={imgUrl} alt={`Service photo ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveNewServiceImage(imgIdx)}
                                                            className="absolute top-1 right-1 p-1 bg-black/75 hover:bg-black text-white rounded-full transition-all"
                                                            title="Remove photo"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <label className="cursor-pointer flex flex-col items-center justify-center h-16 w-20 sm:h-20 sm:w-24 bg-white hover:bg-slate-100/80 border border-dashed border-slate-300 rounded-xl transition-all shrink-0">
                                                    {isUploadingServiceMedia ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                                                    ) : (
                                                        <>
                                                            <Upload className="h-4 w-4 text-slate-500" />
                                                            <span className="text-[9px] font-black uppercase text-slate-700 mt-1">+ Photo</span>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={handleUploadServiceImage}
                                                        disabled={isUploadingServiceMedia}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <button
                                                type="button"
                                                onClick={handleAddServiceItem}
                                                className="px-6 py-2.5 bg-black hover:bg-slate-900 text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-md text-xs font-black uppercase tracking-wider"
                                            >
                                                <Plus className="h-4 w-4" />
                                                <span>Add Service to List</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {servicesList.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center py-6 font-bold">{t('pro.noServices')}</p>
                                        ) : (
                                            servicesList.map((svc, i) => (
                                                <div key={i} className="flex justify-between items-center p-3 sm:p-4 bg-slate-50/50 rounded-2xl border border-slate-100 gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {Array.isArray(svc.images) && svc.images.length > 0 ? (
                                                            <div className="flex items-center -space-x-4 shrink-0">
                                                                {svc.images.slice(0, 3).map((imgUrl, sIdx) => (
                                                                    <img key={sIdx} src={imgUrl} alt={svc.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border-2 border-white shadow-sm" />
                                                                ))}
                                                                {svc.images.length > 3 && (
                                                                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-black/80 text-white font-black text-[10px] flex items-center justify-center border-2 border-white shadow-sm">
                                                                        +{svc.images.length - 3}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : svc.image ? (
                                                            <img src={svc.image} alt={svc.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border border-slate-200 shrink-0" />
                                                        ) : (
                                                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                                                <ImageIcon className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-black text-slate-900 truncate">{svc.name}</h4>
                                                            {svc.description && <p className="text-xs text-slate-400 font-bold line-clamp-1">{svc.description}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0">
                                                        <span className="text-sm font-black text-emerald-600">{svc.price === 0 || svc.price === '0' ? 'FREE' : '₹' + svc.price}</span>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Ready Catalog View Only */}
                                    {ad.services?.length > 0 ? (
                                        ad.services.map((svc, i) => (
                                            <div key={i} className="p-3 sm:p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {Array.isArray(svc.images) && svc.images.length > 0 ? (
                                                        <div className="flex items-center -space-x-4 shrink-0">
                                                            {svc.images.slice(0, 3).map((imgUrl, sIdx) => (
                                                                <img key={sIdx} src={imgUrl} alt={svc.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border-2 border-white shadow-sm" />
                                                            ))}
                                                            {svc.images.length > 3 && (
                                                                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-black/80 text-white font-black text-[10px] flex items-center justify-center border-2 border-white shadow-sm">
                                                                    +{svc.images.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : svc.image ? (
                                                        <img src={svc.image} alt={svc.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border border-slate-200 shrink-0" />
                                                    ) : (
                                                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                                            <ImageIcon className="h-5 w-5" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-black text-slate-900 truncate">{svc.name}</h4>
                                                        {svc.description && <p className="text-xs text-slate-400 font-bold mt-0.5 line-clamp-2">{svc.description}</p>}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-black text-emerald-600 shrink-0">{svc.price === 0 || svc.price === '0' ? 'FREE' : '₹' + svc.price}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-2 flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-6 space-y-4">
                                            <div className="p-3 bg-brand-50 rounded-full text-brand-600">
                                                <Plus className="h-6 w-6" />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <p className="text-sm font-black text-slate-800">{t('pro.catalogEmpty')}</p>
                                                <p className="text-xs text-slate-400 font-bold max-w-xs">{t('pro.catalogEmptySub')}</p>
                                            </div>
                                            <button
                                                onClick={() => setIsEditingCatalog(true)}
                                                className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 shadow-sm"
                                            >
                                                {t('pro.addFirst')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-8 md:p-12 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                        {/* SERVICE PROFESSIONAL REGISTRATION WIZARD */}
                        <div>
                            <h1 className="text-2xl font-black text-slate-950 flex items-center gap-2">
                                {t('pro.registerTitle')}
                                <Sparkles className="h-5 w-5 text-brand-500" />
                            </h1>
                            <p className="text-sm text-slate-400 font-bold mt-1">{t('pro.registerSub')}</p>
                        </div>

                        <form onSubmit={handleRegister} noValidate className="space-y-6">
                            {/* Business / Profile Photo */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                                <div className="relative h-20 w-20 rounded-2xl overflow-hidden bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0">
                                    {regProfileImage ? (
                                        <>
                                            <img src={regProfileImage} alt="Profile preview" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setRegProfileImage('')}
                                                className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-all"
                                                title="Remove"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <ImageIcon className="h-6 w-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 text-center sm:text-left space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        Business / Profile Photo (Optional)
                                    </label>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        Upload your shop board, work photo, or profile picture (Max 10 MB • JPG, PNG, WEBP)
                                    </p>
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 cursor-pointer shadow-sm">
                                        {isUploadingRegImage ? <Loader2 className="h-3 w-3 animate-spin text-brand-500" /> : <Upload className="h-3 w-3" />}
                                        <span>{regProfileImage ? 'Change Photo' : 'Upload Photo'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleUploadProfilePhoto(e, setRegProfileImage, setIsUploadingRegImage)}
                                            disabled={isUploadingRegImage}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('auth.fullName')} <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.name && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.name}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        name="name"
                                        id="reg-name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value.replace(/[^a-zA-Z\s]/g, ''));
                                            clearRegError('name');
                                        }}
                                        placeholder={t('editProfile.namePlaceholder')}
                                        className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all ${
                                            regErrors.name 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('editProfile.phone')} <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.phone && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.phone}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 select-none">
                                            +91
                                        </span>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            name="phone"
                                            id="reg-phone"
                                            maxLength={10}
                                            value={phone}
                                            onChange={(e) => {
                                                setPhone(e.target.value.replace(/\D/g, ''));
                                                clearRegError('phone');
                                            }}
                                            placeholder="9876543210"
                                            className={`w-full pl-12 pr-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all tracking-wider ${
                                                regErrors.phone 
                                                    ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                    : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                            }`}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.emailOptional')} <span className="text-slate-400 font-normal">({t('common.optional', { defaultValue: 'Optional' })})</span>
                                        </label>
                                        {regErrors.email && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.email}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        id="reg-email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            clearRegError('email');
                                        }}
                                        placeholder="yourname@domain.com"
                                        className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all ${
                                            regErrors.email 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.professionTitle')} <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.profession && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.profession}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        name="profession"
                                        id="reg-profession"
                                        value={profession}
                                        onChange={(e) => {
                                            setProfession(e.target.value);
                                            clearRegError('profession');
                                        }}
                                        placeholder={t('pro.professionPlaceholder')}
                                        className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all ${
                                            regErrors.profession 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-2 col-span-1 md:col-span-2" id="reg-categoryIds">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.selectCategories')} <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.categoryIds && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.categoryIds}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-2 rounded-2xl transition-all ${
                                        regErrors.categoryIds ? 'border-2 border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/10' : ''
                                    }`}>
                                        {categories.map((cat) => {
                                            const isSelected = categoryIds.includes(cat._id);
                                            return (
                                                <label
                                                    key={cat._id}
                                                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${isSelected
                                                            ? 'bg-brand-50 border-brand-500/20 text-slate-900 shadow-sm ring-1 ring-brand-500/30'
                                                            : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/75'
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
                                                            clearRegError('categoryIds');
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
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.experience')} (Years) <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.experienceYears && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.experienceYears}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        name="experienceYears"
                                        id="reg-experienceYears"
                                        min="0"
                                        max="70"
                                        value={experienceYears}
                                        onChange={(e) => {
                                            setExperienceYears(e.target.value);
                                            clearRegError('experienceYears');
                                        }}
                                        placeholder="e.g. 5"
                                        className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all ${
                                            regErrors.experienceYears 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.city')} <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.city && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.city}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        name="city"
                                        id="reg-city"
                                        value={city}
                                        onChange={(e) => {
                                            setCity(e.target.value.replace(/[^a-zA-Z\s]/g, ''));
                                            clearRegError('city');
                                        }}
                                        placeholder={t('pro.cityPlaceholder')}
                                        className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all ${
                                            regErrors.city 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.address')} <span className="text-rose-500">*</span>
                                        </label>
                                        {regErrors.address && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {regErrors.address}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        name="address"
                                        id="reg-address"
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value);
                                            clearRegError('address');
                                        }}
                                        placeholder={t('pro.addressPlaceholder')}
                                        className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all ${
                                            regErrors.address 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 p-5 bg-indigo-50/40 rounded-3xl border border-indigo-100/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800">{t('pro.coordsTitle')}</h4>
                                        <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                                            {t('pro.coordsSub')}
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
                                                {t('pro.detect')}
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.latitude')}</label>
                                    <input
                                        type="text"
                                        name="lat"
                                        id="reg-lat"
                                        value={lat}
                                        onChange={(e) => setLat(e.target.value)}
                                        placeholder="e.g. 22.7196"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.longitude')}</label>
                                    <input
                                        type="text"
                                        name="lng"
                                        id="reg-lng"
                                        value={lng}
                                        onChange={(e) => setLng(e.target.value)}
                                        placeholder="e.g. 75.8577"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                    />
                                </div>
                            </div>


                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        {t('pro.description')} <span className="text-rose-500">*</span>
                                    </label>
                                    {regErrors.description && (
                                        <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                            <AlertCircle size={11} /> {regErrors.description}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    name="description"
                                    id="reg-description"
                                    value={description}
                                    onChange={(e) => {
                                        setDescription(e.target.value);
                                        clearRegError('description');
                                    }}
                                    placeholder={t('pro.descriptionPlaceholder')}
                                    rows="4"
                                    className={`w-full px-5 py-4 rounded-[16px] text-sm font-bold text-slate-900 outline-none transition-all resize-none ${
                                        regErrors.description 
                                            ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                            : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                    }`}
                                />
                                <p className="text-[10px] text-slate-400 font-bold text-right">
                                    {description.trim().length}/10 characters minimum
                                </p>
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
                                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">{t('pro.feeTitle')}</h4>
                                            <p className="text-xs text-amber-700 font-bold leading-relaxed">
                                                {isFree ? (
                                                    t('pro.feeFree')
                                                ) : (
                                                    t('pro.feePaid', { amount: fee })
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
                                {t('pro.registerButton')} <ChevronRight className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                ))}

            {activeTab === 'banners' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-black text-slate-955 flex items-center gap-2">
                                {t('pro.tabBanners')}
                                <Sparkles className="h-5 w-5 text-brand-500 animate-pulse" />
                            </h1>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed max-w-xl">
                                {t('pro.bannersSub', { amount: settings?.platformAdListingFee ?? 999 })}
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
                                    <p className="text-sm font-black text-slate-800">{t('pro.noBanners')}</p>
                                    <p className="text-xs text-slate-400 font-bold max-w-sm">{t('pro.noBannersSub')}</p>
                                </div>
                                <button
                                    onClick={() => setIsSubmittingPlatformAd(true)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    {t('pro.firstBanner')}
                                </button>
                            </div>
                        ) : (
                            platformAds.map((adItem) => (
                                <div key={adItem._id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    {/* Media preview */}
                                    {(() => {
                                        // Every image and video on the ad (main item first, no duplicates).
                                        const seen = new Set();
                                        const media = [
                                            ...[adItem.imageUrl, ...(adItem.posters || [])].map((src) => ({ type: 'image', src })),
                                            ...[adItem.videoUrl, ...(adItem.videos || [])].map((src) => ({ type: 'video', src })),
                                            { type: adItem.mediaType === 'video' ? 'video' : 'image', src: adItem.mediaUrl },
                                        ].filter((m) => m.src && !seen.has(m.src) && seen.add(m.src));
                                        const main = media[0];
                                        const thumbs = media.length > 1 ? media.slice(0, 4) : [];
                                        const extra = media.length - thumbs.length;
                                        const imageCount = media.filter((m) => m.type === 'image').length;
                                        const videoCount = media.length - imageCount;
                                        return (
                                            <div className="md:col-span-4 space-y-2">
                                                <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative aspect-video flex items-center justify-center">
                                                    {!main ? (
                                                        <span className="text-[9px] font-black uppercase text-slate-400">{t('pro.noImage')}</span>
                                                    ) : main.type === 'video' ? (
                                                        <video src={main.src} controls className="w-full h-full object-contain bg-black" />
                                                    ) : (
                                                        <img src={main.src} alt={adItem.title} className="w-full h-full object-cover" />
                                                    )}
                                                    {media.length > 1 && (
                                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                                                            {[imageCount && `${imageCount} photo${imageCount > 1 ? 's' : ''}`, videoCount && `${videoCount} video${videoCount > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                                                        </span>
                                                    )}
                                                </div>
                                                {thumbs.length > 0 && (
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {thumbs.map((m, idx) => (
                                                            <div key={m.src} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                                                                {m.type === 'video' ? (
                                                                    <video src={m.src} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <img src={m.src} alt="" loading="lazy" className="w-full h-full object-cover" />
                                                                )}
                                                                {idx === thumbs.length - 1 && extra > 0 && (
                                                                    <span className="absolute inset-0 bg-black/55 text-white text-xs font-bold flex items-center justify-center">+{extra}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Ad Details */}
                                    <div className="md:col-span-5 space-y-2">
                                        <div className="flex items-center gap-2 overflow-hidden w-full">
                                            <h3 className="text-base font-black text-slate-900 truncate flex-1" title={adItem.title}>{adItem.title}</h3>
                                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider shrink-0">{adItem.city}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-3">{adItem.content}</p>
                                        {adItem.targetUrl && (
                                            <a href={adItem.targetUrl} target="_blank" rel="noreferrer" className="inline-flex text-[10px] font-black text-brand-600 hover:text-brand-700 underline truncate max-w-full">
                                                {t('pro.targetLink', { url: adItem.targetUrl })}
                                            </a>
                                        )}
                                        {adItem.approvalStatus === 'rejected' && adItem.rejectionReason && (
                                            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100">
                                                {t('pro.rejectionReason', { reason: adItem.rejectionReason })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Status and Action */}
                                    <div className="md:col-span-3 flex flex-col gap-2 items-start md:items-end justify-between h-full min-h-[100px]">
                                        <div className="flex flex-col gap-1 items-start md:items-end w-full">
                                            {/* Approval status badge */}
                                            {adItem.paymentStatus === 'unpaid' ? (
                                                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500">
                                                    {t('pro.draft')}
                                                </span>
                                            ) : (
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider capitalize ${adItem.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                                        adItem.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                    {adItem.approvalStatus === 'pending' ? t('pro.pendingApproval') : t(`pro.status.${adItem.approvalStatus}`, { defaultValue: adItem.approvalStatus })}
                                                </span>
                                            )}
                                            {/* Payment status badge */}
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider capitalize ${adItem.paymentStatus === 'paid' ? 'bg-sky-50 text-sky-700' : 'bg-slate-50 text-slate-500'
                                                }`}>
                                                {t(`pro.status.${adItem.paymentStatus}`, { defaultValue: adItem.paymentStatus })}
                                            </span>
                                        </div>

                                        {adItem.paymentStatus === 'unpaid' && (
                                            <button
                                                onClick={() => handlePayPlatformAd(adItem)}
                                                className="w-full px-4 py-2.5 bg-black hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-center"
                                            >
                                                {t('pro.payToSubmit', { amount: adItem.price || settings?.platformAdListingFee || 999 })}
                                            </button>
                                        )}
                                        {/* Engagement Analytics Pills */}
                                        <div className="flex items-center gap-1.5 w-full justify-start md:justify-end flex-wrap mt-1">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black" title="Total unique views">
                                                <Eye className="h-3 w-3" /> {adItem.visitsCount || 0} Views
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black" title="Direct contacts & clicks">
                                                <PhoneCall className="h-3 w-3" /> {adItem.contactsCount || 0} Inquiries
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleEditPlatformAd(adItem)}
                                            className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-center mt-1 flex items-center justify-center gap-1.5"
                                        >
                                            <Edit2 className="h-3 w-3" /> Edit Request
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* CREATE PLATFORM AD MODAL */}
            {isSubmittingPlatformAd && (() => {
                const inputCls = (hasError) =>
                    `w-full h-11 px-3.5 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none transition border ${
                        hasError
                            ? 'border-rose-400 ring-2 ring-rose-100'
                            : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
                    }`;
                const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5';
                const sectionTitleCls = 'text-sm font-semibold text-slate-900';
                const fieldError = (msg) =>
                    msg ? (
                        <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                            <AlertCircle size={12} /> {msg}
                        </p>
                    ) : null;
                const contentLen = platContent.trim().length;
                const isVideoTab = activeMediaTab === 'video';
                const primaryPreview = isVideoTab ? primaryBannerVideo : primaryBannerImage;
                const destinations = [
                    { id: 'showcase', title: 'SevaFast page', desc: 'We create a page with your photos, videos and Call / WhatsApp buttons.' },
                    { id: 'website', title: 'Your website', desc: 'Tapping the banner opens your own website or online store.' },
                ];

                return (
                <div
                    className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[550] sm:p-4 animate-in fade-in overscroll-contain"
                    onWheel={preventBackdropScroll}
                    onTouchMove={preventBackdropScroll}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) resetPlatformAdForm();
                    }}
                >
                    <div
                        data-lenis-prevent
                        data-lenis-prevent-wheel
                        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overscroll-contain animate-in slide-in-from-bottom-4 duration-200"
                        style={{ maxHeight: '92vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingPlatformAdId ? t('pro.editBanner') : 'Create a banner ad'}
                                </h2>
                                <p className="text-[13px] text-slate-500 mt-0.5">Shown in the home page banner slider</p>
                            </div>
                            <button
                                type="button"
                                onClick={resetPlatformAdForm}
                                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4 text-slate-600" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubmitPlatformAd}
                            id="banner-ad-form"
                            noValidate
                            data-lenis-prevent
                            data-lenis-prevent-wheel
                            className="flex-1 overflow-y-auto px-5 py-5 space-y-6 overscroll-contain touch-pan-y"
                        >
                            {/* 1. Banner image / video */}
                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className={sectionTitleCls}>Banner <span className="text-rose-500">*</span></h3>
                                    <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                                        {[
                                            { id: 'image', label: t('pro.image'), done: Boolean(primaryBannerImage) },
                                            { id: 'video', label: t('pro.video'), done: Boolean(primaryBannerVideo) },
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setActiveMediaTab(tab.id)}
                                                className={`px-3 py-1.5 rounded-md transition ${
                                                    activeMediaTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                                                }`}
                                            >
                                                {tab.label}{tab.done ? ' ✓' : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <label
                                    className={`relative flex items-center justify-center w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer transition border-2 border-dashed ${
                                        bannerErrors.media
                                            ? 'border-rose-300 bg-rose-50/40'
                                            : primaryPreview
                                                ? 'border-transparent bg-slate-100'
                                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                >
                                    {isUploadingMedia ? (
                                        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                                    ) : primaryPreview ? (
                                        isVideoTab ? (
                                            <video src={primaryPreview} className="h-full w-full object-cover" controls />
                                        ) : (
                                            <img src={primaryPreview} alt="" className="h-full w-full object-cover" />
                                        )
                                    ) : (
                                        <div className="text-center px-6">
                                            <div className="mx-auto h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2">
                                                <Upload className="h-4 w-4 text-slate-600" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-700">
                                                {isVideoTab ? t('pro.uploadVideo') : t('pro.uploadPhoto')}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {isVideoTab ? t('pro.videoHint') : 'A wide image works best (16:9)'}
                                            </p>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept={isVideoTab ? 'video/*' : 'image/*'}
                                        className="hidden"
                                        onChange={(e) => {
                                            handleUploadMediaFile(
                                                e,
                                                isVideoTab ? replacePrimaryBannerVideo : replacePrimaryBannerImage,
                                                () => { }
                                            );
                                            clearBannerError('media');
                                        }}
                                        disabled={isUploadingMedia}
                                    />
                                </label>
                                <div className="flex items-center justify-between">
                                    {fieldError(bannerErrors.media)}
                                    {primaryPreview && !isUploadingMedia && (
                                        <button
                                            type="button"
                                            onClick={isVideoTab ? removePrimaryBannerVideo : removePrimaryBannerImage}
                                            className="ml-auto text-xs font-medium text-rose-600"
                                        >
                                            {isVideoTab ? t('pro.removeVideo') : t('pro.removePhoto')}
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* 2. Ad details */}
                            <section className="space-y-4">
                                <h3 className={sectionTitleCls}>Ad details</h3>
                                <div>
                                    <label className={labelCls}>{t('pro.adTitle')} <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={platTitle}
                                        onChange={(e) => {
                                            setPlatTitle(e.target.value);
                                            clearBannerError('title');
                                        }}
                                        placeholder={t('pro.adTitlePlaceholder')}
                                        className={inputCls(bannerErrors.title)}
                                    />
                                    {fieldError(bannerErrors.title)}
                                </div>
                                <div>
                                    <label className={labelCls}>{t('pro.adCity')} <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={platCity}
                                        onChange={(e) => {
                                            setPlatCity(e.target.value.replace(/[^a-zA-Z\s]/g, ''));
                                            clearBannerError('city');
                                        }}
                                        placeholder={t('pro.cityPlaceholder')}
                                        className={inputCls(bannerErrors.city)}
                                    />
                                    {fieldError(bannerErrors.city)}
                                </div>
                                <div>
                                    <label className={labelCls}>{t('pro.adContent')} <span className="text-rose-500">*</span></label>
                                    <textarea
                                        value={platContent}
                                        onChange={(e) => {
                                            setPlatContent(e.target.value);
                                            clearBannerError('content');
                                        }}
                                        placeholder="Describe your offer: what it is, the price or discount, and how long it runs."
                                        rows={4}
                                        className={`${inputCls(bannerErrors.content)} h-auto py-3 resize-none leading-relaxed`}
                                    />
                                    <div className="flex items-start justify-between gap-2">
                                        {fieldError(bannerErrors.content)}
                                        {contentLen < 10 && !bannerErrors.content && (
                                            <p className="mt-1 ml-auto text-xs text-slate-400">{10 - contentLen} more characters needed</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* 3. Where the banner opens */}
                            <section className="space-y-3">
                                <h3 className={sectionTitleCls}>When customers tap the banner</h3>
                                <div className="space-y-2">
                                    {destinations.map((opt) => {
                                        const active = platDestinationType === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setPlatDestinationType(opt.id)}
                                                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${
                                                    active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-slate-900' : 'border-slate-300'}`}>
                                                    {active && <span className="h-2 w-2 rounded-full bg-slate-900" />}
                                                </span>
                                                <span>
                                                    <span className="block text-sm font-medium text-slate-900">{opt.title}</span>
                                                    <span className="block text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {platDestinationType === 'website' && (
                                    <div className="animate-in fade-in">
                                        <label className={labelCls}>Website link <span className="text-rose-500">*</span></label>
                                        <input
                                            type="url"
                                            inputMode="url"
                                            value={platTargetUrl}
                                            onChange={(e) => {
                                                setPlatTargetUrl(e.target.value);
                                                clearBannerError('targetUrl');
                                            }}
                                            placeholder="https://yourstore.com"
                                            className={inputCls(bannerErrors.targetUrl)}
                                        />
                                        {fieldError(bannerErrors.targetUrl)}
                                    </div>
                                )}
                            </section>

                            {/* 4. SevaFast page details */}
                            {platDestinationType === 'showcase' && (
                                <section className="space-y-4 animate-in fade-in">
                                    <div>
                                        <h3 className={sectionTitleCls}>Your SevaFast page</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Optional, but customers trust pages with contact details.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Business name</label>
                                            <input
                                                type="text"
                                                value={platBusinessName}
                                                onChange={(e) => setPlatBusinessName(e.target.value)}
                                                placeholder="e.g. Verma Electronics"
                                                className={inputCls(false)}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Shop address</label>
                                            <input
                                                type="text"
                                                value={platAddress}
                                                onChange={(e) => setPlatAddress(e.target.value)}
                                                placeholder="e.g. Shop 14, Main Market"
                                                className={inputCls(false)}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Phone</label>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                value={platContactPhone}
                                                onChange={(e) => setPlatContactPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                                placeholder="10-digit number"
                                                className={inputCls(false)}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>WhatsApp</label>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                value={platWhatsapp}
                                                onChange={(e) => setPlatWhatsapp(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                                placeholder="10-digit number"
                                                className={inputCls(false)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelCls}>
                                            More photos &amp; videos
                                            <span className="font-normal text-slate-400"> · {platPosters.length + platVideos.length} added</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {platPosters.map((posterUrl, pIdx) => (
                                                <div key={`p-${posterUrl}-${pIdx}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                                                    <img src={posterUrl} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePoster(pIdx)}
                                                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                                                        aria-label="Remove photo"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {platVideos.map((vidUrl, vIdx) => (
                                                <div key={`v-${vidUrl}-${vIdx}`} className="relative aspect-square rounded-xl overflow-hidden bg-black">
                                                    <video src={vidUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                                                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] flex items-center gap-1">
                                                        <VideoIcon className="h-3 w-3" /> Video
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBannerVideo(vIdx)}
                                                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                                                        aria-label="Remove video"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500">
                                                {isUploadingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                                                <span className="text-xs font-medium">Add photo</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleUploadPosterFile} disabled={isUploadingPoster} />
                                            </label>
                                            <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-500">
                                                {isUploadingBannerVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <VideoIcon className="h-4 w-4" />}
                                                <span className="text-xs font-medium">Add video</span>
                                                <input type="file" accept="video/*" className="hidden" onChange={handleUploadBannerVideoFile} disabled={isUploadingBannerVideo} />
                                            </label>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1.5">Offer posters, rate cards or work videos (video max 20 MB).</p>
                                    </div>
                                </section>
                            )}
                        </form>

                        {/* Footer: price + actions */}
                        <div className="shrink-0 border-t border-slate-100 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-[13px] text-slate-500">30 days · reviewed by admin after payment</span>
                                <span className="text-base font-bold text-slate-900">₹{settings?.platformAdListingFee ?? 999}</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={resetPlatformAdForm}
                                    className="flex-1 h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                                >
                                    {t('common:actions.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    form="banner-ad-form"
                                    disabled={isLoading || isUploadingMedia}
                                    className="flex-[1.4] h-12 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? t('orderDetail.submitting') : (editingPlatformAdId ? t('pro.updateContinue') : t('pro.submitPay'))}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* EDIT CATEGORIES MODAL */}
            {isEditingCategories && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in overscroll-contain"
                    onWheel={preventBackdropScroll}
                    onTouchMove={preventBackdropScroll}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsEditingCategories(false);
                    }}
                >
                    <div 
                        data-lenis-prevent
                        data-lenis-prevent-wheel
                        className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto scrollbar-none overscroll-contain touch-pan-y"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{t('pro.manageCategories')}</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">{t('pro.manageCategoriesSub')}</p>
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
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${isSelected
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
                                {t('common:actions.cancel')}
                            </button>
                            <button
                                onClick={handleSaveCategories}
                                className="flex-1 py-4 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center hover:scale-[1.01]"
                            >
                                {t('checkout.saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM PAYMENT MODAL */}
            {isConfirmingPayment && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in overscroll-contain"
                    onWheel={preventBackdropScroll}
                    onTouchMove={preventBackdropScroll}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsConfirmingPayment(false);
                    }}
                >
                    <div 
                        data-lenis-prevent
                        data-lenis-prevent-wheel
                        className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 overscroll-contain"
                    >
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900">{t('pro.activateTitle')}</h2>
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
                                    <span className="font-bold text-slate-500">{t('pro.activationFee')}</span>
                                    <span className="font-black text-slate-800">₹{getListingPriceToShow()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-500">{t('pro.yourWallet')}</span>
                                    <span className="font-black text-slate-800">
                                        ₹{walletBalance}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 text-emerald-800 text-xs font-semibold leading-relaxed">
                                <Sparkles className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">{t('pro.activationReady')}</p>
                                    <p className="mt-0.5 text-emerald-600">Click below to deduct ₹{getListingPriceToShow()} from your wallet balance and activate the ad listing.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsConfirmingPayment(false)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                            >
                                {t('common:actions.cancel')}
                            </button>
                            <button
                                onClick={executePayment}
                                className="flex-1 py-4 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center hover:scale-[1.01]"
                            >
                                {t('pro.payNow', { amount: getListingPriceToShow() })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT PROFILE DETAILS & MEDIA MODAL */}
            {isEditingProfile && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[550] p-4 animate-in fade-in overscroll-contain"
                    onWheel={preventBackdropScroll}
                    onTouchMove={preventBackdropScroll}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsEditingProfile(false);
                    }}
                >
                    <div 
                        data-lenis-prevent
                        data-lenis-prevent-wheel
                        className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto scrollbar-none animate-in zoom-in-95 duration-200 overscroll-contain touch-pan-y"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{t('pro.editTitle')}</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1">{t('pro.editSub')}</p>
                            </div>
                            <button
                                onClick={() => setIsEditingProfile(false)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProfileSubmit} noValidate className="space-y-4">
                            {/* Business / Profile Photo */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                                <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0">
                                    {editMediaUrl ? (
                                        <>
                                            <img src={editMediaUrl} alt="Profile preview" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setEditMediaUrl('')}
                                                className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-all"
                                                title="Remove"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <ImageIcon className="h-6 w-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 text-center sm:text-left space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        Business / Profile Photo (Optional)
                                    </label>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        Upload your shop board, work photo, or profile picture (Max 10 MB • JPG, PNG, WEBP)
                                    </p>
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 cursor-pointer shadow-sm">
                                        {isUploadingEditImage ? <Loader2 className="h-3 w-3 animate-spin text-brand-500" /> : <Upload className="h-3 w-3" />}
                                        <span>{editMediaUrl ? 'Change Photo' : 'Upload Photo'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleUploadProfilePhoto(e, setEditMediaUrl, setIsUploadingEditImage)}
                                            disabled={isUploadingEditImage}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('auth.fullName')} <span className="text-rose-500">*</span>
                                        </label>
                                        {editErrors.name && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.name}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        id="edit-name"
                                        name="edit-name"
                                        value={editName}
                                        onChange={(e) => {
                                            setEditName(e.target.value.replace(/[^a-zA-Z\s]/g, ''));
                                            clearEditError('name');
                                        }}
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all ${
                                            editErrors.name 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('editProfile.phone')} <span className="text-rose-500">*</span>
                                        </label>
                                        {editErrors.phone && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.phone}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 select-none">
                                            +91
                                        </span>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            id="edit-phone"
                                            name="edit-phone"
                                            maxLength={10}
                                            value={editPhone}
                                            onChange={(e) => {
                                                setEditPhone(e.target.value.replace(/\D/g, ''));
                                                clearEditError('phone');
                                            }}
                                            className={`w-full pl-12 pr-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all tracking-wider ${
                                                editErrors.phone 
                                                    ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                    : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                            }`}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.emailOptional')} <span className="text-slate-400 font-normal">({t('common.optional', { defaultValue: 'Optional' })})</span>
                                        </label>
                                        {editErrors.email && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.email}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="email"
                                        id="edit-email"
                                        name="edit-email"
                                        value={editEmail}
                                        onChange={(e) => {
                                            setEditEmail(e.target.value);
                                            clearEditError('email');
                                        }}
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all ${
                                            editErrors.email 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.professionTitle')} <span className="text-rose-500">*</span>
                                        </label>
                                        {editErrors.profession && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.profession}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        id="edit-profession"
                                        name="edit-profession"
                                        value={editProfession}
                                        onChange={(e) => {
                                            setEditProfession(e.target.value);
                                            clearEditError('profession');
                                        }}
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all ${
                                            editErrors.profession 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.experience')} (Years) <span className="text-rose-500">*</span>
                                        </label>
                                        {editErrors.experienceYears && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.experienceYears}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        id="edit-experienceYears"
                                        name="edit-experienceYears"
                                        min="0"
                                        max="70"
                                        value={editExperienceYears}
                                        onChange={(e) => {
                                            setEditExperienceYears(e.target.value);
                                            clearEditError('experienceYears');
                                        }}
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all ${
                                            editErrors.experienceYears 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.city')} <span className="text-rose-500">*</span>
                                        </label>
                                        {editErrors.city && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.city}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        id="edit-city"
                                        name="edit-city"
                                        value={editCity}
                                        onChange={(e) => {
                                            setEditCity(e.target.value.replace(/[^a-zA-Z\s]/g, ''));
                                            clearEditError('city');
                                        }}
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all ${
                                            editErrors.city 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            {t('pro.address')} <span className="text-rose-500">*</span>
                                        </label>
                                        {editErrors.address && (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                                <AlertCircle size={11} /> {editErrors.address}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        id="edit-address"
                                        name="edit-address"
                                        value={editAddress}
                                        onChange={(e) => {
                                            setEditAddress(e.target.value);
                                            clearEditError('address');
                                        }}
                                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all ${
                                            editErrors.address 
                                                ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                                : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.latitude')}</label>
                                    <input
                                        type="text"
                                        id="edit-lat"
                                        name="edit-lat"
                                        value={editLat}
                                        onChange={(e) => setEditLat(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('pro.longitude')}</label>
                                    <input
                                        type="text"
                                        id="edit-lng"
                                        name="edit-lng"
                                        value={editLng}
                                        onChange={(e) => setEditLng(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        {t('pro.description')} <span className="text-rose-500">*</span>
                                    </label>
                                    {editErrors.description && (
                                        <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 animate-in fade-in">
                                            <AlertCircle size={11} /> {editErrors.description}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    id="edit-description"
                                    name="edit-description"
                                    value={editDescription}
                                    onChange={(e) => {
                                        setEditDescription(e.target.value);
                                        clearEditError('description');
                                    }}
                                    rows="3"
                                    className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-900 outline-none transition-all resize-none ${
                                        editErrors.description 
                                            ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/10' 
                                             : 'bg-slate-50 border border-slate-200/80 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                                    }`}
                                />
                                <p className="text-[10px] text-slate-400 font-bold text-right">
                                    {editDescription.trim().length}/10 characters minimum
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingProfile(false)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider text-center"
                                >
                                    {t('common:actions.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploadingMedia}
                                    className="flex-1 py-3.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider text-center hover:scale-[1.01] disabled:opacity-60"
                                >
                                    {t('checkout.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* VIDEO PLAYER PREVIEW MODAL */}
            {activeVideoModal && (
                <div
                    className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setActiveVideoModal(null)}
                >
                    <button
                        onClick={() => setActiveVideoModal(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl bg-black" onClick={(e) => e.stopPropagation()}>
                        <video src={activeVideoModal} controls autoPlay className="w-full aspect-video object-contain" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfessionalProfilePanel;
