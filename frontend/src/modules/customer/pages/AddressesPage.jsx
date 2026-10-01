import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Home, Briefcase, MapPin, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import { useLocation } from '../context/LocationContext';
import { normalizePhoneNumber, isValidIndianPhone } from '../utils/phoneValidation';

const AddressesPage = () => {
    const { t } = useTranslation('customer');
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshAddresses } = useLocation();
    const [addresses, setAddresses] = useState([]);
    const [rawAddresses, setRawAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');

    const fetchAddresses = useCallback(async () => {
        try {
            const { data } = await customerApi.getProfile();
            const profile = data?.result ?? data?.data ?? data;
            const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
            setRawAddresses(raw);
            setProfileName(profile?.name ?? '');
            const normalizedProfilePhone = normalizePhoneNumber(profile?.phone);
            setProfilePhone(normalizedProfilePhone);
            setAddresses(raw.map((addr, idx) => ({
                id: addr._id ?? idx,
                type: (addr.label || 'home').charAt(0).toUpperCase() + (addr.label || 'home').slice(1),
                name: profile?.name ?? '',
                address: addr.fullAddress || [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || '',
                city: addr.city,
                state: addr.state,
                pincode: addr.pincode,
                phone: normalizedProfilePhone,
                isDefault: idx === 0
            })));
        } catch {
            setAddresses([]);
            setRawAddresses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    // Auto-open Add modal when navigated from LocationDrawer with ?add=1
    useEffect(() => {
        if (searchParams.get('add') === '1' && !loading && !isAddOpen) {
            openAddModal();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, loading]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isGeoLocating, setIsGeoLocating] = useState(false);

    const [addForm, setAddForm] = useState({
        type: 'home',
        name: '',
        phone: '',
        address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: ''
    });

    useEffect(() => {
        if (!isAddOpen) {
            if (searchParams.get('add') === '1') {
                setSearchParams({}, { replace: true });
            }
            sessionStorage.removeItem('addAddressFormDraft');
        }
    }, [isAddOpen, searchParams, setSearchParams]);

    useEffect(() => {
        if (isAddOpen) {
            sessionStorage.setItem('addAddressFormDraft', JSON.stringify(addForm));
        }
    }, [addForm, isAddOpen]);

    const openAddModal = () => {
        const savedDraft = sessionStorage.getItem('addAddressFormDraft');
        if (savedDraft) {
            try {
                setAddForm(JSON.parse(savedDraft));
                setIsAddOpen(true);
                return;
            } catch (e) {
                // Ignore and fall through
            }
        }
        setAddForm({
            type: 'home',
            name: profileName,
            phone: profilePhone || '',
            address: '',
            landmark: '',
            city: '',
            state: '',
            pincode: ''
        });
        setIsAddOpen(true);
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error(t('addresses.errors.noGeo'));
            return;
        }
        setIsGeoLocating(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                if (!res.ok) throw new Error("Reverse geocode failed");
                const data = await res.json();
                
                const addressFields = data.address || {};
                const displayAddress = data.display_name || "";
                const city = addressFields.city || addressFields.town || addressFields.village || addressFields.county || "";
                const state = addressFields.state || "";
                const pincode = addressFields.postcode || "";
                
                setAddForm(prev => ({
                    ...prev,
                    address: displayAddress,
                    city: city,
                    state: state,
                    pincode: pincode
                }));
                toast.success(t('addresses.locationFetched'));
            } catch (err) {
                console.error(err);
                toast.error(t('addresses.errors.reverseGeo'));
            } finally {
                setIsGeoLocating(false);
            }
        }, (err) => {
            console.error(err);
            toast.error(t('addresses.errors.permission'));
            setIsGeoLocating(false);
        });
    };

    const handleSaveNewAddress = async () => {
        const name = addForm.name?.trim();
        const address = addForm.address?.trim();
        const city = addForm.city?.trim();
        const landmark = addForm.landmark?.trim();
        const state = addForm.state?.trim();
        const pincode = addForm.pincode?.trim();
        const phone = normalizePhoneNumber(addForm.phone);

        if (!name) return toast.error(t('addresses.errors.name'));
        if (!isValidIndianPhone(phone)) return toast.error(t('auth.errors.invalidPhone'));
        if (!address) return toast.error(t('addresses.errors.address'));
        if (!city) return toast.error(t('addresses.errors.city'));
        if (!state) return toast.error(t('addresses.errors.state'));
        if (!pincode || !/^\d{6}$/.test(pincode)) return toast.error(t('addresses.errors.pincode'));

        const isDuplicate = rawAddresses.some(a => 
            a.fullAddress?.toLowerCase() === address.toLowerCase() && 
            (a.label || 'home').toLowerCase() === addForm.type.toLowerCase()
        );
        if (isDuplicate) return toast.error(t('addresses.errors.duplicate'));

        const newAddr = {
            label: addForm.type.toLowerCase(),
            fullAddress: address,
            ...(landmark && { landmark }),
            ...(city && { city }),
            ...(state && { state }),
            ...(pincode && { pincode })
        };
        setSaving(true);
        try {
            // Best-effort: store coordinates + placeId so checkout can calculate distance-based delivery fees
            // without repeated Maps calls.
            try {
                const query = [address, landmark, city, state, pincode].filter(Boolean).join(', ');
                const geo = await customerApi.geocodeAddress(query);
                const loc = geo.data?.result?.location;
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                    newAddr.location = { lat: loc.lat, lng: loc.lng };
                    if (geo.data?.result?.placeId) newAddr.placeId = geo.data.result.placeId;
                    if (geo.data?.result?.formattedAddress) newAddr.formattedAddress = geo.data.result.formattedAddress;
                }
            } catch (e) {
                console.warn("Geocoding failed, but continuing to save the address:", e);
                toast.warning(t('addresses.savedNoCoords'));
            }

            await customerApi.updateProfile({
                ...(name && { name }),
                ...(phone && { phone }),
                addresses: [...rawAddresses, newAddr]
            });
            toast.success(t('addresses.saved'));
            setIsAddOpen(false);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || t('addresses.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const [editForm, setEditForm] = useState({
        type: 'home',
        name: '',
        phone: '',
        address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: ''
    });
    const [updating, setUpdating] = useState(false);

    const handleEdit = (addr) => {
        setSelectedAddress(addr);
        setEditForm({
            type: (addr.type || 'Home').toLowerCase(),
            name: addr.name ?? '',
            phone: addr.phone ?? '',
            address: addr.address ?? '',
            landmark: addr.landmark ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            pincode: addr.pincode ?? ''
        });
        setIsEditOpen(true);
    };

    const handleUpdateAddress = async () => {
        if (!selectedAddress) return;
        
        const name = editForm.name?.trim();
        const phone = normalizePhoneNumber(editForm.phone);
        const address = editForm.address?.trim();
        const city = editForm.city?.trim();
        const state = editForm.state?.trim();
        const pincode = editForm.pincode?.trim();

        if (!name) return toast.error(t('addresses.errors.name'));
        if (!isValidIndianPhone(phone)) return toast.error(t('auth.errors.invalidPhone'));
        if (!address) return toast.error(t('addresses.errors.address'));
        if (!city) return toast.error(t('addresses.errors.city'));
        if (!state) return toast.error(t('addresses.errors.state'));
        if (!pincode || !/^\d{6}$/.test(pincode)) return toast.error(t('addresses.errors.pincode'));

        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsEditOpen(false);
            return;
        }
        const updatedRaw = {
            ...(rawAddresses[idx] && typeof rawAddresses[idx] === 'object' ? rawAddresses[idx] : {}),
            label: editForm.type.toLowerCase(),
            fullAddress: address,
            ...(editForm.landmark?.trim() && { landmark: editForm.landmark.trim() }),
            ...(city && { city }),
            ...(state && { state }),
            ...(pincode && { pincode })
        };

        // Best-effort: refresh coordinates + placeId whenever address fields change.
        try {
            const query = [
                address,
                editForm.landmark?.trim(),
                city,
                state,
                pincode,
            ].filter(Boolean).join(', ');
            const geo = await customerApi.geocodeAddress(query);
            const loc = geo.data?.result?.location;
            if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                updatedRaw.location = { lat: loc.lat, lng: loc.lng };
                if (geo.data?.result?.placeId) updatedRaw.placeId = geo.data.result.placeId;
                if (geo.data?.result?.formattedAddress) updatedRaw.formattedAddress = geo.data.result.formattedAddress;
            }
        } catch (e) {
            console.warn("Geocoding failed, but continuing to update the address:", e);
            toast.warning(t('addresses.updatedNoCoords'));
        }

        const updatedAddresses = rawAddresses.map((raw, i) => (i === idx ? updatedRaw : raw));
        setUpdating(true);
        try {
            await customerApi.updateProfile({
                ...(name && { name }),
                ...(phone && { phone }),
                addresses: updatedAddresses
            });
            toast.success(t('addresses.updated'));
            setIsEditOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || t('addresses.errors.updateFailed'));
        } finally {
            setUpdating(false);
        }
    };

    const handleDelete = (addr) => {
        setSelectedAddress(addr);
        setIsDeleteOpen(true);
    };

    const [deleting, setDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!selectedAddress) return;
        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsDeleteOpen(false);
            return;
        }
        const updatedAddresses = rawAddresses.filter((_, i) => i !== idx);
        setDeleting(true);
        try {
            await customerApi.updateProfile({ addresses: updatedAddresses });
            toast.success(t('addresses.deleted'));
            setIsDeleteOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || t('addresses.errors.deleteFailed'));
        } finally {
            setDeleting(false);
        }
    };

    const handleSetDefault = async (addr) => {
        const idx = addresses.findIndex(a => (a.id === addr.id) || (a.address === addr.address && a.type === addr.type));
        if (idx <= 0) return; // Already default or not found

        const updatedAddresses = [...rawAddresses];
        const [movedAddress] = updatedAddresses.splice(idx, 1);
        updatedAddresses.unshift(movedAddress);

        try {
            await customerApi.updateProfile({ addresses: updatedAddresses });
            toast.success(t('addresses.defaultUpdated'));
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || t('addresses.errors.defaultFailed'));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans">
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{t('profile.menu.addresses')}</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                {/* Add New Address Button */}
                <button
                    onClick={openAddModal}
                    className="w-full bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors group"
                >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-sm">{t('checkout.addNewAddress')}</span>
                </button>

                {/* Address List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <p className="text-slate-500 font-medium">{t('addresses.loading')}</p>
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <MapPin size={30} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-700 font-semibold mb-1">{t('addresses.emptyTitle')}</p>
                            <p className="text-slate-500 text-sm">{t('addresses.emptyMessage')}</p>
                        </div>
                    ) : addresses.map((addr) => (
                        <div key={addr.id} className="bg-white rounded-xl p-4 border border-slate-200 relative overflow-hidden">
                            {addr.isDefault && (
                                <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-bl-lg uppercase tracking-wide">
                                    {t('addresses.default')}
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                                    {addr.type === 'Home' ? <Home size={18} /> : addr.type === 'Work' ? <Briefcase size={18} /> : <MapPin size={18} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-sm font-semibold text-slate-800">{t(`addresses.types.${String(addr.type || '').toLowerCase()}`, { defaultValue: addr.type })}</h3>
                                    </div>
                                    <p className="text-slate-800 font-medium text-sm mb-1">{addr.name}</p>
                                    <p className="text-slate-500 text-xs leading-relaxed mb-1">{addr.address}</p>
                                    <p className="text-slate-500 text-xs mb-2">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                                    <p className="text-slate-700 font-medium text-xs">{t('checkout.phone', { phone: addr.phone })}</p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                                {!addr.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(addr)}
                                        className="flex-1 min-w-[30%] py-2 rounded-lg bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        {t('addresses.setDefault')}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(addr)}
                                    className="flex-1 min-w-[25%] py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Edit2 size={14} /> {t('common:actions.edit')}
                                </button>
                                <button
                                    onClick={() => handleDelete(addr)}
                                    className="flex-1 min-w-[25%] py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Address Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t('checkout.addNewAddress')}</DialogTitle>
                        <DialogDescription>
                            {t('addresses.addSub')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleUseCurrentLocation}
                            disabled={isGeoLocating}
                            className="w-full flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 shadow-sm"
                        >
                            {isGeoLocating ? (
                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <MapPin size={16} className="text-indigo-600" />
                            )}
                            {isGeoLocating ? t('addresses.fetchingLocation') : t('addresses.useCurrent')}
                        </Button>

                        <div className="grid gap-2">
                            <Label>{t('addresses.type')}</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'home' ? 'border-primary text-primary bg-brand-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'home' }))}>{t('addresses.types.home')}</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'work' ? 'border-primary text-primary bg-brand-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'work' }))}>{t('addresses.types.work')}</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'other' ? 'border-primary text-primary bg-brand-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'other' }))}>{t('addresses.types.other')}</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">{t('auth.fullName')}</Label>
                            <Input id="name" placeholder={t('addresses.namePlaceholder')} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">{t('editProfile.phone')}</Label>
                            <Input id="phone" placeholder="+91 98765 43210" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">{t('addresses.address')}</Label>
                            <Textarea id="address" placeholder={t('addresses.addressPlaceholder')} value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="landmark">{t('addresses.landmark')}</Label>
                            <Input
                                id="landmark"
                                placeholder={t('addresses.landmarkPlaceholder')}
                                value={addForm.landmark}
                                onChange={e => setAddForm(f => ({ ...f, landmark: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="city">{t('addresses.city')}</Label>
                                <Input id="city" placeholder="New Delhi" value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="state">{t('addresses.state')}</Label>
                                <Input id="state" placeholder="Delhi" value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pincode">{t('addresses.pincode')}</Label>
                            <Input id="pincode" placeholder="110075" value={addForm.pincode} onChange={e => setAddForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={saving}>{t('common:actions.cancel')}</Button>
                        <Button className="bg-primary hover:bg-[#0b721b]" onClick={handleSaveNewAddress} disabled={saving}>{saving ? t('addresses.saving') : t('checkout.address.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Address Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t('addresses.editTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('addresses.editSub')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>{t('addresses.type')}</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'home' ? 'border-primary text-primary bg-brand-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'home' }))}>{t('addresses.types.home')}</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'work' ? 'border-primary text-primary bg-brand-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'work' }))}>{t('addresses.types.work')}</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'other' ? 'border-primary text-primary bg-brand-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'other' }))}>{t('addresses.types.other')}</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">{t('auth.fullName')}</Label>
                            <Input id="edit-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-phone">{t('editProfile.phone')}</Label>
                            <Input id="edit-phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-address">{t('addresses.address')}</Label>
                            <Textarea id="edit-address" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-landmark">{t('addresses.landmark')}</Label>
                            <Input
                                id="edit-landmark"
                                placeholder={t('addresses.landmarkPlaceholder')}
                                value={editForm.landmark}
                                onChange={e => setEditForm(f => ({ ...f, landmark: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-city">{t('addresses.city')}</Label>
                                <Input id="edit-city" placeholder="New Delhi" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-state">{t('addresses.state')}</Label>
                                <Input id="edit-state" placeholder="Delhi" value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-pincode">{t('addresses.pincode')}</Label>
                            <Input id="edit-pincode" placeholder="110075" value={editForm.pincode} onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={updating}>{t('common:actions.cancel')}</Button>
                        <Button className="bg-primary hover:bg-[#0b721b]" onClick={handleUpdateAddress} disabled={updating}>{updating ? t('addresses.updating') : t('addresses.update')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">{t('addresses.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('addresses.deleteMessage')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAddress && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800">{t(`addresses.types.${String(selectedAddress.type || '').toLowerCase()}`, { defaultValue: selectedAddress.type })}</span>
                            </div>
                            <p className="text-slate-600 text-sm">{selectedAddress.address}</p>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting}>{t('common:actions.cancel')}</Button>
                        <Button variant="destructive" className="bg-red-500 hover:bg-red-600" onClick={handleConfirmDelete} disabled={deleting}>{deleting ? t('addresses.deleting') : t('common:actions.delete')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddressesPage;

