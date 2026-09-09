import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Phone,
  QrCode,
  MapPin,
  Calendar,
  Printer,
  CheckCircle2,
  Building2,
  Award,
  Zap,
  Eye,
  Download,
  Loader2
} from "lucide-react";
import Button from "@/shared/components/ui/Button";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { formatDate } from "@shared/utils/formatDate";
import { toast } from "sonner";

const IdCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();

  // Active View Mode: 'both' | 'front' | 'back'
  const [activeTab, setActiveTab] = useState("both");
  const [isDownloading, setIsDownloading] = useState(false);
  const [base64Avatar, setBase64Avatar] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  // References for DOM elements to export to PNG
  const frontCardRef = useRef(null);
  const backCardRef = useRef(null);

  // Format Joining Date (Issue Date)
  const getJoiningDate = (dateString) => {
    if (!dateString) return "12 AUG 2024";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).toUpperCase();
    } catch {
      return formatDate(dateString, "12 AUG 2024");
    }
  };

  const cardData = {
    name: user?.name || "Delivery Partner",
    riderId: user?._id ? `SF-DRV-${user._id.slice(-6).toUpperCase()}` : "N/A",
    phone: user?.phone || "—",
    vehicleNumber: user?.vehicleNumber || "—",
    profileImage: base64Avatar || user?.profileImage || "",
    // Rider Personal Address & City
    city: user?.city || user?.currentArea || user?.preferredArea || "—",
    riderAddress: user?.address || "Address not provided",
    // Admin Managed Address & Support Helpline from System Settings
    address: settings?.address || `${settings?.appName || 'SEVAFAST'} Support Center`,
    supportNumber: settings?.supportPhone || "1800-SEVA-FAST",
    // Issue Date = Platform Joining Date
    issueDate: getJoiningDate(user?.createdAt),
  };

  // Generate Real Scannable 2D QR Code Matrix
  useEffect(() => {
    let isMounted = true;
    const generateQr = async () => {
      try {
        const QRCodeModule = await import("qrcode");
        const QRCode = QRCodeModule.default || QRCodeModule;
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://sevafast.com";
        const verifyUrl = `${baseUrl}/verify/delivery/${encodeURIComponent(cardData.riderId)}?name=${encodeURIComponent(cardData.name)}`;
        const dataUrl = await QRCode.toDataURL(verifyUrl, {
          width: 256,
          margin: 1,
          color: {
            dark: "#0f172a", // slate-900
            light: "#ffffff",
          },
          errorCorrectionLevel: "M",
        });
        if (isMounted) setQrCodeDataUrl(dataUrl);
      } catch (err) {
        console.error("Failed to generate QR Code:", err);
      }
    };
    generateQr();
    return () => {
      isMounted = false;
    };
  }, [cardData.riderId, cardData.name]);

  // Convert profile avatar to base64 Data URL to guarantee 100% CORS-safe canvas/PNG generation
  useEffect(() => {
    let isMounted = true;
    const loadAvatar = async () => {
      const initial = (user?.name || "D").charAt(0).toUpperCase();
      const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f97316"/><stop offset="100%" stop-color="%23dc2626"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/><text x="50%" y="56%" font-size="44" font-weight="bold" font-family="system-ui, sans-serif" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;

      const rawUrl = user?.profileImage && !user.profileImage.includes('dicebear.com')
        ? user.profileImage
        : null;

      if (!rawUrl) {
        if (isMounted) setBase64Avatar(fallbackSvg);
        return;
      }

      if (rawUrl.startsWith("data:")) {
        setBase64Avatar(rawUrl);
        return;
      }

      try {
        const response = await fetch(rawUrl, { mode: "cors" });
        if (!response.ok) throw new Error("Network response was not ok");
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted && reader.result) {
            setBase64Avatar(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (isMounted) setBase64Avatar(fallbackSvg);
      }
    };

    loadAvatar();
    return () => {
      isMounted = false;
    };
  }, [user?.profileImage, user?.name]);

  // Handle Download Front or Back Card as High-Res PNG
  const handleDownload = async (side = "front") => {
    try {
      setIsDownloading(true);

      const targetElement = side === "front" ? frontCardRef.current : backCardRef.current;

      if (!targetElement) {
        toast.error(`Please select "${side.toUpperCase()}" tab to download.`);
        setIsDownloading(false);
        return;
      }

      let dataUrl = null;

      try {
        const html2canvasModule = await import("html2canvas");
        const html2canvas = html2canvasModule.default || html2canvasModule;
        const canvas = await html2canvas(targetElement, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        dataUrl = canvas.toDataURL("image/png");
      } catch (errCanvas) {
        console.warn("html2canvas error, trying html-to-image with skipFonts:", errCanvas);
        const { toPng } = await import("html-to-image");
        dataUrl = await toPng(targetElement, {
          quality: 1,
          pixelRatio: 3,
          backgroundColor: "#ffffff",
          skipFonts: true,
          embedFonts: false,
          cacheBust: true,
        });
      }

      if (!dataUrl) {
        throw new Error("Failed to render card image.");
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `SEVAFAST_ID_Card_${side.toUpperCase()}_${cardData.riderId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${side === "front" ? "Front" : "Back"} ID Card downloaded successfully!`);
    } catch (err) {
      console.error("ID Card download failed:", err);
      toast.error("Download failed. Please try again or use Print / PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadBoth = async () => {
    await handleDownload("front");
    setTimeout(async () => {
      await handleDownload("back");
    }, 1000);
  };

  const handlePrint = () => {
    // Dismiss any active toast notifications so they don't appear in print
    toast.dismiss();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="bg-gray-100 min-h-screen text-slate-900 pb-20 pt-4 px-4 select-none">
      {/* Top Header Bar */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-5 bg-white p-3 px-4 rounded-2xl shadow-sm border border-gray-200 flex-wrap gap-2 no-print">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="text-center">
          <h1 className="text-sm font-extrabold text-gray-900 tracking-wide flex items-center justify-center gap-1">
            <Zap size={16} className="text-orange-500 fill-orange-500" />
            SEVAFAST Delivery Partner ID Card
          </h1>
        </div>

        {/* Action Buttons: Download & Print */}
        <div className="flex items-center gap-2">
          {activeTab === "back" ? (
            <Button
              onClick={() => handleDownload("back")}
              disabled={isDownloading}
              size="sm"
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow flex items-center gap-1.5"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Back PNG
            </Button>
          ) : activeTab === "front" ? (
            <Button
              onClick={() => handleDownload("front")}
              disabled={isDownloading}
              size="sm"
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow flex items-center gap-1.5"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Front PNG
            </Button>
          ) : (
            <Button
              onClick={() => handleDownload("front")}
              disabled={isDownloading}
              size="sm"
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow flex items-center gap-1.5"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Front PNG
            </Button>
          )}

          <Button
            onClick={handlePrint}
            size="sm"
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
          >
            <Printer size={14} /> Print / PDF
          </Button>
        </div>
      </div>

      {/* View Mode Selector Tabs */}
      <div className="max-w-md mx-auto flex bg-white p-1 rounded-xl mb-5 shadow-sm border border-gray-200 justify-center gap-1 no-print">
        <button
          onClick={() => setActiveTab("both")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "both"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          BOTH SIDES
        </button>
        <button
          onClick={() => setActiveTab("front")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "front"
              ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          FRONT
        </button>
        <button
          onClick={() => setActiveTab("back")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "back"
              ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          BACK
        </button>
      </div>

      {/* Main Cards Layout Container */}
      <div id="printable-id-card-area" className="print-container max-w-4xl mx-auto flex flex-wrap justify-center items-center gap-6 py-1">
        
        {/* ========================================================================= */}
        {/* FRONT CARD DESIGN */}
        {/* ========================================================================= */}
        {(activeTab === "front" || activeTab === "both") && (
          <div className="flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-1.5 px-1 no-print">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <Eye size={12} className="text-orange-500" /> Card Front
              </p>
              <button
                onClick={() => handleDownload("front")}
                disabled={isDownloading}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline"
              >
                <Download size={12} /> Download Front
              </button>
            </div>

            <div
              ref={frontCardRef}
              className="id-card-element w-[330px] h-[480px] rounded-2xl bg-white text-slate-900 shadow-xl border border-gray-200 overflow-hidden flex flex-col justify-between relative"
            >
              {/* Lanyard Slot Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-2 bg-slate-900/10 rounded-full border border-slate-400/20 z-20 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-slate-900/30 rounded-full"></div>
              </div>

              {/* Red/Orange Header Banner */}
              <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 pt-5 pb-3 px-4 text-white relative overflow-hidden shadow-sm">
                <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-md pointer-events-none"></div>
                
                <div className="relative z-10 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-1 font-black text-lg tracking-wider text-white uppercase drop-shadow-sm">
                      <span className="bg-white text-red-600 px-1.5 py-0.5 rounded text-xs font-black tracking-tighter">
                        SEVA
                      </span>
                      <span>FAST</span>
                    </div>
                    <p className="text-[8px] text-white/90 font-bold tracking-widest uppercase mt-0.5">
                      Quick-Commerce Logistics
                    </p>
                  </div>

                  <div className="bg-white/20 backdrop-blur-md text-white font-black text-[8px] tracking-wider px-2 py-0.5 rounded-full border border-white/30 uppercase flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    DELIVERY PARTNER
                  </div>
                </div>
              </div>

              {/* Main Body */}
              <div className="px-4 py-2 flex-1 flex flex-col justify-between items-center text-center">
                
                {/* Profile Photo */}
                <div className="relative my-0.5">
                  <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-red-500 via-orange-400 to-amber-400 shadow-md relative">
                    <img
                      src={cardData.profileImage}
                      alt={cardData.name}
                      crossOrigin="anonymous"
                      className="w-full h-full rounded-full object-cover bg-gray-100 border-2 border-white"
                    />
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white">
                      <CheckCircle2 size={10} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full shadow border border-white flex items-center gap-0.5 whitespace-nowrap">
                    <Award size={9} />
                    VERIFIED
                  </div>
                </div>

                {/* Rider Details */}
                <div className="w-full space-y-1 mt-0.5">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight capitalize leading-tight">
                    {cardData.name}
                  </h2>

                  {/* Rider ID Badge */}
                  <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 font-mono font-bold text-xs">
                    <span className="text-slate-500 font-sans text-[9px]">Rider ID:</span>
                    <span className="text-orange-600 font-black tracking-wide">{cardData.riderId}</span>
                  </div>

                  {/* Phone, Vehicle, City & Full Address */}
                  <div className="mt-1 pt-1 border-t border-gray-100 space-y-1 text-left w-full">
                    
                    {/* Row 1: Phone & Vehicle + City */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-gray-50 p-1.5 px-2 rounded-lg border border-gray-100">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Phone</p>
                        <p className="font-bold text-slate-800 text-[10px] flex items-center gap-1 mt-0.5 truncate">
                          <Phone size={10} className="text-orange-500 shrink-0" />
                          {cardData.phone}
                        </p>
                      </div>

                      <div className="bg-gray-50 p-1.5 px-2 rounded-lg border border-gray-100">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Vehicle / City</p>
                        <p className="font-bold text-slate-800 text-[10px] truncate mt-0.5" title={`${cardData.vehicleNumber} (${cardData.city})`}>
                          {cardData.vehicleNumber} • {cardData.city}
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Full Rider Address (No Cut / Truncation) */}
                    <div className="bg-gray-50 p-1.5 px-2 rounded-lg border border-gray-100 w-full">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={9} className="text-orange-500 shrink-0" /> Rider Address
                      </p>
                      <p className="font-extrabold text-slate-800 text-[10px] leading-tight mt-0.5 break-words">
                        {cardData.riderAddress}
                      </p>
                    </div>

                  </div>
                </div>

                {/* Authorized Stamp */}
                <div className="w-full mt-1">
                  <div className="bg-slate-900 text-white rounded-xl py-1 px-2.5 flex items-center justify-between border border-slate-700 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-orange-400 shrink-0" />
                      <div className="text-left">
                        <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider leading-none">
                          AUTHORIZED DELIVERY PARTNER
                        </p>
                        <p className="text-[7px] text-slate-400 font-mono leading-none mt-0.5">
                          SEVAFAST OFFICIAL IDENTIFICATION
                        </p>
                      </div>
                    </div>
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[7px] font-black shrink-0">
                      ✓
                    </div>
                  </div>
                </div>

              </div>

              {/* Front Footer */}
              <div className="bg-gray-50 border-t border-gray-200 py-1 px-3 text-center flex items-center justify-between text-[8px] text-gray-500">
                <span className="font-bold text-gray-700">SEVAFAST LOGISTICS</span>
                <span className="font-mono text-gray-400">ID CARD FRONT</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BACK CARD DESIGN */}
        {/* ========================================================================= */}
        {(activeTab === "back" || activeTab === "both") && (
          <div className="flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-1.5 px-1 no-print">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <Eye size={12} className="text-orange-500" /> Card Back
              </p>
              <button
                onClick={() => handleDownload("back")}
                disabled={isDownloading}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline"
              >
                <Download size={12} /> Download Back
              </button>
            </div>

            <div
              ref={backCardRef}
              className="id-card-element w-[330px] h-[480px] rounded-2xl bg-white text-slate-900 shadow-xl border border-gray-200 overflow-hidden flex flex-col justify-between relative"
            >
              {/* Lanyard Slot Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-2 bg-slate-900/10 rounded-full border border-slate-400/20 z-20 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-slate-900/30 rounded-full"></div>
              </div>

              {/* Back Header Banner */}
              <div className="bg-slate-900 pt-5 pb-3 px-4 text-white relative border-b-2 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-orange-400 tracking-wider uppercase">
                      DELIVERY PARTNER VERIFICATION
                    </h3>
                    <p className="text-[8px] text-slate-400">Official Credentials & Verification</p>
                  </div>
                  <Building2 size={16} className="text-slate-400" />
                </div>
              </div>

              {/* Main Back Body */}
              <div className="px-4 py-2 flex-1 flex flex-col justify-between space-y-1.5">
                
                {/* QR Code & Barcode Block */}
                <div className="bg-gray-50 rounded-xl p-2 border border-gray-200 flex items-center justify-between gap-2.5">
                  <div className="w-14 h-14 bg-white p-0.5 rounded-lg border border-gray-300 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt={`Verify ${cardData.riderId}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode size={40} className="text-slate-900 animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 text-left">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Digital Verification</p>
                    <p className="text-[10px] font-mono font-bold text-slate-800 truncate">
                      {typeof window !== "undefined" && window.location.host ? `${window.location.host}/verify` : "sevafast.com/verify"}
                    </p>
                    
                    {/* Simulated Barcode */}
                    <div className="mt-1 bg-white p-1 rounded border border-gray-200">
                      <div className="h-4 w-full flex justify-between items-center gap-0.5">
                        {[3,1,2,4,1,3,2,1,4,2,1,3,1,2,4,1,2,3,1,2,1,3].map((w, i) => (
                          <div key={i} className="h-full bg-slate-900" style={{ width: `${w * 2.5}%` }}></div>
                        ))}
                      </div>
                      <p className="text-[7px] font-mono text-gray-500 text-center mt-0.5">
                        * {cardData.riderId} *
                      </p>
                    </div>
                  </div>
                </div>

                {/* Company Address (Admin Configured) */}
                <div className="text-left text-xs bg-gray-50 p-2 rounded-lg border border-gray-200 space-y-0.5">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin size={9} className="text-orange-500" /> Registered Company Address
                    </span>
                    <span className="text-[7px] text-gray-400 font-normal">Admin Managed</span>
                  </p>
                  <p className="text-[9px] text-slate-700 font-medium leading-tight break-words">
                    {cardData.address}
                  </p>
                </div>

                {/* Customer Support Number (Admin Configured) */}
                <div className="text-left text-xs bg-orange-50 p-2 rounded-lg border border-orange-200 space-y-0.5">
                  <p className="text-[8px] font-bold text-orange-600 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Phone size={9} /> Customer Support Hotline
                    </span>
                    <span className="text-[7px] text-orange-400 font-normal">24/7 Helpline</span>
                  </p>
                  <p className="text-xs text-orange-950 font-black font-mono">
                    {cardData.supportNumber}
                  </p>
                </div>

                {/* Issue Date = Joining Date (Valid Until Removed) */}
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 text-left">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={10} className="text-orange-500" /> Issue Date (Joining Date)
                  </p>
                  <p className="font-extrabold text-slate-900 text-xs mt-0.5">
                    {cardData.issueDate}
                  </p>
                </div>

                {/* Disclaimer */}
                <div className="bg-slate-100 p-1.5 rounded-lg text-[8px] text-gray-600 font-medium text-center leading-tight">
                  “This ID card is property of SEVAFAST.”
                  <span className="block text-[7px] text-gray-400 mt-0.5">If found, please return to nearest SEVAFAST hub or call support.</span>
                </div>

              </div>

              {/* Back Footer */}
              <div className="bg-slate-900 py-1 px-3 text-center flex items-center justify-between text-[8px] text-slate-400">
                <span>SEVAFAST LOGISTICS PVT LTD</span>
                <span className="font-mono text-gray-400">ID CARD BACK</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Quick Download Both Button */}
      <div className="max-w-md mx-auto mt-5 text-center no-print">
        <button
          onClick={handleDownloadBoth}
          disabled={isDownloading}
          className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Download size={14} /> Download Both Front & Back Cards (PNG)
        </button>
      </div>

      {/* Print Specific CSS Override to ensure clean printing */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 8mm;
          }
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
          }
          body, html {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          nav,
          footer,
          header,
          button,
          [data-sonner-toaster],
          [data-sonner-toast],
          .sonner-toaster,
          .sonner-toast,
          .fixed {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
          .print-container {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            margin: 0 auto !important;
            padding: 10px 0 !important;
            background: transparent !important;
          }
          .id-card-element {
            box-shadow: 0 0 0 1px #e2e8f0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

export default IdCard;

