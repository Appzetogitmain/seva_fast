import React from 'react';
import { Star, X, PartyPopper } from 'lucide-react';

// A lightweight, one-time invitation shown once an order is marked
// delivered (see OrderDetailPage.jsx), nudging the customer toward the
// existing WriteReviewSheet rating flow instead of leaving the "Review"
// buttons on each item to be discovered manually.
const PostDeliveryRatingPrompt = ({ isOpen, items = [], onRate, onDismiss }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[550] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    type="button"
                    onClick={onDismiss}
                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    aria-label="Dismiss"
                >
                    <X size={16} />
                </button>

                <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                    <PartyPopper size={30} className="text-amber-500" />
                </div>

                <h2 className="text-lg font-bold text-slate-900 mb-2">Your order has been delivered!</h2>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                    How was {items.length > 1 ? 'it' : (items[0]?.name || 'your order')}? Rate {items.length > 1 ? 'your products' : 'it'} to help other customers.
                </p>

                <div className="flex items-center justify-center gap-1 mb-6">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={26} className="text-amber-300 fill-amber-100" />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={onRate}
                    className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm mb-2 hover:bg-[var(--brand-400)] transition-colors"
                >
                    Rate Now
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="w-full py-2.5 text-slate-500 font-medium text-xs hover:text-slate-700 transition-colors"
                >
                    Maybe later
                </button>
            </div>
        </div>
    );
};

export default PostDeliveryRatingPrompt;
