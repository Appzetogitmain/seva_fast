import React, { useState, useRef, useEffect } from "react";
import { aiApi } from "../services/aiApi";
import {
  FiMessageSquare,
  FiX,
  FiSend,
  FiCamera,
  FiLoader,
  FiMic,
  FiMicOff,
  FiVolume2,
  FiVolumeX,
  FiShoppingCart,
  FiCheckCircle,
  FiAlertCircle,
  FiCheck,
  FiArrowRight,
  FiList,
  FiShoppingBag,
} from "react-icons/fi";
import { Sparkles, Bot, User, Volume2, Mic, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useCart } from "../context/CartContext";
import { useLocation as useAppLocation } from "../context/LocationContext";

export default function ChatbotWidget() {
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const streamIntervalRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const voiceTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const { addToCart, removeFromCart, updateQuantity, batchAddToCart, cartCount } = useCart();
  const { currentLocation } = useAppLocation();

  const voiceModeRef = useRef(voiceMode);
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.();
        } catch (_) {}
      }
      setIsListening(false);
    }
  }, [isOpen]);

  const prompts = [
    "Upload a grocery list / photo 📝",
    "Kya dhoondh rahe hain? 🔍",
    "Tell me multiple items to add 🛒",
    "Order status track karein 📦",
    "Boliye, Seva AI sun rahi hai! 🎙️",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isSpeaking]);

  const stopSpeaking = () => {
    // 1. Clear voice restart timeouts
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }

    // 2. Clear word-streaming interval
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // 3. Detach listeners from active utterance to prevent delayed triggers on cancel
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current.onstart = null;
      activeUtteranceRef.current.onend = null;
      activeUtteranceRef.current.onboundary = null;
      activeUtteranceRef.current.onerror = null;
      activeUtteranceRef.current = null;
    }

    // 4. Force cancel browser speech synthesis queue + delayed fallbacks for Chrome queue bugs
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

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    setIsListening(false);
    setIsSpeaking(false);
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      stopSpeaking();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.();
        } catch (_) {}
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
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      return { voice: null, lang: "en-IN" };
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return { voice: null, lang: "en-IN" };

    const isHindiOrMarathi = /[\u0900-\u097F]/.test(text);
    const isGujarati = /[\u0A80-\u0AFF]/.test(text);
    const isBengali = /[\u0980-\u09FF]/.test(text);
    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    const isTelugu = /[\u0C00-\u0C7F]/.test(text);
    const isKannada = /[\u0C80-\u0CFF]/.test(text);

    if (isGujarati) {
      const v = voices.find(
        (v) => v.lang && (v.lang.startsWith("gu") || v.lang.includes("GU"))
      );
      if (v) return { voice: v, lang: "gu-IN" };
    }
    if (isBengali) {
      const v = voices.find(
        (v) => v.lang && (v.lang.startsWith("bn") || v.lang.includes("BN"))
      );
      if (v) return { voice: v, lang: "bn-IN" };
    }
    if (isTamil) {
      const v = voices.find(
        (v) => v.lang && (v.lang.startsWith("ta") || v.lang.includes("TA"))
      );
      if (v) return { voice: v, lang: "ta-IN" };
    }
    if (isTelugu) {
      const v = voices.find(
        (v) => v.lang && (v.lang.startsWith("te") || v.lang.includes("TE"))
      );
      if (v) return { voice: v, lang: "te-IN" };
    }
    if (isKannada) {
      const v = voices.find(
        (v) => v.lang && (v.lang.startsWith("kn") || v.lang.includes("KN"))
      );
      if (v) return { voice: v, lang: "kn-IN" };
    }
    if (isHindiOrMarathi) {
      const v = voices.find(
        (v) =>
          v.lang &&
          (v.lang.startsWith("hi") ||
            v.lang.includes("HI") ||
            v.lang.startsWith("mr"))
      );
      if (v) return { voice: v, lang: "hi-IN" };
    }

    const indianEnglish = voices.find(
      (v) =>
        v.lang &&
        (v.lang === "en-IN" ||
          v.lang.includes("en-IN") ||
          v.lang.includes("en_IN"))
    );
    const englishVoice =
      indianEnglish ||
      voices.find((v) => v.lang && v.lang.startsWith("en")) ||
      voices[0];
    return { voice: englishVoice, lang: englishVoice?.lang || "en-IN" };
  };

  // Synchronized Gemini-like Voice + Real-time Speech-Aligned Progressive Word Streaming
  const streamAndSpeakResponse = (
    fullReplyText,
    shouldSpeak = false,
    products = undefined,
    shoppingListResult = undefined
  ) => {
    stopSpeaking();

    const formattedText = formatAiText(fullReplyText);
    const cleanSpeech = formattedText.replace(/[*#_~`>•-]/g, "").trim();
    const words = formattedText.split(/\s+/).filter(Boolean);

    const modelMessageId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: modelMessageId,
        role: "model",
        parts: [{ text: "" }],
        isStreaming: true,
        products: products && products.length > 0 ? products : undefined,
        shoppingListResult: shoppingListResult || undefined,
        isBatchAdded: false,
      },
    ]);

    let wordIdx = 0;

    const revealUpTo = (count) => {
      const clamped = Math.max(0, Math.min(words.length, count));
      const currentText = words.slice(0, clamped).join(" ");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? {
                ...msg,
                parts: [{ text: clamped >= words.length ? formattedText : currentText }],
                isStreaming: clamped < words.length,
              }
            : msg
        )
      );
    };

    const startWordStreaming = (msPerWord = 35) => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);

      streamIntervalRef.current = setInterval(() => {
        if (!isOpenRef.current) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
          return;
        }

        wordIdx++;
        revealUpTo(wordIdx);

        if (wordIdx >= words.length) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
      }, msPerWord);
    };

    if (shouldSpeak && cleanSpeech && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        const { voice: chosenVoice, lang: chosenLang } = getBestVoiceForText(cleanSpeech);

        if (chosenVoice) utterance.voice = chosenVoice;
        utterance.lang = chosenLang || "en-IN";
        utterance.rate = 0.92;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Text reveal is driven by the TTS engine's actual word-boundary events so the
        // on-screen text tracks what's being spoken in real time, instead of a fixed
        // timer that drifts out of sync with the browser's real speech pace.
        let speechStarted = false;
        let boundaryFired = false;
        let boundaryWordIdx = 0;

        utterance.onboundary = (event) => {
          if (!isOpenRef.current) return;
          if (event.name && event.name !== "word") return;
          boundaryFired = true;
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          boundaryWordIdx++;
          revealUpTo(boundaryWordIdx);
        };

        utterance.onstart = () => {
          if (!isOpenRef.current) {
            stopSpeaking();
            return;
          }
          speechStarted = true;
          setIsSpeaking(true);

          // Fallback for engines/voices that never fire onboundary (e.g. some mobile
          // voices): estimate pace so text still streams roughly alongside the audio.
          setTimeout(() => {
            if (!boundaryFired && isOpenRef.current) {
              const totalSpeechDurationEstimateSec = words.length / 2.3;
              const intervalMs = Math.max(
                20,
                Math.min(180, (totalSpeechDurationEstimateSec * 1000) / (words.length || 1))
              );
              startWordStreaming(intervalMs);
            }
          }, 400);
        };

        utterance.onend = () => {
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          setIsSpeaking(false);
          revealUpTo(words.length);

          if (voiceModeRef.current && isOpenRef.current) {
            voiceTimeoutRef.current = setTimeout(() => {
              if (voiceModeRef.current && isOpenRef.current && !isListening) {
                startVoiceInput();
              }
            }, 500);
          }
        };

        utterance.onerror = () => {
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          setIsSpeaking(false);
          revealUpTo(words.length);
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);

        setTimeout(() => {
          if (!speechStarted && !streamIntervalRef.current && isOpenRef.current) {
            startWordStreaming(35);
          }
        }, 800);
      } catch (err) {
        console.error("Speech synthesis error:", err);
        startWordStreaming(35);
      }
    } else {
      startWordStreaming(25);
    }
  };

  const speakText = (text) => {
    if (!isOpenRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stopSpeaking();

    try {
      const cleanText = formatAiText(text).replace(/[*#_~`>•-]/g, "").trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const { voice: chosenVoice, lang: chosenLang } =
        getBestVoiceForText(cleanText);

      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.lang = chosenLang || "en-IN";
      utterance.rate = 0.90;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        if (!isOpenRef.current) {
          stopSpeaking();
          return;
        }
        setIsSpeaking(true);
      };
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      activeUtteranceRef.current = utterance;
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
    if (voiceModeRef.current) {
      speakText("Kuch mil nahi raha hai Seva Fast me? Mujhe batao ya shopping list upload karo!");
    }
  };

  const toggleVoiceMode = () => {
    const nextVoiceMode = !voiceMode;
    setVoiceMode(nextVoiceMode);

    if (nextVoiceMode) {
      startVoiceInput();
    } else {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop?.();
        } catch (_) {}
      }
      setIsListening(false);
    }
  };

  const startVoiceInput = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    stopSpeaking();

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      let finalTranscript = "";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalTranscript += text;
          } else {
            interim += text;
          }
        }
        setInput(finalTranscript || interim);
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

  // Checks if text is asking for multiple products or a list
  const isMultiProductQuery = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    if (lower.includes("\n") || lower.includes("•") || lower.includes("- "))
      return true;
    if (lower.split(",").length >= 2 && /\d+/.test(lower)) return true;
    if (/\b\d+\s+[a-zA-Z]+.*\band\b.*\b\d+\s+[a-zA-Z]+/i.test(lower))
      return true;
    if (
      lower.startsWith("i need ") ||
      lower.startsWith("buy ") ||
      lower.startsWith("order ") ||
      lower.startsWith("add ") ||
      lower.startsWith("list ")
    ) {
      if (
        lower.includes(" and ") ||
        lower.includes(",") ||
        lower.split(" ").length > 5
      )
        return true;
    }
    return false;
  };

  const handleSend = async (e, textOverride = null, isFromVoice = false) => {
    e?.preventDefault();
    const finalInput = textOverride || input;
    if (!finalInput.trim() && !isLoading) return;

    stopSpeaking();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage = { role: "user", parts: [{ text: finalInput }] };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const shouldSpeakReply = isFromVoice || voiceModeRef.current;

    // Check if the query looks like a multi-item shopping list
    if (isMultiProductQuery(finalInput)) {
      try {
        const res = await aiApi.processShoppingList({
          text: finalInput,
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude,
        });

        const data = res?.data?.result;
        if (
          data &&
          (data.matchedItems?.length > 0 ||
            data.ambiguousItems?.length > 0 ||
            data.unavailableItems?.length > 0)
        ) {
          setIsLoading(false);
          streamAndSpeakResponse(
            data.summaryText,
            shouldSpeakReply,
            undefined,
            data
          );
          return;
        }
      } catch (listErr) {
        console.warn("[Chatbot] Shopping list extraction fallback to chat:", listErr.message);
      }
    }

    // Default chat flow
    try {
      const params = {
        messages: newMessages.map((m) => ({ role: m.role, parts: m.parts })),
        lat: currentLocation?.latitude,
        lng: currentLocation?.longitude,
      };
      const res = await aiApi.chat(params);
      const { reply, products, action, actionPayload } = res.data.result || {};

      setIsLoading(false);

      if (action === "ADD_TO_CART" && actionPayload) {
        await addToCart(actionPayload, { skipConfirm: true });
      } else if (action === "REMOVE_FROM_CART" && actionPayload) {
        if (actionPayload.quantity && Number(actionPayload.quantity) > 0) {
          await updateQuantity(
            actionPayload.productId,
            -Number(actionPayload.quantity),
            actionPayload.variantSku
          );
        } else {
          await removeFromCart(actionPayload.productId, actionPayload.variantSku);
        }
      }

      if (reply) {
        streamAndSpeakResponse(reply, shouldSpeakReply, products);
      } else {
        const fallbackMsg =
          "Aapka message mil gaya hai. Kya aapko kisi aur item ya order ke baare me poochna hai?";
        streamAndSpeakResponse(fallbackMsg, shouldSpeakReply, products);
      }
    } catch (error) {
      setIsLoading(false);
      const errMsg =
        error?.response?.data?.message ||
        "Sorry, I am having trouble connecting right now. Please try again.";
      streamAndSpeakResponse(errMsg, shouldSpeakReply);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result.replace(/^data:(.*,)?/, "");
      const mimeType = file.type;

      stopSpeaking();
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          parts: [{ text: `[Uploaded Image: ${file.name}]` }],
        },
      ]);
      setIsLoading(true);

      try {
        // First try full shopping list & catalog extraction
        const listRes = await aiApi.processShoppingList({
          imageBase64: base64String,
          mimeType,
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude,
        });

        const listData = listRes?.data?.result;
        if (
          listData &&
          (listData.matchedItems?.length > 0 ||
            listData.ambiguousItems?.length > 0 ||
            listData.unavailableItems?.length > 0)
        ) {
          setIsLoading(false);
          streamAndSpeakResponse(
            listData.summaryText,
            voiceModeRef.current,
            undefined,
            listData
          );
          return;
        }

        // Fallback to visual search keywords
        const res = await aiApi.visualSearch({
          imageBase64: base64String,
          mimeType,
        });

        const { keywords, products } = res.data.result;
        let botReply = `Maine aapki photo check ki aur matching items search kiye hain:`;
        setIsLoading(false);
        if (products && products.length > 0) {
          streamAndSpeakResponse(botReply, voiceModeRef.current, products);
        } else {
          streamAndSpeakResponse(
            `Photo me **${keywords}** recognize hua, par abhi store me matching stock available nahi hai.`,
            voiceModeRef.current
          );
        }
      } catch (error) {
        setIsLoading(false);
        streamAndSpeakResponse(
          "Failed to process the image. Please try again.",
          voiceModeRef.current
        );
      }
    };
    reader.readAsDataURL(file);
  };

  // Add all matched items to cart
  const handleConfirmBatchAdd = async (msgId, batchPayload) => {
    if (!batchPayload || batchPayload.length === 0) return;
    setIsLoading(true);

    try {
      const res = await batchAddToCart(batchPayload, { skipConfirm: true });
      setIsLoading(false);

      if (res.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === msgId ? { ...msg, isBatchAdded: true } : msg
          )
        );
        const confMsg = `Added ${batchPayload.length} item(s) to your cart! 🛒`;
        if (voiceModeRef.current) speakText(confMsg);
      } else {
        alert(res.message || "Could not add some items to cart");
      }
    } catch (err) {
      setIsLoading(false);
      console.error("Batch add error:", err);
    }
  };

  // Resolve variant selection directly inside chat
  const handleSelectVariantForList = (msgId, ambiguousItemIdx, variant) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.shoppingListResult) return msg;

        const slr = { ...msg.shoppingListResult };
        const ambItem = slr.ambiguousItems[ambiguousItemIdx];
        if (!ambItem) return msg;

        slr.ambiguousItems = slr.ambiguousItems.filter(
          (_, idx) => idx !== ambiguousItemIdx
        );

        const newMatched = {
          productId: ambItem.productId,
          name: `${ambItem.name} (${variant.name})`,
          price: variant.price,
          image: ambItem.image,
          variantSku: variant.sku || variant.name,
          quantity: ambItem.requestedQuantity || 1,
          availableStock: variant.stock,
          sellerId: ambItem.sellerId,
        };

        slr.matchedItems = [...(slr.matchedItems || []), newMatched];
        slr.batchPayload = [
          ...(slr.batchPayload || []),
          {
            productId: newMatched.productId,
            variantSku: newMatched.variantSku,
            quantity: newMatched.quantity,
            name: newMatched.name,
            price: newMatched.price,
            image: newMatched.image,
            sellerId: newMatched.sellerId,
          },
        ];
        slr.canBatchAdd = slr.batchPayload.length > 0;

        return { ...msg, shoppingListResult: slr };
      })
    );
  };

  // Resolve multiple product candidates
  const handleSelectCandidateProduct = (msgId, ambiguousItemIdx, candidate) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.shoppingListResult) return msg;

        const slr = { ...msg.shoppingListResult };
        const ambItem = slr.ambiguousItems[ambiguousItemIdx];
        if (!ambItem) return msg;

        if (candidate.hasVariants && candidate.variants?.length > 0) {
          slr.ambiguousItems[ambiguousItemIdx] = {
            status: "VARIANT_REQUIRED",
            productId: candidate.productId,
            name: candidate.name,
            image: candidate.image,
            requestedQuantity: ambItem.requestedItem?.quantity || 1,
            availableVariants: candidate.variants
              .filter((v) => v.stock > 0)
              .map((v) => ({
                name: v.name,
                sku: v.sku || v.name,
                price: v.salePrice > 0 ? v.salePrice : v.price,
                stock: v.stock,
              })),
            sellerId: candidate.sellerId,
            message: `Please choose a variant/size for "${candidate.name}".`,
          };
        } else {
          slr.ambiguousItems = slr.ambiguousItems.filter(
            (_, idx) => idx !== ambiguousItemIdx
          );
          const newMatched = {
            productId: candidate.productId,
            name: candidate.name,
            price: candidate.price,
            image: candidate.image,
            variantSku: "",
            quantity: ambItem.requestedItem?.quantity || 1,
            sellerId: candidate.sellerId,
          };
          slr.matchedItems = [...(slr.matchedItems || []), newMatched];
          slr.batchPayload = [
            ...(slr.batchPayload || []),
            {
              productId: newMatched.productId,
              variantSku: "",
              quantity: newMatched.quantity,
              name: newMatched.name,
              price: newMatched.price,
              image: newMatched.image,
              sellerId: newMatched.sellerId,
            },
          ];
          slr.canBatchAdd = slr.batchPayload.length > 0;
        }

        return { ...msg, shoppingListResult: slr };
      })
    );
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-5 z-[999] flex flex-col items-end gap-2 select-none">
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
          className="relative group p-0.5 rounded-full bg-gradient-to-tr from-primary via-orange-400 to-amber-300 shadow-2xl hover:scale-108 hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center cursor-pointer"
          title="Seva AI Assistant"
        >
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full overflow-hidden border-2 border-white bg-slate-900 flex items-center justify-center shadow-inner">
            <img
              src="/ai-assistant-avatar.png"
              alt="Seva AI"
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
    <div
      className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 w-[94vw] sm:w-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-[999] transition-all"
      style={{ height: "600px", maxHeight: "82vh" }}
    >
      {/* Sleek Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/50 shrink-0 bg-slate-800">
            <img
              src="/ai-assistant-avatar.png"
              alt="Seva AI"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight text-white">
                Seva Assistant
              </h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Shopping list, products & orders
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Cart Counter Button */}
          {cartCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                stopSpeaking();
                navigate("/cart");
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 shadow-sm transition-all cursor-pointer"
              title="Open Cart"
            >
              <FiShoppingCart size={13} />
              <span className="text-[10px]">{cartCount}</span>
            </button>
          )}

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
                speakText("Voice talk mode on hai. Aap sawal pooch sakte hain.");
              } else {
                stopSpeaking();
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              voiceMode
                ? "bg-primary text-white shadow-sm ring-1 ring-white/30"
                : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
            }`}
            title={
              voiceMode
                ? "Voice Talk ON (AI will speak replies)"
                : "Turn ON Voice Talk"
            }
          >
            {voiceMode ? (
              <FiVolume2 size={13} className="animate-pulse" />
            ) : (
              <FiVolumeX size={13} />
            )}
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

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages
          .filter(
            (m) =>
              (m.parts && m.parts[0] && m.parts[0].text) ||
              m.isStreaming ||
              m.shoppingListResult
          )
          .map((msg, idx) => {
            const rawText = msg.parts?.[0]?.text || "";
            const text = msg.role === "model" ? formatAiText(rawText) : rawText;
            const slr = msg.shoppingListResult;

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-primary text-white font-medium rounded-tr-xs"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none text-slate-800 space-y-2">
                      <ReactMarkdown
                        components={{
                          p: ({ node, ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong
                              className="font-bold text-slate-900"
                              {...props}
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul
                              className="list-disc pl-4 space-y-1 my-2"
                              {...props}
                            />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol
                              className="list-decimal pl-4 space-y-1 my-2"
                              {...props}
                            />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="text-[13px]" {...props} />
                          ),
                        }}
                      >
                        {text}
                      </ReactMarkdown>

                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle rounded-xs" />
                      )}

                      {!msg.isStreaming && text && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => speakText(text)}
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

                {/* Rich Shopping List UI Card */}
                {slr && (
                  <div className="mt-2.5 w-full max-w-[96%] bg-white rounded-xl p-3 border border-slate-200 shadow-sm space-y-3">
                    {/* Confirmed Matched Items */}
                    {slr.matchedItems && slr.matchedItems.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-1.5">
                          <FiCheckCircle size={14} className="text-emerald-500" />
                          <span>Matched in Catalog ({slr.matchedItems.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {slr.matchedItems.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-100"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                    Item
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Qty: {item.quantity} × ₹{item.price}
                                  </p>
                                </div>
                              </div>
                              <span className="font-bold text-primary shrink-0 pl-2">
                                ₹{(item.price || 0) * (item.quantity || 1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ambiguous Items: Variant Required or Multiple Matches */}
                    {slr.ambiguousItems && slr.ambiguousItems.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                          <FiAlertCircle size={14} className="text-amber-500" />
                          <span>Needs Your Input</span>
                        </div>

                        {slr.ambiguousItems.map((amb, ambIdx) => (
                          <div
                            key={ambIdx}
                            className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/80 text-xs space-y-2"
                          >
                            <p className="font-semibold text-slate-900">
                              {amb.name || amb.requestedItem?.searchTerm}
                            </p>

                            {/* Variant Selector Pills */}
                            {amb.status === "VARIANT_REQUIRED" &&
                              amb.availableVariants && (
                                <div>
                                  <p className="text-[11px] text-slate-600 mb-1.5">
                                    Select size / variant:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {amb.availableVariants.map((v, vIdx) => (
                                      <button
                                        key={vIdx}
                                        type="button"
                                        onClick={() =>
                                          handleSelectVariantForList(
                                            msg.id,
                                            ambIdx,
                                            v
                                          )
                                        }
                                        className="px-2.5 py-1 bg-white hover:bg-primary hover:text-white text-slate-700 font-semibold text-[11px] rounded-md border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                                      >
                                        {v.name} (₹{v.price})
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Multiple Product Candidates */}
                            {amb.status === "MULTIPLE_MATCHES" &&
                              amb.candidates && (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] text-slate-600">
                                    Which item did you mean?
                                  </p>
                                  {amb.candidates.map((cand, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="flex items-center justify-between p-1.5 bg-white rounded border border-amber-200"
                                    >
                                      <span className="truncate flex-1 font-medium text-slate-800">
                                        {cand.name} — ₹{cand.price}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSelectCandidateProduct(
                                            msg.id,
                                            ambIdx,
                                            cand
                                          )
                                        }
                                        className="ml-2 px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded hover:bg-primary/90 shrink-0 cursor-pointer"
                                      >
                                        Select
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unavailable / Out of Stock Items */}
                    {slr.unavailableItems && slr.unavailableItems.length > 0 && (
                      <div className="pt-1 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">
                          Not available in store right now:
                        </p>
                        <div className="space-y-1">
                          {slr.unavailableItems.map((unav, uIdx) => (
                            <div
                              key={uIdx}
                              className="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded flex items-center justify-between"
                            >
                              <span>
                                {unav.requestedItem?.searchTerm ||
                                  unav.product?.name ||
                                  "Item"}
                              </span>
                              <span className="text-[10px] text-rose-500 font-semibold">
                                {unav.status === "OUT_OF_STOCK"
                                  ? "Out of stock"
                                  : "Unavailable"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons: Batch Add to Cart */}
                    {slr.batchPayload && slr.batchPayload.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        {msg.isBatchAdded ? (
                          <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200">
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <FiCheck size={16} className="text-emerald-600" />
                              <span>Added to Cart!</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                stopSpeaking();
                                navigate("/cart");
                              }}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              Go to Cart <FiArrowRight size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleConfirmBatchAdd(msg.id, slr.batchPayload)
                            }
                            disabled={isLoading}
                            className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <FiShoppingCart size={15} />
                            Add Confirmed ({slr.batchPayload.length} Items) to Cart
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Display regular clickable product cards if returned */}
                {!slr && msg.products && msg.products.length > 0 && (
                  <div className="mt-2.5 w-full max-w-[92%] grid grid-cols-1 gap-2">
                    {msg.products.map((p) => {
                      const prodId = p.id || p._id;
                      return (
                        <div
                          key={prodId}
                          onClick={() => {
                            if (prodId) {
                              setIsOpen(false);
                              stopSpeaking();
                              navigate(`/product/${prodId}`);
                            }
                          }}
                          className="cursor-pointer bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/90 flex gap-3 items-center hover:border-primary hover:shadow-md hover:scale-[1.01] transition-all group"
                        >
                          {p.thumbnail ? (
                            <img
                              src={p.thumbnail}
                              alt={p.name}
                              className="w-12 h-12 object-cover rounded-lg bg-slate-50 shrink-0 border border-slate-100"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                              Item
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-bold text-primary">
                                ₹{p.price ?? 0}
                              </span>
                              {p.mrp && Number(p.mrp) > Number(p.price) && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  ₹{p.mrp}
                                </span>
                              )}
                              {p.rating && typeof p.rating === "number" && (
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
            );
          })}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white text-slate-800 shadow-xs border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-2.5 flex gap-2.5 items-center">
              <Sparkles className="animate-spin text-primary" size={16} />
              <span className="text-xs font-medium text-slate-500">
                Analyzing request & catalog...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Speech Banners */}
      {isSpeaking && (
        <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-t border-b border-primary/20 px-3.5 py-2 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5 text-primary font-semibold text-xs">
            <div className="flex items-end gap-1 h-3.5 pb-0.5">
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2"></span>
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.8s_ease-in-out_infinite_150ms] h-3.5"></span>
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.5s_ease-in-out_infinite_300ms] h-2.5"></span>
              <span className="w-1 bg-primary rounded-full animate-[pulse_0.7s_ease-in-out_infinite_75ms] h-3"></span>
            </div>
            <span className="text-slate-700">Seva AI bol raha hai...</span>
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

      {isListening && (
        <div className="bg-rose-50 border-t border-b border-rose-200 px-3.5 py-2 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
            <Radio size={15} className="animate-spin text-rose-500" />
            <span>Sun raha hoon... Boliye (Speak now)</span>
          </div>
          <button
            type="button"
            onClick={() => {
              recognitionRef.current?.stop();
              setIsListening(false);
            }}
            className="text-xs font-bold text-rose-700 bg-rose-200/80 hover:bg-rose-300 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5"
      >
        {/* Photo Upload for Lists / Receipts / Products */}
        <label
          className="cursor-pointer p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors shrink-0 flex items-center gap-1"
          title="Upload Shopping List / Photo"
        >
          <FiCamera size={18} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>

        {/* Voice Input (Microphone) */}
        <button
          type="button"
          onClick={startVoiceInput}
          className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center cursor-pointer ${
            isListening
              ? "bg-rose-500 text-white shadow-md scale-105 animate-pulse"
              : "bg-slate-100 text-slate-600 hover:text-primary hover:bg-primary/10"
          }`}
          title={isListening ? "Listening... Click to stop" : "Click to Speak"}
        >
          {isListening ? <FiMic size={17} className="animate-pulse text-white" /> : <FiMicOff size={17} />}
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (isSpeaking) stopSpeaking();
          }}
          placeholder={
            isListening
              ? "Listening to your voice..."
              : "e.g. 2 Nike shoes size 8, 1 Puma shirt M..."
          }
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
            disabled={!input.trim()}
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
