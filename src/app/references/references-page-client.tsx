// src/app/references/references-page-client.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link'; // Keep Link for internal navigation like Favorites
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePagination, DOTS } from '@/hooks/usePagination';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ImageModal from '@/components/ImageModal'; // Import ImageModal
import { getToken, removeToken } from "@/lib/auth";
import apiClient from '@/lib/apiClient';
import { Search, Heart, FileText, FolderOpen } from 'lucide-react'; // Import Search, Heart, FileText, FolderOpen icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";



// --- Interfaces based on the OpenAPI spec for /reference-files ---
interface ApiReferenceFile {
  id: number;
  name: string;
  src: string;
  thumbnail: string | null;
  directory: string;
  size_bytes?: number | null; // Optional as per spec
  mime_type?: string | null;  // Optional as per spec
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
}

interface ApiReferenceFilesResponseData {
  files: ApiReferenceFile[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  directoryFilter: string | null;
  searchQuery: string | null;
}
// --- End Interfaces ---

// --- Constants ---
const envItemsPerPage = process.env.NEXT_PUBLIC_REFERENCES_FILES_PER_PAGE;
const parsedItemsPerPage = parseInt(envItemsPerPage || '', 10);
const FILES_PER_PAGE = !isNaN(parsedItemsPerPage) && parsedItemsPerPage > 0
    ? parsedItemsPerPage
    : 20; // Default to 20 as per API spec example, or choose another default

const SIBLING_COUNT = 2; // For pagination display (can be adjusted)
// --- End Constants ---


// --- Modal Detail Interface ---
interface ModalFileDetails {
  src: string;
  thumbnail: string | null;
  id: number; // reference_file_id
  is_favorite: boolean;
  name: string;
}


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

const ReferencesPageClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // --- State ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentReferenceFiles, setCurrentReferenceFiles] = useState<ApiReferenceFile[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(0);
  const [lastUsedSearchQuery, setLastUsedSearchQuery] = useState<string | null>(null);
  const [lastUsedDirectoryFilter, setLastUsedDirectoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => getInitialPage(searchParams));
  const [searchInput, setSearchInput] = useState(() => getInitialSearchTerm(searchParams));
  const [activeSearchQuery, setActiveSearchQuery] = useState(() => getInitialSearchTerm(searchParams));
  const isInitialLoad = useRef(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
 // Modal State
  const [selectedFileGlobalIndex, setSelectedFileGlobalIndex] = useState<number | null>(null);
  const [modalFileDetails, setModalFileDetails] = useState<ModalFileDetails | null>(null);

  // --- Effect to Check Initial Login Status ---
  useEffect(() => {
    const checkAuthStatus = async () => {
        const token = getToken();
        if (!token) {
            setIsLoggedIn(false);
            return;
        }
        try {
            await apiClient('/check', { method: 'GET' }, true);
            setIsLoggedIn(true);
        } catch (error: any) {
            console.error("Auth check failed:", error);
            setIsLoggedIn(false);
            if (error?.status === 401) removeToken();
        }
    };
    checkAuthStatus();
  }, []);

  // --- Effect to Fetch Reference Files from API ---
  useEffect(() => {
    // Wait for login status to be determined before fetching,
    // as 'is_favorite' depends on authentication.
    if (isLoggedIn === null) {
        // setLoading(true); // Optional: ensure loading is true while waiting for auth
        return;
    }

    const fetchReferenceFiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
            page: currentPage.toString(),
            size: FILES_PER_PAGE.toString(),
        });

        const currentSearchTerm = activeSearchQuery.trim();
        if (currentSearchTerm) {
          queryParams.set('search', currentSearchTerm);
        }

        // Pass isLoggedIn to apiClient for potentially authenticated requests
        const result = await apiClient<{ data: ApiReferenceFilesResponseData }>(
            `/reference-files?${queryParams.toString()}`,
            { method: 'GET' },
            isLoggedIn // Send auth token if logged in, for 'is_favorite'
        );

        if (result?.data) {
            setCurrentReferenceFiles(result.data.files || []);
            setTotalItems(result.data.total || 0);
            setApiTotalPages(result.data.totalPages || 0);
            setLastUsedSearchQuery(result.data.searchQuery || null);
            setLastUsedDirectoryFilter(result.data.directoryFilter || null);

            if (result.data.totalPages > 0 && currentPage > result.data.totalPages) {
                setCurrentPage(result.data.totalPages);
            } else if (result.data.totalPages === 0 && currentPage !== 1) {
                setCurrentPage(1);
            }
        } else {
            throw new Error("Received invalid data structure from API.");
        }
      } catch (e: any) {
        console.error("Failed to fetch reference files:", e);
        setError(e.message || "Failed to load reference files.");
        setCurrentReferenceFiles([]);
        setTotalItems(0);
        setApiTotalPages(0);
        setLastUsedSearchQuery(activeSearchQuery.trim() || null);
      } finally {
        setLoading(false);
      }
    };

    fetchReferenceFiles();
  }, [currentPage, activeSearchQuery, isLoggedIn]); // Refetch if isLoggedIn changes for is_favorite field

  // --- Calculate start index for the current page ---
  const fileStartIndex = useMemo(() => (currentPage - 1) * FILES_PER_PAGE, [currentPage]);
  const totalPages = apiTotalPages; // Moved here


  // --- Effect to Sync Grid Page with Modal Navigation ---
  useEffect(() => {
    if (selectedFileGlobalIndex !== null && totalItems > 0 && totalPages > 0) {
      const pageForSelectedIndex = Math.floor(selectedFileGlobalIndex / FILES_PER_PAGE) + 1;
      if (pageForSelectedIndex !== currentPage) {
        const validPage = Math.max(1, Math.min(pageForSelectedIndex, totalPages));
        if (validPage !== currentPage) {
            setCurrentPage(validPage);
        }
      }
    }
  }, [selectedFileGlobalIndex, currentPage, totalPages, totalItems]);

  // --- Effect to update modal file details when selected file or relevant data changes ---
  useEffect(() => {
    if (selectedFileGlobalIndex === null) {
      setModalFileDetails(null);
      return;
    }

    const pageOfSelectedFile = Math.floor(selectedFileGlobalIndex / FILES_PER_PAGE) + 1;
    const indexOnPageOfSelectedFile = selectedFileGlobalIndex % FILES_PER_PAGE;

    if (pageOfSelectedFile === currentPage && currentReferenceFiles && indexOnPageOfSelectedFile < currentReferenceFiles.length) {
      const file = currentReferenceFiles[indexOnPageOfSelectedFile];
      if (file && file.src) {
        setModalFileDetails({ src: file.src, thumbnail: file.thumbnail, id: file.id, is_favorite: file.is_favorite, name: file.name });
      }
    }
    // If the file is not on the currently loaded page, modalFileDetails retains its previous value while new page loads.
  }, [selectedFileGlobalIndex, currentReferenceFiles, currentPage]);

  // --- Pagination Logic ---

  // --- Effect to Update URL on Page/Search Change ---
  useEffect(() => {
    if (isInitialLoad.current) {
      if (!loading) isInitialLoad.current = false;
      return;
    }
    if (!loading && !isLoggingOut) {
        const queryParams = new URLSearchParams();
        if (currentPage > 1) queryParams.set('page', currentPage.toString());
        const currentSearchTerm = activeSearchQuery.trim();
        if (currentSearchTerm) queryParams.set('q', currentSearchTerm);

        const queryString = queryParams.toString();
        const newPath = `/references${queryString ? `?${queryString}` : ''}`; // Updated path
        const currentPath = window.location.pathname + window.location.search;

        if (newPath !== currentPath) {
            router.replace(newPath, { scroll: false });
        }
    }
  }, [currentPage, activeSearchQuery, loading, isLoggingOut, router]);

  const paginationRange = usePagination({
    currentPage,
    totalCount: totalItems,
    siblingCount: SIBLING_COUNT,
    pageSize: FILES_PER_PAGE,
  });

  // --- Event Handlers ---
  const handlePreviousPage = useCallback(() => setCurrentPage((prev) => Math.max(prev - 1, 1)), []);
  const handleNextPage = useCallback(() => setCurrentPage((prev) => Math.min(prev + 1, totalPages)), [totalPages]);

  const handlePageChange = useCallback((pageNumber: number | string) => {
     if (typeof pageNumber === 'number') {
        setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
     } else if (pageNumber === DOTS) {
        const currentIndex = paginationRange.findIndex(p => p === DOTS);
        let prevNumeric = 1, nextNumeric = totalPages;
        for(let i = currentIndex - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
        for(let i = currentIndex + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
        const targetPage = Math.round((prevNumeric + nextNumeric) / 2);
        if (targetPage > 0 && targetPage <= totalPages && targetPage !== prevNumeric && targetPage !== nextNumeric) {
             setCurrentPage(targetPage);
        }
     }
  }, [paginationRange, totalPages]);

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value);

  const handleSearchSubmit = useCallback((event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const newQuery = searchInput.trim();
    if (newQuery !== activeSearchQuery) {
      setActiveSearchQuery(newQuery);
      setCurrentPage(1);
    }
  }, [searchInput, activeSearchQuery]);

  // --- Modal Event Handlers ---
  const handleFileClick = (indexOnPage: number) => {
    const globalIndex = fileStartIndex + indexOnPage;
    setSelectedFileGlobalIndex(globalIndex);
  };

  const handleCloseModal = () => setSelectedFileGlobalIndex(null);

  const handleModalPrevious = () => {
    setSelectedFileGlobalIndex(prevIndex => (prevIndex === null || prevIndex === 0 ? 0 : prevIndex - 1));
  };

  const handleModalNext = () => {
    setSelectedFileGlobalIndex(prevIndex => (prevIndex === null || prevIndex >= totalItems - 1 ? Math.max(0, totalItems - 1) : prevIndex + 1));
  };

  const handleFavoriteStatusChangeInModal = useCallback((changedFileSrc: string, isNowFavorite: boolean) => {
    setCurrentReferenceFiles(prevFiles =>
        prevFiles.map(file =>
            file.src === changedFileSrc ? { ...file, is_favorite: isNowFavorite } : file
        )
    );
    if (modalFileDetails && modalFileDetails.src === changedFileSrc) {
        setModalFileDetails(prev => prev ? {...prev, is_favorite: isNowFavorite} : null);
    }
  }, [modalFileDetails]);

  // --- Effect for Grid Arrow Key Navigation ---

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedFileGlobalIndex !== null) return; // Ignore if modal is open
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || isLoggingOut || loading)) return;
      if (event.key === 'ArrowLeft' && currentPage > 1) handlePreviousPage();
      else if (event.key === 'ArrowRight' && currentPage < totalPages) handleNextPage();
    };
    if (totalPages > 1) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, handlePreviousPage, handleNextPage, isLoggingOut, loading, selectedFileGlobalIndex]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // ... (logout logic identical to main-page-client.tsx, can be refactored into a hook/util)
    const token = getToken();
    if (!token) {
      toast({ variant: "destructive", title: "Error", description: "You are not logged in." });
      setIsLoggedIn(false); setIsLoggingOut(false); return;
    }
    try {
        const result = await apiClient<{ data?: string }>('/log-out', { method: 'POST' }, true);
        toast({ title: "Logged Out", description: result?.data || "You have been successfully logged out." });
        removeToken(); setIsLoggedIn(false);
    } catch (error: any) {
        let errorMessage = "Logout failed.";
        if (error?.responseBody?.status?.message) errorMessage = error.responseBody.status.message;
        else if (error?.status === 401) { errorMessage = "Session already expired or invalid."; removeToken(); setIsLoggedIn(false); }
        toast({ variant: "destructive", title: "Logout Failed", description: errorMessage });
    } finally {
        setIsLoggingOut(false);
    }
  };
  // --- Props for Modal ---
  const hasPreviousFileInModal = selectedFileGlobalIndex !== null && selectedFileGlobalIndex > 0;
  const hasNextFileInModal = selectedFileGlobalIndex !== null && selectedFileGlobalIndex < totalItems - 1;


  // --- Render Logic ---
  if (loading && isInitialLoad.current) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading Reference Files...</main>;
  }
  if (error && !loading) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Error: {error}</main>;
  }

  const noResultsAfterLoad = !loading && totalItems === 0;
  const noSearchResults = noResultsAfterLoad && !!lastUsedSearchQuery;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12 sm:p-12 md:p-6">
      <div className="w-full max-w-7xl flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Reference Files</h1>
        <div className="flex items-center space-x-2">
          {isLoggedIn === true && (
            <Button variant="outline" onClick={() => router.push('/favorites')} disabled={isLoggingOut || loading}>Favorites</Button>
          )}
          {/* Image Catalogs Button */}
            <Button
                variant="outline"
                onClick={() => router.push('/main')}
                disabled={isLoggingOut || loading}
                >
                Image Catalogs
            </Button>
          {isLoggedIn === null ? <Button variant="outline" disabled>...</Button>
            : isLoggedIn ? <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut || loading}>{isLoggingOut ? "Logging Out..." : "Log Out"}</Button>
            : <Button variant="outline" onClick={() => router.push('/')} disabled={isLoggingOut || loading}>Log In</Button>
          }
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="w-full max-w-lg mb-8 flex items-center space-x-2">
        <Label htmlFor="file-search" className="sr-only">Search Files</Label>
        <Input id="file-search" type="search" placeholder="Search files by name..." value={searchInput} onChange={handleSearchInputChange} className="flex-grow" disabled={isLoggingOut || loading} />
        <Button type="submit" disabled={isLoggingOut || loading} aria-label="Submit search"><Search className="h-4 w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Search</span></Button>
      </form>

      {loading && !isInitialLoad.current && <div className="text-center text-gray-600 mt-10">Loading results...</div>}
      {noResultsAfterLoad && !loading ? (
        <div className="text-center text-gray-600 mt-10">
          {noSearchResults ? <p>No files found matching &quot;{lastUsedSearchQuery}&quot;.</p> : <p>No reference files found.</p>}
          {lastUsedDirectoryFilter && <p className="text-sm">In directory: {lastUsedDirectoryFilter}</p>}
        </div>
      ) : !loading && currentReferenceFiles.length > 0 ? (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full max-w-7xl mb-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {currentReferenceFiles.map((file, index) => (
              <button
                key={file.id}
                onClick={() => handleFileClick(index)}
                className="text-left block border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 group disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || isLoggingOut}
                aria-label={`View file ${file.name}${file.is_favorite ? ' (Favorite)' : ''}`}
              >

                <div className="relative aspect-[4/3]"> {/* Aspect ratio for thumbnail area */}
                  {file.thumbnail ? (
                    <Image src={file.thumbnail} alt={`Thumbnail for ${file.name}`} fill sizes="(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 20vw" className="object-cover group-hover:scale-105 transition-transform" priority={index < FILES_PER_PAGE / 2} loading={index < FILES_PER_PAGE / 2 ? 'eager' : 'lazy'} />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <FileText className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  {file.is_favorite && (
                    <div className="absolute top-1.5 right-1.5 z-10 p-0.5 bg-black bg-opacity-40 rounded-full">
                        <Heart className="h-4 w-4 text-red-500 fill-current" />
                    </div>
                  )}
                </div>
                {/* Modified p-3 div for inline layout of text and button */}
                <div className="p-3 flex items-center justify-between space-x-2">
                  <div className="flex-grow min-w-0"> {/* Wrapper for text content to allow truncation */}
                    <h3 className="font-semibold text-sm truncate group-hover:text-blue-600" title={file.name}>{file.name}</h3>
                    <p className="text-xs text-gray-500 truncate" title={file.directory}>{file.directory}</p>
                  </div>

                  {/* Icon Button to Open Catalog with Tooltip */}
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger
                        asChild
                        onClick={(e) => {
                          // Stop propagation to prevent the main card's onClick (modal trigger)
                          e.stopPropagation();
                          // If the button/link is disabled, prevent default action (navigation)
                          if (loading || isLoggingOut) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <Button
                          asChild
                          variant="ghost" // Use ghost for a less obtrusive icon button
                          size="icon"    // Use icon size
                          disabled={loading || isLoggingOut}
                          aria-label={`Open catalog: ${file.directory}`}
                          className="flex-shrink-0" // Prevent button from shrinking text
                        >
                          <Link href={`/catalog?catalog=${encodeURIComponent(file.directory)}&fromPage=1`}>
                            <FolderOpen className="h-4 w-4" /> {/* Adjusted icon size if needed */}
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" onClick={(e) => e.stopPropagation()}> {/* Stop propagation on tooltip click too */}
                        <p>View Catalog: {file.directory}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Reference file page navigation">
              <ul className="flex items-center justify-center space-x-1 mt-8">
                <li><button onClick={handlePreviousPage} disabled={currentPage === 1 || isLoggingOut || loading} className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${currentPage === 1 || isLoggingOut || loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'}`} aria-label="Previous Page">Prev</button></li>
                {paginationRange.map((pageNumber, idx) => {
                  if (pageNumber === DOTS) {
                    let prevNumeric = 1, nextNumeric = totalPages;
                    for(let i = idx - 1; i >= 0; i--) { if(typeof paginationRange[i] === 'number') { prevNumeric = paginationRange[i] as number; break; } }
                    for(let i = idx + 1; i < paginationRange.length; i++) { if(typeof paginationRange[i] === 'number') { nextNumeric = paginationRange[i] as number; break; } }
                    const targetPage = Math.round((prevNumeric + nextNumeric) / 2);
                    if (targetPage > 0 && targetPage <= totalPages && targetPage !== prevNumeric && targetPage !== nextNumeric) {
                        return <li key={`${DOTS}-${idx}`}><button onClick={() => handlePageChange(targetPage)} disabled={isLoggingOut || loading} className={`px-3 py-2 leading-tight rounded-md ${ isLoggingOut || loading ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700'}`} aria-label={`Jump towards page ${targetPage}`}>{DOTS}</button></li>;
                    } return null;
                  }
                  return <li key={pageNumber}><button onClick={() => handlePageChange(pageNumber)} disabled={currentPage === pageNumber || isLoggingOut || loading} className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${currentPage === pageNumber ? 'bg-blue-500 text-white border border-blue-500 cursor-default' + (isLoggingOut || loading ? ' opacity-50' : '') : isLoggingOut || loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'}`} aria-current={currentPage === pageNumber ? 'page' : undefined} aria-label={`Page ${pageNumber}`}>{pageNumber}</button></li>;
                })}
                <li><button onClick={handleNextPage} disabled={currentPage === totalPages || isLoggingOut || loading} className={`px-3 py-2 leading-tight rounded-md transition-colors duration-150 ${currentPage === totalPages || isLoggingOut || loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-300'}`} aria-label="Next Page">Next</button></li>
              </ul>
            </nav>
          )}
        </>
      ) : null}
      
      <ImageModal
        currentImageUrl={modalFileDetails?.src || null}
        currentReferenceFileId={modalFileDetails?.id}
        currentImageThumbnailUrl={modalFileDetails?.thumbnail || null} // Pass thumbnail, ImageModal can handle if it's null
        onClose={handleCloseModal}
        onPrevious={handleModalPrevious}
        onNext={handleModalNext}
        hasPrevious={hasPreviousFileInModal}
        hasNext={hasNextFileInModal}
        isLoggedIn={isLoggedIn}
        initialIsFavorite={modalFileDetails?.is_favorite}
        onFavoriteStatusChange={handleFavoriteStatusChangeInModal}
        // fileName={modalFileDetails?.name} // Optional: if ImageModal supports displaying the name
      />
    </main>
  );
};

export default ReferencesPageClient;