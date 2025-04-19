// src/app/catalog/[catalogName]/page.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePagination, DOTS } from '@/hooks/usePagination';
import ImageModal from '@/components/ImageModal';

interface ImageItem { name: string; src: string; }
interface ImageCatalog { name: string; list: ImageItem[]; }
interface ImageData { images: ImageCatalog[]; }

const IMAGES_PER_PAGE = 18;
const IMAGE_PAGINATION_SIBLING_COUNT = 2;

const CatalogDetailPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const encodedCatalogName = params.catalogName as string;
  const catalogName = decodeURIComponent(encodedCatalogName || '');

  const [catalog, setCatalog] = useState<ImageCatalog | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImagePage, setCurrentImagePage] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // --- Read 'fromPage' and 'q' and construct backHref ---
  const fromPageParam = searchParams.get('fromPage');
  const searchParamQ = searchParams.get('q'); // Get the search term

  const backHref = useMemo(() => {
    const queryParams = new URLSearchParams();
    const pageNum = Number(fromPageParam);

    // Add 'page' if valid
    if (fromPageParam && !isNaN(pageNum) && pageNum > 0) {
      queryParams.set('page', fromPageParam);
    }
    // Add 'q' if it exists
    if (searchParamQ) {
      queryParams.set('q', searchParamQ); // URLSearchParams handles encoding
    }

    const queryString = queryParams.toString();
    return `/main${queryString ? `?${queryString}` : ''}`; // Construct final href

  }, [fromPageParam, searchParamQ]); // Add searchParamQ dependency
// --- Fetch Data Effect ---
useEffect(() => {
  // --- Get URL from environment variable ---
  const imageUrl = process.env.NEXT_PUBLIC_IMAGE_DATA_URL;

  if (!imageUrl) {
      console.error("Configuration Error: NEXT_PUBLIC_IMAGE_DATA_URL is not defined.");
      setError("Application is not configured correctly (missing image data URL).");
      setLoading(false);
      return; // Stop execution if URL is missing
  }
  // --- End Get URL ---

  if (!catalogName) {
      setError("Catalog name not found in URL.");
      setLoading(false);
      setCatalog(null);
      return;
  };

  const fetchCatalogData = async () => {
    setLoading(true);
    setError(null);
    setCatalog(undefined);
    setCurrentImagePage(1);
    setSelectedImageIndex(null);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ImageData = await response.json();
      const foundCatalog = data.images.find(c => c.name === catalogName);

      if (foundCatalog) {
        foundCatalog.list = foundCatalog.list.filter(item => item.src && item.name);
        setCatalog(foundCatalog);
      } else {
        setCatalog(null);
        setError(`Catalog "${catalogName}" not found.`);
      }
    } catch (e: any) {
      setError(e.message);
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  };

  fetchCatalogData();
}, [catalogName]);

// --- Image List ---
const fullImageList = useMemo(() => catalog?.list || [], [catalog]);

// --- Image Pagination Logic ---
const totalImages = fullImageList.length;
const totalImagePages = Math.ceil(totalImages / IMAGES_PER_PAGE);

const imagePaginationRange = usePagination({
  currentPage: currentImagePage,
  totalCount: totalImages,
  siblingCount: IMAGE_PAGINATION_SIBLING_COUNT,
  pageSize: IMAGES_PER_PAGE,
});

const imageStartIndex = (currentImagePage - 1) * IMAGES_PER_PAGE;
const imageEndIndex = imageStartIndex + IMAGES_PER_PAGE;
const currentGridImages = fullImageList.slice(imageStartIndex, imageEndIndex);

// --- Effect to Sync Grid Page with Modal Navigation ---
useEffect(() => {
  // ... (sync logic - no changes) ...
   if (selectedImageIndex !== null && totalImages > 0) {
    const pageForSelectedIndex = Math.floor(selectedImageIndex / IMAGES_PER_PAGE) + 1;
    if (pageForSelectedIndex !== currentImagePage) {
      const validPage = Math.max(1, Math.min(pageForSelectedIndex, totalImagePages));
      setCurrentImagePage(validPage);
    }
  }
}, [selectedImageIndex, currentImagePage, IMAGES_PER_PAGE, totalImagePages, totalImages]);


