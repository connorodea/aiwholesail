import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Loader2 } from 'lucide-react';
import {
  Buyer,
  BuyerCriteria,
  DEFAULT_BUYER_CRITERIA,
  REHAB_TOLERANCE_OPTIONS,
  COMMON_TAGS,
  PROPERTY_TYPE_OPTIONS,
} from '@/types/buyer';

interface AddBuyerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    firstName: string;
    lastName: string;
    company?: string;
    email?: string;
    phone?: string;
    criteria: BuyerCriteria;
    tags?: string[];
    notes?: string;
  }) => Promise<boolean>;
  editBuyer?: Buyer | null;
}

export function AddBuyerDialog({ isOpen, onClose, onSave, editBuyer }: AddBuyerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(editBuyer?.firstName || '');
  const [lastName, setLastName] = useState(editBuyer?.lastName || '');
  const [company, setCompany] = useState(editBuyer?.company || '');
  const [email, setEmail] = useState(editBuyer?.email || '');
  const [phone, setPhone] = useState(editBuyer?.phone || '');
  const [notes, setNotes] = useState(editBuyer?.notes || '');
  const [tags, setTags] = useState<string[]>(editBuyer?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [criteria, setCriteria] = useState<BuyerCriteria>(editBuyer?.criteria || { ...DEFAULT_BUYER_CRITERIA });
  const [locationInput, setLocationInput] = useState('');

  const handleOpen = (open: boolean) => {
    if (!open) onClose();
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const addLocation = () => {
    const loc = locationInput.trim();
    if (loc && !criteria.locations.includes(loc)) {
      setCriteria({ ...criteria, locations: [...criteria.locations, loc] });
    }
    setLocationInput('');
  };

  const removeLocation = (loc: string) => {
    setCriteria({ ...criteria, locations: criteria.locations.filter(l => l !== loc) });
  };

  const togglePropertyType = (type: string) => {
    const types = criteria.propertyTypes.includes(type)
      ? criteria.propertyTypes.filter(t => t !== type)
      : [...criteria.propertyTypes, type];
    setCriteria({ ...criteria, propertyTypes: types });
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    const success = await onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      criteria,
      tags,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    if (success) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editBuyer ? 'Edit Buyer' : 'Add Buyer'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Contact Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
              </div>
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Smith Investments LLC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="555-123-4567" />
              </div>
            </div>
          </div>

          {/* Buying Criteria */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Buying Criteria</h3>

            {/* Property Types */}
            <div>
              <Label>Property Types</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PROPERTY_TYPE_OPTIONS.map(type => (
                  <Badge
                    key={type}
                    variant={criteria.propertyTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => togglePropertyType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Price</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={criteria.minPrice || ''}
                  onChange={e => setCriteria({ ...criteria, minPrice: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Max Price</Label>
                <Input
                  type="number"
                  placeholder="500000"
                  value={criteria.maxPrice || ''}
                  onChange={e => setCriteria({ ...criteria, maxPrice: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Bedrooms */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Bedrooms</Label>
                <Input
                  type="number"
                  placeholder="2"
                  value={criteria.minBedrooms || ''}
                  onChange={e => setCriteria({ ...criteria, minBedrooms: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Min Sqft</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={criteria.minSqft || ''}
                  onChange={e => setCriteria({ ...criteria, minSqft: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Locations */}
            <div>
              <Label>Target Locations</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="e.g. Austin, TX or 78701"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                />
                <Button variant="outline" size="icon" onClick={addLocation}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {criteria.locations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {criteria.locations.map(loc => (
                    <Badge key={loc} variant="secondary" className="gap-1">
                      {loc}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeLocation(loc)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Rehab Tolerance */}
            <div>
              <Label>Rehab Tolerance</Label>
              <Select
                value={criteria.rehabTolerance}
                onValueChange={val => setCriteria({ ...criteria, rehabTolerance: val as BuyerCriteria['rehabTolerance'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REHAB_TOLERANCE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tags</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_TAGS.map(tag => (
                <Badge
                  key={tag}
                  variant={tags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => tags.includes(tag) ? removeTag(tag) : addTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Custom tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(tagInput))}
              />
              <Button variant="outline" size="icon" onClick={() => addTag(tagInput)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <Badge key={tag} className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes about this buyer..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !firstName.trim() || !lastName.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editBuyer ? 'Save Changes' : 'Add Buyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
