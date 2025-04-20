// src/app/main/main-page-client.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { usePagination, DOTS } from '@/hooks/usePagination';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getToken, removeToken } from "@/lib/auth";
import apiClient from '@/lib/apiClient';

// ... (interfaces, constants, helpers remain the same) ...
interface ImageItem { name: string; src: string; }
interface ImageCatalog { name: string; list: ImageItem[]; }
interface ImageData { images: ImageCatalog[]; }
const ITEMS_PER_PAGE = 24;
const SIBLING_COUNT = 4;
const getInitialPage = (searchParams: URLSearchParams | null): number => {
  // ... (function remains the same) ...
  if (!searchParams) return 1;
  const pageParam = searchParams.get('page');
  if (pageParam) {
    const pageNum = parseInt(pageParam, 10);
    if (!isNaN(pageNum) && pageNum > 0) {
      return pageNum;
    }
  }
  return 1;
};

const getInitialSearchTerm = (searchParams: URLSearchParams | null): string => {
    // ... (function remains the same) ...
    return searchParams?.get('q') || '';
};


const MainPageClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => getInitialPage(searchParams));
  const isInitialLoad = useRef(true);
  const [searchTerm, setSearchTerm] = useState(() => getInitialSearchTerm(searchParams));
  const [isLoggingOut, setIsLoggingOut] = useState(false);

