import React, { useState, useEffect, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
    HiOutlineUserPlus,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineShieldCheck,
    HiOutlineMagnifyingGlass,
    HiOutlineMapPin,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineKey
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { getOrderSocket } from '@/core/services/orderSocket';

const ALL_PERMISSIONS = [
    "Dashboard",
    "Categories",
    "Professional Directory",
    "Products",
    "Marketing Tools",
    "Customer Support",
    "Sellers",
    "Delivery Drivers",
    "Wallet",
    "Money Requests",
    "Seller Payments",
    "Collect Cash",
    "Customers",
    "Sub-Admins",
    "Zones",
    "Referrals & Plans",
    "FAQs",
    "Orders",
    "Fees & Charges",
    "Settings",
    "Subscription Plans",
    "Login Activity",
    "My Profile",
    "System Settings"
];

const UserManagement = () => {
    const { showToast } = useToast();
    const [subadmins, setSubadmins] = useState([]);
    const [zones, setZones] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        assignedZones: [],
        allowedPermissions: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [subRes, zonesRes] = await Promise.all([
                adminApi.getSubadmins(),
                adminApi.getZones()
            ]);

            if (subRes.data.success) {
                setSubadmins(subRes.data.result?.subadmins || subRes.data.results || []);
            }
            if (zonesRes.data.success) {
                setZones(zonesRes.data.result?.zones || zonesRes.data.results || []);
            }
        } catch (error) {
            showToast('Failed to load data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                password: '',
                assignedZones: Array.isArray(user.assignedZones)
                    ? user.assignedZones.map(z => (z && typeof z === 'object' ? z._id : z))
                    : [],
                allowedPermissions: Array.isArray(user.allowedPermissions) ? user.allowedPermissions : []
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                assignedZones: [],
                allowedPermissions: []
            });
        }
        setIsModalOpen(true);
    };

    const handleTogglePermission = (permission) => {
        setFormData(prev => {
            const currentPerms = [...(prev.allowedPermissions || [])];
            const idx = currentPerms.indexOf(permission);
            if (idx > -1) {
                currentPerms.splice(idx, 1);
            } else {
                currentPerms.push(permission);
            }
            return { ...prev, allowedPermissions: currentPerms };
        });
    };

    const handleToggleZone = (zoneId) => {
        setFormData(prev => {
            const currentZones = [...prev.assignedZones];
            const idx = currentZones.indexOf(zoneId);
            if (idx > -1) {
                currentZones.splice(idx, 1);
            } else {
                currentZones.push(zoneId);
            }
            return { ...prev, assignedZones: currentZones };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Bug 254: Validate name - only alphabets and spaces allowed
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(formData.name.trim())) {
            showToast('Full name must contain only alphabets and spaces', 'error');
            return;
        }
        if (formData.phone.length !== 10) {
            showToast('Phone number must be exactly 10 digits', 'error');
            return;
        }
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                assignedZones: formData.assignedZones,
                allowedPermissions: formData.allowedPermissions
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            if (editingUser?._id) {
                const res = await adminApi.updateSubadmin(editingUser._id, payload);
                if (res.data.success) {
                    showToast('Sub-admin updated successfully', 'success');
                }
            } else {
                if (!formData.password) {
                    showToast('Password is required for new sub-admin', 'error');
                    return;
                }
                const res = await adminApi.createSubadmin(payload);
                if (res.data.success) {
                    showToast('New sub-admin created successfully', 'success');
                }
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save sub-admin', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await adminApi.deleteSubadmin(id);
            if (res.data.success) {
                showToast('Sub-admin removed successfully', 'warning');
                // Bug 255: Force-logout the deleted sub-admin via socket
                try {
                    const getToken = () => localStorage.getItem('auth_admin');
                    const socket = getOrderSocket(getToken);
                    if (socket) {
                        socket.emit('admin:force-logout', { targetAdminId: id });
                    }
                } catch (_) { /* ignore socket errors */ }
                fetchData();
                setDeleteTarget(null);
            }
        } catch (error) {
            showToast('Failed to delete sub-admin', 'error');
        }
    };

    const filteredUsers = useMemo(() => {
        return subadmins.filter(user => {
            const query = searchTerm.toLowerCase();
            return (
                user.name?.toLowerCase().includes(query) ||
                user.email?.toLowerCase().includes(query) ||
                user.phone?.toLowerCase().includes(query)
            );
        });
    }, [subadmins, searchTerm]);

    const getZoneNames = (zoneIds) => {
        if (!Array.isArray(zoneIds) || zoneIds.length === 0) return [];
        return zoneIds.map(val => {
            if (val && typeof val === 'object' && val.name) {
                return val.name;
            }
            const id = val && typeof val === 'object' ? val._id : val;
            const zone = zones.find(z => z._id === id);
            return zone ? zone.name : String(id);
        });
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Sub-Admin Access Control
                        <Badge variant="primary" className="text-[10px] font-black uppercase tracking-widest">Zone RBAC</Badge>
                    </h1>
                    <p className="ds-description mt-1">Manage sub-admins, zone access, and commission wallets.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <HiOutlineUserPlus className="h-5 w-5" />
                    CREATE NEW SUB-ADMIN
                </button>
            </div>

            {/* Quick Summary stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Sub-Admins</h4>
                    <h3 className="text-2xl font-black text-slate-900">{subadmins.length}</h3>
                </Card>
                <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Registered Zones</h4>
                    <h3 className="text-2xl font-black text-slate-900">{zones.length}</h3>
                </Card>
                <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Enforcement Status</h4>
                    <h3 className="text-2xl font-black text-brand-600">Active</h3>
                </Card>
            </div>

            {/* Table/Card Area */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-50 flex items-center justify-between gap-4">
                    <div className="relative group flex-1 max-w-md">
                        <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-primary/10 transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-Admin Info</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Zones</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Permissions</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-12 text-slate-400 text-sm">
                                        Loading records...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredUsers.map((user) => (
                                <tr key={user._id} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                                                <HiOutlineShieldCheck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-black text-slate-900 tracking-wide">{user.name}</span>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role: Sub-Admin</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                                <HiOutlineEnvelope className="h-3.5 w-3.5 text-slate-400" />
                                                {user.email}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <HiOutlinePhone className="h-3.5 w-3.5 text-slate-400" />
                                                {user.phone || 'N/A'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                                            {Array.isArray(user.assignedZones) && user.assignedZones.length > 0 ? (
                                                getZoneNames(user.assignedZones).map((zname, idx) => (
                                                    <Badge key={idx} variant="primary" className="text-[9px] font-bold py-0.5 px-2 bg-slate-100 text-slate-700 border-none">
                                                        {zname}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-amber-600 font-bold italic">No zones — commissions won&apos;t credit</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-sm font-black text-emerald-700">
                                            ₹{Number(user.wallet?.availableBalance || 0).toLocaleString('en-IN')}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            Credited ₹{Number(user.wallet?.totalCredited || 0).toLocaleString('en-IN')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                                            {Array.isArray(user.allowedPermissions) && user.allowedPermissions.length > 0 ? (
                                                user.allowedPermissions.map((perm, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-[9px] font-bold py-0.5 px-2 bg-blue-50 text-blue-700 border-none">
                                                        {perm}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold italic">No permissions</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(user)}
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                            >
                                                <HiOutlinePencilSquare className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(user)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <HiOutlineTrash className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-16">
                                        <p className="text-slate-400 font-bold text-sm">No sub-admin users found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                                    <HiOutlineTrash className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete sub-admin?</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Are you sure you want to remove{' '}
                                    <span className="font-semibold text-slate-900">{deleteTarget.name}</span>? They will immediately lose access to the system.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setDeleteTarget(null)}
                                        className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteTarget._id)}
                                        className="px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create / Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingUser ? "Modify Sub-Admin" : "New Sub-Admin Configuration"}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => {
                                // Bug 254: Only allow alphabets and spaces
                                const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                setFormData({ ...formData, name: val });
                            }}
                            placeholder="John Doe"
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                            <input
                                required
                                type="text"
                                value={formData.phone}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setFormData({ ...formData, phone: val });
                                }}
                                placeholder="9876543210"
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <HiOutlineKey className="h-4 w-4 text-slate-400" />
                            Password {editingUser && <span className="text-[9px] text-amber-500 font-bold lowercase">(leave blank to keep unchanged)</span>}
                        </label>
                        <input
                            required={!editingUser}
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                        />
                    </div>

                    {/* Zone selection checkboxes */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <HiOutlineMapPin className="h-4 w-4 text-slate-400" />
                            Assigned Geographical Zones
                        </label>
                        <div className="bg-slate-50 rounded-2xl p-4 max-h-36 overflow-y-auto grid grid-cols-2 gap-3 border border-slate-100">
                            {zones.map((zone) => {
                                const isChecked = formData.assignedZones.includes(zone._id);
                                return (
                                    <label
                                        key={zone._id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                                            isChecked
                                                ? "bg-brand-50 border-brand-500 text-brand-900"
                                                : "bg-white border-slate-100 text-slate-600 hover:bg-slate-100/50"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleZone(zone._id)}
                                            className="accent-brand-600 h-4 w-4 rounded cursor-pointer"
                                        />
                                        <span className="text-xs font-black select-none">{zone.name}</span>
                                    </label>
                                );
                            })}
                            {zones.length === 0 && (
                                <p className="col-span-2 text-center text-xs text-slate-400 py-4 italic font-bold">
                                    No zones found. Create zones in the system first.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Permissions selection checkboxes */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <HiOutlineShieldCheck className="h-4 w-4 text-slate-400" />
                                Allowed Sidebar Permissions (Functionalities)
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, allowedPermissions: [...ALL_PERMISSIONS] }))}
                                    className="text-[9px] font-black text-brand-600 uppercase hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-[9px] text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, allowedPermissions: [] }))}
                                    className="text-[9px] font-black text-rose-600 uppercase hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 max-h-48 overflow-y-auto grid grid-cols-2 gap-3 border border-slate-100">
                            {ALL_PERMISSIONS.map((perm) => {
                                const isChecked = (formData.allowedPermissions || []).includes(perm);
                                return (
                                    <label
                                        key={perm}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                                            isChecked
                                                ? "bg-brand-50 border-brand-500 text-brand-900"
                                                : "bg-white border-slate-100 text-slate-600 hover:bg-slate-100/50"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleTogglePermission(perm)}
                                            className="accent-brand-600 h-4 w-4 rounded cursor-pointer"
                                        />
                                        <span className="text-xs font-black select-none">{perm}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                        >
                            {editingUser ? 'SAVE CHANGES' : 'CREATE SUB-ADMIN'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default UserManagement;
