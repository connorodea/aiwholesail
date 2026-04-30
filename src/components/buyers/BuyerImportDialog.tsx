import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useBuyers } from '@/hooks/useBuyers';

interface BuyerImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedRow {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  tags: string;
  propertyTypes: string;
  minPrice: string;
  maxPrice: string;
  locations: string;
  rehabTolerance: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[_\s]+/g, ''));
  const headerMap: Record<string, string> = {};

  const aliases: Record<string, string[]> = {
    firstName: ['firstname', 'first', 'fname'],
    lastName: ['lastname', 'last', 'lname'],
    company: ['company', 'companyname', 'org', 'organization'],
    email: ['email', 'emailaddress', 'mail'],
    phone: ['phone', 'phonenumber', 'mobile', 'cell'],
    tags: ['tags', 'tag', 'labels'],
    propertyTypes: ['propertytypes', 'propertytype', 'types'],
    minPrice: ['minprice', 'min', 'minimumprice'],
    maxPrice: ['maxprice', 'max', 'maximumprice'],
    locations: ['locations', 'location', 'markets', 'areas'],
    rehabTolerance: ['rehabtolerance', 'rehab', 'tolerance'],
  };

  for (const [field, alts] of Object.entries(aliases)) {
    const idx = headers.findIndex(h => alts.includes(h));
    if (idx >= 0) headerMap[field] = String(idx);
  }

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
      current += char;
    }
    cells.push(current.trim());

    const get = (field: string) => {
      const idx = headerMap[field];
      return idx != null ? cells[Number(idx)] || '' : '';
    };

    return {
      firstName: get('firstName'),
      lastName: get('lastName'),
      company: get('company'),
      email: get('email'),
      phone: get('phone'),
      tags: get('tags'),
      propertyTypes: get('propertyTypes'),
      minPrice: get('minPrice'),
      maxPrice: get('maxPrice'),
      locations: get('locations'),
      rehabTolerance: get('rehabTolerance'),
    };
  }).filter(row => row.firstName || row.lastName);
}

export function BuyerImportDialog({ isOpen, onClose }: BuyerImportDialogProps) {
  const { importBuyers } = useBuyers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setParsedRows(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);

    const mapped = parsedRows.map(row => ({
      firstName: row.firstName,
      lastName: row.lastName,
      company: row.company || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      tags: row.tags ? row.tags.split(/[;,]/).map(t => t.trim()).filter(Boolean) : [],
      criteria: {
        propertyTypes: row.propertyTypes ? row.propertyTypes.split(/[;,]/).map(t => t.trim()).filter(Boolean) : [],
        minPrice: row.minPrice ? Number(row.minPrice) : null,
        maxPrice: row.maxPrice ? Number(row.maxPrice) : null,
        locations: row.locations ? row.locations.split(/[;,]/).map(t => t.trim()).filter(Boolean) : [],
        rehabTolerance: row.rehabTolerance || 'moderate',
        minBedrooms: null,
        maxBedrooms: null,
        minSqft: null,
        maxSqft: null,
        preferredReturnRate: null,
      },
    }));

    const res = await importBuyers(mapped);
    setResult(res);
    setImporting(false);
  };

  const handleClose = () => {
    setParsedRows([]);
    setResult(null);
    setFileName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Buyers from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{parsedRows.length} rows</Badge>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload a CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected columns: First Name, Last Name, Company, Email, Phone, Tags, Property Types, Min Price, Max Price, Locations, Rehab Tolerance
                </p>
              </>
            )}
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && !result && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Locations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{row.firstName} {row.lastName}</TableCell>
                      <TableCell className="text-xs">{row.email}</TableCell>
                      <TableCell className="text-xs">{row.phone}</TableCell>
                      <TableCell className="text-xs">{row.tags}</TableCell>
                      <TableCell className="text-xs">{row.locations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 10 && (
                <div className="p-2 text-xs text-muted-foreground text-center border-t">
                  ...and {parsedRows.length - 10} more rows
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="p-4 rounded-lg bg-muted/50 text-center space-y-2">
              {result.success > 0 && (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">{result.success} buyers imported successfully</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center justify-center gap-2 text-orange-500">
                  <AlertCircle className="h-5 w-5" />
                  <span>{result.failed} rows failed</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={importing || parsedRows.length === 0}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {parsedRows.length} Buyer{parsedRows.length !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
