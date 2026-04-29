import { useState, useEffect } from 'react';
import { favorites as favoritesApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Property } from '@/types/zillow';
import { toast } from 'sonner';

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
