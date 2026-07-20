import React, { useState, useEffect, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineMapPin,
    HiOutlineMagnifyingGlass,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXMark
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { formatDate } from '@shared/utils/formatDate';

const ZoneManagement = () => {
    const { showToast } = useToast();
    const [zones, setZones] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active'
    });

    useEffect(() => {
        fetchZones();
    }, []);

    const fetchZones = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getZones();
            if (res.data.success) {
                setZones(res.data.result?.zones || res.data.results || []);
            }
        } catch (error) {
            showToast('Failed to load zones', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (zone = null) => {
        if (zone) {
            setEditingZone(zone);
            setFormData({
                name: zone.name || '',
                description: zone.description || '',
                status: zone.status || 'active'
            });
        } else {
            setEditingZone(null);
            setFormData({
                name: '',
                description: '',
                status: 'active'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('Zone name is required', 'error');
            return;
        }

        try {
            const payload = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                status: formData.status
            };

            if (editingZone?._id) {
                const res = await adminApi.updateZone(editingZone._id, payload);
                if (res.data.success) {
                    showToast('Zone updated successfully', 'success');
                }
            } else {
                const res = await adminApi.createZone(payload);
                if (res.data.success) {
                    showToast('New geographical zone created successfully', 'success');
                }
            }
            setIsModalOpen(false);
            fetchZones();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save zone', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await adminApi.deleteZone(id);
            if (res.data.success) {
                showToast('Zone deleted successfully', 'warning');
                fetchZones();
                setDeleteTarget(null);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to delete zone', 'error');
        }
    };

    const filteredZones = useMemo(() => {
        return zones.filter(zone => {
            const query = searchTerm.toLowerCase();
            return (
                zone.name?.toLowerCase().includes(query) ||
                zone.description?.toLowerCase().includes(query)
            );
        });
    }, [zones, searchTerm]);

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Geographical Zone Management
                        <Badge variant="primary" className="text-[10px] font-black uppercase tracking-widest">Zones</Badge>
                    </h1>
                    <p className="ds-description mt-1">Configure service areas to partition riders, sellers, and sub-admins.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <HiOutlinePlus className="h-5 w-5" />
                    CREATE NEW ZONE
                </button>
            </div>

            {/* Quick Summary stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Zones</h4>
                    <h3 className="text-2xl font-black text-slate-900">{zones.length}</h3>
                </Card>
                <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Active Zones</h4>
                    <h3 className="text-2xl font-black text-brand-600">{zones.filter(z => z.status === 'active').length}</h3>
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
                            placeholder="Search zones by name or description..."
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
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Details</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading && (
                                <tr>
                                    <td colSpan="4" className="text-center py-12 text-slate-400 text-sm">
                                        Loading zones...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredZones.map((zone) => (
                                <tr key={zone._id} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                                                <HiOutlineMapPin className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-black text-slate-900 tracking-wide">{zone.name}</span>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                                    <HiOutlineClock className="h-3.5 w-3.5 text-slate-400" />
                                                    Created: {formatDate(zone.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-xs text-slate-600 font-medium max-w-sm truncate">
                                        {zone.description || '—'}
                                    </td>
                                    <td className="px-6 py-6">
                                        <Badge variant={zone.status === 'active' ? 'success' : 'secondary'} className="text-[9px] font-black uppercase">
                                            {zone.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(zone)}
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                            >
                                                <HiOutlinePencilSquare className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(zone)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <HiOutlineTrash className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && filteredZones.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-16">
                                        <p className="text-slate-400 font-bold text-sm">No zones found.</p>
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
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete zone?</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Are you sure you want to remove the zone{' '}
                                    <span className="font-semibold text-slate-900">{deleteTarget.name}</span>? This could affect sub-admins and sellers assigned to this area.
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
                title={editingZone ? "Modify Zone" : "New Geographical Zone Configuration"}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Indore, Bhopal, Delhi"
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                        <textarea
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe the boundaries or description of this zone..."
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none resize-none"
                        />
                    </div>

                    {editingZone && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    )}

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
                            {editingZone ? 'SAVE CHANGES' : 'CREATE ZONE'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ZoneManagement;
