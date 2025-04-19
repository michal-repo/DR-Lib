// src/components/ImageModal.tsx
"use client";

import Image from 'next/image';
import { useEffect } from 'react';

interface ImageModalProps {
  // imageUrl: string | null; // Replaced by currentImageUrl
  currentImageUrl: string | null; // The URL of the image currently shown
  onClose: () => void;
  onPrevious: () => void; // Function to call when Previous is clicked
  onNext: () => void;     // Function to call when Next is clicked
  hasPrevious: boolean;  // True if there's a previous image
  hasNext: boolean;      // True if there's a next image
}

const ImageModal: React.FC<ImageModalProps> = ({
  currentImageUrl,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext
}) => {
  // Hook 1: useEffect for Escape key press and Arrow keys
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && hasPrevious) {
        onPrevious();
      } else if (event.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };
    if (currentImageUrl) { // Only add listener when modal is open
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // Add navigation functions and flags to dependencies
  }, [currentImageUrl, onClose, onPrevious, onNext, hasPrevious, hasNext]);

  // Hook 2: useEffect for preventing background scroll
  useEffect(() => {
      if (currentImageUrl) {
          const originalStyle = window.getComputedStyle(document.body).overflow;
          document.body.style.overflow = 'hidden';
          return () => {
              document.body.style.overflow = originalStyle;
          };
      }
  }, [currentImageUrl]);

  if (!currentImageUrl) {
    return null;
  }

  // --- Modal JSX ---
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
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-30 p-1 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Close image view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

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
        <div className="relative w-full h-full flex items-center justify-center"> {/* Added flex centering for the image itself */}
           <Image
            key={currentImageUrl} // Add key to force re-render on src change if needed
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
