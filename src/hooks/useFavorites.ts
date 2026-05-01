import { useState, useEffect } from 'react';
import { favorites as favoritesApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Property } from '@/types/zillow';
import { toast } from 'sonner';
import { zillowAPI } from '@/lib/zillow-api';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchFavorites = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await favoritesApi.list();

      if (response.error) throw new Error(response.error);

      const favoriteProperties = (response.data as any)?.favorites?.map((fav: any) => {
        const propertyData = fav.property_data as Property;
        return {
          ...propertyData,
          favoriteId: fav.id
        };
      }) || [];

      setFavorites(favoriteProperties);

      // Enrich any favorites missing zestimates (so spread doesn't show "Calculating...")
      const needsZestimate = favoriteProperties.filter((p: Property) => p.price && !p.zestimate && p.zpid);
      if (needsZestimate.length > 0) {
        try {
          const enriched = await zillowAPI.enrichWithZestimates(needsZestimate);
          setFavorites(prev => prev.map(fav => {
            const match = enriched.find((e: Property) => e.id === fav.id || e.zpid === fav.zpid);
            if (match?.zestimate) {
              // Update the favorite in the DB with the zestimate
              favoritesApi.add(fav.id, { ...fav, zestimate: match.zestimate }).catch(() => {});
              return { ...fav, zestimate: match.zestimate };
            }
            if (match && !match.zestimate) {
              return { ...fav, zestimateUnavailable: true } as any;
            }
            return fav;
          }));
        } catch {
          // Mark all as unavailable so they stop showing "Calculating..."
          setFavorites(prev => prev.map(fav =>
            !fav.zestimate ? { ...fav, zestimateUnavailable: true } as any : fav
          ));
        }
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (property: Property) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return false;
    }

    try {
      const response = await favoritesApi.add(property.id, property);

      if (response.error) {
        if (response.error.includes('already')) {
          toast.error('Property is already in your favorites');
          return false;
        }
        throw new Error(response.error);
      }

      setFavorites(prev => [{ ...property, favoriteId: (response.data as any)?.id }, ...prev]);
      toast.success('Added to favorites');
      return true;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      toast.error('Failed to add to favorites');
      return false;
    }
  };

  const removeFromFavorites = async (propertyId: string) => {
    if (!user) return false;

    try {
      const response = await favoritesApi.removeByPropertyId(propertyId);

      if (response.error) throw new Error(response.error);

      setFavorites(prev => prev.filter(fav => fav.id !== propertyId));
      toast.success('Removed from favorites');
      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      toast.error('Failed to remove from favorites');
      return false;
    }
  };

  const isFavorite = (propertyId: string) => {
    return favorites.some(fav => fav.id === propertyId);
  };

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  return {
    favorites,
    loading,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    fetchFavorites
  };
}
