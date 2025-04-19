// src/app/main/page.tsx
import { Suspense } from 'react';
import MainPageClient from './main-page-client'; // Import the new client component

// Optional: Define a specific loading component for the Suspense fallback
function LoadingFallback() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            Loading Page...
        </main>
    );
}

// This is now a Server Component (or can be)
export default function MainPage() {
  return (
    // Wrap the client component that uses searchParams in Suspense
    <Suspense fallback={<LoadingFallback />}>
      <MainPageClient />
    </Suspense>
  );
}
