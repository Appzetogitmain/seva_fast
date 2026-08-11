import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { customerApi } from '../services/customerApi';
import { useAuth } from '@core/context/AuthContext';

const FirstOrderOfferContext = createContext({
    isFirstOrder: false,
    firstOrderDiscountPercent: 10,
    firstOrderFreeDelivery: true,
    welcomeScratchCardEnabled: true,
    isLoading: false,
    refreshFirstOrderEligibility: () => {},
});

export const FirstOrderOfferProvider = ({ children }) => {
    const { user } = useAuth();
    const [offerState, setOfferState] = useState({
        isFirstOrder: false,
        firstOrderDiscountPercent: 10,
        firstOrderFreeDelivery: true,
        welcomeScratchCardEnabled: true,
        isLoading: true,
    });

    const fetchEligibility = useCallback(async () => {
        if (!user) {
            setOfferState({
                isFirstOrder: false,
                firstOrderDiscountPercent: 10,
                firstOrderFreeDelivery: true,
                welcomeScratchCardEnabled: true,
                isLoading: false,
            });
            return;
        }

        try {
            setOfferState((prev) => ({ ...prev, isLoading: true }));
            const res = await customerApi.getFirstOrderEligibility();
            const data = res.data?.result ?? res.data;
            if (data) {
                setOfferState({
                    isFirstOrder: Boolean(data.isFirstOrder),
                    firstOrderDiscountPercent: Number(data.firstOrderDiscountPercent ?? 10),
                    firstOrderFreeDelivery: data.firstOrderFreeDelivery !== false,
                    welcomeScratchCardEnabled: data.welcomeScratchCardEnabled !== false,
                    isLoading: false,
                });
            }
        } catch (error) {
            console.error('[FirstOrderOfferContext] Error fetching eligibility:', error);
            setOfferState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [user]);

    useEffect(() => {
        fetchEligibility();
    }, [fetchEligibility]);

    return (
        <FirstOrderOfferContext.Provider
            value={{
                ...offerState,
                refreshFirstOrderEligibility: fetchEligibility,
            }}
        >
            {children}
        </FirstOrderOfferContext.Provider>
    );
};

export const useFirstOrderOffer = () => useContext(FirstOrderOfferContext);
