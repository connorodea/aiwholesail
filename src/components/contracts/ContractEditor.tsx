import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, ArrowLeft } from 'lucide-react';
import {
  ContractType,
  ContractData,
  ContractParty,
  ContractTerms,
  CONTRACT_TYPES,
  DEFAULT_PARTY,
  DEFAULT_TERMS,
} from '@/types/contracts';

interface ContractEditorProps {
  contractType: ContractType;
  onGenerate: (data: ContractData) => Promise<any>;
  onBack: () => void;
  initialData?: Partial<ContractData>;
}

function PartySection({ label, party, onChange }: {
  label: string;
  party: ContractParty;
  onChange: (p: ContractParty) => void;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input value={party.name} onChange={e => onChange({ ...party, name: e.target.value })} placeholder="John Smith" />
          </div>
          <div>
            <Label className="text-xs">Entity / LLC</Label>
            <Input value={party.entity} onChange={e => onChange({ ...party, entity: e.target.value })} placeholder="Smith Holdings LLC" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Address</Label>
          <Input value={party.address} onChange={e => onChange({ ...party, address: e.target.value })} placeholder="123 Main St, City, State ZIP" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={party.phone} onChange={e => onChange({ ...party, phone: e.target.value })} placeholder="555-123-4567" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={party.email} onChange={e => onChange({ ...party, email: e.target.value })} placeholder="john@example.com" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContractEditor({ contractType, onGenerate, onBack, initialData }: ContractEditorProps) {
  const [generating, setGenerating] = useState(false);
  const [propertyAddress, setPropertyAddress] = useState(initialData?.propertyAddress || '');
  const [legalDescription, setLegalDescription] = useState(initialData?.propertyLegalDescription || '');
  const [seller, setSeller] = useState<ContractParty>(initialData?.seller || { ...DEFAULT_PARTY });
  const [buyer, setBuyer] = useState<ContractParty>(initialData?.buyer || { ...DEFAULT_PARTY });
  const [assignee, setAssignee] = useState<ContractParty>(initialData?.assignee || { ...DEFAULT_PARTY });
  const [terms, setTerms] = useState<ContractTerms>(initialData?.terms || { ...DEFAULT_TERMS });

  const typeConfig = CONTRACT_TYPES.find(t => t.type === contractType);
  const isAssignment = contractType === 'assignment_agreement';

  const handleGenerate = async () => {
    if (!propertyAddress.trim() || !seller.name.trim() || !buyer.name.trim()) return;
    setGenerating(true);

    const data: ContractData = {
      contractType,
      propertyAddress: propertyAddress.trim(),
      propertyLegalDescription: legalDescription.trim(),
      seller,
      buyer,
      assignee: isAssignment ? assignee : { ...DEFAULT_PARTY },
      terms,
    };

    await onGenerate(data);
    setGenerating(false);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{typeConfig?.label || 'Contract'}</h2>
          <p className="text-xs text-muted-foreground">{typeConfig?.description}</p>
        </div>
      </div>

      {/* Property Details */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Property Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Property Address *</Label>
            <Input value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="123 Main St, City, State ZIP" />
          </div>
          <div>
            <Label className="text-xs">Legal Description</Label>
            <Textarea
              value={legalDescription}
              onChange={e => setLegalDescription(e.target.value)}
              placeholder="Lot X, Block Y, Subdivision Z, as recorded in..."
              className="min-h-[60px] resize-none text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Parties */}
      <PartySection label="Seller Information" party={seller} onChange={setSeller} />
      <PartySection label="Buyer Information" party={buyer} onChange={setBuyer} />
      {isAssignment && (
        <PartySection label="Assignee (End Buyer)" party={assignee} onChange={setAssignee} />
      )}

      {/* Terms */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Purchase Price *</Label>
              <Input
                type="number"
                value={terms.purchasePrice || ''}
                onChange={e => setTerms({ ...terms, purchasePrice: Number(e.target.value) })}
                placeholder="150000"
              />
            </div>
            <div>
              <Label className="text-xs">Earnest Money</Label>
              <Input
                type="number"
                value={terms.earnestMoney || ''}
                onChange={e => setTerms({ ...terms, earnestMoney: Number(e.target.value) })}
                placeholder="1000"
              />
            </div>
            {isAssignment && (
              <div>
                <Label className="text-xs">Assignment Fee</Label>
                <Input
                  type="number"
                  value={terms.assignmentFee || ''}
                  onChange={e => setTerms({ ...terms, assignmentFee: Number(e.target.value) })}
                  placeholder="5000"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Closing Date</Label>
              <Input
                type="date"
                value={terms.closingDate}
                onChange={e => setTerms({ ...terms, closingDate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Inspection Period (days)</Label>
              <Input
                type="number"
                value={terms.inspectionPeriod}
                onChange={e => setTerms({ ...terms, inspectionPeriod: Number(e.target.value) })}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-medium">Contingencies</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={terms.inspectionContingency}
                  onCheckedChange={val => setTerms({ ...terms, inspectionContingency: !!val })}
                />
                Inspection
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={terms.financingContingency}
                  onCheckedChange={val => setTerms({ ...terms, financingContingency: !!val })}
                />
                Financing
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={terms.appraisalContingency}
                  onCheckedChange={val => setTerms({ ...terms, appraisalContingency: !!val })}
                />
                Appraisal
              </label>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Title Company</Label>
              <Input
                value={terms.titleCompany}
                onChange={e => setTerms({ ...terms, titleCompany: e.target.value })}
                placeholder="ABC Title Company"
              />
            </div>
            <div>
              <Label className="text-xs">Closing Agent</Label>
              <Input
                value={terms.closingAgent}
                onChange={e => setTerms({ ...terms, closingAgent: e.target.value })}
                placeholder="Jane Doe, Esq."
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Additional Terms</Label>
            <Textarea
              value={terms.additionalTerms}
              onChange={e => setTerms({ ...terms, additionalTerms: e.target.value })}
              placeholder="Any additional terms, conditions, or special provisions..."
              className="min-h-[80px] resize-none text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button
          onClick={handleGenerate}
          disabled={generating || !propertyAddress.trim() || !seller.name.trim() || !buyer.name.trim()}
          className="gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Generate PDF
        </Button>
      </div>
    </div>
  );
}
