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
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  // recognition.onend fires asynchronously and calls handleSend from a
  // closure captured when startVoiceInput() ran — at that point
  // setVoiceMode(true) hasn't been committed yet, so a plain `voiceMode`
  // read there is permanently stale (always false) for every mic-triggered
  // message. Mirror it into a ref so the async callback always sees the
  // latest value instead of the one frozen at closure-creation time.
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
  }, [messages, isLoading]);

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

  const speakText = (text) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const cleanText = formatAiText(text).replace(/[*#_~`>]/g, "").trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();

      const hindiVoice = voices.find((v) => v.lang && (v.lang.includes("hi") || v.lang.includes("HI")));
      const indianVoice = voices.find((v) => v.lang && (v.lang.includes("IN") || v.lang.includes("in")));
      const defaultVoice = hindiVoice || indianVoice || voices.find((v) => v.lang && v.lang.startsWith("en")) || voices[0];

      if (defaultVoice) utterance.voice = defaultVoice;
      utterance.lang = defaultVoice?.lang || "hi-IN";
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

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
          handleSend(null, finalTranscript);
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
    e.target.value = ""; // allow re-selecting the same file later
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

  const handleSend = async (e, textOverride = null) => {
    e?.preventDefault();
    const finalInput = textOverride || input;
    const imageToSend = attachedImage;
    if (!finalInput.trim() && !imageToSend && !isLoading) return;

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

    try {
      const res = await adminApi.aiChat({
        message: userMessage.content,
        history: messages,
        imageBase64: imageToSend?.base64,
        mimeType: imageToSend?.mimeType,
      });
      const reply = res.data.result?.reply || res.data.data?.reply || "";

      setMessages([...newMessages, { role: "model", content: reply }]);

      if (voiceModeRef.current && reply) {
        speakText(reply);
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || "Sorry, I am having trouble connecting right now. Please try again.";
      setMessages([...newMessages, { role: "model", content: errMsg }]);
      if (voiceModeRef.current) {
        speakText(errMsg);
      }
    } finally {
      setIsLoading(false);
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
    <div className="fixed bottom-6 right-3 sm:right-6 w-[94vw] sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-[999] transition-all" style={{ height: "550px", maxHeight: "78vh" }}>
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
          <button
            onClick={() => {
              const newMode = !voiceMode;
              setVoiceMode(newMode);
              if (newMode) {
                speakText("Voice talk mode activated.");
              } else {
                window.speechSynthesis?.cancel();
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              voiceMode
                ? "bg-primary text-white shadow-sm ring-1 ring-white/30"
                : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
            }`}
            title={voiceMode ? "Voice Talk ON (AI will speak replies)" : "Turn ON Voice Talk"}
          >
            {voiceMode ? <FiVolume2 size={13} className="animate-pulse" /> : <FiVolumeX size={13} />}
            <span className="text-[10px]">{voiceMode ? "Voice ON" : "Voice"}</span>
          </button>

          <button onClick={() => { setIsOpen(false); window.speechSynthesis?.cancel(); }} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-slate-300 hover:text-white">
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
          if (!text && !msg.image) return null;
          const displayText = msg.role === "model" ? formatAiText(text) : text;

          return (
            <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
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

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => speakText(displayText)}
                        className="text-slate-400 hover:text-primary p-1 rounded-md transition-colors cursor-pointer"
                        title="Read Aloud"
                      >
                        <FiVolume2 size={13} />
                      </button>
                    </div>
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
              <span className="text-xs font-medium text-slate-500">Admin AI is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isListening && (
        <div className="bg-rose-50 border-t border-rose-100 px-3 py-1.5 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
            <FiMic size={14} className="animate-pulse text-rose-500" />
            <span>Listening... Speak now, in any language</span>
          </div>
          <button
            type="button"
            onClick={() => { recognitionRef.current?.stop(); setIsListening(false); }}
            className="text-[10px] font-bold text-rose-700 bg-rose-200/60 px-2 py-0.5 rounded-full hover:bg-rose-200"
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
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md hover:bg-rose-500"
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
          className="p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center bg-slate-100 text-slate-600 hover:text-primary hover:bg-primary/10 disabled:opacity-50"
          title="Attach a screenshot or photo to ask about"
        >
          {isProcessingImage ? <Sparkles size={17} className="animate-spin" /> : <FiImage size={17} />}
        </button>

        <button
          type="button"
          onClick={startVoiceInput}
          className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
            isListening
              ? "bg-rose-500 text-white shadow-md scale-105 animate-pulse"
              : "bg-slate-100 text-slate-600 hover:text-primary hover:bg-primary/10"
          }`}
          title={isListening ? "Listening... Click to stop" : "Click to Speak via Voice"}
        >
          {isListening ? <FiMicOff size={17} /> : <FiMic size={17} />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening to your voice..." : attachedImage ? "Ask about this image (optional)..." : "Ask anything in any language..."}
          className="flex-1 bg-slate-100/80 border-none outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-primary/40 transition-all font-medium min-w-0"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading || (!input.trim() && !attachedImage)}
          className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all shadow-xs"
        >
          <FiSend size={16} />
        </button>
      </form>
    </div>
  );
}
