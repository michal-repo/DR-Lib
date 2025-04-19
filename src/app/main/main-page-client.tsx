// src/app/main/main-page-client.tsx
"use client"; // <--- Add this directive

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation'; // Keep these hooks here
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { usePagination, DOTS } from '@/hooks/usePagination';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ... (interfaces, constants, helper functions remain the same) ...
interface ImageItem { name: string; src: string; }
interface ImageCatalog { name: string; list: ImageItem[]; }
interface ImageData { images: ImageCatalog[]; }

const ITEMS_PER_PAGE = 24;
const SIBLING_COUNT = 4;

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

const getInitialSearchTerm = (searchParams: URLSearchParams | null): string => {
    return searchParams?.get('q') || '';
};


// --- Component Definition ---
const MainPageClient = () => { // Renamed component
  const router = useRouter();
  const searchParams = useSearchParams(); // This hook is now correctly inside a Client Component

  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => getInitialPage(searchParams));
  const isInitialLoad = useRef(true);
  const [searchTerm, setSearchTerm] = useState(() => getInitialSearchTerm(searchParams));

  // --- All existing Effects, Memos, Handlers, Calculations, and JSX ---
  // --- remain exactly the same within this component ---

  // --- Fetch Data Effect ---
  useEffect(() => {
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
  }, []);

  // --- Filter Catalogs (including search) ---
  const searchFilteredCatalogs = useMemo(() => {
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
    // ... (validation logic - no changes, but uses totalPages derived from filtered list) ...
     if (!loading && totalPages > 0) {
        const validPage = Math.max(1, Math.min(currentPage, totalPages));
        if (validPage !== currentPage) {
            setCurrentPage(validPage);
            if (!isInitialLoad.current) {
                // Construct path including search term for replacement
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
            // Construct path including search term for replacement
            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.set('q', searchTerm); // Keep search term even if no results
            const newPath = `/main${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            router.replace(newPath, { scroll: false });
        }
    }
  }, [loading, totalPages, currentPage, router, searchTerm]); // Added searchTerm dependency


  // --- Effect to Update URL on Page/Search Change ---
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // Construct the target URL based on current state
    const queryParams = new URLSearchParams();
    if (currentPage > 1) {
        queryParams.set('page', currentPage.toString());
    }
    if (searchTerm) {
        // Use encodeURIComponent here when *constructing* the query string if needed,
        // but URLSearchParams handles basic encoding. Let's rely on it for now.
        queryParams.set('q', searchTerm);
    }

    const queryString = queryParams.toString();
    const newPath = `/main${queryString ? `?${queryString}` : ''}`;

    // Get current browser URL path + search
    const currentPath = window.location.pathname + window.location.search;

    // Only push if the path is different to avoid redundant history entries
    if (newPath !== currentPath && !loading) {
        router.push(newPath, { scroll: false });
    }

  }, [currentPage, searchTerm, loading, router]); // Added searchTerm dependency, removed searchParams


  // --- Pagination Hook ---
  const paginationRange = usePagination({
    currentPage,
    totalCount: totalItems, // Use totalItems from search-filtered list
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
        // Dots logic... (no changes needed here)
        const currentIndex = paginationRange.findIndex(p => p === DOTS);
        let prevNumeric = 1;
        let nextNumeric = totalPages;
        for(let i = currentIndex - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
        for(let i = currentIndex + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
        const targetPage = nextNumeric < totalPages ? prevNumeric + 1 : prevNumeric + 1;
        if (targetPage > 0 && targetPage <= totalPages) {
            setCurrentPage(targetPage);
        }
     }
  }, [paginationRange, totalPages]);

  // --- Search Handler ---
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page on new search
    // URL will be updated by the useEffect watching currentPage and searchTerm
  };

  // --- Effect for Main Page Arrow Key Navigation ---
  useEffect(() => {
    // ... (arrow key logic - no changes needed here) ...
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
      }
      if (event.key === 'ArrowLeft') {
        if (currentPage > 1) { handlePreviousPage(); }
      } else if (event.key === 'ArrowRight') {
        if (currentPage < totalPages) { handleNextPage(); }
      }
    };
    if (totalPages > 1) { document.addEventListener('keydown', handleKeyDown); }
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [ currentPage, totalPages, handlePreviousPage, handleNextPage ]);


  // --- Calculate indices ---
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentCatalogs = searchFilteredCatalogs.slice(startIndex, endIndex);

  // --- Render Logic ---
  if (loading) {
    // You might want a slightly different loading state here if the Suspense fallback is also basic
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Data...</main>;
  }

  if (error) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Error: {error}</main>;
  }
  
  if (totalItems === 0) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">No image data found or all catalogs are empty.</main>;
  }
  const noResultsAfterLoad = !loading && totalItems === 0;


  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12 sm:p-12 md:p-24">
      <h1 className="text-4xl font-bold mb-8">Image Catalogs</h1>
      {/* Search Input */}
      <div className="w-full max-w-md mb-8">
        <Label htmlFor="catalog-search" className="sr-only">Search Catalogs</Label>
        <Input
          id="catalog-search"
          type="search"
          placeholder="Search catalogs by name..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full"
        />
      </div>
      {/* Conditional Rendering */}
      {noResultsAfterLoad ? (
         <div className="text-center text-gray-600 mt-10">
            {searchTerm
                ? <p>No catalogs found matching "{searchTerm}".</p>
                : <p>No catalogs found.</p> // Message if empty even without search
            }
         </div>
      ) : (
        <>
          {/* Catalog Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-7xl mb-8">
            {currentCatalogs.map((catalog, index) => (
              // --- Update Link href to include search term ---
              <Link
                key={catalog.name}
                href={`/catalog/${encodeURIComponent(catalog.name)}?fromPage=${currentPage}${searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ''}`}
                className="block border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                {/* Card Content */}
                <div>
                  <h2 className="text-lg font-semibold p-3 truncate text-center bg-gray-50 border-b">{catalog.name}</h2>
                  <div className="flex justify-center items-center space-x-1 h-32 p-2">
                    {/* Images */}
                    <div className="relative w-1/3 h-full">
                  <Image
                    src={catalog.list[0].src}
                    alt={catalog.list[0].name} // Use image name for alt
                    fill
                    sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw"
                    className="rounded-md object-cover"
                    priority={index < ITEMS_PER_PAGE / 2}
                    loading={index < ITEMS_PER_PAGE / 2 ? 'eager' : 'lazy'}
                  />
                    </div>
                {/* Middle Image */}
                {catalog.list.length >= 3 && (
                  <div className="relative w-1/3 h-full">
                    <Image
                      src={catalog.list[Math.floor(catalog.list.length / 2)].src}
                      alt={`${catalog.name} - Middle Preview`} // More descriptive alt
                      fill
                      sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw"
                      className="rounded-md object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                {/* Last Image */}
                {catalog.list.length >= 2 && (
                  <div className="relative w-1/3 h-full">
                    <Image
                      src={catalog.list[catalog.list.length - 1].src}
                      alt={`${catalog.name} - Last Preview`} // More descriptive alt
                      fill
                      sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 10vw"
                      className="rounded-md object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                    {/* Placeholders */}
                {catalog.list.length < 3 && <div className="w-1/3 h-full bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-xs"></div>}
                {catalog.list.length < 2 && <div className="w-1/3 h-full bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-xs"></div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <nav aria-label="Catalog Page navigation">
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
                aria-label="Previous Catalog Page"
              >
                Prev {/* Or use an SVG icon */}
              </button>
                </li>
                {/* Page Number Buttons */}
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
                                className="px-3 py-2 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 rounded-md"
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
                    disabled={currentPage === pageNumber}
                    className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                      currentPage === pageNumber
                        ? 'bg-blue-500 text-white border border-blue-500 cursor-default'
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
                disabled={currentPage === totalPages}
                 className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${
                  currentPage === totalPages
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

export default MainPageClient; // Export the new component