// --- MODIFIED: Effect to Check Initial Login Status using apiClient ---
useEffect(() => {
  const checkAuthStatus = async () => {
      const token = getToken();
      if (!token) {
          setIsLoggedIn(false);
          return;
      }
      try {
          // Use apiClient, passing authenticate: true
          await apiClient('/check', { method: 'GET' }, true);
          setIsLoggedIn(true);
      } catch (error: any) {
          console.error("Auth check failed:", error);
          setIsLoggedIn(false);
          // If the error status is 401, remove the invalid token
          if (error?.status === 401) {
              removeToken();
          }
      }
  };
  checkAuthStatus();
  }, []); // Run only once on mount

  // --- Fetch Image Data Effect (remains the same) ---
  useEffect(() => {
    // ... (fetch image data logic) ...
    const imageUrl = process.env.NEXT_PUBLIC_IMAGE_DATA_URL;
    if (!imageUrl) {
      console.error("Configuration Error: NEXT_PUBLIC_IMAGE_DATA_URL is not defined.");
      setError("Application is not configured correctly (missing image data URL).");
      setLoading(false);
      return;
    }
    const fetchImageData = async () => {
      setLoading(true);
      setError(null);
      try {
        // credentials: 'include', // Add if needed for image data URL
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data: ImageData = await response.json();
        setImageData(data);
      } catch (e: any) {
        setError(e.message);
        setImageData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchImageData();
  }, []); // Runs once on mount

  // --- Filter Catalogs (including search) ---
  const searchFilteredCatalogs = useMemo(() => {
    // ... (logic remains the same) ...
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    const allCatalogs = imageData?.images || [];
    const nonEmptyCatalogs = allCatalogs.filter(catalog => catalog.list && catalog.list.length > 0);
    if (!lowerCaseSearchTerm) return nonEmptyCatalogs;
    return nonEmptyCatalogs.filter(catalog => catalog.name.toLowerCase().includes(lowerCaseSearchTerm));
  }, [imageData, searchTerm]);


  // --- Pagination Logic ---
  const totalItems = searchFilteredCatalogs.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // --- Effect to validate currentPage ---
  useEffect(() => {
    // ... (logic remains the same) ...
     if (!loading && totalPages > 0) {
        const validPage = Math.max(1, Math.min(currentPage, totalPages));
        if (validPage !== currentPage) {
            setCurrentPage(validPage);
            if (!isInitialLoad.current) {
                const queryParams = new URLSearchParams();
                if (validPage > 1) queryParams.set('page', validPage.toString());
                if (searchTerm) queryParams.set('q', searchTerm);
                const newPath = `/main${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
                router.replace(newPath, { scroll: false });
            }
        }
    } else if (!loading && totalPages === 0 && currentPage !== 1) {
        setCurrentPage(1);
        if (!isInitialLoad.current) {
            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.set('q', searchTerm);
            const newPath = `/main${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            router.replace(newPath, { scroll: false });
        }
    }
  }, [loading, totalPages, currentPage, router, searchTerm]);


  // --- Effect to Update URL on Page/Search Change ---
  useEffect(() => {
    // ... (logic remains the same, ensures URL reflects state) ...
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    const queryParams = new URLSearchParams();
    if (currentPage > 1) queryParams.set('page', currentPage.toString());
    if (searchTerm) queryParams.set('q', searchTerm);
    const queryString = queryParams.toString();
    const newPath = `/main${queryString ? `?${queryString}` : ''}`;
    const currentPath = window.location.pathname + window.location.search;
    if (newPath !== currentPath && !loading && !isLoggingOut) {
        router.push(newPath, { scroll: false });
    }
  }, [currentPage, searchTerm, loading, isLoggingOut, router]);


  // --- Pagination Hook ---
  const paginationRange = usePagination({
    // ... (logic remains the same) ...
    currentPage,
    totalCount: totalItems,
    siblingCount: SIBLING_COUNT,
    pageSize: ITEMS_PER_PAGE,
  });

  // --- Event Handlers ---
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
}, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const handlePageChange = useCallback((pageNumber: number | string) => {
     if (typeof pageNumber === 'number') {
        const validPage = Math.max(1, Math.min(pageNumber, totalPages));
        setCurrentPage(validPage);
     }
     else if (pageNumber === DOTS) {
        const currentIndex = paginationRange.findIndex(p => p === DOTS);
        let prevNumeric = 1, nextNumeric = totalPages;
        for(let i = currentIndex - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
        for(let i = currentIndex + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
        const targetPage = nextNumeric < totalPages ? prevNumeric + 1 : prevNumeric + 1;
        if (targetPage > 0 && targetPage <= totalPages) setCurrentPage(targetPage);
     }
  }, [paginationRange, totalPages]);
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  // --- Effect for Main Page Arrow Key Navigation ---
  useEffect(() => {
    // ... (logic remains the same) ...
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || isLoggingOut)) return;
      if (event.key === 'ArrowLeft' && currentPage > 1) handlePreviousPage();
      else if (event.key === 'ArrowRight' && currentPage < totalPages) handleNextPage();
    };
    if (totalPages > 1) document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [ currentPage, totalPages, handlePreviousPage, handleNextPage, isLoggingOut ]);


  // --- Calculate indices ---
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentCatalogs = searchFilteredCatalogs.slice(startIndex, endIndex);

  // --- *** MODIFIED: Logout Handler using JWT *** ---
const handleLogout = async () => {
  setIsLoggingOut(true);
  const token = getToken();

  if (!token) {
    // Should ideally not happen if button is shown correctly, but handle anyway
    toast({ variant: "destructive", title: "Error", description: "You are not logged in." });
    setIsLoggedIn(false); // Ensure state is correct
    setIsLoggingOut(false);
    return;
}

  try {
      // Use apiClient, passing authenticate: true
      const result = await apiClient<{ data?: string }>('/log-out', { method: 'POST' }, true);
      toast({
          title: "Logged Out",
          description: result?.data || "You have been successfully logged out.",
      });
      removeToken();
      setIsLoggedIn(false);
  } catch (error: any) {
      console.error("Logout request failed:", error);
      let errorMessage = "Logout failed.";
      if (error?.responseBody?.status?.message) {
          errorMessage = error.responseBody.status.message;
      } else if (error?.status === 401) {
          errorMessage = "Session already expired or invalid.";
          // Remove token if server says it's invalid
          removeToken();
          setIsLoggedIn(false);
      }
      toast({ variant: "destructive", title: "Logout Failed", description: errorMessage });
  } finally {
      setIsLoggingOut(false);
  }
};
  // --- *** END: Logout Handler *** ---


  // --- Render Logic ---
  // Show main loading only for image data fetch
  if (loading) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Data...</main>;
  }

  // Show error if image data fetch failed
  if (error) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Error: {error}</main>;
  }

  // No results logic remains the same
  const noResultsAfterLoad = !loading && totalItems === 0 && !imageData?.images?.length;
  const noSearchResults = !loading && totalItems === 0 && !!searchTerm;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12 sm:p-12 md:p-24">
       {/* Header with Conditional Buttons */}
       <div className="w-full max-w-7xl flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Image Catalogs</h1>
            {/* --- Button Container --- */}
            <div className="flex items-center space-x-2">
                {/* --- NEW: Favorites Button (Conditional) --- */}
                {isLoggedIn === true && (
                    <Button
                        variant="outline"
                        onClick={() => router.push('/favorites')} // Navigate to favorites page
                        disabled={isLoggingOut} // Disable if logging out
                    >
                        Favorites
                    </Button>
                )}
                {/* --- END: Favorites Button --- */}

                {/* Existing Login/Logout Button */}
                {isLoggedIn === null ? (
                    <Button variant="outline" disabled>...</Button>
                ) : isLoggedIn ? (
                    <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut}>
                        {isLoggingOut ? "Logging Out..." : "Log Out"}
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => router.push('/')}>
                        Log In
                    </Button>
                )}
            </div>
            {/* --- END: Button Container --- */}
       </div>

      {/* Search Input (remains the same) */}
      <div className="w-full max-w-md mb-8">
        <Label htmlFor="catalog-search" className="sr-only">Search Catalogs</Label>
        <Input
          id="catalog-search"
          type="search"
          placeholder="Search catalogs by name..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full"
          disabled={isLoggingOut} // Only disable during the logout API call
        />
      </div>

      {/* Conditional Rendering for No Data / No Search Results (remains the same) */}
       {noResultsAfterLoad ? (
         <div className="text-center text-gray-600 mt-10">
            <p>No image data found or all catalogs are empty.</p>
         </div>
      ) : noSearchResults ? (
         <div className="text-center text-gray-600 mt-10">
            <p>No catalogs found matching "{searchTerm}".</p>
         </div>
      ) : (
        <>
          {/* Catalog Grid (remains the same) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-7xl mb-8">
            {currentCatalogs.map((catalog, index) => (
              <Link
                key={catalog.name}
                href={`/catalog?catalog=${encodeURIComponent(catalog.name)}&fromPage=${currentPage}${searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ''}`}
                className="block border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                onClick={(e) => { if (isLoggingOut) e.preventDefault(); }} // Prevent nav during logout
                aria-disabled={isLoggingOut}
                tabIndex={isLoggingOut ? -1 : 0}
              >
                {/* Card Content */}
                <div>
                  {/* ... h2, image divs ... */}
                   <h2 className="text-lg font-semibold p-3 truncate text-center bg-gray-50 border-b">{catalog.name}</h2>
                   <div className="flex justify-center items-center space-x-1 h-32 p-2">
                       {/* Images */}
                       <div className="relative w-1/3 h-full">
                           <Image src={catalog.list[0].src} alt={catalog.list[0].name} fill sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw" className="rounded-md object-cover" priority={index < ITEMS_PER_PAGE / 2} loading={index < ITEMS_PER_PAGE / 2 ? 'eager' : 'lazy'} />
                       </div>
                       {catalog.list.length >= 3 && <div className="relative w-1/3 h-full"><Image src={catalog.list[Math.floor(catalog.list.length / 2)].src} alt={`${catalog.name} - Middle Preview`} fill sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw" className="rounded-md object-cover" loading="lazy" /></div>}
                       {catalog.list.length >= 2 && <div className="relative w-1/3 h-full"><Image src={catalog.list[catalog.list.length - 1].src} alt={`${catalog.name} - Last Preview`} fill sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw" className="rounded-md object-cover" loading="lazy" /></div>}
                       {catalog.list.length < 3 && <div className="w-1/3 h-full bg-gray-100 rounded-md"></div>}
                       {catalog.list.length < 2 && <div className="w-1/3 h-full bg-gray-100 rounded-md"></div>}
                   </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls (remains the same) */}
          {totalPages > 1 && (
            <nav aria-label="Catalog Page navigation">
              <ul className="flex items-center justify-center space-x-1 mt-8">
                {/* Previous Button */}
                <li>
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || isLoggingOut} // Disable pagination if logging out
                className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                  currentPage === 1 || isLoggingOut
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                }`}
                aria-label="Previous Catalog Page"
              >
                Prev {/* Or use an SVG icon */}
              </button>
                </li>
                {/* Page Numbers */}
                {paginationRange.map((pageNumber, index) => {
                  if (pageNumber === DOTS) {
                 // Dots logic
                 let prevNumeric = 1, nextNumeric = totalPages;
                 for(let i = index - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
                 for(let i = index + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
                 const targetPage = nextNumeric < totalPages ? prevNumeric + 1 : prevNumeric + 1;
                 if (targetPage > 0 && targetPage <= totalPages) {
                     return (
                        <li key={`${DOTS}-${index}`}>
                            <button
                                onClick={() => handlePageChange(targetPage)}
                                disabled={isLoggingOut} // Disable pagination if logging out
                                className={`px-3 py-2 leading-tight rounded-md ${ isLoggingOut ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700'}`}
                                aria-label={`Jump to catalog page ${targetPage}`}
                            >
                                {DOTS}
                            </button>
                        </li>
                    );
                 } else {
                     return (
                        <li key={`${DOTS}-${index}`} className="px-3 py-2 leading-tight text-gray-400">
                            {DOTS}
                        </li>
                    );
                 }
              }

              // Render page number button
                  return (
                    <li key={pageNumber}>
                  <button
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={currentPage === pageNumber || isLoggingOut} // Disable pagination if logging out
                    className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                      currentPage === pageNumber || isLoggingOut
                        ? 'bg-blue-500 text-white border border-blue-500 cursor-default' + (isLoggingOut ? ' opacity-50' : '')
                        : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                    }`}
                    aria-current={currentPage === pageNumber ? 'page' : undefined}
                    aria-label={`Catalog Page ${pageNumber}`}
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
                disabled={currentPage === totalPages || isLoggingOut} // Disable pagination if logging out
                 className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                  currentPage === totalPages || isLoggingOut
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                }`}
                aria-label="Next Catalog Page"
              >
                Next {/* Or use an SVG icon */}
</button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}
    </main>
  );
};

export default MainPageClient;
