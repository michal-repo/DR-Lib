// src/app/references/page.tsx
import { Suspense } from 'react';
import ReferencesPageClient from './references-page-client'; // Import the new client component

// Optional: Define a specific loading component for the Suspense fallback
function LoadingFallback() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            Loading Reference Files...
        </main>
    );
}

export default function ReferencesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReferencesPageClient />
    </Suspense>
  );
}