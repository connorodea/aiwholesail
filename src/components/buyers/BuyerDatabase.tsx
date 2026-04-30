import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Plus, Download, Upload, RefreshCw, LayoutGrid, List,
  Phone, Mail, MoreVertical, Pencil, Trash2, Send, Users,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBuyers } from '@/hooks/useBuyers';
import { Buyer } from '@/types/buyer';
import { BuyerCard } from './BuyerCard';
import { AddBuyerDialog } from './AddBuyerDialog';
import { BuyerImportDialog } from './BuyerImportDialog';
import { toast } from 'sonner';

export function BuyerDatabase() {
  const { buyers, loading, fetchBuyers, addBuyer, updateBuyer, deleteBuyer, exportBuyers } = useBuyers();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);

  const filteredBuyers = useMemo(() => {
    if (!searchQuery.trim()) return buyers;
    const q = searchQuery.toLowerCase();
    return buyers.filter(b =>
      `${b.firstName} ${b.lastName}`.toLowerCase().includes(q) ||
      b.company?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.phone?.includes(q) ||
      b.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [buyers, searchQuery]);

  const handleEdit = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setShowAddDialog(true);
  };

  const handleDelete = async (buyerId: string) => {
    await deleteBuyer(buyerId);
  };

  const handleOutreach = (buyer: Buyer) => {
    toast.info(`Outreach to ${buyer.firstName} - coming soon`);
  };

  const handleSave = async (data: any) => {
    if (editingBuyer) {
      return await updateBuyer(editingBuyer.id, data);
    }
    return await addBuyer(data);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingBuyer(null);
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    return `$${(price / 1000).toFixed(0)}K`;
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search buyers by name, company, tag..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}>
            {viewMode === 'card' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportBuyers()}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="icon" onClick={() => fetchBuyers()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setEditingBuyer(null); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4" /> Add Buyer
          </Button>
        </div>
      </div>

      {/* Count */}
      <div className="text-sm text-muted-foreground">
        {filteredBuyers.length} buyer{filteredBuyers.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Loading */}
      {loading && buyers.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && buyers.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No buyers yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your cash buyers to match them with deals automatically.
          </p>
          <Button onClick={() => { setEditingBuyer(null); setShowAddDialog(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Your First Buyer
          </Button>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'card' && filteredBuyers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBuyers.map(buyer => (
            <BuyerCard
              key={buyer.id}
              buyer={buyer}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onOutreach={handleOutreach}
            />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && filteredBuyers.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead className="text-center">Deals</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBuyers.map(buyer => (
                <TableRow key={buyer.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{buyer.firstName} {buyer.lastName}</div>
                    {buyer.company && <div className="text-xs text-muted-foreground">{buyer.company}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
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
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {buyer.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                      {buyer.tags.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{buyer.tags.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {buyer.criteria.maxPrice ? `Up to ${formatPrice(buyer.criteria.maxPrice)}` : ''}
                      {buyer.criteria.locations?.length ? ` in ${buyer.criteria.locations[0]}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">{buyer.dealCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(buyer)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOutreach(buyer)}>
                          <Send className="mr-2 h-4 w-4" /> Send Deal
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(buyer.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <AddBuyerDialog
        isOpen={showAddDialog}
        onClose={handleCloseDialog}
        onSave={handleSave}
        editBuyer={editingBuyer}
      />

      <BuyerImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </div>
  );
}
