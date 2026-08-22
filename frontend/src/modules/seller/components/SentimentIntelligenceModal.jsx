import React, { useState, useEffect } from "react";
import { sellerApi } from "../services/sellerApi";
import { 
  Sparkles, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  RotateCcw, 
  Lightbulb, 
  ShieldAlert, 
  Star,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function SentimentIntelligenceModal({ isOpen, onClose, productId = null, productName = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = productId ? { productId } : {};
      const res = await sellerApi.getSentimentIntelligence(params);
      setData(res.data.result || res.data.data || {});
    } catch (err) {
      console.error("Failed to load sentiment intelligence:", err);
      setError(err.response?.data?.message || "Could not analyze reviews and returns. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchIntelligence();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, productId]);

  const handleCopy = () => {
    if (!data?.intelligence) return;
    const text = `SevaFast Sentiment & Return Report: ${data.intelligence.productName || "Catalog"}\n`
      + `Risk Level: ${data.intelligence.returnRiskLevel}\n`
      + `Summary: ${data.intelligence.summary}\n\n`
      + `Top Complaints:\n${data.intelligence.topComplaints?.map(c => `- ${c.issue} (${c.percentage}) - Severity: ${c.severity}`).join("\n")}\n\n`
      + `Actionable Advice:\n${data.intelligence.actionableAdvice?.map(a => `- ${a.title} [Impact: ${a.impact}]: ${a.description}`).join("\n")}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const intel = data?.intelligence;
  const stats = data?.stats;
  const sentiment = intel?.sentimentScore || { positivePercent: 70, neutralPercent: 20, negativePercent: 10 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4.5 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-md shadow-primary/20 text-white shrink-0">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Review & Sentiment Intelligence</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                  AI Return Reduction
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate max-w-[280px] sm:max-w-md">
                {productName || intel?.productName || "Entire Catalog & Return Requests"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {intel && (
              <button
                onClick={handleCopy}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-xs flex items-center gap-1.5"
                title="Copy Summary"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span className="hidden sm:inline text-xs">{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-3 border-primary/30 border-t-primary animate-spin"></div>
                <Sparkles size={20} className="absolute inset-0 m-auto text-primary animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Scanning Customer Reviews & Return Reasons...</p>
                <p className="text-xs text-slate-500">Gemini AI is extracting root causes, complaints, and return reduction advice.</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-14 text-center space-y-3">
              <AlertTriangle size={36} className="mx-auto text-rose-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{error}</p>
              <button
                onClick={fetchIntelligence}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2"
              >
                <RefreshCw size={14} /> Retry Analysis
              </button>
            </div>
          ) : intel ? (
            <>
              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Return Risk Level</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${
                      intel.returnRiskLevel === 'High' 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200' 
                        : intel.returnRiskLevel === 'Medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200'
                    }`}>
                      {intel.returnRiskLevel || "Medium"}
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Analyzed Reviews</p>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                    <MessageSquare size={16} className="text-primary" />
                    {stats?.totalReviews ?? 0}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Returns</p>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                    <RotateCcw size={16} className="text-rose-500" />
                    {stats?.totalReturns ?? 0}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Average Rating</p>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                    <Star size={16} className="text-amber-500 fill-amber-500" />
                    {stats?.averageRating !== "N/A" ? `${stats?.averageRating} / 5` : "New"}
                  </p>
                </div>
              </div>

              {/* Sentiment Score Progress Breakdown */}
              <div className="bg-white dark:bg-slate-800 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={15} className="text-primary" />
                    Sentiment Health Breakdown
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Positive: {sentiment.positivePercent}%
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> Neutral: {sentiment.neutralPercent}%
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span> Negative: {sentiment.negativePercent}%
                    </span>
                  </div>
                </div>

                {/* Triple-color bar */}
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div style={{ width: `${sentiment.positivePercent}%` }} className="bg-emerald-500 transition-all duration-500" title={`Positive: ${sentiment.positivePercent}%`}></div>
                  <div style={{ width: `${sentiment.neutralPercent}%` }} className="bg-amber-400 transition-all duration-500" title={`Neutral: ${sentiment.neutralPercent}%`}></div>
                  <div style={{ width: `${sentiment.negativePercent}%` }} className="bg-rose-500 transition-all duration-500" title={`Negative: ${sentiment.negativePercent}%`}></div>
                </div>
              </div>

              {/* Executive Summary */}
              {intel.summary && (
                <div className="bg-gradient-to-r from-primary/5 via-orange-500/5 to-transparent border border-primary/20 rounded-2xl p-4 flex gap-3.5 items-start">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">AI Executive Summary</h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{intel.summary}</p>
                  </div>
                </div>
              )}

              {/* Top Complaints & Return Drivers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={15} className="text-rose-500" />
                    Top Complaints & Return Drivers
                  </h3>
                  <span className="text-[11px] text-slate-500">Ranked by customer impact</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {intel.topComplaints && intel.topComplaints.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{item.issue}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                            item.severity === 'High' 
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                              : item.severity === 'Medium'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {item.severity} Severity
                          </span>
                        </div>
                        {item.sampleQuote && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            "{item.sampleQuote}"
                          </p>
                        )}
                      </div>

                      <div className="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-extrabold text-xs px-3 py-1.5 rounded-xl shrink-0 text-center border border-rose-100 dark:border-rose-900/40">
                        {item.percentage} customers
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlights & What Customers Loved */}
              {intel.highlights && intel.highlights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle size={15} className="text-emerald-500" />
                    Customer Highlights (Positive Points)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {intel.highlights.map((h, idx) => (
                      <div key={idx} className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-3 rounded-2xl space-y-1">
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                          <Check size={13} className="text-emerald-600" /> {h.feature}
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug">{h.praise}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Return Reduction Advice */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb size={15} className="text-amber-500" />
                    Actionable Advice (Return Reduction Engine)
                  </h3>
                  <span className="text-[11px] font-semibold text-primary">Recommended Actions</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {intel.actionableAdvice && intel.actionableAdvice.map((advice, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-1.5 hover:border-primary/50 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          {advice.title}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {advice.impact}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                        {advice.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <button
            onClick={fetchIntelligence}
            disabled={loading}
            className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-primary p-2 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh Insights
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
