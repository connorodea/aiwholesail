import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Send, Phone, Mail, Star } from 'lucide-react';
import { Property } from '@/types/zillow';
import { BuyerMatch } from '@/types/buyer';
import { buyers as buyersApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface BuyerMatchPanelProps {
  property: Property;
}

function mapMatch(raw: any): BuyerMatch {
  return {
    buyer: {
      id: raw.buyer?.id || '',
      userId: raw.buyer?.user_id || '',
      firstName: raw.buyer?.first_name || '',
      lastName: raw.buyer?.last_name || '',
      company: raw.buyer?.company || null,
      email: raw.buyer?.email || null,
      phone: raw.buyer?.phone || null,
      criteria: raw.buyer?.criteria || {},
      tags: raw.buyer?.tags || [],
      notes: raw.buyer?.notes || null,
      dealCount: raw.buyer?.deal_count || 0,
      lastContactedAt: raw.buyer?.last_contacted_at || null,
      createdAt: raw.buyer?.created_at || '',
      updatedAt: raw.buyer?.updated_at || '',
    },
    matchScore: raw.matchScore || raw.match_score || 0,
    matchReasons: raw.matchReasons || raw.match_reasons || [],
  };
}

export function BuyerMatchPanel({ property }: BuyerMatchPanelProps) {
  const [matches, setMatches] = useState<BuyerMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    buyersApi.match(property).then(response => {
      if (cancelled) return;
      if (response.error) {
        setMatches([]);
      } else {
        const data = response.data as any;
        const list = data?.matches || [];
        setMatches(list.map(mapMatch));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [property.id, property.zpid]);

  const handleOutreach = async (match: BuyerMatch) => {
    try {
      await buyersApi.outreach(match.buyer.id, property, ['email', 'sms']);
      toast.success(`Deal sent to ${match.buyer.firstName}`);
    } catch {
      toast.error('Failed to send deal');
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-500 text-white';
    if (score >= 40) return 'bg-yellow-500 text-white';
    return 'bg-orange-500 text-white';
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No matching buyers found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add buyers with matching criteria to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="text-sm font-medium flex items-center gap-2">
        <Star className="h-4 w-4 text-primary" />
        {matches.length} matching buyer{matches.length !== 1 ? 's' : ''}
      </div>

      {matches.map(match => (
        <div
          key={match.buyer.id}
          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
        >
          <Badge className={`${scoreColor(match.matchScore)} text-xs shrink-0`}>
            {match.matchScore}%
          </Badge>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">
              {match.buyer.firstName} {match.buyer.lastName}
              {match.buyer.company && (
                <span className="text-muted-foreground font-normal"> - {match.buyer.company}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {match.matchReasons.slice(0, 3).map((reason, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {match.buyer.phone && (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <a href={`tel:${match.buyer.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {match.buyer.email && (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <a href={`mailto:${match.buyer.email}`}>
                  <Mail className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOutreach(match)}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
