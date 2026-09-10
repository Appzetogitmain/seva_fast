import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Headphones,
  Mail,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@core/context/SettingsContext";
import axiosInstance from "@core/api/axios";

const defaultFaqs = [
  {
    question: "How do I change my bank account details?",
    answer:
      "Go to Profile > Bank Account and tap on 'Request Change'. You will need to upload a cancelled cheque or passbook copy for verification.",
  },
  {
    question: "What if I can't find the customer's location?",
    answer:
      "Use the in-app map navigation. If you're still stuck, you can call the customer directly using the 'Call' button on the order screen.",
  },
  {
    question: "How are my earnings calculated?",
    answer:
      "Earnings are based on base fare + distance pay + surge pricing (if applicable). You can view detailed breakdown in the Earnings tab.",
  },
  {
    question: "I had an accident during delivery. What to do?",
    answer:
      "Use the SOS button immediately in the Safety section. Our emergency response team will contact you and provide assistance.",
  },
  {
    question: "How do I deposit COD cash collected from customers?",
    answer:
      "Go to Profile > COD Cash Management to view your collected cash, hand over cash to seller, or settle pending balance online via UPI.",
  },
];

const HelpSupport = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const supportPhone = settings?.supportPhone || "+91 98765 43210";
  const supportEmail = settings?.supportEmail || "support@sevafast.com";

  const [faqs, setFaqs] = useState(defaultFaqs);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await axiosInstance.get("/public/faqs", {
          params: { category: "Delivery", status: "published" },
        });
        const dynamicFaqs = response.data?.results || response.data?.result || response.data;
        if (Array.isArray(dynamicFaqs) && dynamicFaqs.length > 0) {
          setFaqs(dynamicFaqs);
        }
      } catch (error) {
        console.error("Error fetching Delivery FAQs:", error);
      }
    };

    fetchFaqs();
  }, []);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleOpenChat = () => {
    window.dispatchEvent(new CustomEvent("open-delivery-chatbot"));
    toast.success("Opening Seva Rider Support Chat...");
  };

  const handleCallSupport = () => {
    if (!supportPhone) {
      toast.error("Support phone number is currently unavailable.");
      return;
    }

    const cleanPhone = supportPhone.replace(/[^\d+]/g, "");
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = `tel:${cleanPhone}`;
    } else {
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(supportPhone)
          .then(() => toast.success(`Helpline ${supportPhone} copied to clipboard!`))
          .catch(() => toast.info(`Call Helpline: ${supportPhone}`));
      } else {
        toast.info(`Call Helpline: ${supportPhone}`);
      }
      // Also attempt opening tel protocol
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  const handleEmailSupport = () => {
    if (!supportEmail) return;
    window.open(
      `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent("Delivery Partner Support Request")}`,
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white shadow-xs sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center p-4 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2 text-gray-700 active:scale-95"
            aria-label="Go Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Help & Support</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Support Channels Banner */}
        <section className="grid grid-cols-2 gap-3.5">
          {/* Chat Support Card */}
          <button
            type="button"
            onClick={handleOpenChat}
            className="w-full bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/40 active:scale-98 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
          >
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
              <MessageCircle size={26} className="shrink-0" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors">
              Chat Support
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">Instant AI & Agent Help</p>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live 24/7
            </span>
          </button>

          {/* Call Support Card */}
          <button
            type="button"
            onClick={handleCallSupport}
            className="w-full bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-500/40 active:scale-98 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
          >
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
              <Phone size={26} className="shrink-0" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm group-hover:text-emerald-600 transition-colors">
              Call Support
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">{supportPhone || "Toll-Free Helpline"}</p>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <Headphones size={10} />
              Priority Line
            </span>
          </button>
        </section>

        {/* FAQs */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-3.5 flex items-center">
            <HelpCircle size={18} className="mr-2 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="divide-y divide-gray-100">
            {faqs.map((faq, index) => {
              const qText = faq.question || faq.title || "";
              const aText = faq.answer || faq.content || "";
              return (
                <div key={faq._id || index} className="py-3.5 first:pt-1 last:pb-1">
                  <button
                    type="button"
                    className="w-full flex justify-between items-center text-left gap-3 group focus:outline-none cursor-pointer"
                    onClick={() => toggleAccordion(index)}
                  >
                    <h4 className="font-semibold text-gray-800 text-sm group-hover:text-primary transition-colors leading-snug">
                      {qText}
                    </h4>
                    <span className="p-1 rounded-full text-gray-400 group-hover:text-primary group-hover:bg-gray-100 transition-colors shrink-0">
                      {openIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {openIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2.5 pb-1 text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50/70 p-3 rounded-xl mt-2 border border-gray-100">
                          {aText}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* Still Need Help Bottom Action Card */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 space-y-3">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center mx-auto text-primary border border-white/10">
              <Sparkles size={22} />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Still need help?</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                Hamari support team aapki poori madad ke liye 24/7 taiyaar hai.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleOpenChat}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-primary/30 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle size={16} />
                <span>Chat with Us</span>
              </button>

              <button
                type="button"
                onClick={handleCallSupport}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Phone size={16} className="text-emerald-600" />
                <span>Call Helpline</span>
              </button>
            </div>

            {supportEmail && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleEmailSupport}
                  className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Mail size={12} />
                  <span>Email: {supportEmail}</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpSupport;
