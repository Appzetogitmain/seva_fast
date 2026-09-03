import React from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';

// Shown once, before Home renders real data, when we have no saved/cached
// address for this device. Actively asks the customer to allow location
// access instead of silently falling back to the default location.
const LocationPermissionCard = () => {
    const {
        showLocationPermission,
        requestLocationPermission,
        declineLocationPermission,
        isFetchingLocation,
    } = useLocation();

    if (!showLocationPermission) return null;

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <MapPin size={30} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Enable Your Location</h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Allow location access so we can show your exact delivery address, accurate delivery times and nearby products on Home.
                </p>
                <button
                    type="button"
                    onClick={requestLocationPermission}
                    disabled={isFetchingLocation}
                    className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm mb-2 flex items-center justify-center gap-2 disabled:opacity-70 transition-opacity"
                >
                    {isFetchingLocation ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Navigation size={16} />
                    )}
                    {isFetchingLocation ? 'Detecting your location...' : 'Allow Location Access'}
                </button>
                <button
                    type="button"
                    onClick={declineLocationPermission}
                    disabled={isFetchingLocation}
                    className="w-full py-2.5 text-slate-500 font-medium text-xs hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                    Not now, use default location
                </button>
            </div>
        </div>
    );
};

export default LocationPermissionCard;
