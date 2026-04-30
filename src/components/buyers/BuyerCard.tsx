import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { User, Phone, Mail, Building2, MapPin, MoreVertical, Pencil, Trash2, Send } from 'lucide-react';
import { Buyer } from '@/types/buyer';

interface BuyerCardProps {
  buyer: Buyer;
  onEdit: (buyer: Buyer) => void;
  onDelete: (buyerId: string) => void;
  onOutreach: (buyer: Buyer) => void;
}

export function BuyerCard({ buyer, onEdit, onDelete, onOutreach }: BuyerCardProps) {
  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    return `$${(price / 1000).toFixed(0)}K`;
  };

  const criteriaText = [
    buyer.criteria.propertyTypes?.length ? buyer.criteria.propertyTypes.join(', ') : null,
    buyer.criteria.minPrice || buyer.criteria.maxPrice
      ? `${buyer.criteria.minPrice ? formatPrice(buyer.criteria.minPrice) : '$0'} - ${buyer.criteria.maxPrice ? formatPrice(buyer.criteria.maxPrice) : 'No max'}`
      : null,
    buyer.criteria.locations?.length ? buyer.criteria.locations.slice(0, 2).join(', ') : null,
  ].filter(Boolean);

  return (
    <Card className="hover:shadow-md transition-all duration-200 border-border/50">
      <CardContent className="p-4 space-y-3">
        {/* Header: Name + Actions */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-medium text-sm">
                  {buyer.firstName} {buyer.lastName}
                </div>
                {buyer.company && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {buyer.company}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(buyer)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOutreach(buyer)}>
                <Send className="mr-2 h-4 w-4" /> Send Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(buyer.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contact */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {buyer.phone && (
            <a href={`tel:${buyer.phone}`} className="flex items-center gap-1 hover:text-primary">
              <Phone className="h-3 w-3" /> {buyer.phone}
            </a>
          )}
          {buyer.email && (
            <a href={`mailto:${buyer.email}`} className="flex items-center gap-1 hover:text-primary">
              <Mail className="h-3 w-3" /> {buyer.email}
            </a>
          )}
        </div>

        {/* Tags */}
        {buyer.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {buyer.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Criteria Summary */}
        {criteriaText.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {criteriaText.map((text, i) => (
              <div key={i} className="flex items-center gap-1">
                {i === 2 ? <MapPin className="h-3 w-3 shrink-0" /> : null}
                <span className="truncate">{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Deal Count */}
        {buyer.dealCount > 0 && (
          <div className="text-xs font-medium text-primary">
            {buyer.dealCount} deal{buyer.dealCount !== 1 ? 's' : ''} closed
          </div>
        )}
      </CardContent>
    </Card>
  );
}
