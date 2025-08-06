import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkipTrace, SkipTraceResult } from "@/hooks/useSkipTrace";
import { Property } from "@/types/zillow";
import { Phone, User, Mail, MapPin, Calendar, Download, Search } from "lucide-react";

interface SkipTraceModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SkipTraceModal({ property, isOpen, onClose }: SkipTraceModalProps) {
  const { skipTrace, loading, results, exportResults } = useSkipTrace();

  const handleSkipTrace = async () => {
    if (!property) return;
    await skipTrace(property);
  };

  const currentResult = results.find(r => 
    property && r.address === property.address.split(',')[0]?.trim()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Skip Trace Results
          </DialogTitle>
          <DialogDescription>
            Find owner contact information for: {property?.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!currentResult && (
            <div className="text-center py-8">
              <Button 
                onClick={handleSkipTrace}
                disabled={loading || !property}
                size="lg"
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                {loading ? 'Searching...' : 'Start Skip Trace'}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Click to find owner contact information for this property
              </p>
            </div>
          )}

          {currentResult && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <SkipTraceResultCard 
                  result={currentResult} 
                  onExport={() => exportResults(currentResult)}
                />
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SkipTraceResultCardProps {
  result: SkipTraceResult;
  onExport: () => void;
}

function SkipTraceResultCard({ result, onExport }: SkipTraceResultCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{result.address}</CardTitle>
            <p className="text-sm text-muted-foreground">{result.location}</p>
          </div>
          <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone Numbers */}
        {result.phones && result.phones.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Phone Numbers</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.phones.map((phone, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  <Phone className="h-3 w-3" />
                  {phone}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Names */}
        {result.names && result.names.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Associated Names</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.names.map((name, index) => (
                <Badge key={index} variant="outline" className="gap-1">
                  <User className="h-3 w-3" />
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Emails */}
        {result.emails && result.emails.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Email Addresses</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.emails.map((email, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  <Mail className="h-3 w-3" />
                  {email}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.currentAddress && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">Current Address</span>
                <p className="text-sm text-muted-foreground">{result.currentAddress}</p>
              </div>
            </div>
          )}
          
          {result.age && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">Age</span>
                <p className="text-sm text-muted-foreground">{result.age} years old</p>
              </div>
            </div>
          )}
        </div>

        {/* Raw Data for Debugging */}
        {Object.keys(result).length > 6 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              View Additional Data
            </summary>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}