// --- Event Handlers ---
// Wrap handlers potentially used in effects with useCallback
const handlePreviousImagePage = useCallback(() => {
  setCurrentImagePage((prev) => Math.max(prev - 1, 1));
}, []); // No dependencies needed as it only uses the setter

const handleNextImagePage = useCallback(() => {
  // Need totalImagePages, so add it as dependency
  setCurrentImagePage((prev) => Math.min(prev + 1, totalImagePages));
}, [totalImagePages]);

const handleImagePageChange = useCallback((pageNumber: number | string) => {
  if (typeof pageNumber === 'number') {
     setCurrentImagePage(pageNumber);
  }
  else if (pageNumber === DOTS) {
     const currentIndex = imagePaginationRange.findIndex(p => p === DOTS);
     let prevNumeric = 1;
     let nextNumeric = totalImagePages;
     for(let i = currentIndex - 1; i >= 0; i--) { if(typeof imagePaginationRange[i] === 'number') { prevNumeric = imagePaginationRange[i] as number; break; } }
     for(let i = currentIndex + 1; i < imagePaginationRange.length; i++) { if(typeof imagePaginationRange[i] === 'number') { nextNumeric = imagePaginationRange[i] as number; break; } }
     const targetPage = nextNumeric < totalImagePages ? prevNumeric + 1 : prevNumeric + 1;
     if (targetPage > 0 && targetPage <= totalImagePages) {
         setCurrentImagePage(targetPage);
     }
  }
}, [imagePaginationRange, totalImagePages]); // Add dependencies

// --- Modal Event Handlers ---
const handleImageClick = (imageIndexInFullList: number) => {
  setSelectedImageIndex(imageIndexInFullList);
};
const handleCloseModal = () => {
  setSelectedImageIndex(null);
};
const handleModalPrevious = () => {
  setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex === 0 ? prevIndex : prevIndex - 1));
};
const handleModalNext = () => {
   setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex >= fullImageList.length - 1 ? prevIndex : prevIndex + 1));
};
// --- End Event Handlers ---

// --- Effect for Grid Arrow Key Navigation ---
useEffect(() => {
  const handleGridKeyDown = (event: KeyboardEvent) => {
    // --- IMPORTANT: Check if Modal is Hidden ---
    if (selectedImageIndex !== null) {
      return; // Do nothing if modal is open
    }

    // --- Handle Arrow Keys for Grid Pagination ---
    if (event.key === 'ArrowLeft') {
      // Check if not on the first page before calling handler
      if (currentImagePage > 1) {
         handlePreviousImagePage();
      }
    } else if (event.key === 'ArrowRight') {
      // Check if not on the last page before calling handler
      if (currentImagePage < totalImagePages) {
         handleNextImagePage();
      }
    }
  };

  // Add listener
  document.addEventListener('keydown', handleGridKeyDown);

  // Remove listener on cleanup
  return () => {
    document.removeEventListener('keydown', handleGridKeyDown);
  };

  // Dependencies: Re-create handler if these change
}, [
    selectedImageIndex, // To check modal visibility
    currentImagePage,   // To check if already on first/last page
    totalImagePages,    // To check if already on last page
    handlePreviousImagePage, // Stable handler from useCallback
    handleNextImagePage      // Stable handler from useCallback
]);


// --- Calculate Props for Modal ---
const currentImageUrlForModal = selectedImageIndex !== null ? fullImageList[selectedImageIndex]?.src : null;
const hasPreviousImage = selectedImageIndex !== null && selectedImageIndex > 0;
const hasNextImage = selectedImageIndex !== null && selectedImageIndex < fullImageList.length - 1;

// --- Render Logic ---
if (loading) {
  return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Catalog...</main>;
}

if (error || catalog === null) {
  return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
           <Link href="/main" className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
           <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
           <p>{error || `Catalog "${catalogName}" could not be loaded or found.`}</p>
      </main>
  );
}

