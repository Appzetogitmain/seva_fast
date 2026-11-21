/** Returns a badge for banners outside their admin-set display window, else null. */
export const getScheduleState = (ad, now = new Date()) => {
    const start = ad?.startDate ? new Date(ad.startDate) : null;
    const end = ad?.endDate ? new Date(ad.endDate) : null;
    if (end && end < now) return { label: 'Expired', className: 'bg-rose-50 text-rose-600' };
    if (start && start > now) return { label: 'Scheduled', className: 'bg-violet-50 text-violet-600' };
    return null;
};
