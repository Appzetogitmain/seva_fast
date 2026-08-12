import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Volume2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const VoiceSearchModal = ({ isOpen, onClose, onSearchResult }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');
    const [error, setError] = useState(null);
    const [lang, setLang] = useState('en-IN'); // Default to Indian English / Hinglish
    const [isSupported, setIsSupported] = useState(true);

    const recognitionRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            stopListening();
            setTranscript('');
            setInterimText('');
            setError(null);
        } else if (isSupported) {
            startListening();
        }
    }, [isOpen, lang]);

    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        stopListening(); // Stop any existing instance
        setError(null);
        setTranscript('');
        setInterimText('');

        try {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = lang;
            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event) => {
                let currentInterim = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript;
                    } else {
                        currentInterim += result[0].transcript;
                    }
                }

                if (currentInterim) {
                    setInterimText(currentInterim);
                }

                if (finalTranscript) {
                    const clean = finalTranscript.trim().replace(/[.,!?;]+$/, '');
                    setTranscript(clean);
                    setInterimText('');
                    setIsListening(false);
                    // Automatically trigger search on final speech result after brief delay
                    setTimeout(() => {
                        onSearchResult(clean);
                        onClose();
                    }, 800);
                }
            };

            recognition.onerror = (event) => {
                console.warn('Voice recognition error:', event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    setError('Microphone permission denied. Please allow mic access in browser settings.');
                } else if (event.error === 'no-speech') {
                    setError('No speech detected. Please try speaking again.');
                } else {
                    setError('Voice recognition error. Please try again.');
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        } catch (err) {
            console.error('Speech recognition exception:', err);
            setIsListening(false);
            setError('Could not start microphone. Please try again.');
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            recognitionRef.current = null;
        }
        setIsListening(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                />

                {/* Modal Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl overflow-hidden z-10 border border-slate-100 flex flex-col items-center text-center font-outfit"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>

                    {/* Language Switcher Pills */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full mb-6 text-xs font-bold">
                        <button
                            onClick={() => setLang('en-IN')}
                            className={cn(
                                "px-3 py-1 rounded-full transition-all",
                                lang === 'en-IN' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500"
                            )}
                        >
                            English / Hinglish
                        </button>
                        <button
                            onClick={() => setLang('hi-IN')}
                            className={cn(
                                "px-3 py-1 rounded-full transition-all",
                                lang === 'hi-IN' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500"
                            )}
                        >
                            हिंदी (Hindi)
                        </button>
                    </div>

                    {!isSupported ? (
                        <div className="py-8 flex flex-col items-center">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-1">Voice Search Unsupported</h3>
                            <p className="text-xs text-slate-500 max-w-xs mb-4">
                                Your browser does not support Web Speech API. Please try using Google Chrome.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Animated Microphone Circle */}
                            <div className="relative my-4 flex items-center justify-center">
                                {/* Pulsing rings when listening */}
                                {isListening && (
                                    <>
                                        <motion.div
                                            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                                            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                                            className="absolute w-24 h-24 rounded-full bg-primary/20 pointer-events-none"
                                        />
                                        <motion.div
                                            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0.2, 0.8] }}
                                            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                                            className="absolute w-20 h-20 rounded-full bg-primary/30 pointer-events-none"
                                        />
                                    </>
                                )}

                                <button
                                    onClick={isListening ? stopListening : startListening}
                                    className={cn(
                                        "relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95",
                                        isListening
                                            ? "bg-linear-to-r from-red-500 to-rose-600 text-white shadow-rose-500/40"
                                            : "bg-linear-to-r from-primary to-[var(--brand-400)] text-white shadow-primary/40"
                                    )}
                                >
                                    {isListening ? (
                                        <Mic size={32} className="animate-pulse" />
                                    ) : (
                                        <MicOff size={32} />
                                    )}
                                </button>
                            </div>

                            {/* Status Text & Transcript Display */}
                            <div className="mt-4 min-h-[60px] flex flex-col items-center justify-center">
                                {isListening && (
                                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary mb-1 animate-pulse">
                                        <Volume2 size={14} /> Listening... Speak product name
                                    </div>
                                )}

                                {error && (
                                    <div className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg mb-2 flex items-center gap-1">
                                        <AlertCircle size={14} /> {error}
                                    </div>
                                )}

                                <div className="text-base font-extrabold text-slate-800 min-h-[28px]">
                                    {transcript || interimText ? (
                                        <span className="text-primary italic">"{transcript || interimText}"</span>
                                    ) : !error ? (
                                        <span className="text-slate-400 font-medium text-sm">
                                            Try saying <span className="font-bold text-slate-600">"Mango"</span>, <span className="font-bold text-slate-600">"Doodh"</span>, or <span className="font-bold text-slate-600">"Fresh Milk"</span>
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 flex items-center gap-2 w-full">
                                {error || !isListening ? (
                                    <button
                                        onClick={startListening}
                                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <RefreshCw size={14} /> Tap to Speak Again
                                    </button>
                                ) : null}

                                {transcript && (
                                    <button
                                        onClick={() => {
                                            onSearchResult(transcript);
                                            onClose();
                                        }}
                                        className="flex-1 py-3 px-4 bg-primary text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                                    >
                                        <Sparkles size={14} /> Search "{transcript}"
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default VoiceSearchModal;
