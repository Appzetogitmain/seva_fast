import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Truck,
  ShieldCheck,
  FileText,
  AlertCircle,
  Bike,
  CheckCircle2,
  Clock,
  Edit2,
  Save,
  X,
  ExternalLink
} from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import Card from "@/shared/components/ui/Card";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import axiosInstance from "@core/api/axios";
import { toast } from "sonner";

const VehicleInfo = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { settings } = useSettings();
  const appName = settings?.appName || "SEVAFAST";

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    vehicleType: "bike",
    vehicleNumber: "",
    drivingLicenseNumber: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        vehicleType: user.vehicleType || "bike",
        vehicleNumber: user.vehicleNumber || "",
        drivingLicenseNumber: user.drivingLicenseNumber || "",
      });
    }
  }, [user]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      await axiosInstance.put("/delivery/profile", {
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
        drivingLicenseNumber: formData.drivingLicenseNumber.trim().toUpperCase(),
      });
      await refreshUser();
      setIsEditing(false);
      toast.success("Vehicle details updated successfully!");
    } catch (error) {
      console.error("Failed to update vehicle details:", error);
      toast.error(error?.response?.data?.message || "Failed to update vehicle details");
    } finally {
      setIsSaving(false);
    }
  };

  const getVehicleIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "cycle":
        return <Bike size={26} className="text-white" />;
      case "scooter":
      case "bike":
      default:
        return <Truck size={26} className="text-white" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-lg mx-auto">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
              aria-label="Back"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Vehicle Information</h1>
          </div>

          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    if (user) {
                      setFormData({
                        vehicleType: user.vehicleType || "bike",
                        vehicleNumber: user.vehicleNumber || "",
                        drivingLicenseNumber: user.drivingLicenseNumber || "",
                      });
                    }
                  }}
                  className="h-8 px-2.5 text-xs text-gray-600"
                >
                  <X size={14} className="mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
                >
                  <Save size={14} className="mr-1" /> {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 px-3 text-xs font-bold text-primary border-primary/20 hover:bg-primary/5"
              >
                <Edit2 size={13} className="mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-5">
        {/* Vehicle Main Status Card */}
        <Card className="p-5 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white border-none shadow-xl rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-orange-400 border border-white/10 mb-1.5">
                {user?.vehicleType ? user.vehicleType.toUpperCase() : "VEHICLE"}
              </span>
              <h3 className="text-2xl font-mono font-black tracking-wider text-white">
                {user?.vehicleNumber || "NOT ASSIGNED"}
              </h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
              {getVehicleIcon(user?.vehicleType)}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">License:</span>
              <span className="font-mono font-bold text-gray-200">
                {user?.drivingLicenseNumber || "Not Added"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {user?.isVerified ? (
                <span className="flex items-center text-emerald-400 font-bold text-[10px] uppercase tracking-wider bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 size={11} className="mr-1" /> Partner Verified
                </span>
              ) : (
                <span className="flex items-center text-amber-400 font-bold text-[10px] uppercase tracking-wider bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <Clock size={11} className="mr-1" /> Pending Approval
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Editable Form (When in Edit Mode) */}
        {isEditing && (
          <Card className="p-4 bg-white border border-gray-200 shadow-sm rounded-2xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
              Update Vehicle Information
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Vehicle Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["bike", "scooter", "cycle"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicleType: type })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                      formData.vehicleType === type
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Vehicle Registration Number"
              placeholder="e.g. DL 01 AB 1234"
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
              icon={Truck}
              className="uppercase font-mono"
            />

            <Input
              label="Driving License Number"
              placeholder="e.g. DL-1420110012345"
              value={formData.drivingLicenseNumber}
              onChange={(e) => setFormData({ ...formData, drivingLicenseNumber: e.target.value })}
              icon={FileText}
              className="uppercase font-mono"
            />
          </Card>
        )}

        {/* Verified Document Records */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 px-1">
            Registered Vehicle Records
          </h3>

          {/* Driving License Record */}
          <Card className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-start">
                <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 mr-3">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Driving License</h4>
                  <p className="text-xs font-mono text-gray-600 mt-0.5">
                    {user?.drivingLicenseNumber || "No Driving License number entered"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {user?.documents?.drivingLicense
                      ? "Official document uploaded"
                      : "Document upload pending"}
                  </p>
                </div>
              </div>

              {user?.documents?.drivingLicense ? (
                <button
                  type="button"
                  onClick={() => window.open(user.documents.drivingLicense, "_blank")}
                  className="flex items-center text-[10px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  View <ExternalLink size={10} className="ml-1" />
                </button>
              ) : (
                <div
                  className={`flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    user?.isVerified
                      ? "text-emerald-700 bg-emerald-50"
                      : "text-amber-700 bg-amber-50"
                  }`}
                >
                  <ShieldCheck size={11} className="mr-1" />
                  {user?.isVerified ? "Verified" : "Pending"}
                </div>
              )}
            </div>
          </Card>

          {/* Vehicle Number Record */}
          <Card className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-start">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 mr-3">
                  <Truck size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Vehicle Registration</h4>
                  <p className="text-xs font-mono text-gray-600 mt-0.5">
                    {user?.vehicleNumber || "Vehicle number not registered"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1 capitalize">
                    Type: {user?.vehicleType || "Bike"}
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  user?.vehicleNumber
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-gray-500 bg-gray-100"
                }`}
              >
                <CheckCircle2 size={11} className="mr-1" />
                {user?.vehicleNumber ? "Registered" : "Not Added"}
              </div>
            </div>
          </Card>
        </div>

        {/* Notice Info */}
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start">
          <AlertCircle size={18} className="text-orange-600 mr-2.5 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-900 leading-relaxed">
            Ensure your registered vehicle plate number and Driving License number match your physical documents during delivery inspections.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VehicleInfo;
