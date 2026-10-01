import React from "react";
import { useTranslation } from 'react-i18next';
import { Clipboard, Tag, Wallet } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CheckoutPricingBreakdown
 *
 * Props:
 *   pricingPreview    – breakdown object from the preview API (or null)
 *   isPreviewLoading  – boolean
 *   walletAmountToUse – number
 *   finalAmountToPay  – number
 *   cartTotal         – number (fallback when preview is loading)
 *   selectedCoupon    – coupon object or null
 *   discountAmount    – number
 */
const CheckoutPricingBreakdown = React.memo(function CheckoutPricingBreakdown({
  pricingPreview,
  isPreviewLoading,
  walletAmountToUse,
  finalAmountToPay,
  cartTotal,
  selectedCoupon,
  discountAmount,
  isOnlinePayment = false,
}) {
  const { t } = useTranslation('customer');
  const deliveryFee = pricingPreview?.deliveryFeeCharged || 0;
  const handlingFee = pricingPreview?.handlingFeeCharged || 0;
  const taxAmount = pricingPreview?.taxTotal || 0;

  return (
    <>
      {/* Bill Details */}
      <motion.div className="bg-white rounded-3xl p-4 shadow-xl shadow-gray-200/50 border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl bg-brand-50 flex items-center justify-center">
            <Clipboard size={16} className="text-primary" />
          </div>
          <h3 className="font-[1000] text-slate-800 text-base tracking-tight uppercase">
            {t('checkout.pricing.summary')}
          </h3>
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              {t('checkout.pricing.itemTotal')}
            </span>
            <span className="font-black text-slate-800 text-sm">
              ₹{pricingPreview?.productSubtotal ?? cartTotal}
            </span>
          </div>
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              {t('checkout.pricing.deliveryFee')}
            </span>
            <span className="font-black text-slate-800 text-sm">₹{deliveryFee}</span>
          </div>
          {pricingPreview &&
            typeof pricingPreview.distanceKmActual === "number" &&
            typeof pricingPreview.distanceKmRounded === "number" && (
              <div className="px-2 -mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>
                  {t('checkout.pricing.distance', { km: pricingPreview.distanceKmActual.toFixed(2) })}
                  {pricingPreview.distanceKmRounded
                    ? ` ${t('checkout.pricing.billed', { km: pricingPreview.distanceKmRounded.toFixed(2) })}`
                    : ""}
                </span>
                <span className="uppercase tracking-wider">
                  {pricingPreview?.snapshots?.deliverySettings?.deliveryPricingMode ||
                    pricingPreview?.snapshots?.deliverySettings?.pricingMode ||
                    ""}
                </span>
              </div>
            )}
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              {t('checkout.pricing.handlingFee')}
            </span>
            <span className="font-black text-slate-800 text-sm">₹{handlingFee}</span>
          </div>
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              {t('checkout.pricing.tax')}
            </span>
            <span className="font-black text-slate-800 text-sm">₹{taxAmount}</span>
          </div>

          {selectedCoupon && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-1.5 bg-brand-50 rounded-lg border border-brand-100">
              <span className="text-primary font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                <Tag size={14} />
                {t('checkout.pricing.couponReserved')}
              </span>
              <span className="font-black text-primary text-sm">-₹{discountAmount}</span>
            </motion.div>
          )}

          {pricingPreview?.firstOrderDiscountAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-amber-600 font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                <Tag size={14} />
                {t('checkout.pricing.newCustomer')}
              </span>
              <span className="font-black text-amber-600 text-sm">
                -₹{pricingPreview.firstOrderDiscountAmount}
              </span>
            </motion.div>
          )}

          {pricingPreview?.deliveryFeeCharged === 0 && pricingPreview?.deliveryFeeBase > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-amber-600 font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                <Tag size={14} />
                {t('checkout.pricing.freeDelivery')}
              </span>
              <span className="font-black text-amber-600 text-sm line-through opacity-60">
                ₹{pricingPreview.deliveryFeeBase}
              </span>
            </motion.div>
          )}

          {pricingPreview?.estimatedCashback > 0 && pricingPreview?.cashbackPercentage > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-1.5 bg-green-50 rounded-lg border border-green-100 mt-1.5">
              <span className="text-green-600 font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                <Wallet size={14} />
                {t('checkout.pricing.cashback', { percent: pricingPreview.cashbackPercentage })}
              </span>
              <span className="font-black text-green-600 text-sm">+₹{pricingPreview.estimatedCashback}</span>
            </motion.div>
          )}

          {walletAmountToUse > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-1.5 bg-brand-50 rounded-lg border border-brand-100 mb-1">
              <span className="text-primary font-black text-[11px] flex items-center gap-2 uppercase tracking-tight">
                <Wallet size={14} />
                {t('checkout.pricing.walletApplied')}
              </span>
              <span className="font-black text-primary text-sm">-₹{walletAmountToUse}</span>
            </motion.div>
          )}

          <div className="mt-3 pt-4 border-t-2 border-dashed border-slate-100">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-[1000] text-slate-800 text-base uppercase tracking-tight">
                  {finalAmountToPay === 0 ? t('checkout.pricing.fullyCovered') : t('checkout.pricing.totalPayable')}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                  {finalAmountToPay === 0
                    ? t('checkout.pricing.paidWallet')
                    : isOnlinePayment
                      ? t('checkout.securedRazorpay')
                      : t('checkout.pricing.safePayment')}
                </span>
              </div>
              <span className="font-[1000] text-primary text-2xl tracking-tighter italic">
                {isPreviewLoading ? t('checkout.pricing.calculating') : `₹${Number(finalAmountToPay.toFixed(2))}`}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
});

export default CheckoutPricingBreakdown;
