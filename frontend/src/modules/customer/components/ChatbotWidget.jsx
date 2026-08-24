import React, { useState, useRef, useEffect } from "react";
import { aiApi } from "../services/aiApi";
import { FiMessageSquare, FiX, FiSend, FiCamera, FiLoader, FiMic, FiMicOff, FiVolume2, FiVolumeX } from "react-icons/fi";
import { Sparkles, Bot, User, Volume2, Mic, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useCart } from "../context/CartContext";
import { useLocation as useAppLocation } from '../context/LocationContext';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-IN"); // en-IN (default), hi-IN, gu-IN, mr-IN
  const [voiceMode, setVoiceMode] = useState(false);
  const [currentPromptIdx, setCurrentPromptIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const { addToCart, removeFromCart } = useCart();
  const { currentLocation } = useAppLocation();

  const prompts = [
    "Kya dhoondh rahe hain? 🔍",
    "Offers & coupons chahiye? 🏷️",
    "Order status track karein 📦",
    "Boliye, Seva AI sun rahi hai! 🎙️"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Pre-load browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Voice speech synthesis helper
  const speakText = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const cleanText = text.replace(/[*#_~`>]/g, '').trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      
      const hindiVoice = voices.find(v => v.lang && (v.lang.includes('hi') || v.lang.includes('HI')));
      const indianVoice = voices.find(v => v.lang && (v.lang.includes('IN') || v.lang.includes('in')));
      const defaultVoice = hindiVoice || indianVoice || voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0];

      if (defaultVoice) {
        utterance.voice = defaultVoice;
      }

      utterance.lang = defaultVoice?.lang || 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  };

  // Typewriter effect: Type char by char -> hold 2s -> hide 3s -> next text
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
        // Fully typed: wait 2 seconds, then fade out
        timer = setTimeout(() => {
          setIsBubbleVisible(false);
          setIsTyping(false);
        }, 2000);
      }
    } else {
      // Hidden: wait 3 seconds, switch prompt, then start typing next
      timer = setTimeout(() => {
        setDisplayedText("");
        setCurrentPromptIdx((prev) => (prev + 1) % prompts.length);
        setIsBubbleVisible(true);
        setIsTyping(true);
      }, 3000);
    }

    return () => clearTimeout(timer);
  }, [displayedText, isTyping, currentPromptIdx, isOpen]);

  // Handle avatar click & voice greeting
  const handleAvatarClick = () => {
    setIsOpen(true);
    setIsBubbleVisible(false);
    speakText("Kuch mil nahi raha hai Seva Fast me? Mujhe batao!");
  };

  // Web Speech Recognition setup (Voice to Text)
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
      recognition.lang = speechLang; // Dynamic: en-IN (English/Hinglish), hi-IN (Hindi), gu-IN (Gujarati), mr-IN (Marathi)
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => setIsListening(true);
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
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

  const handleSend = async (e, textOverride = null) => {
    e?.preventDefault();
    const finalInput = textOverride || input;
    if (!finalInput.trim() && !isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage = { role: "user", parts: [{ text: finalInput }] };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const params = {
        messages: newMessages,
        lat: currentLocation?.latitude,
        lng: currentLocation?.longitude,
      };
      const res = await aiApi.chat(params);
      const { reply, messages: updatedHistory, products, action, actionPayload } = res.data.result || {};
      
      if (action === "ADD_TO_CART" && actionPayload) {
        addToCart(actionPayload);
      } else if (action === "REMOVE_FROM_CART" && actionPayload) {
        removeFromCart(actionPayload.productId, actionPayload.variantSku);
      }
      
      setMessages([
        ...updatedHistory,
        { 
          role: "model", 
          parts: [{ text: reply }],
          products: products && products.length > 0 ? products : undefined
        }
      ]);

      // If Voice Talk Mode is enabled, speak the reply out loud!
      if (voiceMode && reply) {
        speakText(reply);
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || "Sorry, I am having trouble connecting right now. Please try again.";
      setMessages([
        ...newMessages,
        { role: "model", parts: [{ text: errMsg }] },
      ]);
      if (voiceMode) {
        speakText(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result.replace(/^data:(.*,)?/, '');
      const mimeType = file.type;

      setMessages(prev => [...prev, { role: "user", parts: [{ text: `[Uploaded Image: ${file.name}]` }] }]);
      setIsLoading(true);

      try {
        const res = await aiApi.visualSearch({
          imageBase64: base64String,
          mimeType,
        });
        
        const { keywords, products } = res.data.result;
        let botReply = `Maine aapki photo check ki aur matching items search kiye hain:`;
        if (products && products.length > 0) {
            setMessages(prev => [
                ...prev, 
                { role: "model", parts: [{ text: botReply }], products }
            ]);
            if (voiceMode) speakText(botReply);
        } else {
            setMessages(prev => [
                ...prev, 
                { role: "model", parts: [{ text: `Photo me **${keywords}** recognize hua, par abhi store me matching stock available nahi hai.` }] }
            ]);
        }
      } catch (error) {
        setMessages(prev => [
          ...prev,
          { role: "model", parts: [{ text: "Failed to process the image. Please try again." }] },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-5 z-[999] flex flex-col items-end gap-2 select-none">
        {/* Sleek Typewriter Speech Capsule */}
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

        {/* Circular Avatar Button */}
        <button
          onClick={handleAvatarClick}
          className="relative group p-0.5 rounded-full bg-gradient-to-tr from-primary via-orange-400 to-amber-300 shadow-2xl hover:scale-108 hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center cursor-pointer"
          title="Seva AI Assistant"
        >
          {/* Avatar Image in Circle */}
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full overflow-hidden border-2 border-white bg-slate-900 flex items-center justify-center shadow-inner">
            <img 
              src="/ai-assistant-avatar.png" 
              alt="Seva AI" 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </div>

          {/* Glowing Green Online Status Dot */}
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></span>

          {/* Subtle Sparkle Badge */}
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
            <Sparkles size={11} className="animate-spin" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 w-[94vw] sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-[999] transition-all" style={{ height: "550px", maxHeight: "78vh" }}>
      {/* Sleek Gemini-style Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/50 shrink-0 bg-slate-800">
            <img src="/ai-assistant-avatar.png" alt="Seva AI" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight text-white">Seva Assistant</h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">AI</span>
            </div>
            <p className="text-[11px] text-slate-300">Live products, orders & help</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Two-way Voice Talk Toggle Button */}
          <button 
            onClick={() => {
              const newMode = !voiceMode;
              setVoiceMode(newMode);
              if (newMode) {
                speakText("Voice talk mode activated! Aap bol kar pooch sakte hain.");
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

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.filter(m => m.parts && m.parts[0] && m.parts[0].text).map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-xs ${
              msg.role === "user" 
                ? "bg-primary text-white font-medium rounded-tr-xs" 
                : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
            }`}>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
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
                    {msg.parts[0].text}
                  </ReactMarkdown>
                  
                  {/* Speaker button to read aloud individual response */}
                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => speakText(msg.parts[0].text)} 
                      className="text-slate-400 hover:text-primary p-1 rounded-md transition-colors"
                      title="Read Aloud"
                    >
                      <FiVolume2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Display clickable product cards */}
            {msg.products && msg.products.length > 0 && (
                <div className="mt-2.5 w-full max-w-[92%] grid grid-cols-1 gap-2">
                    {msg.products.map(p => {
                        const prodId = p.id || p._id;
                        return (
                          <div 
                            key={prodId} 
                            onClick={() => {
                              if (prodId) {
                                setIsOpen(false);
                                window.speechSynthesis?.cancel();
                                navigate(`/product/${prodId}`);
                              }
                            }} 
                            className="cursor-pointer bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/90 flex gap-3 items-center hover:border-primary hover:shadow-md hover:scale-[1.01] transition-all group"
                          >
                              {p.thumbnail ? (
                                <img src={p.thumbnail} alt={p.name} className="w-12 h-12 object-cover rounded-lg bg-slate-50 shrink-0 border border-slate-100" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                                  Item
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold text-primary">₹{p.price ?? 0}</span>
                                    {p.mrp && Number(p.mrp) > Number(p.price) && (
                                      <span className="text-[10px] text-slate-400 line-through">₹{p.mrp}</span>
                                    )}
                                    {p.rating && typeof p.rating === 'number' && (
                                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        ★ {p.rating}
                                      </span>
                                    )}
                                  </div>
                              </div>

                              <div className="text-[11px] font-semibold text-primary px-2.5 py-1 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                                View
                              </div>
                          </div>
                        );
                    })}
                </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white text-slate-800 shadow-xs border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-2.5 flex gap-2.5 items-center">
              <Sparkles className="animate-spin text-primary" size={16} />
              <span className="text-xs font-medium text-slate-500">Searching Seva Fast...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Listening Active Wave Banner */}
      {isListening && (
        <div className="bg-rose-50 border-t border-rose-100 px-3 py-1.5 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
            <Radio size={14} className="animate-spin text-rose-500" />
            <span>Listening... Boliye (Hindi / English / Marathi / Gujarati)</span>
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

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5">
        {/* Photo Upload */}
        <label className="cursor-pointer p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-colors shrink-0" title="Visual Search">
          <FiCamera size={18} />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        {/* Voice Input (Microphone) Button */}
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
        
        {/* Text Input */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening to your voice..." : "Ask anything in any language..."}
          className="flex-1 bg-slate-100/80 border-none outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-primary/40 transition-all font-medium min-w-0"
          disabled={isLoading}
        />
        
        {/* Send Button */}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all shadow-xs"
        >
          <FiSend size={16} />
        </button>
      </form>
    </div>
  );
}
