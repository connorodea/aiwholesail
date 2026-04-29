import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kanban, Loader2 } from 'lucide-react';
import { Property } from '@/types/zillow';
import { leads } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AddToPipelineButtonProps {
  property: Property;
  variant?: 'icon' | 'full';
  size?: 'sm' | 'default';
}

export function AddToPipelineButton({ property, variant = 'icon', size = 'sm' }: AddToPipelineButtonProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const propertyId = property.zpid || property.id || String(Date.now());
      const response = await leads.create(propertyId, property);
      if (response.error) {
        if (response.error.includes('already exists') || response.error.includes('duplicate')) {
          toast.info('Already in your pipeline');
          return;
        }
        throw new Error(response.error);
      }
      toast.success('Added to pipeline');
    } catch {
      toast.error('Failed to add to pipeline');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleAdd}
        disabled={loading}
        title="Add to Pipeline"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Kanban className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleAdd}
      disabled={loading}
      className="gap-2 hover:bg-muted rounded-xl border-border/50 transition-all duration-300 hover:shadow-md"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Kanban className="h-4 w-4" />
      )}
      Add to Pipeline
    </Button>
  );
}
