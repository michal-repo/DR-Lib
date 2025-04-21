// src/components/ImageModal.tsx
"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/apiClient';

interface ImageModalProps {
  currentImageUrl: string | null;
  currentImageThumbnailUrl: string | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isLoggedIn: boolean | null;
  onFavoriteStatusChange?: (imageUrl: string, isNowFavorite: boolean) => void; // <-- ADD THIS PROP
}

const ImageModal: React.FC<ImageModalProps> = ({
  currentImageUrl,
  currentImageThumbnailUrl,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  isLoggedIn,
  onFavoriteStatusChange, // <-- Destructure the prop
}) => {
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // --- Effect to Check Initial Favorite Status ---
  useEffect(() => {
    // Reset status when image changes or user logs out/in
    setIsFavorite(null);

    // Only check if logged in and an image URL is present
    if (isLoggedIn === true && currentImageUrl) {
      const checkFavoriteStatus = async () => {
        setIsFavorite(null); // Indicate checking state
        try {
          const result = await apiClient<{ data: { isFavorite: boolean } }>(
            `/favorites/check?file=${encodeURIComponent(currentImageUrl)}`,
            { method: 'GET' },
            true // Authenticate this request
          );
          setIsFavorite(result.data.isFavorite);
        } catch (error: any) {
          // Don't show error toast for check failure, just assume not favorite
          console.error("Failed to check favorite status:", error);
          setIsFavorite(false); // Assume not favorite on error
          // Handle 401 specifically? Maybe log out user? For now, just set false.
        }
      };
      checkFavoriteStatus();
    } else {
        // If not logged in or no image, definitely not a favorite in this context
        setIsFavorite(false);
    }
  }, [currentImageUrl, isLoggedIn]); // Re-run when image or login status changes

  // --- Handler to Toggle Favorite Status ---
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isLoggedIn || !currentImageUrl || !currentImageThumbnailUrl || isFavorite === null || isTogglingFavorite) {
      return;
    }

    setIsTogglingFavorite(true);
    const currentlyIsFavorite = isFavorite;
    const method = currentlyIsFavorite ? 'DELETE' : 'POST';
    const fav_payload = currentlyIsFavorite ?  { file: currentImageUrl } : { file: currentImageUrl, thumbnail: currentImageThumbnailUrl };

    try {
      await apiClient(
        '/favorites',
        { method: method, body: JSON.stringify(fav_payload) },
        true
      );

      // Success: Update state, show toast, and call callback
      const isNowFavorite = !currentlyIsFavorite; // Calculate the new state
      setIsFavorite(isNowFavorite);
      toast({ title: currentlyIsFavorite ? "Removed from Favorites" : "Added to Favorites" });
      onFavoriteStatusChange?.(currentImageUrl, isNowFavorite); // <-- CALL CALLBACK

    } catch (error: any) {
      // Error handling remains the same
      console.error("Failed to toggle favorite:", error);
      let errorMessage = currentlyIsFavorite ? "Could not remove favorite." : "Could not add favorite.";
      toast({ variant: "destructive", title: "Error", description: errorMessage });
      // Correct local state based on specific errors (404, 409)
      if (error?.status === 404 && currentlyIsFavorite) setIsFavorite(false);
      else if (error?.status === 409 && !currentlyIsFavorite) setIsFavorite(true);

    } finally {
      setIsTogglingFavorite(false);
    }
  };


  // --- Existing Effects (Escape, Arrows, Background Scroll) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && hasPrevious) onPrevious();
      else if (event.key === 'ArrowRight' && hasNext) onNext();
    };
    if (currentImageUrl) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentImageUrl, onClose, onPrevious, onNext, hasPrevious, hasNext]);

  useEffect(() => {
      if (currentImageUrl) {
          const originalStyle = window.getComputedStyle(document.body).overflow;
          document.body.style.overflow = 'hidden';
          return () => { document.body.style.overflow = originalStyle; };
      }
  }, [currentImageUrl]);

  if (!currentImageUrl) return null;

  // --- Modal JSX (remains the same, including the favorite button) ---
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image View"
    >
      {/* Modal Content Box */}
      <div
        className="relative flex items-center justify-center bg-white p-2 rounded-lg shadow-xl w-[95vw] h-[95vh] max-w-6xl max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- Buttons Container (Top Right) --- */}
        <div className="absolute top-2 right-2 z-30 flex items-center space-x-2">
          {/* Favorite Button (Conditional) */}
          {isLoggedIn === true && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              disabled={isTogglingFavorite || isFavorite === null}
              className={`p-1 rounded-full text-white ${ // Keep text white
                isFavorite === null ? 'bg-gray-500' : // Loading/Checking state: Gray background
                isFavorite ? 'bg-red-500 hover:bg-red-600' : // Is favorite state: Red background
                'bg-gray-700 hover:bg-gray-600' // Not favorite state: Opaque dark gray background
              } focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50`}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} // Fill heart if favorite
              />
            </Button>
          )}

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="p-1 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close image view"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Previous Button */}
        {hasPrevious && (
          <button
            onClick={onPrevious}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black bg-opacity-30 text-white rounded-full hover:bg-opacity-60 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            aria-label="Previous image"
            disabled={!hasPrevious} // Double check disabled state
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
)}
        {/* Next Button */}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black bg-opacity-30 text-white rounded-full hover:bg-opacity-60 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            aria-label="Next image"
            disabled={!hasNext} // Double check disabled state
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}


        {/* Image Container */}
        <div className="relative w-full h-full flex items-center justify-center">
           <Image
            key={currentImageUrl}
            src={currentImageUrl}
            alt="Enlarged view"
            fill
            style={{ objectFit: 'contain' }}
            sizes="(max-width: 1280px) 90vw, 800px"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default ImageModal;

