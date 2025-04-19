// src/app/catalog/page.tsx // <-- New file replacing the old one
import { Suspense } from 'react';
import CatalogPageClient from './catalog-page-client'; // Import the new client component

// Optional: Define a specific loading component for the Suspense fallback
function LoadingFallback() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            Loading Catalog Page...
        </main>
    );
}

// This is the actual page component for the /catalog route
export default function CatalogPage() {
  return (
    // Wrap the client component that uses searchParams in Suspense
    <Suspense fallback={<LoadingFallback />}>
      <CatalogPageClient />
    </Suspense>
  );
}