if (catalog === undefined) {
    // Should ideally be covered by loading state, but as a fallback
     return <main className="flex min-h-screen flex-col items-center justify-center p-24">Initializing...</main>;
}

 if (totalImages === 0) {
  return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
           <Link href="/main" className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
           <h1 className="text-3xl font-bold mb-8">{catalog.name}</h1>
           <p>This catalog contains no images.</p>
      </main>
  );
}
  return (
    <>
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        {/* Back link uses updated backHref */}
         <div className="w-full max-w-7xl mb-6">
            <Link href={backHref} className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Catalogs
            </Link>
        </div>
        <h1 className="text-4xl font-bold mb-8">{catalog.name}</h1>

        {/* Image Grid */}
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full max-w-7xl mb-8">
          {currentGridImages.map((image, indexOnPage) => {
            const indexInFullList = imageStartIndex + indexOnPage;
            return (
              <button
                key={`${image.name}-${indexInFullList}`}
                onClick={() => handleImageClick(indexInFullList)}
                className="relative aspect-square border rounded-md overflow-hidden shadow-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 transition-shadow duration-150 group"
                aria-label={`View image ${image.name}`}
              >
                <Image
                  src={image.src}
                  alt={image.name}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 20vw, 15vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-150"
                  loading="lazy"
                />
                 <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {image.name}
                  </div>
              </button>
            );
          })}
        </div>

        {/* --- Image Pagination Controls (for grid) --- */}
        {totalImagePages > 1 && (
          <nav aria-label="Image page navigation">
            <ul className="flex items-center justify-center space-x-1 mt-8">
              {/* Previous Button */}
              <li>
                <button
                  onClick={handlePreviousImagePage}
                  disabled={currentImagePage === 1}
                  className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                    currentImagePage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                  }`}
                  aria-label="Previous Image Page"
                >
                  Prev
                </button>
              </li>

              {/* Page Number Buttons */}
              {imagePaginationRange.map((pageNumber, index) => {
                if (pageNumber === DOTS) {
                   // Determine target page for DOTS click
                    let prevNumeric = 1;
                    let nextNumeric = totalImagePages;
                     for(let i = index - 1; i >= 0; i--) { if(typeof imagePaginationRange[i] === 'number') { prevNumeric = imagePaginationRange[i] as number; break; } }
                     for(let i = index + 1; i < imagePaginationRange.length; i++) { if(typeof imagePaginationRange[i] === 'number') { nextNumeric = imagePaginationRange[i] as number; break; } }
                     const targetPage = nextNumeric < totalImagePages ? prevNumeric + 1 : prevNumeric + 1;

                     if (targetPage > 0 && targetPage <= totalImagePages) {
                        return (
                            <li key={`${DOTS}-img-${index}`}>
                                <button
                                    onClick={() => handleImagePageChange(targetPage)}
                                    className="px-3 py-2 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 rounded-md"
                                    aria-label={`Jump to image page ${targetPage}`}
                                >
                                    {DOTS}
                                </button>
                            </li>
                        );
                     } else {
                         return <li key={`${DOTS}-img-${index}`} className="px-3 py-2 leading-tight text-gray-400">{DOTS}</li>;
                     }
                }

                // Render page number button
                return (
                  <li key={`img-page-${pageNumber}`}>
                    <button
                      onClick={() => handleImagePageChange(pageNumber)}
                      disabled={currentImagePage === pageNumber}
                      className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                        currentImagePage === pageNumber
                          ? 'bg-blue-500 text-white border border-blue-500 cursor-default'
                          : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                      }`}
                      aria-current={currentImagePage === pageNumber ? 'page' : undefined}
                      aria-label={`Image Page ${pageNumber}`}
                    >
                      {pageNumber}
                    </button>
                  </li>
                );
              })}

              {/* Next Button */}
              <li>
                <button
                  onClick={handleNextImagePage}
                  disabled={currentImagePage === totalImagePages}
                  className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                    currentImagePage === totalImagePages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                  }`}
                  aria-label="Next Image Page"
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        )}
      </main>

      {/* --- Render Modal --- */}
       <ImageModal
        currentImageUrl={currentImageUrlForModal}
        onClose={handleCloseModal}
        onPrevious={handleModalPrevious}
        onNext={handleModalNext}
        hasPrevious={hasPreviousImage}
        hasNext={hasNextImage}
      />
    </>
  );
};

export default CatalogDetailPage;
