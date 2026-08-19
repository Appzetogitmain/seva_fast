import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Clock, MapPin, Shield } from "lucide-react";
import {
  getOrderSocket,
  onCustomerOtp,
  onDeliveryOtpGenerated,
  onDeliveryOtpValidated,
} from "@/core/services/orderSocket";

/**
 * DeliveryOtpDisplay Component
 * 
 * Displays the proximity-based delivery OTP to the customer when the delivery person
 * arrives within 0-300m of the delivery location.
 * 
 * Features:
 * - Real-time OTP display via Socket.IO
 * - 10-minute countdown timer
 * - Visual indicator that delivery person is nearby
 * - Security: Hides OTP when app is backgrounded
 * - Shows delivery confirmation when OTP is validated
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.5, 9.4
 */
const matchesOrderIdentifier = (payloadOrderId, identifiers = []) => {
  const normalizedPayloadId = String(payloadOrderId || "").trim();
  if (!normalizedPayloadId) return false;
  return identifiers
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .includes(normalizedPayloadId);
};

const DeliveryOtpDisplay = ({ orderId, checkoutGroupId = null, initialOtp = null, initialExpiresAt = null }) => {
  const [otpData, setOtpData] = useState(null);
  const [isDelivered, setIsDelivered] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef(null);

  // Calculate remaining time from expiration timestamp
  const calculateRemainingTime = (expiresAt) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = Math.floor((expiry - now) / 1000);
    return Math.max(0, diff);
  };

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle visibility change (app backgrounded or device locked)
  // Requirement 9.4: Hide OTP when app is backgrounded or device locked
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Hydrate OTP from order details API (page refresh / late visit / missed socket event)
  useEffect(() => {
    if (!initialOtp) return;

    const expiresAt =
      initialExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const remaining = calculateRemainingTime(expiresAt);
    if (remaining <= 0) return;

    setOtpData((prev) => {
      if (prev?.otp === initialOtp) return prev;
      return {
        otp: initialOtp,
        expiresAt,
        deliveryPersonNearby: true,
      };
    });
    setIsDelivered(false);
    setRemainingSeconds(remaining);
  }, [initialOtp, initialExpiresAt, orderId]);

  // Set up Socket.IO listeners for OTP events
  useEffect(() => {
    if (!orderId) return;

    console.log(`[DeliveryOtpDisplay] Setting up Socket.IO listeners for order ${orderId}`);

    const getToken = () => {
      const raw = localStorage.getItem("auth_customer");
      if (!raw) return null;
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("{")) {
        try {
          return JSON.parse(trimmed)?.token || null;
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    };
    const socket = getOrderSocket(getToken);
    
    console.log(`[DeliveryOtpDisplay] Socket connection status:`, socket?.connected);
    console.log(`[DeliveryOtpDisplay] Socket ID:`, socket?.id);
    const acceptedOrderIds = [orderId, checkoutGroupId];

    // Listen for OTP generation event
    const offGenerated = onDeliveryOtpGenerated(getToken, (payload) => {
      console.log(`[DeliveryOtpDisplay] Received delivery:otp:generated event:`, payload);
      if (matchesOrderIdentifier(payload?.orderId, acceptedOrderIds)) {
        setOtpData({
          otp: payload.otp,
          expiresAt: payload.expiresAt,
          deliveryPersonNearby: payload.deliveryPersonNearby,
        });
        setIsDelivered(false);
        setRemainingSeconds(calculateRemainingTime(payload.expiresAt));
      }
    });

    // Support legacy/workflow event name consistency
    const offCustomerOtp = onCustomerOtp(getToken, (payload) => {
      console.log(`[DeliveryOtpDisplay] Received order:otp event:`, payload);
      if (matchesOrderIdentifier(payload?.orderId, acceptedOrderIds) && (payload?.code || payload?.otp)) {
        const otpValue = payload.otp || payload.code;
        setOtpData({
          otp: otpValue,
          expiresAt: payload.expiresAt || new Date(Date.now() + 600000).toISOString(),
          deliveryPersonNearby: true,
        });
        setIsDelivered(false);
        setRemainingSeconds(calculateRemainingTime(payload.expiresAt || new Date(Date.now() + 600000).toISOString()));
      }
    });

    // Listen for OTP validation event
    const offValidated = onDeliveryOtpValidated(getToken, (payload) => {
      console.log(`[DeliveryOtpDisplay] Received delivery:otp:validated event:`, payload);
      if (matchesOrderIdentifier(payload?.orderId, acceptedOrderIds)) {
        setIsDelivered(true);
        setOtpData(null);
      }
    });

    return () => {
      offGenerated();
      offCustomerOtp();
      offValidated();
    };
  }, [orderId, checkoutGroupId]);

  // Countdown timer
  // Requirement 7.5: Display countdown timer showing remaining validity
  useEffect(() => {
    if (!otpData || remainingSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setOtpData(null);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [otpData, remainingSeconds]);

  // Show delivery confirmation
  if (isDelivered) {
    return (
      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-brand-600" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-brand-900 mb-1">
          Delivery Confirmed!
        </h3>
        <p className="text-sm text-brand-700">
          Your order has been successfully delivered
        </p>
      </div>
    );
  }

  // Show OTP display when available and visible
  if (otpData && isVisible) {
    const isExpiringSoon = remainingSeconds <= 120; // Less than 2 minutes

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Delivery Person Nearby Indicator */}
        {/* Requirement 4.4: Show visual indicator that delivery person is nearby */}
        {otpData.deliveryPersonNearby && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                Delivery Partner Nearby
              </p>
              <p className="text-xs text-brand-700">
                Within 0-300 meters of your location
              </p>
            </div>
          </div>
        )}

        {/* OTP Display */}
        {/* Requirement 4.2: Display OTP in prominent, easily readable format */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`border rounded-xl p-4 text-center transition-colors duration-300 ${
            isExpiringSoon
              ? "bg-amber-50 border-amber-300"
              : "bg-gradient-to-br from-purple-50 to-brand-50 border-purple-200"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Shield className={`w-4 h-4 ${isExpiringSoon ? "text-amber-600" : "text-purple-600"}`} />
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isExpiringSoon ? "text-amber-800" : "text-purple-800"
              }`}
            >
              Delivery OTP
            </p>
          </div>

          <div
            className={`text-3xl font-black font-mono tracking-[0.3em] mb-1.5 ${
              isExpiringSoon ? "text-amber-950" : "text-purple-950"
            }`}
          >
            {otpData.otp}
          </div>

          <p className={`text-[10px] ${isExpiringSoon ? "text-amber-700" : "text-purple-700"}`}>
            Share this code with your delivery partner
          </p>
        </motion.div>

        {/* Countdown Timer */}
        {/* Requirement 7.5: Display countdown timer showing remaining validity */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition-colors duration-300 ${
            isExpiringSoon
              ? "bg-amber-50 border-amber-200"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isExpiringSoon ? "text-amber-600" : "text-gray-600"}`} />
            <span className={`text-xs font-semibold ${isExpiringSoon ? "text-amber-900" : "text-gray-700"}`}>
              {isExpiringSoon ? "Expiring Soon" : "Valid For"}
            </span>
          </div>
          <span
            className={`text-lg font-bold font-mono ${
              isExpiringSoon ? "text-amber-950" : "text-gray-900"
            }`}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>

        {/* Security Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-600 text-center">
            🔒 This OTP is valid for 10 minutes and will be hidden when you switch apps
          </p>
        </div>
      </div>
    );
  }

  // Don't render anything if no OTP or app is backgrounded
  return null;
};

export default DeliveryOtpDisplay;
