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
  onFavoriteStatusChange?: (imageUrl: string, isNowFavorite: boolean) => void;
  currentReferenceFileId?: number; // The ID of the reference file
  initialIsFavorite?: boolean; // New prop for initial favorite state
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
  currentReferenceFileId,
  initialIsFavorite, // Destructure new prop
}) => {
  const { toast } = useToast();
  // Initialize with initialIsFavorite if provided, otherwise null to trigger fetch/check
  const [isFavorite, setIsFavorite] = useState<boolean | null>(
    initialIsFavorite !== undefined ? initialIsFavorite : null
  );
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // --- Effect to Check Initial Favorite Status ---
  useEffect(() => {
    // If initialIsFavorite is provided, use it and don't fetch.
    if (initialIsFavorite !== undefined) {
      setIsFavorite(initialIsFavorite);
    } 
    // Else, if logged in and have an ID, fetch the status (fallback or for other usages of modal)
    else if (isLoggedIn === true && currentReferenceFileId) {
      const checkFavoriteStatus = async () => {
        setIsFavorite(null); // Set to null to indicate loading/checking state
        try {
          const result = await apiClient<{ data: { isFavorite: boolean, reference_file_id: number } }>(
            `/favorites/check?reference_file_id=${currentReferenceFileId}`,
            { method: 'GET' },
            true 
          );
          setIsFavorite(result.data.isFavorite);
        } catch (error: any) {
          console.error("Failed to check favorite status:", error);
          setIsFavorite(false); // Assume not favorite on error
        }
      };
      checkFavoriteStatus();
    } else {
        // If not logged in, or no ID, or initialIsFavorite not provided and not fetching, set to false.
        setIsFavorite(false);
    }
  }, [currentReferenceFileId, isLoggedIn, initialIsFavorite]); // Re-run if these change

  // --- Handler to Toggle Favorite Status ---
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isLoggedIn || !currentImageUrl || !currentReferenceFileId || isFavorite === null || isTogglingFavorite) {
      // currentImageThumbnailUrl is not strictly needed for the new API for add/remove,
      // but currentImageUrl is used for the onFavoriteStatusChange callback.
      return;
    }

    setIsTogglingFavorite(true);
    const currentlyIsFavorite = isFavorite;
    const method = currentlyIsFavorite ? 'DELETE' : 'POST';
    // API now expects reference_file_id in the body for POST/DELETE
    const fav_payload = { reference_file_id: currentReferenceFileId };

    try {
      // Response type for POST is FavoriteAddResponse, for DELETE is FavoriteRemoveResponse
      // We don't strictly need to type the response here if we're not using its specific data fields
      await apiClient<any>(
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
      // Error handling
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
            className="p-1 text-white rounded-full bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white"
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
