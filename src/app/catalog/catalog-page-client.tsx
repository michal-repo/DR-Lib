// src/app/catalog/catalog-page-client.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePagination, DOTS } from '@/hooks/usePagination';
import ImageModal from '@/components/ImageModal';
import { getToken, removeToken } from "@/lib/auth"; // <-- Import auth utils
import apiClient from '@/lib/apiClient'; // <-- Import apiClient
import { Heart } from 'lucide-react'; // <-- Import Heart icon

// Interfaces remain the same
interface ImageItem { name: string; src: string; thumbnail: string; }
interface ImageCatalog { name: string; list: ImageItem[]; }
interface ImageData { images: ImageCatalog[]; }
interface FavoriteItem { id: number; file: string; thumbnail: string; created_at: string; } // <-- Add FavoriteItem interface

const IMAGES_PER_PAGE = 18;
const IMAGE_PAGINATION_SIBLING_COUNT = 2;

const CatalogPageClient = () => {
  const searchParams = useSearchParams();
  const encodedCatalogNameFromQuery = searchParams.get('catalog');
  const catalogName = useMemo(() => {
      return encodedCatalogNameFromQuery ? decodeURIComponent(encodedCatalogNameFromQuery) : '';
  }, [encodedCatalogNameFromQuery]);

  const [catalog, setCatalog] = useState<ImageCatalog | null | undefined>(undefined);
  const [loading, setLoading] = useState(true); // Combined loading state for catalog and initial favorites
  const [error, setError] = useState<string | null>(null);
  const [currentImagePage, setCurrentImagePage] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // --- NEW: State to store favorite image URLs ---
  const [favoriteUrls, setFavoriteUrls] = useState<Set<string>>(new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false); // Separate loading for subsequent favorite fetches/updates

  // Back link calculation remains the same
  const fromPageParam = searchParams.get('fromPage');
  const searchParamQ = searchParams.get('q');
  const backHref = useMemo(() => {
    const queryParams = new URLSearchParams();
    const pageNum = Number(fromPageParam);
    if (fromPageParam && !isNaN(pageNum) && pageNum > 0) queryParams.set('page', fromPageParam);
    if (searchParamQ) queryParams.set('q', searchParamQ);
    const queryString = queryParams.toString();
    return `/main${queryString ? `?${queryString}` : ''}`;
  }, [fromPageParam, searchParamQ]);

  // --- Function to fetch favorites ---
  const fetchFavorites = useCallback(async () => {
      if (!isLoggedIn) {
          setFavoriteUrls(new Set()); // Clear favorites if not logged in
          return;
      }
      setFavoritesLoading(true);
      try {
          const result = await apiClient<{ data: FavoriteItem[] }>('/favorites', { method: 'GET' }, true);
          const urls = new Set(result.data?.map(fav => fav.file) || []);
          setFavoriteUrls(urls);
      } catch (favError: any) {
          console.error("Failed to fetch favorites:", favError);
          // Don't set main error, maybe just log or show a subtle indicator if needed
          setFavoriteUrls(new Set()); // Clear on error to be safe
      } finally {
          setFavoritesLoading(false);
      }
  }, [isLoggedIn]); // Depend on isLoggedIn status

  // --- Effect to Check Auth and Fetch Initial Favorites ---
  useEffect(() => {
    const checkAuthAndFetchInitial = async () => {
        const token = getToken();
        let loggedIn = false;
        if (token) {
            try {
                await apiClient('/check', { method: 'GET' }, true);
                loggedIn = true;
            } catch (error: any) {
                if (error?.status === 401) removeToken();
            }
        }
        setIsLoggedIn(loggedIn);

        // Fetch favorites *after* setting login status
        if (loggedIn) {
            await fetchFavorites(); // Fetch initial favorites
        } else {
            setFavoriteUrls(new Set()); // Ensure favorites are cleared if not logged in
        }
    };
    checkAuthAndFetchInitial();
  }, [fetchFavorites]); // Run on mount and when fetchFavorites function identity changes (due to isLoggedIn change)

  // --- Effect to Fetch Catalog Data ---
  useEffect(() => {
    const encodedCatalogNameFromQuery = searchParams.get('catalog');
    const catalogName = encodedCatalogNameFromQuery ? decodeURIComponent(encodedCatalogNameFromQuery) : '';
    const imageUrl = process.env.NEXT_PUBLIC_IMAGE_DATA_URL;

    if (!imageUrl) {
        console.error("Configuration Error: NEXT_PUBLIC_IMAGE_DATA_URL is not defined.");
        setError("Application is not configured correctly (missing image data URL).");
        setLoading(false);
        return;
    }

    if (!catalogName) {
        setError("Catalog parameter missing in URL.");
        setLoading(false);
        setCatalog(null);
        return;
    };

    const fetchCatalogData = async () => {
      setLoading(true); // Set main loading true for catalog fetch
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
          foundCatalog.list = foundCatalog.list.filter(item => item.src && item.name && item.thumbnail);
          setCatalog(foundCatalog);
        } else {
          setCatalog(null);
          setError(`Catalog "${catalogName}" not found.`);
        }
      } catch (e: any) {
        setError(e.message);
        setCatalog(null);
      } finally {
        setLoading(false); // Set main loading false after catalog fetch
      }
    };
    fetchCatalogData();
  }, [searchParams]); // Depend on searchParams to refetch catalog if name changes

  // Pagination calculations remain the same
  const fullImageList = useMemo(() => catalog?.list || [], [catalog]);
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

  // Effect to Sync Grid Page with Modal Navigation remains the same
  useEffect(() => {
     if (selectedImageIndex !== null && totalImages > 0) {
      const pageForSelectedIndex = Math.floor(selectedImageIndex / IMAGES_PER_PAGE) + 1;
      if (pageForSelectedIndex !== currentImagePage) {
        const validPage = Math.max(1, Math.min(pageForSelectedIndex, totalImagePages));
        setCurrentImagePage(validPage);
      }
    }
  }, [selectedImageIndex, currentImagePage, totalImagePages, totalImages]);

  // Event Handlers (Pagination, Modal) remain the same
  const handlePreviousImagePage = useCallback(() => {
    setCurrentImagePage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextImagePage = useCallback(() => {
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
  }, [imagePaginationRange, totalImagePages]);

  const handleImageClick = (imageIndexInFullList: number) => setSelectedImageIndex(imageIndexInFullList);
  const handleCloseModal = () => setSelectedImageIndex(null);
  const handleModalPrevious = () => {
    setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex === 0 ? prevIndex : prevIndex - 1));
  };
  const handleModalNext = () => {
     setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex >= fullImageList.length - 1 ? prevIndex : prevIndex + 1));
  };

  // --- NEW: Callback for Modal Favorite Status Change ---
  const handleFavoriteStatusChange = useCallback((imageUrl: string, isNowFavorite: boolean) => {
      setFavoriteUrls(prevUrls => {
          const newUrls = new Set(prevUrls);
          if (isNowFavorite) {
              newUrls.add(imageUrl);
          } else {
              newUrls.delete(imageUrl);
          }
          return newUrls;
      });
      // Optional: Could trigger a refetch if needed, but direct state update is faster
      // fetchFavorites();
  }, []); // No dependencies needed as it only uses the setter

  // Effect for Grid Arrow Key Navigation remains the same
  useEffect(() => {
    const handleGridKeyDown = (event: KeyboardEvent) => {
      if (selectedImageIndex !== null) return; // Ignore if modal is open
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return; // Ignore if typing

      if (event.key === 'ArrowLeft' && currentImagePage > 1) handlePreviousImagePage();
      else if (event.key === 'ArrowRight' && currentImagePage < totalImagePages) handleNextImagePage();
    };
    document.addEventListener('keydown', handleGridKeyDown);
    return () => document.removeEventListener('keydown', handleGridKeyDown);
  }, [selectedImageIndex, currentImagePage, totalImagePages, handlePreviousImagePage, handleNextImagePage]);

  // Calculate Props for Modal remain the same
  const currentImageUrlForModal = selectedImageIndex !== null ? fullImageList[selectedImageIndex]?.src : null;
  const currentImageThumbnailUrlForModal = selectedImageIndex !== null ? fullImageList[selectedImageIndex]?.thumbnail : null;
  const hasPreviousImage = selectedImageIndex !== null && selectedImageIndex > 0;
  const hasNextImage = selectedImageIndex !== null && selectedImageIndex < fullImageList.length - 1;

  // Render Logic (Loading, Error, Empty states remain similar)
  if (loading) { // Show main loading while catalog is loading
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Catalog...</main>;
  }

  if (error || catalog === null) {
    return (
        <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
             <Link href={backHref} className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
             <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
             <p>{error || (catalogName ? `Catalog "${catalogName}" could not be loaded or found.` : 'Catalog parameter missing.')}</p>
        </main>
    );
  }

  if (catalog === undefined) { // Should be brief unless error occurs before fetch starts
       return <main className="flex min-h-screen flex-col items-center justify-center p-24">Initializing...</main>;
  }

   if (totalImages === 0) {
    return (
        <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
             <Link href={backHref} className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
             <h1 className="text-3xl font-bold mb-8">{catalog.name}</h1>
             <p>This catalog contains no images.</p>
        </main>
    );
  }

  // --- Main Render Output ---
  return (
    <>
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        {/* Back link */}
        <div className="w-full max-w-7xl mb-6">
            <Link href={backHref} className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Catalogs
            </Link>
        </div>
        {/* Title */}
        <h1 className="text-4xl font-bold mb-8">{catalog.name}</h1>
        {/* Image Grid */}
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full max-w-7xl mb-8">
          {currentGridImages.map((image, indexOnPage) => {
            const indexInFullList = imageStartIndex + indexOnPage;
            // --- Check if the current image is a favorite ---
            const isFavorite = isLoggedIn && favoriteUrls.has(image.src);

            return (
              <button
                key={`${image.name}-${indexInFullList}`}
                onClick={() => handleImageClick(indexInFullList)}
                className="relative aspect-square border rounded-md overflow-hidden shadow-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 transition-shadow duration-150 group"
                aria-label={`View image ${image.name}${isFavorite ? ' (Favorite)' : ''}`} // Add to aria-label
              >
                <Image
                  src={image.thumbnail}
                  alt={image.name}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 20vw, 15vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-150"
                  loading="lazy"
                />
                 <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {image.name}
                 </div>
                 {/* --- Conditionally render Heart Icon --- */}
                 {isFavorite && (
                    <div className="absolute top-1.5 right-1.5 z-10 p-0.5 bg-black bg-opacity-40 rounded-full">
                        <Heart className="h-4 w-4 text-red-500 fill-current" />
                    </div>
                 )}
              </button>
            );
          })}
        </div>

        {/* Image Pagination Controls (remain the same) */}
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

      {/* Render Modal */}
       <ImageModal
        currentImageUrl={currentImageUrlForModal}
        currentImageThumbnailUrl={currentImageThumbnailUrlForModal} // Pass thumbnail URL
        onClose={handleCloseModal}
        onPrevious={handleModalPrevious}
        onNext={handleModalNext}
        hasPrevious={hasPreviousImage}
        hasNext={hasNextImage}
        isLoggedIn={isLoggedIn}
        onFavoriteStatusChange={handleFavoriteStatusChange} // <-- Pass the callback
      />
    </>
  );
};

export default CatalogPageClient;
