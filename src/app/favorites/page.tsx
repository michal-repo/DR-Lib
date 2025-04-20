// src/app/favorites/page.tsx
import { Suspense } from 'react';
import FavoritesPageClient from './favorites-page-client'; // Import the client component

function LoadingFallback() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            Loading Favorites...
        </main>
    );
}

export default function FavoritesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FavoritesPageClient />
    </Suspense>
  );
}
