import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileText, FileOutput, FileSignature, Trash2, Download, RefreshCw } from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';
import { ContractType, ContractData, CONTRACT_TYPES } from '@/types/contracts';
import { ContractEditor } from './ContractEditor';

const TYPE_ICONS: Record<ContractType, typeof FileText> = {
  assignment_agreement: FileOutput,
  purchase_agreement: FileText,
  letter_of_intent: FileSignature,
};

const TYPE_LABELS: Record<ContractType, string> = {
  assignment_agreement: 'Assignment',
  purchase_agreement: 'Purchase',
  letter_of_intent: 'LOI',
};

export function ContractManager() {
  const { contracts, loading, fetchContracts, generateContract, deleteContract } = useContracts();
  const [selectedType, setSelectedType] = useState<ContractType | null>(null);

  const handleGenerate = async (data: ContractData) => {
    const result = await generateContract(data);
    if (result) {
      setSelectedType(null);
    }
  };

  return (
    <Tabs defaultValue="generate" className="space-y-6">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="generate">Generate Contract</TabsTrigger>
          <TabsTrigger value="history">
            History
            {contracts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                {contracts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <Button variant="outline" size="icon" onClick={fetchContracts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Generate Tab */}
      <TabsContent value="generate" className="space-y-6">
        {!selectedType ? (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Select a contract type to get started
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CONTRACT_TYPES.map(ct => {
                const Icon = TYPE_ICONS[ct.type];
                return (
                  <Card
                    key={ct.type}
                    className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all border-border/50"
                    onClick={() => setSelectedType(ct.type)}
                  >
                    <CardContent className="p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium">{ct.label}</h3>
                      <p className="text-xs text-muted-foreground">{ct.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <ContractEditor
            contractType={selectedType}
            onGenerate={handleGenerate}
            onBack={() => setSelectedType(null)}
          />
        )}
      </TabsContent>

      {/* History Tab */}
      <TabsContent value="history" className="space-y-4">
        {loading && contracts.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        )}

        {!loading && contracts.length === 0 && (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No contracts generated</h3>
            <p className="text-sm text-muted-foreground">
              Generate your first contract from the "Generate Contract" tab.
            </p>
          </div>
        )}

        {contracts.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => {
                  const Icon = TYPE_ICONS[contract.contractType] || FileText;
                  const data = contract.contractData;
                  return (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <Badge variant="outline" className="text-xs">
                            {TYPE_LABELS[contract.contractType] || contract.contractType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {data?.propertyAddress || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {data?.seller?.name && `Seller: ${data.seller.name}`}
                        {data?.buyer?.name && ` | Buyer: ${data.buyer.name}`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(contract.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {contract.pdfUrl && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={contract.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteContract(contract.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
