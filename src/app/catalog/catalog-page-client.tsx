// src/app/catalog/catalog-page-client.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePagination, DOTS } from '@/hooks/usePagination';
import ImageModal from '@/components/ImageModal';
import { getToken, removeToken } from "@/lib/auth";
import apiClient from '@/lib/apiClient';
import { Heart } from 'lucide-react';

// --- Interfaces based on the new API spec ---
interface ApiReferenceFile {
  id: number;
  name: string;
  directory: string;
  src: string; // This seems to be the unique identifier / path used for favorites
  thumbnail: string;
  corrupted: boolean;
  created_at: string;
  updated_at: string;
}

interface ApiReferenceFilesResponseData {
  files: ApiReferenceFile[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  directoryFilter: string | null;
}

interface FavoriteItem {
  id: number;
  file: string; // This should match ApiReferenceFile.src
  thumbnail: string;
  created_at: string;
}
// --- End Interfaces ---

// --- Constants ---
// Read items per page from environment variable, with a default fallback
const envImagesPerPage = process.env.NEXT_PUBLIC_CATALOG_IMAGES_PER_PAGE;
const parsedImagesPerPage = parseInt(envImagesPerPage || '', 10); // Attempt parsing
const IMAGES_PER_PAGE = !isNaN(parsedImagesPerPage) && parsedImagesPerPage > 0
    ? parsedImagesPerPage
    : 18; // Default value (e.g., 18) if env var is missing, not a number, or <= 0
// console.log(`Using IMAGES_PER_PAGE: ${IMAGES_PER_PAGE}`); // Optional: for debugging

const IMAGE_PAGINATION_SIBLING_COUNT = 2; // For pagination display
// --- End Constants ---

const CatalogPageClient = () => {
  const searchParams = useSearchParams();
  const encodedCatalogNameFromQuery = searchParams.get('catalog');
  const catalogName = useMemo(() => {
      return encodedCatalogNameFromQuery ? decodeURIComponent(encodedCatalogNameFromQuery) : '';
  }, [encodedCatalogNameFromQuery]);

  // --- State ---
  // API Data State
  const [currentFiles, setCurrentFiles] = useState<ApiReferenceFile[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(0);
  // Loading and Error State
  const [loading, setLoading] = useState(true); // Combined loading for initial auth, favorites, and first file fetch
  const [error, setError] = useState<string | null>(null);
  // Pagination and Selection State
  const [currentImagePage, setCurrentImagePage] = useState(1); // API uses 1-based indexing
  const [selectedImageGlobalIndex, setSelectedImageGlobalIndex] = useState<number | null>(null); // Index in the *entire* catalog list
  // Auth and Favorites State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [favoriteUrls, setFavoriteUrls] = useState<Set<string>>(new Set()); // Store favorite 'src' URLs
  const [favoritesLoading, setFavoritesLoading] = useState(false); // Loading for subsequent favorite fetches/updates
  
  // State for the image details to be displayed in the modal
  const [modalImageDetails, setModalImageDetails] = useState<{ src: string; thumbnail: string; } | null>(null);

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

  // --- Function to fetch favorites (remains the same logic, uses 'file' which matches 'src') ---
  const fetchFavorites = useCallback(async () => {
      if (!isLoggedIn) {
          setFavoriteUrls(new Set());
          return;
      }
      setFavoritesLoading(true);
      try {
          // Assuming the API returns favorites with a 'file' field matching the 'src' of reference files
          const result = await apiClient<{ data: FavoriteItem[] }>('/favorites', { method: 'GET' }, true);
          const urls = new Set(result.data?.map(fav => fav.file) || []);
          setFavoriteUrls(urls);
      } catch (favError: any) {
          console.error("Failed to fetch favorites:", favError);
          setFavoriteUrls(new Set());
      } finally {
          setFavoritesLoading(false);
      }
  }, [isLoggedIn]);

  // --- Effect to Check Auth and Fetch Initial Favorites (remains the same) ---
  useEffect(() => {
    const checkAuthAndFetchInitial = async () => {
        setLoading(true); // Start global loading
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

        if (loggedIn) {
            await fetchFavorites(); // Fetch initial favorites
        } else {
            setFavoriteUrls(new Set());
        }
        // setLoading(false) will happen after the *first* file fetch completes
    };
    checkAuthAndFetchInitial();
    // We only want this to run once on mount, subsequent favorite fetches are handled by fetchFavorites directly or triggered elsewhere if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // --- Effect to Fetch Reference Files from API ---
  useEffect(() => {
    // Don't fetch if catalogName is missing
    if (!catalogName) {
        setError("Catalog parameter missing in URL.");
        setLoading(false);
        setCurrentFiles([]);
        setTotalItems(0);
        setApiTotalPages(0);
        return;
    };

    const fetchReferenceFiles = async () => {
      setLoading(true); // Set loading true for each fetch triggered by page or catalog change
      setError(null);
      // Clear previous results for the current page while loading new page
      // setCurrentFiles([]); // Avoid clearing, looks better to keep old while loading new

      try {
        // Construct query parameters for the API call
        const queryParams = new URLSearchParams({
            page: currentImagePage.toString(),
            size: IMAGES_PER_PAGE.toString(),
            catalog: catalogName, // Use the decoded catalog name for the 'catalog' parameter
        });

        const result = await apiClient<{ data: ApiReferenceFilesResponseData }>(
            `/reference-files?${queryParams.toString()}`,
            { method: 'GET' },
            false // Public endpoint
        );

        if (result?.data) {
            // Filter out potentially corrupted files if needed (optional, API might already do this)
            // const validFiles = result.data.files.filter(file => !file.corrupted && file.src && file.thumbnail && file.name);
            const validFiles = result.data.files || []; // Assume API returns valid files

            setCurrentFiles(validFiles);
            setTotalItems(result.data.total || 0);
            setApiTotalPages(result.data.totalPages || 0);

            // Validate currentImagePage against the actual totalPages from the API response
            // This handles cases where the URL might have had an invalid page number or state was stale
            if (result.data.totalPages > 0 && currentImagePage > result.data.totalPages) {
                setCurrentImagePage(result.data.totalPages); // Adjust to last valid page
            } else if (result.data.totalPages === 0 && currentImagePage !== 1) {
                setCurrentImagePage(1); // Reset to 1 if no pages
            }
            // Handle case where API returns 0 total items for the catalog
            if (result.data.total === 0) {
                 setError(`Catalog "${catalogName}" contains no images.`); // Set error message for display
            }

        } else {
            throw new Error("Received invalid data structure from API.");
        }

      } catch (e: any) {
        console.error("Failed to fetch reference files:", e);
        setError(e.message || `Failed to load data for catalog "${catalogName}".`);
        setCurrentFiles([]);
        setTotalItems(0);
        setApiTotalPages(0);
      } finally {
        setLoading(false);
      }
    };

    fetchReferenceFiles();

  }, [catalogName, currentImagePage]); // Refetch whenever catalogName or currentImagePage changes

  // --- Pagination Logic ---
  // totalImagePages is now derived from apiTotalPages state, set by the API response.
  const totalImagePages = apiTotalPages;

  const imagePaginationRange = usePagination({
    currentPage: currentImagePage,
    totalCount: totalItems, // Use totalItems from API response
    siblingCount: IMAGE_PAGINATION_SIBLING_COUNT,
    pageSize: IMAGES_PER_PAGE, // <-- Use the new constant from env/default
  });

  // Calculate the start index for the *current page* in the *overall* list
  // Uses the new constant from env/default
  const imageStartIndex = (currentImagePage - 1) * IMAGES_PER_PAGE;

  // --- Effect to Sync Grid Page with Modal Navigation ---
  useEffect(() => {
     // If an image is selected (modal is open)
     if (selectedImageGlobalIndex !== null && totalItems > 0) {
      // Calculate the page number the selected image *should* be on
      // Uses the new constant from env/default
      const pageForSelectedIndex = Math.floor(selectedImageGlobalIndex / IMAGES_PER_PAGE) + 1;
      // If the calculated page is different from the currently displayed grid page
      if (pageForSelectedIndex !== currentImagePage) {
        // Ensure the target page is valid
        const validPage = Math.max(1, Math.min(pageForSelectedIndex, totalImagePages));
        // Update the current grid page to match the modal's image
        setCurrentImagePage(validPage);
      }
    }
    // Uses the new constant from env/default indirectly via imageStartIndex calculation
  }, [selectedImageGlobalIndex, currentImagePage, totalImagePages, totalItems]); // Re-run if selection, current page, total pages, or total items change

  // Effect to update modal image details when selected image or relevant data changes
  useEffect(() => {
    if (selectedImageGlobalIndex === null) {
      setModalImageDetails(null); // Clear details if modal is closed or no image selected
      return;
    }

    // Calculate the page and index on that page for the globally selected image
    const pageOfSelectedImage = Math.floor(selectedImageGlobalIndex / IMAGES_PER_PAGE) + 1;
    const indexOnPageOfSelectedImage = selectedImageGlobalIndex % IMAGES_PER_PAGE;

    // Check if the selected image is on the page currently loaded into `currentFiles`
    if (pageOfSelectedImage === currentImagePage && 
        currentFiles && 
        indexOnPageOfSelectedImage >= 0 && 
        indexOnPageOfSelectedImage < currentFiles.length) {
      const file = currentFiles[indexOnPageOfSelectedImage];
      if (file && file.src && file.thumbnail) { // Ensure file and its properties are valid
        setModalImageDetails({ src: file.src, thumbnail: file.thumbnail });
      }
    }
    // If the image is not on the currently loaded page (e.g., while `currentFiles` is updating for a new page),
    // `modalImageDetails` retains its previous value. This keeps the modal open, showing the last valid image.
  }, [selectedImageGlobalIndex, currentFiles, currentImagePage]); // IMAGES_PER_PAGE is a constant

  // --- Event Handlers ---
  const handlePreviousImagePage = useCallback(() => {
    setCurrentImagePage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextImagePage = useCallback(() => {
    // Use the totalImagePages derived from the API response state
    setCurrentImagePage((prev) => Math.min(prev + 1, totalImagePages));
  }, [totalImagePages]);

  const handleImagePageChange = useCallback((pageNumber: number | string) => {
     if (typeof pageNumber === 'number') {
        const validPage = Math.max(1, Math.min(pageNumber, totalImagePages));
        setCurrentImagePage(validPage);
     }
     else if (pageNumber === DOTS) {
        // DOTS logic remains the same, using totalImagePages from API
        const currentIndex = imagePaginationRange.findIndex(p => p === DOTS);
        let prevNumeric = 1, nextNumeric = totalImagePages;
        for(let i = currentIndex - 1; i >= 0; i--) { if(typeof imagePaginationRange[i] === 'number') { prevNumeric = imagePaginationRange[i] as number; break; } }
        for(let i = currentIndex + 1; i < imagePaginationRange.length; i++) { if(typeof imagePaginationRange[i] === 'number') { nextNumeric = imagePaginationRange[i] as number; break; } }
        // Simple midpoint jump logic (can be refined)
        const targetPage = Math.round((prevNumeric + nextNumeric) / 2);
        if (targetPage > 0 && targetPage <= totalImagePages && targetPage !== prevNumeric && targetPage !== nextNumeric) {
             setCurrentImagePage(targetPage);
        }
     }
  }, [imagePaginationRange, totalImagePages]);

  // When an image in the grid is clicked, store its GLOBAL index
  const handleImageClick = (indexOnPage: number) => {
      const globalIndex = imageStartIndex + indexOnPage;
      setSelectedImageGlobalIndex(globalIndex);
  };

  const handleCloseModal = () => setSelectedImageGlobalIndex(null);

  // Modal navigation updates the GLOBAL index
  const handleModalPrevious = () => {
    setSelectedImageGlobalIndex(prevIndex => (prevIndex === null || prevIndex === 0 ? 0 : prevIndex - 1));
  };
  const handleModalNext = () => {
     setSelectedImageGlobalIndex(prevIndex => (prevIndex === null || prevIndex >= totalItems - 1 ? totalItems - 1 : prevIndex + 1));
  };

  // Callback for Modal Favorite Status Change (remains the same logic)
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
      // Optional: Refetch favorites if strict consistency is needed, but UI update is faster
      // fetchFavorites();
  }, []);

  // Effect for Grid Arrow Key Navigation (uses totalImagePages)
  useEffect(() => {
    const handleGridKeyDown = (event: KeyboardEvent) => {
      if (selectedImageGlobalIndex !== null) return; // Ignore if modal is open
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      // Use totalImagePages derived from API state
      if (event.key === 'ArrowLeft' && currentImagePage > 1) handlePreviousImagePage();
      else if (event.key === 'ArrowRight' && currentImagePage < totalImagePages) handleNextImagePage();
    };
    // Only add listener if there's more than one page
    if (totalImagePages > 1) document.addEventListener('keydown', handleGridKeyDown);
    return () => document.removeEventListener('keydown', handleGridKeyDown);
  }, [selectedImageGlobalIndex, currentImagePage, totalImagePages, handlePreviousImagePage, handleNextImagePage]);

  // --- Calculate Props for Modal ---
  // We need to find the file data corresponding to the selected GLOBAL index.
  // This file might NOT be in the `currentFiles` array if the user navigated
  // the modal across page boundaries before the grid updated.
  // For simplicity *now*, we'll assume the grid updates fast enough or
  // we only show the modal if the image *is* on the current page.
  // A more robust solution might require fetching the specific image data if needed.
  // Let's try the simpler approach first: derive from currentFiles if possible.
  // The new `modalImageDetails` state and its accompanying `useEffect` handle this.
  const currentImageUrlForModal = modalImageDetails?.src || null;
  const currentImageThumbnailUrlForModal = modalImageDetails?.thumbnail || null;
  const hasPreviousImage = selectedImageGlobalIndex !== null && selectedImageGlobalIndex > 0;
  const hasNextImage = selectedImageGlobalIndex !== null && selectedImageGlobalIndex < totalItems - 1;


  // --- Render Logic ---
  // Initial loading covers auth, favorites, and first file fetch
  if (loading && currentFiles.length === 0 && totalItems === 0) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Catalog...</main>;
  }

  // Handle errors after loading attempt
  if (error && !loading) { // Show error only if not actively loading
    return (
        <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
             <Link href={backHref} className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
             <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
             {/* Display the specific error message */}
             <p>{error}</p>
        </main>
    );
  }

   // Handle case where catalog exists but has no items (after loading)
   if (!loading && totalItems === 0 && !error) { // Check !error to distinguish from fetch failure
    return (
        <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
             <Link href={backHref} className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
             <h1 className="text-3xl font-bold mb-8">{catalogName}</h1>
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
        <h1 className="text-4xl font-bold mb-8">{catalogName}</h1>

        {/* Loading indicator for page changes */}
        {loading && <div className="text-center text-gray-600 my-4">Loading page {currentImagePage}...</div>}

        {/* Image Grid - Renders images from the current page */}
         <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full max-w-7xl mb-8 ${loading ? 'opacity-50' : ''}`}>
          {currentFiles.map((file, indexOnPage) => {
            // Check if the current image is a favorite using its 'src' URL
            const isFavorite = isLoggedIn === true && favoriteUrls.has(file.src);

            return (
              <button
                key={`${file.id}-${file.name}`} // Use unique ID from API if available
                onClick={() => handleImageClick(indexOnPage)}
                className="relative aspect-square border rounded-md overflow-hidden shadow-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 transition-all duration-150 group"
                aria-label={`View image ${file.name}${isFavorite ? ' (Favorite)' : ''}`}
                disabled={loading} // Disable button while loading new page
              >
                <Image
                  src={file.thumbnail} // Use thumbnail URL from API
                  alt={file.name} // Use name from API
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 20vw, 15vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-150"
                  loading="lazy"
                  // Add priority to first few images on the *first* page load?
                  // priority={currentImagePage === 1 && indexOnPage < 6}
                />
                 <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {file.name}
                 </div>
                 {/* Conditionally render Heart Icon if favorite */}
                 {isFavorite && (
                    <div className="absolute top-1.5 right-1.5 z-10 p-0.5 bg-black bg-opacity-40 rounded-full">
                        <Heart className="h-4 w-4 text-red-500 fill-current" />
                    </div>
                 )}
              </button>
            );
          })}
        </div>

        {/* Image Pagination Controls - Uses totalImagePages from API */}
        {totalImagePages > 1 && (
          <nav aria-label="Image page navigation">
            <ul className="flex items-center justify-center space-x-1 mt-8">
              {/* Previous Button */}
              <li>
                <button
                  onClick={handlePreviousImagePage}
                  disabled={currentImagePage === 1 || loading} // Disable during load
                  className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                    currentImagePage === 1 || loading
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
                    // Dots logic (simplified jump)
                     let prevNumeric = 1, nextNumeric = totalImagePages;
                     for(let i = index - 1; i >= 0; i--) { if(typeof imagePaginationRange[i] === 'number') { prevNumeric = imagePaginationRange[i] as number; break; } }
                     for(let i = index + 1; i < imagePaginationRange.length; i++) { if(typeof imagePaginationRange[i] === 'number') { nextNumeric = imagePaginationRange[i] as number; break; } }
                     const targetPage = Math.round((prevNumeric + nextNumeric) / 2);
                     if (targetPage > 0 && targetPage <= totalImagePages && targetPage !== prevNumeric && targetPage !== nextNumeric) {
                         return (
                            <li key={`${DOTS}-img-${index}`}>
                                <button
                                    onClick={() => handleImagePageChange(targetPage)}
                                    disabled={loading} // Disable during load
                                    className={`px-3 py-2 leading-tight rounded-md ${ loading ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700'}`}
                                    aria-label={`Jump towards image page ${targetPage}`}
                                >
                                    {DOTS}
                                </button>
                            </li>
                        );
                     } else {
                         // Don't render dots if it can't jump meaningfully
                         return null;
                     }
                }

                // Render page number button
                return (
                  <li key={`img-page-${pageNumber}`}>
                    <button
                      onClick={() => handleImagePageChange(pageNumber)}
                      disabled={currentImagePage === pageNumber || loading} // Disable during load
                      className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                        currentImagePage === pageNumber
                          ? 'bg-blue-500 text-white border border-blue-500 cursor-default' + (loading ? ' opacity-50' : '')
                          : loading
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' // Disabled non-current page style
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
                  disabled={currentImagePage === totalImagePages || loading} // Disable during load
                  className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                    currentImagePage === totalImagePages || loading
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

      {/* Render Modal - Pass data derived from the selected global index */}
       <ImageModal
        currentImageUrl={currentImageUrlForModal} // Use derived URL
        currentImageThumbnailUrl={currentImageThumbnailUrlForModal} // Pass derived thumbnail URL
        onClose={handleCloseModal}
        onPrevious={handleModalPrevious} // Uses global index logic
        onNext={handleModalNext} // Uses global index logic
        hasPrevious={hasPreviousImage} // Based on global index
        hasNext={hasNextImage} // Based on global index
        isLoggedIn={isLoggedIn}
        onFavoriteStatusChange={handleFavoriteStatusChange} // Pass the callback
      />
    </>
  );
};

export default CatalogPageClient;
