// src/app/favorites/favorites-page-client.tsx
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import ImageModal from '@/components/ImageModal'; // Re-use the modal
import { getToken, removeToken } from "@/lib/auth";
import apiClient from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

// Define the structure of a favorite item from the API
interface FavoriteItem {
  id: number;
  file: string; // This is the image src
  created_at: string;
}

// Constants for layout (adjust as needed)
const IMAGES_PER_PAGE = 18; // Example, maybe favorites don't need pagination initially

const FavoritesPageClient = () => {
  const router = useRouter();
  const { toast } = useToast();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [favoritesList, setFavoritesList] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

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

        // If logged in, fetch favorites
        try {
          const result = await apiClient<{ data: FavoriteItem[] }>('/favorites', { method: 'GET' }, true);
          setFavoritesList(result.data || []); // Set the fetched list
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
  }, [router]); // Dependency on router for redirection

  // --- Modal Event Handlers ---
  const handleImageClick = (indexInList: number) => setSelectedImageIndex(indexInList);
  const handleCloseModal = () => setSelectedImageIndex(null);

  const handleModalPrevious = () => {
    setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex === 0 ? prevIndex : prevIndex - 1));
  };

  const handleModalNext = () => {
    setSelectedImageIndex(prevIndex => (prevIndex === null || prevIndex >= favoritesList.length - 1 ? prevIndex : prevIndex + 1));
  };

  // --- Callback for Modal Favorite Status Change ---
  // This updates the UI immediately when an item is removed via the modal
  const handleFavoriteStatusChange = useCallback((imageUrl: string, isNowFavorite: boolean) => {
    if (!isNowFavorite) {
      // If an item was removed (isNowFavorite is false), filter it out of the local state
      setFavoritesList(prevList => prevList.filter(item => item.file !== imageUrl));
      // Close modal if the currently viewed image was removed
      if (selectedImageIndex !== null && favoritesList[selectedImageIndex]?.file === imageUrl) {
          handleCloseModal();
      }
      toast({ title: "Removed", description: "Favorite removed from this view." }); // Optional feedback
    }
    // Note: If adding favorites was possible from this page (it's not currently),
    // you might need to refetch or add the item back to the list here.
  }, [selectedImageIndex, favoritesList]); // Include dependencies

  // --- Calculate Props for Modal ---
  const currentImageUrlForModal = selectedImageIndex !== null ? favoritesList[selectedImageIndex]?.file : null;
  const hasPreviousImage = selectedImageIndex !== null && selectedImageIndex > 0;
  const hasNextImage = selectedImageIndex !== null && selectedImageIndex < favoritesList.length - 1;

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

        {/* Favorites Grid */}
        {favoritesList.length === 0 ? (
            <p className="text-gray-600">You haven't added any favorites yet.</p>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full max-w-7xl mb-8">
            {favoritesList.map((item, index) => {
                // Try to extract a name from the file path for alt text
                const imageName = item.file.split('/').pop() || `Favorite ${item.id}`;
                return (
                <button
                    key={item.id}
                    onClick={() => handleImageClick(index)}
                    className="relative aspect-square border rounded-md overflow-hidden shadow-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 transition-shadow duration-150 group"
                    aria-label={`View favorite ${imageName}`}
                >
                    <Image
                    src={item.file} // Use the 'file' property as src
                    alt={imageName}
                    fill
                    sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 20vw, 15vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-150"
                    loading="lazy"
                    />
                    {/* Optional: Show name on hover */}
                    {/* <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {imageName}
                    </div> */}
                </button>
                );
            })}
            </div>
        )}
        {/* No pagination for favorites initially, add if needed */}
      </main>

      {/* --- Render Modal --- */}
       <ImageModal
        currentImageUrl={currentImageUrlForModal}
        onClose={handleCloseModal}
        onPrevious={handleModalPrevious}
        onNext={handleModalNext}
        hasPrevious={hasPreviousImage}
        hasNext={hasNextImage}
        isLoggedIn={isLoggedIn} // Pass login status
        onFavoriteStatusChange={handleFavoriteStatusChange} // Pass the callback
      />
    </>
  );
};

export default FavoritesPageClient;
