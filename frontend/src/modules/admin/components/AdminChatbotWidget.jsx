import React, { useState, useRef, useEffect } from "react";
import { adminApi } from "../services/adminApi";
import { FiX, FiSend, FiMic, FiMicOff, FiVolume2, FiVolumeX, FiImage } from "react-icons/fi";
import { Sparkles, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@core/context/AuthContext";

const MAX_IMAGE_BYTES = 1_200_000; // stay under the backend's JSON body limit once base64-encoded

// Resizes/compresses the image client-side so a full-resolution screenshot or
// phone photo doesn't blow past the API's request body limit.
async function compressImageFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  let quality = 0.82;
  let maxDim = 1500;
  let outputUrl = dataUrl;

  for (let attempt = 0; attempt < 4; attempt++) {
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    outputUrl = canvas.toDataURL("image/jpeg", quality);

    if (outputUrl.length <= MAX_IMAGE_BYTES || (quality <= 0.4 && maxDim <= 900)) break;
    quality = Math.max(0.4, quality - 0.15);
    maxDim = Math.max(900, Math.round(maxDim * 0.75));
  }

  return {
    previewUrl: outputUrl,
    base64: outputUrl.replace(/^data:(.*,)?/, ""),
    mimeType: "image/jpeg",
  };
}

export default function AdminChatbotWidget() {
  const { user } = useAuth();
  const isSubAdmin = user?.role === "sub-admin";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [voiceMode, setVoiceMode] = useState(false);
  const [currentPromptIdx, setCurrentPromptIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const [attachedImage, setAttachedImage] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const streamIntervalRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const voiceModeRef = useRef(voiceMode);
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);
  const fileInputRef = useRef(null);

  const prompts = [
    "Have a question? Ask Admin AI ✨",
    "Check today's orders & revenue 📊",
    "Understand any section's workflow 🧭",
    "Check pending approvals ✅",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isSpeaking]);

  // Stop all active speech synthesis and text streaming
  const stopSpeaking = () => {
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current.onstart = null;
      activeUtteranceRef.current.onend = null;
      activeUtteranceRef.current.onboundary = null;
      activeUtteranceRef.current.onerror = null;
      activeUtteranceRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
        setTimeout(() => {
          try {
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              window.speechSynthesis.cancel();
            }
          } catch (_) {}
        }, 50);
        setTimeout(() => {
          try {
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              window.speechSynthesis.cancel();
            }
          } catch (_) {}
        }, 150);
      } catch (e) {
        console.warn("Speech synthesis cancel error:", e);
      }
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    setIsListening(false);
    setIsSpeaking(false);
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  // Automatically halt speech and speech recognition whenever chat modal is closed or unmounted
  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
      if (isListening && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
        setIsListening(false);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      stopSpeaking();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      stopSpeaking();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort?.(); } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const formatAiText = (rawText) => {
    if (!rawText) return "";
    return rawText
      .replace(/\$\\le\s*(\d+)\$/g, "<= $1")
      .replace(/\$\\ge\s*(\d+)\$/g, ">= $1")
      .replace(/\$\\le\$/g, "<=")
      .replace(/\$\\ge\$/g, ">=")
      .replace(/\\le\b/g, "<=")
      .replace(/\\ge\b/g, ">=")
      .replace(/\$([0-9.,]+)\$/g, "$1");
  };

  const getBestVoiceForText = (text) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return { voice: null, lang: "en-IN" };
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return { voice: null, lang: "en-IN" };

    const isHindiOrMarathi = /[\u0900-\u097F]/.test(text);
    const isGujarati = /[\u0A80-\u0AFF]/.test(text);
    const isBengali = /[\u0980-\u09FF]/.test(text);
    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    const isTelugu = /[\u0C00-\u0C7F]/.test(text);
    const isKannada = /[\u0C80-\u0CFF]/.test(text);

    if (isGujarati) {
      const v = voices.find(v => v.lang && (v.lang.startsWith("gu") || v.lang.includes("GU")));
      if (v) return { voice: v, lang: "gu-IN" };
    }
    if (isBengali) {
      const v = voices.find(v => v.lang && (v.lang.startsWith("bn") || v.lang.includes("BN")));
      if (v) return { voice: v, lang: "bn-IN" };
    }
    if (isTamil) {
      const v = voices.find(v => v.lang && (v.lang.startsWith("ta") || v.lang.includes("TA")));
      if (v) return { voice: v, lang: "ta-IN" };
    }
    if (isTelugu) {
      const v = voices.find(v => v.lang && (v.lang.startsWith("te") || v.lang.includes("TE")));
      if (v) return { voice: v, lang: "te-IN" };
    }
    if (isKannada) {
      const v = voices.find(v => v.lang && (v.lang.startsWith("kn") || v.lang.includes("KN")));
      if (v) return { voice: v, lang: "kn-IN" };
    }
    if (isHindiOrMarathi) {
      const v = voices.find(v => v.lang && (v.lang.startsWith("hi") || v.lang.includes("HI") || v.lang.startsWith("mr")));
      if (v) return { voice: v, lang: "hi-IN" };
    }

    const indianEnglish = voices.find(v => v.lang && (v.lang === "en-IN" || v.lang.includes("en-IN") || v.lang.includes("en_IN")));
    const englishVoice = indianEnglish || voices.find(v => v.lang && v.lang.startsWith("en")) || voices[0];
    return { voice: englishVoice, lang: englishVoice?.lang || "en-IN" };
  };

  // Synchronized Gemini-like Voice + Progressive Word Streaming
  const streamAndSpeakResponse = (fullReplyText, shouldSpeak = false) => {
    stopSpeaking();

    const formattedText = formatAiText(fullReplyText);
    const cleanSpeech = formattedText.replace(/[*#_~`>•-]/g, "").trim();

    const modelMessageId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: modelMessageId, role: "model", content: "", isStreaming: true }
    ]);

    if (shouldSpeak && typeof window !== "undefined" && "speechSynthesis" in window && cleanSpeech) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        const { voice: chosenVoice, lang: chosenLang } = getBestVoiceForText(cleanSpeech);

        if (chosenVoice) utterance.voice = chosenVoice;
        utterance.lang = chosenLang || "en-IN";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === modelMessageId
                ? { ...msg, content: formattedText, isStreaming: false }
                : msg
            )
          );
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === modelMessageId
                ? { ...msg, content: formattedText, isStreaming: false }
                : msg
            )
          );
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("Speech synthesis error:", err);
      }
    }

    const words = formattedText.split(" ");
    let currentWordIdx = 0;
    const streamSpeed = shouldSpeak ? 65 : 25;

    streamIntervalRef.current = setInterval(() => {
      currentWordIdx += 1;
      const currentStreamText = words.slice(0, currentWordIdx).join(" ");

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? { ...msg, content: currentStreamText, isStreaming: currentWordIdx < words.length }
            : msg
        )
      );

      if (currentWordIdx >= words.length) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
        if (!shouldSpeak) {
          setIsSpeaking(false);
        }
      }
    }, streamSpeed);
  };

  const speakText = (text) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stopSpeaking();

    try {
      const cleanText = formatAiText(text).replace(/[*#_~`>•-]/g, "").trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const { voice: chosenVoice, lang: chosenLang } = getBestVoiceForText(cleanText);

      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.lang = chosenLang || "en-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  };

  useEffect(() => {
    if (isOpen) return;

    const fullText = prompts[currentPromptIdx];
    let timer;

    if (isTyping) {
      if (displayedText.length < fullText.length) {
        timer = setTimeout(() => {
          setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, 45);
      } else {
        timer = setTimeout(() => {
          setIsBubbleVisible(false);
          setIsTyping(false);
        }, 2000);
      }
    } else {
      timer = setTimeout(() => {
        setDisplayedText("");
        setCurrentPromptIdx((prev) => (prev + 1) % prompts.length);
        setIsBubbleVisible(true);
        setIsTyping(true);
      }, 3000);
    }

    return () => clearTimeout(timer);
  }, [displayedText, isTyping, currentPromptIdx, isOpen]);

  const handleAvatarClick = () => {
    setIsOpen(true);
    setIsBubbleVisible(false);
  };

  const startVoiceInput = () => {
    stopSpeaking();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is supported in Google Chrome & Edge. Please allow microphone permissions.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      setVoiceMode(true);
      const recognition = new SpeechRecognition();
      let finalTranscript = "";
      recognition.lang = speechLang;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");

        if (transcript) {
          finalTranscript = transcript;
          setInput(transcript);
        }
      };

      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (finalTranscript.trim()) {
          handleSend(null, finalTranscript, true);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Failed to start voice recognition:", e);
      setIsListening(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    setIsProcessingImage(true);
    try {
      const compressed = await compressImageFile(file);
      setAttachedImage(compressed);
    } catch (err) {
      console.error("Failed to process image:", err);
      alert("Couldn't read that image. Please try a different file.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSend = async (e, textOverride = null, isFromVoice = false) => {
    e?.preventDefault();
    const finalInput = textOverride || input;
    const imageToSend = attachedImage;
    if (!finalInput.trim() && !imageToSend && !isLoading) return;

    stopSpeaking();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage = {
      role: "user",
      content: finalInput.trim() || (imageToSend ? "Explain this image." : ""),
      image: imageToSend?.previewUrl,
    };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setAttachedImage(null);
    setIsLoading(true);

    const shouldSpeakReply = isFromVoice || voiceModeRef.current;

    try {
      const res = await adminApi.aiChat({
        message: userMessage.content,
        history: messages,
        imageBase64: imageToSend?.base64,
        mimeType: imageToSend?.mimeType,
      });
      const reply = res.data.result?.reply || res.data.data?.reply || "";

      setIsLoading(false);

      if (reply) {
        streamAndSpeakResponse(reply, shouldSpeakReply);
      } else {
        const fallbackMsg = "Your request was processed. Let me know if you need help with anything else in the admin portal.";
        streamAndSpeakResponse(fallbackMsg, shouldSpeakReply);
      }
    } catch (error) {
      setIsLoading(false);
      const errMsg = error?.response?.data?.message || "Sorry, I am having trouble connecting right now. Please try again.";
      streamAndSpeakResponse(errMsg, shouldSpeakReply);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-5 z-[999] flex flex-col items-end gap-2 select-none">
        {isBubbleVisible && displayedText && (
          <div
            onClick={handleAvatarClick}
            className="cursor-pointer bg-white/95 backdrop-blur-xs text-slate-800 text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-slate-200/90 flex items-center gap-1.5 hover:border-primary hover:shadow-primary/20 transition-all duration-300 transform hover:-translate-y-0.5 animate-in fade-in"
          >
            <Sparkles size={12} className="text-primary shrink-0 animate-pulse" />
            <span>{displayedText}</span>
            <span className="w-1 h-3 bg-primary/70 animate-pulse ml-0.5 rounded-full inline-block"></span>
          </div>
        )}

        <button
          onClick={handleAvatarClick}
          className="relative group p-0.5 rounded-full bg-gradient-to-tr from-slate-800 via-indigo-600 to-primary shadow-2xl hover:scale-108 hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center cursor-pointer"
          title="Admin AI Assistant"
        >
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full overflow-hidden border-2 border-white bg-slate-900 flex items-center justify-center shadow-inner">
            <img
              src="/ai-assistant-avatar.png"
              alt="Seva Admin AI"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </div>

          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></span>

          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
            <Sparkles size={11} className="animate-spin" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-3 sm:right-6 w-[94vw] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-[999] transition-all" style={{ height: "550px", maxHeight: "78vh" }}>
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/50 shrink-0 bg-slate-800">
            <img src="/ai-assistant-avatar.png" alt="Seva Admin AI" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight text-white">Admin Assistant</h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">AI</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {isSubAdmin ? "Live data & help, scoped to your access" : "Live stats, approvals & panel help"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Stop AI Voice Button if currently speaking */}
          {isSpeaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all animate-pulse cursor-pointer hover:scale-105 active:scale-95"
              title="Stop AI Voice Speech"
            >
              <span className="w-2 h-2 bg-white rounded-xs"></span>
              <span className="text-[10px]">Stop Audio</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const newMode = !voiceMode;
              setVoiceMode(newMode);
              if (newMode) {
                speakText("Voice talk mode on.");
              } else {
                stopSpeaking();
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              voiceMode
                ? "bg-primary text-white shadow-sm ring-1 ring-white/30"
                : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
            }`}
            title={voiceMode ? "Voice Talk ON (AI will speak replies)" : "Turn ON Voice Talk"}
          >
            {voiceMode ? <FiVolume2 size={13} className="animate-pulse" /> : <FiVolumeX size={13} />}
            <span className="text-[10px]">{voiceMode ? "Voice ON" : "Voice"}</span>
          </button>

          <button 
            type="button"
            onClick={() => { 
              setIsOpen(false); 
              stopSpeaking(); 
            }} 
            className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-slate-300 hover:text-white cursor-pointer"
            title="Close Assistant"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 shadow-xs">
              <Shield size={22} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Hello! I'm Seva Admin AI</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
              Ask me to explain how any panel section works, or to check live orders and approvals.
            </p>

            <div className="w-full mt-4 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left pl-1">You can ask:</p>
              {[
                "Show today's orders & revenue 📊",
                "How many sellers are pending approval? 🕓",
                "How do I approve a seller? ✅",
                "How is a return request processed? 🔄",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(suggestion.replace(/[^\w\s?&/]/g, "").trim())}
                  className="w-full text-left text-xs bg-white hover:bg-primary/5 hover:border-primary/40 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-700 font-medium transition-all shadow-xs flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate">{suggestion}</span>
                  <span className="text-[10px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ask →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const text = msg.content || "";
          if (!text && !msg.image && !msg.isStreaming) return null;
          const displayText = msg.role === "model" ? formatAiText(text) : text;

          return (
            <div key={msg.id || idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-xs ${
                msg.role === "user"
                  ? "bg-primary text-white font-medium rounded-tr-xs"
                  : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
              }`}>
                {msg.role === "user" ? (
                  <>
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Attached"
                        className="max-w-full max-h-40 rounded-lg mb-2 object-contain border border-white/30"
                      />
                    )}
                    {text && <p className="whitespace-pre-wrap">{displayText}</p>}
                  </>
                ) : (
                  <div className="prose prose-sm max-w-none text-slate-800 space-y-2">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-bold text-slate-900" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                        li: ({ node, ...props }) => <li className="text-[13px]" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="text-sm font-bold text-slate-900 mt-2 mb-1" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-sm font-bold text-slate-900 mt-2 mb-1" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mt-2 mb-1" {...props} />,
                        hr: () => <hr className="my-2 border-slate-200" />,
                      }}
                    >
                      {displayText}
                    </ReactMarkdown>

                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle rounded-xs" />
                    )}

                    {!msg.isStreaming && displayText && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => speakText(displayText)}
                          className="text-slate-400 hover:text-primary p-1 rounded-md transition-colors cursor-pointer"
                          title="Read Aloud"
                        >
                          <FiVolume2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white text-slate-800 shadow-xs border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-2.5 flex gap-2.5 items-center">
              <Sparkles className="animate-spin text-primary" size={16} />
              <span className="text-xs font-medium text-slate-500">Admin AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Active AI Speech Waveform Banner with STOP Button */}
      {isSpeaking && (
        <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-t border-b border-primary/20 px-3.5 py-2 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5 text-primary font-semibold text-xs">
            <div className="flex items-end gap-1 h-3.5 pb-0.5">
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2"></span>
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.8s_ease-in-out_infinite_150ms] h-3.5"></span>
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.5s_ease-in-out_infinite_300ms] h-2.5"></span>
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.7s_ease-in-out_infinite_75ms] h-3"></span>
            </div>
            <span className="text-slate-700">Admin AI is speaking...</span>
          </div>
          <button
            type="button"
            onClick={stopSpeaking}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1 rounded-full shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Stop AI speech"
          >
            <span className="w-2 h-2 bg-white rounded-xs"></span>
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Voice Listening Active Wave Banner */}
      {isListening && (
        <div className="bg-rose-50 border-t border-b border-rose-200 px-3.5 py-2 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
            <FiMic size={15} className="animate-spin text-rose-500" />
            <span>Listening... Speak now (in any language)</span>
          </div>
          <button
            type="button"
            onClick={() => { recognitionRef.current?.stop(); setIsListening(false); }}
            className="text-xs font-bold text-rose-700 bg-rose-200/80 hover:bg-rose-300 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {attachedImage && (
        <div className="px-2.5 pt-2 bg-white border-t border-slate-200">
          <div className="relative inline-block">
            <img
              src={attachedImage.previewUrl}
              alt="Selected"
              className="h-16 w-16 object-cover rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md hover:bg-rose-500 cursor-pointer"
              title="Remove image"
            >
              <FiX size={12} />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className={`p-2.5 bg-white flex items-center gap-1.5 ${attachedImage ? "" : "border-t border-slate-200"}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingImage}
          className="p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center bg-slate-100 text-slate-600 hover:text-primary hover:bg-primary/10 disabled:opacity-50 cursor-pointer"
          title="Attach a screenshot or photo to ask about"
        >
          {isProcessingImage ? <Sparkles size={17} className="animate-spin" /> : <FiImage size={17} />}
        </button>

        {/* Voice Input (Microphone) Button with Barge-in */}
        <button
          type="button"
          onClick={startVoiceInput}
          className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center cursor-pointer ${
            isListening
              ? "bg-rose-500 text-white shadow-md scale-105 animate-pulse"
              : "bg-slate-100 text-slate-600 hover:text-primary hover:bg-primary/10"
          }`}
          title={isListening ? "Listening... Click to stop" : "Click to Speak via Voice"}
        >
          {isListening ? <FiMic size={17} className="animate-pulse text-white" /> : <FiMicOff size={17} />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (isSpeaking) stopSpeaking();
          }}
          placeholder={isListening ? "Listening to your voice..." : attachedImage ? "Ask about this image (optional)..." : "Ask anything in any language..."}
          className="flex-1 bg-slate-100/80 border-none outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-primary/40 transition-all font-medium min-w-0"
          disabled={isLoading}
        />

        {/* Send or Stop Button */}
        {isLoading || isSpeaking ? (
          <button
            type="button"
            onClick={stopSpeaking}
            className="p-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center animate-pulse"
            title="Stop AI Response & Voice"
          >
            <div className="w-3.5 h-3.5 bg-white rounded-xs" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() && !attachedImage}
            className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all shadow-xs cursor-pointer"
            title="Send Message"
          >
            <FiSend size={16} />
          </button>
        )}
      </form>
    </div>
  );
}
