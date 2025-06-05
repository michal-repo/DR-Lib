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
import { Search } from 'lucide-react'; // Import Search icon

// --- Interfaces based on the new API spec ---
interface ApiCatalogEntry {
  directory: string;
  thumbnails: string[];
}

interface ApiCatalogsResponseData {
  catalogs: ApiCatalogEntry[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  searchQuery: string | null; // <-- Added based on OpenAPI spec
}
// --- End Interfaces ---

// --- Constants ---
// Read items per page from environment variable, with a default fallback
const envItemsPerPage = process.env.NEXT_PUBLIC_MAIN_CATALOGS_PER_PAGE;
const parsedItemsPerPage = parseInt(envItemsPerPage || '', 10); // Attempt parsing
const CATALOGS_PER_PAGE = !isNaN(parsedItemsPerPage) && parsedItemsPerPage > 0
    ? parsedItemsPerPage
    : 24; // Default value (e.g., 24) if env var is missing, not a number, or <= 0
// console.log(`Using CATALOGS_PER_PAGE: ${CATALOGS_PER_PAGE}`); // Optional: for debugging

const SIBLING_COUNT = 4; // For pagination display
const THUMBNAILS_PER_CATALOG = 3; // How many thumbnails to request per catalog
// --- End Constants ---

// Helper to get initial page from URL Search Params
const getInitialPage = (searchParams: URLSearchParams | null): number => {
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

// Helper to get initial search term from URL Search Params ('q')
const getInitialSearchTerm = (searchParams: URLSearchParams | null): string => {
    return searchParams?.get('q') || '';
};


const MainPageClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // --- State ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // State for API data
  const [currentApiCatalogs, setCurrentApiCatalogs] = useState<ApiCatalogEntry[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(0);
  const [lastUsedSearchQuery, setLastUsedSearchQuery] = useState<string | null>(null); // Store the search query returned by API
  // Loading and error states
  const [loading, setLoading] = useState(true); // Combined loading for auth check and initial catalog fetch
  const [error, setError] = useState<string | null>(null);
  // Pagination and Search state
  const [currentPage, setCurrentPage] = useState(() => getInitialPage(searchParams));
  // State for the search input field's current value
  const [searchInput, setSearchInput] = useState(() => getInitialSearchTerm(searchParams));
  // State for the search term that has been submitted and is actively used for filtering
  const [activeSearchQuery, setActiveSearchQuery] = useState(() => getInitialSearchTerm(searchParams));
  // Other UI states
  const isInitialLoad = useRef(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Effect to Check Initial Login Status ---
  useEffect(() => {
    const checkAuthStatus = async () => {
        const token = getToken();
        if (!token) {
            setIsLoggedIn(false);
            return; // No need to check API if no token
        }
        try {
            await apiClient('/check', { method: 'GET' }, true);
            setIsLoggedIn(true);
        } catch (error: any) {
            console.error("Auth check failed:", error);
            setIsLoggedIn(false);
            if (error?.status === 401) {
                removeToken();
            }
        }
        // Note: setLoading(false) will happen after the *first* catalog fetch completes
    };
    checkAuthStatus();
  }, []); // Run only once on mount

  // --- Effect to Fetch Catalog Data from API ---
  // *** Now depends on activeSearchQuery instead of searchInput ***
  useEffect(() => {
    // Don't fetch if auth status is still loading (isLoggedIn === null)
    // Let's fetch immediately as endpoint is public.

    const fetchCatalogData = async () => {
      setLoading(true); // Set loading true for each fetch
      setError(null);
      // Avoid clearing results immediately for better UX during page/search changes
      // setCurrentApiCatalogs([]);
      // setTotalItems(0);
      // setApiTotalPages(0);

      try {
        // Construct query parameters for the API call
        const queryParams = new URLSearchParams({
            page: currentPage.toString(),
            size: CATALOGS_PER_PAGE.toString(), // <-- Use the new constant
            thumbnails: THUMBNAILS_PER_CATALOG.toString(),
        });

        // *** Add the 'search' parameter if activeSearchQuery is present ***
        const currentSearchTerm = activeSearchQuery.trim(); // Use trimmed active search query
        if (currentSearchTerm) {
          queryParams.set('search', currentSearchTerm); // Use 'search' for the API parameter
        }

        const result = await apiClient<{ data: ApiCatalogsResponseData }>(
            `/catalogs?${queryParams.toString()}`,
            { method: 'GET' },
            false // Public endpoint, no authentication needed
        );

        if (result?.data) {
            setCurrentApiCatalogs(result.data.catalogs || []);
            setTotalItems(result.data.total || 0);
            setApiTotalPages(result.data.totalPages || 0);
            setLastUsedSearchQuery(result.data.searchQuery || null); // Store the actual search query used by API

            // Validate currentPage against the actual totalPages from the API response
            // This handles cases where the URL had an invalid page number initially or after a search
            if (result.data.totalPages > 0 && currentPage > result.data.totalPages) {
                // If current page is invalid after fetch (e.g., search reduced total pages)
                setCurrentPage(result.data.totalPages); // Adjust to last valid page
            } else if (result.data.totalPages === 0 && currentPage !== 1) {
                // If no results found (total pages is 0), reset to page 1
                setCurrentPage(1);
            }

        } else {
            // Handle cases where API returns 200 OK but no data object
            throw new Error("Received invalid data structure from API.");
        }

      } catch (e: any) {
        console.error("Failed to fetch catalogs:", e);
        setError(e.message || "Failed to load catalog data.");
        setCurrentApiCatalogs([]);
        setTotalItems(0);
        setApiTotalPages(0);
        setLastUsedSearchQuery(activeSearchQuery.trim() || null); // Assume the intended search failed
      } finally {
        setLoading(false);
        // isInitialLoad.current = false; // Mark initial load complete *after* first fetch attempt
      }
    };

    fetchCatalogData();

    // *** Update dependency array to use activeSearchQuery ***
  }, [currentPage, activeSearchQuery]); // Refetch whenever currentPage or the *active* search query changes

  // --- Pagination Logic ---
  // totalPages is now derived from apiTotalPages state, set by the API response.
  const totalPages = apiTotalPages;

  // --- Effect to Update URL on Page/Search Change ---
  // *** Now depends on activeSearchQuery ***
  useEffect(() => {
    if (isInitialLoad.current) {
      // Only mark initial load as false *after* the first successful data load and potential page correction
      if (!loading) {
          isInitialLoad.current = false;
      }
      return; // Don't push history state on initial load or during loading
    }

    // Update URL only after initial load and when not loading/logging out
    if (!loading && !isLoggingOut) {
        const queryParams = new URLSearchParams();
        if (currentPage > 1) queryParams.set('page', currentPage.toString());
        // Use 'q' for the URL parameter, based on the *active* search query
        const currentSearchTerm = activeSearchQuery.trim();
        if (currentSearchTerm) queryParams.set('q', currentSearchTerm);

        const queryString = queryParams.toString();
        // Ensure leading slash for path
        const newPath = `/main${queryString ? `?${queryString}` : ''}`;
        // Construct current path from window location to ensure accuracy
        const currentPath = window.location.pathname + window.location.search;

        // Use replaceState for page changes and search changes to avoid polluting browser history
        if (newPath !== currentPath) {
            router.replace(newPath, { scroll: false });
        }
    }
    // *** Update dependency array to use activeSearchQuery ***
  }, [currentPage, activeSearchQuery, loading, isLoggingOut, router]);


  // --- Pagination Hook ---
  const paginationRange = usePagination({
    currentPage,
    totalCount: totalItems, // Use totalItems from API response
    siblingCount: SIBLING_COUNT,
    pageSize: CATALOGS_PER_PAGE, // <-- Use the new constant
  });

  // --- Event Handlers ---
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    // Use the totalPages derived from the API response
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const handlePageChange = useCallback((pageNumber: number | string) => {
     if (typeof pageNumber === 'number') {
        const validPage = Math.max(1, Math.min(pageNumber, totalPages));
        setCurrentPage(validPage);
     }
     else if (pageNumber === DOTS) {
        // DOTS logic remains the same, using totalPages from API
        const currentIndex = paginationRange.findIndex(p => p === DOTS);
        let prevNumeric = 1, nextNumeric = totalPages;
        for(let i = currentIndex - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
        for(let i = currentIndex + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
        // Simple midpoint jump logic
        const targetPage = Math.round((prevNumeric + nextNumeric) / 2);
        if (targetPage > 0 && targetPage <= totalPages && targetPage !== prevNumeric && targetPage !== nextNumeric) {
             setCurrentPage(targetPage);
        }
     }
  }, [paginationRange, totalPages]);

  // Handler for changes in the search input field
  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
    // Do NOT trigger search here, only update the input's state
  };

  // Handler for submitting the search (Enter key or button click)
  const handleSearchSubmit = useCallback((event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault(); // Prevent default form submission page reload
    const newQuery = searchInput.trim();
    // Only trigger an update if the trimmed query is different from the currently active one
    if (newQuery !== activeSearchQuery) {
      setActiveSearchQuery(newQuery); // Update the active query
      setCurrentPage(1); // Reset to page 1 for new search results
      // The useEffect hook watching activeSearchQuery will now trigger the API fetch
    }
  }, [searchInput, activeSearchQuery]); // Dependencies for the callback


  // --- Effect for Main Page Arrow Key Navigation ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      // Ignore keydown if focus is on input, logging out, or loading
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || isLoggingOut || loading)) return;
      // Use totalPages derived from API
      if (event.key === 'ArrowLeft' && currentPage > 1) handlePreviousPage();
      else if (event.key === 'ArrowRight' && currentPage < totalPages) handleNextPage();
    };
    // Only add listener if there's more than one page
    if (totalPages > 1) document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
    // Add loading to dependencies to re-evaluate listener attachment
  }, [ currentPage, totalPages, handlePreviousPage, handleNextPage, isLoggingOut, loading ]);


  // --- Logout Handler (remains the same) ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    const token = getToken();

    if (!token) {
      toast({ variant: "destructive", title: "Error", description: "You are not logged in." });
      setIsLoggedIn(false);
      setIsLoggingOut(false);
      return;
    }

    try {
        const result = await apiClient<{ data?: string }>('/log-out', { method: 'POST' }, true);
        toast({
            title: "Logged Out",
            description: result?.data || "You have been successfully logged out.",
        });
        removeToken();
        setIsLoggedIn(false);
        // Reset search state on logout for consistency? Optional.
        // setSearchInput('');
        // setActiveSearchQuery('');
        // setCurrentPage(1);
    } catch (error: any) {
        console.error("Logout request failed:", error);
        let errorMessage = "Logout failed.";
        if (error?.responseBody?.status?.message) {
            errorMessage = error.responseBody.status.message;
        } else if (error?.status === 401) {
            errorMessage = "Session already expired or invalid.";
            removeToken();
            setIsLoggedIn(false);
        }
        toast({ variant: "destructive", title: "Logout Failed", description: errorMessage });
    } finally {
        setIsLoggingOut(false);
    }
  };


  // --- Render Logic ---
  // Show loading indicator until the first fetch completes
  if (loading && isInitialLoad.current) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Data...</main>;
  }

  // Show error if the fetch failed
  if (error && !loading) { // Show error only if not actively loading
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Error: {error}</main>;
  }

  // No results logic: Check after loading is complete
  const noResultsAfterLoad = !loading && totalItems === 0;
  // Check if the lack of results is due to an active search
  const noSearchResults = noResultsAfterLoad && !!lastUsedSearchQuery;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12 sm:p-12 md:p-6">
       {/* Header with Conditional Buttons */}
       <div className="w-full max-w-7xl flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Image Catalogs</h1>
            {/* Button Container */}
            <div className="flex items-center space-x-2">
                {/* Favorites Button */}
                {isLoggedIn === true && (
                    <Button
                        variant="outline"
                        onClick={() => router.push('/favorites')}
                        disabled={isLoggingOut || loading} // Also disable during loading
                    >
                        Favorites
                    </Button>
                )}
                {/* Reference Files Button */}
                <Button
                    variant="outline"
                    onClick={() => router.push('/references')}
                    disabled={isLoggingOut || loading}
                    >
                    Reference Files
                </Button>
                {/* Login/Logout Button */}
                {isLoggedIn === null ? (
                    <Button variant="outline" disabled>...</Button> // Auth check loading state
                ) : isLoggedIn ? (
                    <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut || loading}>
                        {isLoggingOut ? "Logging Out..." : "Log Out"}
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => router.push('/')} disabled={isLoggingOut || loading}>
                        Log In
                    </Button>
                )}
            </div>
       </div>

      {/* Search Input and Button Form */}
      {/* Wrap input and button in a form */}
      <form onSubmit={handleSearchSubmit} className="w-full max-w-lg mb-8 flex items-center space-x-2">
        <Label htmlFor="catalog-search" className="sr-only">Search Catalogs</Label>
        <Input
          id="catalog-search"
          type="search"
          placeholder="Search catalogs by name or content..."
          value={searchInput} // Controlled by searchInput state
          onChange={handleSearchInputChange} // Update searchInput state only
          className="flex-grow" // Allow input to take available space
          disabled={isLoggingOut || loading} // Disable while loading new page data too
        />
        <Button
            type="submit"
            disabled={isLoggingOut || loading}
            aria-label="Submit search"
        >
            <Search className="h-4 w-4 mr-1 sm:mr-2" /> {/* Added icon */}
            <span className="hidden sm:inline">Search</span> {/* Hide text on small screens */}
        </Button>
      </form>

      {/* Conditional Rendering for Loading/No Data */}
       {loading && !isInitialLoad.current && ( // Show subtle loading for page/search changes
            <div className="text-center text-gray-600 mt-10">Loading results...</div>
       )}
       {noResultsAfterLoad && !loading ? ( // Check !loading here
         <div className="text-center text-gray-600 mt-10">
            {/* Updated no results message */}
            {noSearchResults ? (
                <p>No catalogs found matching &quot;{lastUsedSearchQuery}&quot;.</p>
            ) : (
                <p>No image catalogs found.</p>
            )}
         </div>
       ) : !loading && currentApiCatalogs.length > 0 ? ( // Only render grid/pagination if not loading and have catalogs
        <>
          {/* Catalog Grid - Uses currentApiCatalogs */}
          {/* Add opacity transition during loading */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full max-w-7xl mb-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {/* Map over the catalogs received from the API for the current page */}
            {currentApiCatalogs.map((catalog, index) => {
                // Determine thumbnail URLs to display (up to 3)
                const thumb1 = catalog.thumbnails?.[0];
                const thumb2 = catalog.thumbnails?.[1];
                const thumb3 = catalog.thumbnails?.[2];
                // If fewer than 3 thumbs, use placeholders or adjust layout
                const hasThumb1 = !!thumb1;
                const hasThumb2 = !!thumb2;
                const hasThumb3 = !!thumb3;

                return (
                    <Link
                        key={catalog.directory} // Use directory as key
                        // Pass directory as catalog name, current page as fromPage, and *active* search term ('q' for URL)
                        href={`/catalog?catalog=${encodeURIComponent(catalog.directory)}&fromPage=${currentPage}${activeSearchQuery.trim() ? `&q=${encodeURIComponent(activeSearchQuery.trim())}` : ''}`}
                        className="block border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        onClick={(e) => { if (isLoggingOut || loading) e.preventDefault(); }} // Prevent nav during logout or load
                        aria-disabled={isLoggingOut || loading}
                        tabIndex={(isLoggingOut || loading) ? -1 : 0}
                    >
                        {/* Card Content */}
                        <div>
                            {/* Catalog Name Header - Use directory */}
                            <div className="text-sm font-semibold p-3 text-center bg-gray-50 border-b min-h-[4rem] flex items-center justify-center break-words">
                                {/* Use directory, maybe shorten or format later if needed */}
                                <h2>{catalog.directory}</h2>
                            </div>

                            {/* Thumbnail Display Area */}
                            <div className="flex justify-center items-center space-x-1 h-32 p-2">
                                {/* Image 1 */}
                                <div className="relative w-1/3 h-full">
                                    {hasThumb1 ? (
                                        <Image src={thumb1} alt={`${catalog.directory} thumbnail 1`} fill sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw" className="rounded-md object-cover" priority={index < CATALOGS_PER_PAGE / 3} loading={index < CATALOGS_PER_PAGE / 3 ? 'eager' : 'lazy'} />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 rounded-md"></div>
                                    )}
                                </div>
                                {/* Image 2 */}
                                <div className="relative w-1/3 h-full">
                                    {hasThumb2 ? (
                                        <Image src={thumb2} alt={`${catalog.directory} thumbnail 2`} fill sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw" className="rounded-md object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 rounded-md"></div>
                                    )}
                                </div>
                                {/* Image 3 */}
                                <div className="relative w-1/3 h-full">
                                    {hasThumb3 ? (
                                        <Image src={thumb3} alt={`${catalog.directory} thumbnail 3`} fill sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw" className="rounded-md object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 rounded-md"></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Link>
                );
            })}
          </div>

          {/* Pagination Controls - Uses totalPages from API */}
          {totalPages > 1 && (
            <nav aria-label="Catalog Page navigation">
              <ul className="flex items-center justify-center space-x-1 mt-8">
                {/* Previous Button */}
                <li>
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1 || isLoggingOut || loading} // Disable during load
                    className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                      currentPage === 1 || isLoggingOut || loading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                    }`}
                    aria-label="Previous Catalog Page"
                  >
                    Prev
                  </button>
                </li>
                {/* Page Numbers */}
                {paginationRange.map((pageNumber, index) => {
                  if (pageNumber === DOTS) {
                     // Dots logic (simplified jump)
                     let prevNumeric = 1, nextNumeric = totalPages;
                     for(let i = index - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
                     for(let i = index + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
                     const targetPage = Math.round((prevNumeric + nextNumeric) / 2);
                     if (targetPage > 0 && targetPage <= totalPages && targetPage !== prevNumeric && targetPage !== nextNumeric) {
                         return (
                            <li key={`${DOTS}-${index}`}>
                                <button
                                    onClick={() => handlePageChange(targetPage)}
                                    disabled={isLoggingOut || loading} // Disable during load
                                    className={`px-3 py-2 leading-tight rounded-md ${ isLoggingOut || loading ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700'}`}
                                    aria-label={`Jump towards catalog page ${targetPage}`}
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
                    <li key={pageNumber}>
                      <button
                        onClick={() => handlePageChange(pageNumber)}
                        disabled={currentPage === pageNumber || isLoggingOut || loading} // Disable during load
                        className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                          currentPage === pageNumber
                            ? 'bg-blue-500 text-white border border-blue-500 cursor-default' + (isLoggingOut || loading ? ' opacity-50' : '')
                            : isLoggingOut || loading
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' // Disabled non-current page style
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
                    disabled={currentPage === totalPages || isLoggingOut || loading} // Disable during load
                     className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                      currentPage === totalPages || isLoggingOut || loading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'
                    }`}
                    aria-label="Next Catalog Page"
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      ) : null /* End conditional rendering block for grid/pagination */ }
    </main>
  );
};

export default MainPageClient;
