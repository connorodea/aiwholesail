import { useState } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';
import { ChatAssistant } from '@/components/ChatAssistant';
import { useFavorites } from '@/hooks/useFavorites';
import { Property } from '@/types/zillow';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Favorites() {
  const { favorites } = useFavorites();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Your Favorites</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            Properties you've saved for later review
          </p>
        </section>

        {favorites.length > 0 ? (
          <div className="property-grid animate-fade-in">
            {favorites.map((property, index) => (
              <div
                key={property.id}
                className="animate-fade-in hover-scale"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PropertyCard
                  property={property}
                  onViewDetails={() => setSelectedProperty(property)}
                  highlightWholesaleDeals={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto animate-scale-in">
            <div className="feature-card p-10 text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Heart className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-3 tracking-tight">No favorites yet</h3>
              <p className="text-muted-foreground mb-8 font-light leading-relaxed">
                Start exploring properties and save the ones you like
              </p>
              <Button
                onClick={() => navigate('/app')}
                size="sm"
                className="h-10 px-6 text-sm font-medium smooth-transition"
              >
                Browse Properties
              </Button>
            </div>
          </div>
        )}
      </main>

      <PropertyModal
        property={selectedProperty}
        isOpen={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
      <ChatAssistant />
    </div>
  );
}
