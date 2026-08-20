import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check, Crop } from 'lucide-react';

const ImageCropperModal = ({
    isOpen,
    imageSrc,
    aspectRatio = 16 / 10,
    title = "Crop & Adjust Image",
    onCropComplete,
    onClose
}) => {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isProcessing, setIsProcessing] = useState(false);
    const [safeImageSrc, setSafeImageSrc] = useState(null);

    const cropBoxRef = useRef(null);
    const imgRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        let createdBlobUrl = null;

        if (isOpen && imageSrc) {
            setZoom(1);
            setRotation(0);
            setOffset({ x: 0, y: 0 });
            setIsProcessing(false);

            if (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) {
                setSafeImageSrc(imageSrc);
            } else {
                // Fetch external image as blob to completely bypass canvas CORS tainting
                fetch(imageSrc, { mode: 'cors' })
                    .then((res) => {
                        if (!res.ok) throw new Error('Network response not ok');
                        return res.blob();
                    })
                    .then((blob) => {
                        if (isMounted) {
                            createdBlobUrl = URL.createObjectURL(blob);
                            setSafeImageSrc(createdBlobUrl);
                        }
                    })
                    .catch((err) => {
                        console.warn("Could not fetch image as blob, using fallback with crossOrigin", err);
                        if (isMounted) setSafeImageSrc(imageSrc);
                    });
            }
        }

        return () => {
            isMounted = false;
            if (createdBlobUrl) {
                URL.revokeObjectURL(createdBlobUrl);
            }
        };
    }, [isOpen, imageSrc]);

    if (!isOpen || !safeImageSrc) return null;

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
        setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
        setOffset({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleApplyCrop = async () => {
        if (!cropBoxRef.current || !imgRef.current) return;
        setIsProcessing(true);

        try {
            const cropBox = cropBoxRef.current.getBoundingClientRect();
            const img = imgRef.current;
            const imgRect = img.getBoundingClientRect();

            const canvas = document.createElement('canvas');
            const targetWidth = 640;
            const targetHeight = Math.round(targetWidth / aspectRatio);
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Calculate scale from rendered image to intrinsic dimensions
            const scaleX = img.naturalWidth / imgRect.width;
            const scaleY = img.naturalHeight / imgRect.height;

            // Crop box coordinates relative to the rendered image
            const sourceX = (cropBox.left - imgRect.left) * scaleX;
            const sourceY = (cropBox.top - imgRect.top) * scaleY;
            const sourceWidth = cropBox.width * scaleX;
            const sourceHeight = cropBox.height * scaleY;

            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                targetWidth,
                targetHeight
            );

            canvas.toBlob((blob) => {
                if (blob) {
                    const croppedFile = new File([blob], `cropped_service_${Date.now()}.jpg`, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    onCropComplete(croppedFile);
                }
                setIsProcessing(false);
            }, 'image/jpeg', 0.92);
        } catch (err) {
            console.error("Error cropping image:", err);
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[500] p-4 animate-in fade-in select-none">
            <div 
                className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
            >
                {/* Modal Header */}
                <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-50 rounded-xl text-orange-600">
                            <Crop className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                                {title}
                            </h3>
                            <p className="text-xs font-semibold text-slate-400">
                                Drag to reposition, zoom to fit inside the frame
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Cropper Workspace Area */}
                <div className="relative w-full h-[280px] sm:h-[320px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center cursor-move">
                    {/* The Visual Crop Window */}
                    <div
                        ref={cropBoxRef}
                        style={{ aspectRatio: `${aspectRatio}` }}
                        className="w-[85%] max-h-[85%] border-2 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-none relative z-20 flex flex-col justify-between overflow-hidden"
                    >
                        {/* Rule of thirds grid lines */}
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
                            <div className="border-r border-b border-white/30"></div>
                            <div className="border-r border-b border-white/30"></div>
                            <div className="border-b border-white/30"></div>
                            <div className="border-r border-b border-white/30"></div>
                            <div className="border-r border-b border-white/30"></div>
                            <div className="border-b border-white/30"></div>
                            <div className="border-r border-white/30"></div>
                            <div className="border-r border-white/30"></div>
                            <div></div>
                        </div>
                    </div>

                    {/* Draggable & Scalable Image */}
                    <img
                        ref={imgRef}
                        src={safeImageSrc}
                        alt="Crop target"
                        crossOrigin="anonymous"
                        draggable={false}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            maxHeight: 'none',
                            maxWidth: 'none'
                        }}
                        className="absolute cursor-grab active:cursor-grabbing pointer-events-auto max-w-none max-h-none object-contain select-none"
                    />
                </div>

                {/* Cropper Controls */}
                <div className="flex flex-col gap-3 pt-1">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                            className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.05"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full accent-orange-600 cursor-pointer"
                        />
                        <button
                            type="button"
                            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                            className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={handleApplyCrop}
                            className="flex-1 py-3 bg-black hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>{isProcessing ? "Processing..." : "Crop & Use Image"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropperModal;
