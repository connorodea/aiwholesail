import React, { useState, useEffect } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Image,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  Download,
  Loader2,
  ImageOff,
  Grid3X3
} from 'lucide-react';
import { zillowAPI } from '@/lib/zillow-api';

interface PhotosGalleryProps {
  property: Property;
}

export function PhotosGallery({ property }: PhotosGalleryProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchPhotos = async () => {
      // First check if property already has images
      const existingImages = property.images || [];
      const imageUrl = (property as any).imageUrl || (property as any).imgSrc;

      if (existingImages.length > 0) {
        setPhotos(existingImages);
        setIsLoading(false);
        return;
      }

      // Try to fetch from API
      const zpid = property.zpid || property.id;
      if (!zpid) {
        if (imageUrl) {
          setPhotos([imageUrl]);
        }
        setIsLoading(false);
        return;
      }

      try {
        const data = await zillowAPI.getPropertyPhotos(zpid);

        if (data && Array.isArray(data)) {
          const photoUrls = data
            .map((photo: any) => photo.url || photo.href || photo.mixedSources?.jpeg?.[0]?.url || photo)
            .filter((url: any) => typeof url === 'string' && url.startsWith('http'));

          if (photoUrls.length > 0) {
            setPhotos(photoUrls);
          } else if (imageUrl) {
            setPhotos([imageUrl]);
          }
        } else if (data?.photos) {
          const photoUrls = data.photos
            .map((photo: any) => photo.url || photo.href || photo.mixedSources?.jpeg?.[0]?.url)
            .filter((url: any) => url);

          if (photoUrls.length > 0) {
            setPhotos(photoUrls);
          } else if (imageUrl) {
            setPhotos([imageUrl]);
          }
        } else if (imageUrl) {
          setPhotos([imageUrl]);
        }
      } catch (error) {
        console.error('Error fetching photos:', error);
        if (imageUrl) {
          setPhotos([imageUrl]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPhotos();
  }, [property]);

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
  };

  const handleImageError = (index: number) => {
    setFailedImages(prev => new Set([...prev, index]));
  };

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  const goToPrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === 0 ? photos.length - 1 : selectedIndex - 1);
    }
  };

  const goToNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === photos.length - 1 ? 0 : selectedIndex + 1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (selectedIndex === null) return;

    switch (e.key) {
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      case 'Escape':
        closeLightbox();
        break;
    }
  };

  useEffect(() => {
    if (selectedIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedIndex]);

  const validPhotos = photos.filter((_, index) => !failedImages.has(index));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading photos...</span>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageOff className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <p className="text-muted-foreground">No photos available for this property</p>
        <p className="text-sm text-muted-foreground mt-2">
          Check the listing on Zillow for more details
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.open(`https://www.zillow.com/homes/${encodeURIComponent(property.address)}_rb/`, '_blank')}
        >
          View on Zillow
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Photo Count Badge */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="flex items-center gap-2">
          <Grid3X3 className="h-3 w-3" />
          {validPhotos.length} Photos
        </Badge>
        <p className="text-sm text-muted-foreground">Click any photo to enlarge</p>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo, index) => {
          if (failedImages.has(index)) return null;

          return (
            <div
              key={index}
              className="relative aspect-[4/3] group cursor-pointer overflow-hidden rounded-lg border border-border bg-muted"
              onClick={() => openLightbox(index)}
            >
              {!loadedImages.has(index) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <img
                src={photo}
                alt={`Property photo ${index + 1}`}
                className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                  loadedImages.has(index) ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {index === 0 && (
                <Badge className="absolute top-2 left-2 bg-primary">Main Photo</Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Photo Counter */}
            <Badge className="absolute top-4 left-4 z-50 bg-black/50 text-white border-none">
              {selectedIndex !== null ? selectedIndex + 1 : 0} / {photos.length}
            </Badge>

            {/* Navigation Buttons */}
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Main Image */}
            {selectedIndex !== null && (
              <img
                src={photos[selectedIndex]}
                alt={`Property photo ${selectedIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            )}

            {/* Thumbnail Strip */}
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-lg max-w-[80vw] overflow-x-auto">
                {photos.slice(0, 10).map((photo, index) => {
                  if (failedImages.has(index)) return null;

                  return (
                    <div
                      key={index}
                      className={`flex-shrink-0 w-16 h-12 cursor-pointer rounded overflow-hidden border-2 transition-all ${
                        selectedIndex === index ? 'border-primary' : 'border-transparent hover:border-white/50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIndex(index);
                      }}
                    >
                      <img
                        src={photo}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })}
                {photos.length > 10 && (
                  <div className="flex-shrink-0 w-16 h-12 flex items-center justify-center bg-white/10 rounded text-white text-sm">
                    +{photos.length - 10}
                  </div>
                )}
              </div>
            )}

            {/* Download Button */}
            {selectedIndex !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute bottom-20 right-4 z-50 text-white hover:bg-white/20"
                onClick={() => {
                  window.open(photos[selectedIndex], '_blank');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Open Full Size
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
