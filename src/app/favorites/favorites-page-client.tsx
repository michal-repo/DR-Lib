// src/app/favorites/favorites-page-client.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import ImageModal from '@/components/ImageModal';
import { getToken, removeToken } from "@/lib/auth";
import apiClient from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { usePagination, DOTS } from '@/hooks/usePagination';

// Define the structure of a favorite item from the API
interface FavoriteItem {
  id: number;
  file: string; // This is the image src
  created_at: string;
}

// --- Pagination Constants ---
const FAVORITES_PER_PAGE = 18;
const FAVORITES_PAGINATION_SIBLING_COUNT = 1;

const FavoritesPageClient = () => {
  const router = useRouter();
  const { toast } = useToast();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [favoritesList, setFavoritesList] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // --- Effect to Check Auth and Fetch Favorites ---
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setLoading(true);
      setError(null);
      const token = getToken();
      if (!token) {
        setIsLoggedIn(false);
        setLoading(false);
        router.push('/'); // Redirect to login if no token
        return;
      }

      // Verify token is still valid
      try {
        await apiClient('/check', { method: 'GET' }, true);
        setIsLoggedIn(true);
        try {
          const result = await apiClient<{ data: FavoriteItem[] }>('/favorites', { method: 'GET' }, true);
          setFavoritesList(result.data || []);
          setCurrentPage(1); // Reset to page 1 when favorites are fetched/refetched
        } catch (favError: any) {
          console.error("Failed to fetch favorites:", favError);
          setError("Could not load your favorites.");
          setFavoritesList([]); // Clear list on error
        }

      } catch (authError: any) {
        console.error("Auth check failed:", authError);
        setIsLoggedIn(false);
        if (authError?.status === 401) removeToken();
        router.push('/'); // Redirect to login if token is invalid
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndFetch();
  }, [router]);

  // --- Pagination Calculations ---
  const totalFavorites = favoritesList.length;
  const totalPages = Math.ceil(totalFavorites / FAVORITES_PER_PAGE);

  const paginationRange = usePagination({
    currentPage,
    totalCount: totalFavorites,
    siblingCount: FAVORITES_PAGINATION_SIBLING_COUNT,
    pageSize: FAVORITES_PER_PAGE,
  });

  // Calculate items for the current page
  const startIndex = (currentPage - 1) * FAVORITES_PER_PAGE;
  const endIndex = startIndex + FAVORITES_PER_PAGE;
  const currentGridFavorites = useMemo(() => {
      return favoritesList.slice(startIndex, endIndex);
  }, [favoritesList, startIndex, endIndex]);

  // --- Effect to handle page changes if items are removed ---
  useEffect(() => {
      // If the current page becomes empty and it's not the first page, go to the previous page
      if (currentPage > 1 && currentGridFavorites.length === 0 && totalFavorites > 0) {
          setCurrentPage(prev => Math.max(1, prev - 1));
      }
      // If the current page exceeds the total pages (e.g., after removing items), go to the last page
      else if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
      }
  }, [currentGridFavorites.length, currentPage, totalPages, totalFavorites]);


  // --- Pagination Event Handlers ---
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const handlePageChange = useCallback((pageNumber: number | string) => {
    if (typeof pageNumber === 'number') {
       setCurrentPage(pageNumber);
    }
    else if (pageNumber === DOTS) {
       // Logic to jump based on DOTS position (same as catalog)
       const currentIndex = paginationRange.findIndex(p => p === DOTS);
       let prevNumeric = 1, nextNumeric = totalPages;
       for(let i = currentIndex - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
       for(let i = currentIndex + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
       const targetPage = nextNumeric < totalPages ? prevNumeric + 1 : prevNumeric + 1;
       if (targetPage > 0 && targetPage <= totalPages) setCurrentPage(targetPage);
    }
  }, [paginationRange, totalPages]);


  // --- Modal Event Handlers (handleImageClick needs update) ---
  const handleImageClick = (indexOnPage: number) => {
      const indexInFullList = startIndex + indexOnPage; // Calculate index in the full list
      setSelectedImageIndex(indexInFullList);
  };
  const handleCloseModal = () => setSelectedImageIndex(null);

  const handleModalPrevious = () => {
    setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex === 0 ? prevIndex : prevIndex - 1));
  };

  const handleModalNext = () => {
    setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex >= favoritesList.length - 1 ? prevIndex : prevIndex + 1));
  };

  // --- Callback for Modal Favorite Status Change (remains the same) ---
  const handleFavoriteStatusChange = useCallback((imageUrl: string, isNowFavorite: boolean) => {
    if (!isNowFavorite) {
      setFavoritesList(prevList => prevList.filter(item => item.file !== imageUrl));
      if (selectedImageIndex !== null && favoritesList[selectedImageIndex]?.file === imageUrl) {
          handleCloseModal();
      }
      toast({ title: "Removed", description: "Favorite removed from this view." });
    }
  }, [selectedImageIndex, favoritesList]);

  // --- Calculate Props for Modal ---
  const currentImageUrlForModal = selectedImageIndex !== null ? favoritesList[selectedImageIndex]?.file : null;
  const hasPreviousImage = selectedImageIndex !== null && selectedImageIndex > 0;
  const hasNextImage = selectedImageIndex !== null && selectedImageIndex < favoritesList.length - 1;

  // --- *** NEW: Effect for Favorites Page Arrow Key Navigation *** ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if modal is open or if focus is on an input element
      const target = event.target as HTMLElement;
      if (selectedImageIndex !== null || (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))) {
        return;
      }

      // Handle Arrow Keys for Pagination
      if (event.key === 'ArrowLeft') {
        if (currentPage > 1) {
          handlePreviousPage();
        }
      } else if (event.key === 'ArrowRight') {
        if (currentPage < totalPages) {
          handleNextPage();
        }
      }
    };

    // Add listener only if there are multiple pages
    if (totalPages > 1) {
      document.addEventListener('keydown', handleKeyDown);
    }

    // Remove listener on cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };

    // Dependencies: Re-create handler if these change
  }, [selectedImageIndex, currentPage, totalPages, handlePreviousPage, handleNextPage]);
  // --- *** END: Arrow Key Navigation Effect *** ---


  // --- Render Logic ---
  if (loading || isLoggedIn === null) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading...</main>;
  }

  // Note: Redirection should happen in useEffect, but this is a fallback
  if (isLoggedIn === false) {
     return <main className="flex min-h-screen flex-col items-center justify-center p-24">Redirecting to login...</main>;
  }

  if (error) {
    return (
        <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
             <Link href="/main" className="text-blue-600 hover:underline mb-4">&larr; Back to Catalogs</Link>
             <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
             <p>{error}</p>
        </main>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        {/* Back link */}
        <div className="w-full max-w-7xl mb-6">
            <Link href="/main" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Catalogs
            </Link>
        </div>
        {/* Title */}
        <h1 className="text-4xl font-bold mb-8">Your Favorites</h1>

        {/* Favorites Grid & Pagination */}
        {favoritesList.length === 0 ? (
            <p className="text-gray-600">You haven't added any favorites yet.</p>
        ) : (
            <>
                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full max-w-7xl mb-8">
                {/* Use currentGridFavorites for mapping */}
                {currentGridFavorites.map((item, index) => {
                    const imageName = item.file.split('/').pop() || `Favorite ${item.id}`;
                    return (
                    <button
                        key={item.id}
                        // Pass the index *on the current page* to handleImageClick
                        onClick={() => handleImageClick(index)}
                        className="relative aspect-square border rounded-md overflow-hidden shadow-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 transition-shadow duration-150 group"
                        aria-label={`View favorite ${imageName}`}
                    >
                        <Image
                        src={item.file}
                        alt={imageName}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 20vw, 15vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-150"
                        loading="lazy"
                        />
                        </button>
                    );
                })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <nav aria-label="Favorites page navigation">
                        <ul className="flex items-center justify-center space-x-1 mt-8">
                    {/* Previous Button */}
                    <li>
                        <button
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                            currentPage === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                        }`}
                        aria-label="Previous Favorites Page"
                        >
                        Prev
                        </button>
                    </li>

                    {/* Page Number Buttons */}
                            {paginationRange.map((pageNumber, index) => {
                                if (pageNumber === DOTS) {
                            // Determine target page for DOTS click
                            let prevNumeric = 1, nextNumeric = totalPages;
                            for(let i = index - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
                            for(let i = index + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
                            const targetPage = nextNumeric < totalPages ? prevNumeric + 1 : prevNumeric + 1;

                            if (targetPage > 0 && targetPage <= totalPages) {
                                return (
                                    <li key={`${DOTS}-fav-${index}`}>
                                        <button
                                            onClick={() => handlePageChange(targetPage)}
                                            className="px-3 py-2 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 rounded-md"
                                            aria-label={`Jump to favorites page ${targetPage}`}
                                        >
                                            {DOTS}
                                        </button>
                                    </li>
                                );
                            } else {
                                return <li key={`${DOTS}-fav-${index}`} className="px-3 py-2 leading-tight text-gray-400">{DOTS}</li>;
                                }
                        }

                        // Render page number button
                        return (
                        <li key={`fav-page-${pageNumber}`}>
                            <button
                            onClick={() => handlePageChange(pageNumber)}
                            disabled={currentPage === pageNumber}
                            className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                                currentPage === pageNumber
                                ? 'bg-blue-500 text-white border border-blue-500 cursor-default'
                                : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                            }`}
                            aria-current={currentPage === pageNumber ? 'page' : undefined}
                            aria-label={`Favorites Page ${pageNumber}`}
                            >
                            {pageNumber}
                            </button>
                        </li>
                        );
                            })}
                            {/* Next Button */}
                    <li>
                        <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                            currentPage === totalPages
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                        }`}
                        aria-label="Next Favorites Page"
                        >
                        Next
                        </button>
                    </li>
                        </ul>
                    </nav>
                )}
            </>
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
        isLoggedIn={isLoggedIn}
        onFavoriteStatusChange={handleFavoriteStatusChange}
      />
    </>
  );
};

export default FavoritesPageClient;
