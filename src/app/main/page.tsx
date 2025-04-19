"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface ImageItem {
  name: string;
  src: string;
}

interface ImageCatalog {
  name: string;
  list: ImageItem[];
}

interface ImageData {
  images: ImageCatalog[];
}

const IMAGE_DATA_URL = 'http://192.168.1.1/images.json'; // Replace with your actual URL

const MainPage = () => {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImageData = async () => {
      try {
        const response = await fetch(IMAGE_DATA_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: ImageData = await response.json();
        setImageData(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchImageData();
  }, []);

  if (loading) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading...</main>;
  }

  if (error) {
    return <main className="flex min-h-screen flex-col items-center justify-center p-24">Error: {error}</main>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">Image Catalogs</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {imageData?.images.map((catalog) => (
          <div key={catalog.name} className="border rounded-md p-4">
            <h2 className="text-xl font-semibold mb-2">{catalog.name}</h2>
            <div className="flex justify-center">
              {catalog.list.length >= 1 && (
                <Image
                  src={catalog.list[0].src}
                  alt={catalog.list[0].name}
                  width={100}
                  height={100}
                  className="mr-1 rounded-md object-cover"
                />
              )}
              {catalog.list.length >= 3 && (
                <Image
                  src={catalog.list[Math.floor(catalog.list.length / 2)].src}
                  alt="Middle Image"
                  width={100}
                  height={100}
                  className="mr-1 rounded-md object-cover"
                />
              )}
              {catalog.list.length >= 2 && (
                <Image
                  src={catalog.list[catalog.list.length - 1].src}
                  alt="Last Image"
                  width={100}
                  height={100}
                  className="rounded-md object-cover"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default MainPage;
