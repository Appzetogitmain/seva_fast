import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Upload, CheckCircle, Video, Image as ImageIcon, Loader2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import { customerApi } from "../../services/customerApi";
import { toast } from "sonner";

const WriteReviewSheet = ({ isOpen, onClose, product, orderId }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  if (!isOpen) return null;

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (imageFiles.length + files.length > 3) {
      toast.error("You can upload a maximum of 3 images.");
      return;
    }

    const newImageFiles = [];
    const newImagePreviews = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 10MB allowed.`);
        continue;
      }
      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        newImageFiles.push(compressedFile);
        newImagePreviews.push(URL.createObjectURL(compressedFile));
      } catch (error) {
        console.error("Error compressing image", error);
        toast.error(`Could not compress ${file.name}`);
      }
    }

    setImageFiles(prev => [...prev, ...newImageFiles]);
    setImagePreviews(prev => [...prev, ...newImagePreviews]);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("Video is too large. Max 5MB allowed.");
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating.");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write a comment.");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedImages = [];
      for (const img of imageFiles) {
        const formData = new FormData();
        formData.append("file", img);
        const res = await customerApi.uploadMedia(formData);
        uploadedImages.push(res.data?.result?.url || res.data?.url || res.data?.result?.secureUrl);
      }

      let uploadedVideo = null;
      if (videoFile) {
        const formData = new FormData();
        formData.append("file", videoFile);
        const res = await customerApi.uploadMedia(formData);
        uploadedVideo = res.data?.result?.url || res.data?.url || res.data?.result?.secureUrl;
      }

      const reviewPayload = {
        productId: product.product?._id || product.product || product.productId || product._id,
        orderId,
        rating,
        comment,
        images: uploadedImages,
        video: uploadedVideo
      };

      const res = await customerApi.submitReview(reviewPayload);
      const submittedReview = res.data?.result || reviewPayload;

      toast.success("Review submitted! Waiting for approval.");
      onClose(submittedReview); // pass review back so parent can update reviewedMap
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl"
      >
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900">Write a Review</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6 flex-1 custom-scrollbar">
          
          {/* Product Info */}
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
            <div className="w-16 h-16 bg-white rounded-xl flex-shrink-0 shadow-sm border border-gray-100 p-1">
              <img src={product.image || product.mainImage} alt={product.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm line-clamp-2">{product.name}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">How was your experience?</p>
            </div>
          </div>

          {/* Rating */}
          <div className="flex flex-col items-center py-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star 
                    size={40} 
                    className={`${(hoveredRating || rating) >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} transition-colors`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-bold text-gray-500 mt-3 h-5">
              {rating === 1 && "Terrible 😠"}
              {rating === 2 && "Bad 😞"}
              {rating === 3 && "Okay 😐"}
              {rating === 4 && "Good 🙂"}
              {rating === 5 && "Excellent! 😍"}
            </p>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Your Review</label>
            <textarea 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike about this product?"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none h-32 transition-all"
            />
          </div>

          {/* Media Upload */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Add Photos/Video</label>
            
            <div className="flex flex-wrap gap-3">
              {/* Upload Buttons */}
              {imageFiles.length < 3 && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-gray-50 hover:border-primary/50 transition-all text-gray-500"
                >
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-bold">Photo</span>
                </button>
              )}
              
              {!videoFile && (
                <button 
                  onClick={() => videoInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-gray-50 hover:border-primary/50 transition-all text-gray-500"
                >
                  <Video size={24} />
                  <span className="text-[10px] font-bold">Video</span>
                </button>
              )}

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                multiple 
                className="hidden" 
              />
              <input 
                type="file" 
                ref={videoInputRef} 
                onChange={handleVideoUpload} 
                accept="video/*" 
                className="hidden" 
              />

              {/* Previews */}
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                  <img src={preview} alt="upload" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full backdrop-blur-md hover:bg-red-500 transition-colors"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}

              {videoPreview && (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-black">
                  <video src={videoPreview} className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Video size={20} className="text-white drop-shadow-md" />
                  </div>
                  <button 
                    onClick={removeVideo}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full backdrop-blur-md hover:bg-red-500 transition-colors"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[10px] font-semibold text-gray-400 ml-1">Max 3 photos and 1 video. Videos max 5MB.</p>
          </div>
        </div>

        <div className="flex-shrink-0 p-5 pb-28 bg-white border-t border-gray-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-brand-200 hover:bg-[var(--brand-400)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="animate-spin" /> Submitting...</>
            ) : (
              "Submit Review"
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default WriteReviewSheet;
