import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Volume2, Smartphone, Loader2 } from "lucide-react";
import Card from "@/shared/components/ui/Card";
import { toast } from "sonner";
import { deliveryApi } from "../../services/deliveryApi";
import {
  getDeliverySettings,
  saveDeliverySettings,
} from "../../utils/deliverySettings";
import {
  ensureFcmTokenRegistered,
  getStoredFcmToken,
  clearStoredFcmToken,
  removeStoredFcmToken,
} from "@core/firebase/pushClient";

const Settings = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(getDeliverySettings);
  const [loadingKey, setLoadingKey] = useState(null);
  const [fetchingPreferences, setFetchingPreferences] = useState(true);

  // Sync settings with backend preferences on mount
  useEffect(() => {
    let isMounted = true;
    const loadPreferences = async () => {
      try {
        const res = await deliveryApi.getPushPreferences();
        const data = res?.data?.data || res?.data?.result || {};
        if (isMounted && data) {
          const synced = {
            pushNotifications: data.pushNotifications !== false,
            sound: data.sound !== false,
            vibration: data.vibration !== false,
            emailAlerts: Boolean(data.emailAlerts),
          };
          setSettings(synced);
          saveDeliverySettings(synced);
        }
      } catch (err) {
        console.warn("[delivery:settings] Could not fetch remote push preferences:", err);
      } finally {
        if (isMounted) setFetchingPreferences(false);
      }
    };
    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for external settings changes
  useEffect(() => {
    const handleSettingsChanged = (e) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener("delivery_settings_changed", handleSettingsChanged);
    return () => {
      window.removeEventListener("delivery_settings_changed", handleSettingsChanged);
    };
  }, []);

  const togglePushNotifications = async () => {
    const nextVal = !settings.pushNotifications;
    setLoadingKey("pushNotifications");

    try {
      if (!nextVal) {
        // Turning OFF: update backend preference and revoke/delete push token
        await deliveryApi.updatePushPreferences({ pushNotifications: false });
        const token = getStoredFcmToken("delivery");
        if (token) {
          await deliveryApi.removePushToken({ token }).catch(() => {});
        }
        await removeStoredFcmToken({ role: "delivery" }).catch(() => {});
        clearStoredFcmToken("delivery");

        const updated = saveDeliverySettings({ ...settings, pushNotifications: false });
        setSettings(updated);
        toast.success("Push notifications turned off");
      } else {
        // Turning ON: update backend preference and re-register FCM token
        await deliveryApi.updatePushPreferences({ pushNotifications: true });
        const updated = saveDeliverySettings({ ...settings, pushNotifications: true });
        setSettings(updated);

        // Register token with backend
        try {
          await ensureFcmTokenRegistered({ role: "delivery" });
        } catch (regErr) {
          console.warn("[delivery:settings] Token registration note:", regErr?.message || regErr);
        }
        toast.success("Push notifications turned on");
      }
    } catch (error) {
      console.error("[delivery:settings] Failed to update push notifications:", error);
      toast.error(error?.response?.data?.message || "Failed to update push notification setting");
    } finally {
      setLoadingKey(null);
    }
  };

  const toggleSound = async () => {
    const nextVal = !settings.sound;
    setLoadingKey("sound");

    try {
      await deliveryApi.updatePushPreferences({ sound: nextVal }).catch(() => {});
      const updated = saveDeliverySettings({ ...settings, sound: nextVal });
      setSettings(updated);
      toast.success(nextVal ? "Sound alerts turned on" : "Sound alerts turned off");
    } catch (error) {
      console.error("[delivery:settings] Failed to update sound setting:", error);
      toast.error("Failed to update sound setting");
    } finally {
      setLoadingKey(null);
    }
  };

  const toggleVibration = async () => {
    const nextVal = !settings.vibration;
    setLoadingKey("vibration");

    try {
      await deliveryApi.updatePushPreferences({ vibration: nextVal }).catch(() => {});
      const updated = saveDeliverySettings({ ...settings, vibration: nextVal });
      setSettings(updated);

      if (nextVal && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([150, 75, 150]);
      }
      toast.success(nextVal ? "Vibration turned on" : "Vibration turned off");
    } catch (error) {
      console.error("[delivery:settings] Failed to update vibration setting:", error);
      toast.error("Failed to update vibration setting");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">App Settings</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Notifications & Sound & Vibration */}
        <section>
          <h2 className="text-sm uppercase font-bold text-gray-500 mb-3 tracking-wider ml-1">
            Notifications & Alerts
          </h2>
          <Card className="divide-y divide-gray-100 shadow-sm rounded-2xl overflow-hidden">
            {/* Push Notifications Toggle */}
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={loadingKey === "pushNotifications" ? undefined : togglePushNotifications}
            >
              <div className="flex items-center mr-3">
                <div className={`p-2.5 rounded-xl mr-3 ${settings.pushNotifications ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">Push Notifications</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Receive push notifications for new orders & assignments
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {loadingKey === "pushNotifications" ? (
                  <Loader2 size={20} className="animate-spin text-primary" />
                ) : (
                  <div
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      settings.pushNotifications ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                        settings.pushNotifications ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sound Alerts Toggle */}
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={loadingKey === "sound" ? undefined : toggleSound}
            >
              <div className="flex items-center mr-3">
                <div className={`p-2.5 rounded-xl mr-3 ${settings.sound ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Volume2 size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">Sound Alerts</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Play audio ringtone when a new delivery request arrives
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {loadingKey === "sound" ? (
                  <Loader2 size={20} className="animate-spin text-primary" />
                ) : (
                  <div
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      settings.sound ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                        settings.sound ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Vibration Alerts Toggle */}
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={loadingKey === "vibration" ? undefined : toggleVibration}
            >
              <div className="flex items-center mr-3">
                <div className={`p-2.5 rounded-xl mr-3 ${settings.vibration ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">Vibration</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Vibrate phone when a new delivery order arrives
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {loadingKey === "vibration" ? (
                  <Loader2 size={20} className="animate-spin text-primary" />
                ) : (
                  <div
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      settings.vibration ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                        settings.vibration ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>

        <div className="text-center pt-8">
          <p className="text-xs text-gray-400">App Version 1.2.0 (Build 450)</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
