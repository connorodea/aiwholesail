import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { buyers as buyersApi } from '@/lib/api-client';
import { Buyer, BuyerMatch } from '@/types/buyer';
import { Property } from '@/types/zillow';
import { toast } from 'sonner';

function mapApiBuyer(raw: any): Buyer {
  return {
    id: raw.id,
    userId: raw.user_id,
    firstName: raw.first_name || '',
    lastName: raw.last_name || '',
    company: raw.company || null,
    email: raw.email || null,
    phone: raw.phone || null,
    criteria: raw.criteria || {},
    tags: raw.tags || [],
    notes: raw.notes || null,
    dealCount: raw.deal_count || 0,
    lastContactedAt: raw.last_contacted_at || null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function useBuyers() {
  const [buyersList, setBuyersList] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchBuyers = async (params?: { search?: string; tags?: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await buyersApi.list(params);
      if (response.error) throw new Error(response.error);
      const data = response.data as any;
      const list = Array.isArray(data) ? data : data?.buyers || [];
      setBuyersList(list.map(mapApiBuyer));
    } catch (error) {
      console.error('[Buyers] Failed to fetch:', error);
      toast.error('Failed to load buyers');
    } finally {
      setLoading(false);
    }
  };

  const addBuyer = async (buyerData: {
    firstName: string;
    lastName: string;
    company?: string;
    email?: string;
    phone?: string;
    criteria: any;
    tags?: string[];
    notes?: string;
  }): Promise<boolean> => {
    try {
      const response = await buyersApi.create(buyerData);
      if (response.error) throw new Error(response.error);
      const newBuyer = mapApiBuyer(response.data);
      setBuyersList(prev => [newBuyer, ...prev]);
      toast.success('Buyer added');
      return true;
    } catch {
      toast.error('Failed to add buyer');
      return false;
    }
  };

  const updateBuyer = async (id: string, data: Partial<Buyer>): Promise<boolean> => {
    try {
      const response = await buyersApi.update(id, data);
      if (response.error) throw new Error(response.error);
      setBuyersList(prev =>
        prev.map(b => (b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b))
      );
      toast.success('Buyer updated');
      return true;
    } catch {
      toast.error('Failed to update buyer');
      return false;
    }
  };

  const deleteBuyer = async (id: string): Promise<boolean> => {
    const previousBuyers = [...buyersList];
    setBuyersList(prev => prev.filter(b => b.id !== id));
    try {
      const response = await buyersApi.delete(id);
      if (response.error) throw new Error(response.error);
      toast.success('Buyer removed');
      return true;
    } catch {
      setBuyersList(previousBuyers);
      toast.error('Failed to remove buyer');
      return false;
    }
  };

  const matchBuyersToProperty = async (property: Property): Promise<BuyerMatch[]> => {
    try {
      const response = await buyersApi.match(property);
      if (response.error) throw new Error(response.error);
      const data = response.data as any;
      return (data?.matches || []).map((m: any) => ({
        buyer: mapApiBuyer(m.buyer),
        matchScore: m.matchScore || m.match_score || 0,
        matchReasons: m.matchReasons || m.match_reasons || [],
      }));
    } catch {
      toast.error('Failed to match buyers');
      return [];
    }
  };

  const exportBuyers = (buyersToExport?: Buyer[]) => {
    const data = buyersToExport || buyersList;
    if (data.length === 0) {
      toast.error('No buyers to export');
      return;
    }

    const headers = ['First Name', 'Last Name', 'Company', 'Email', 'Phone', 'Tags', 'Property Types', 'Min Price', 'Max Price', 'Locations', 'Rehab Tolerance', 'Deal Count'];
    const rows = data.map(b => [
      b.firstName,
      b.lastName,
      b.company || '',
      b.email || '',
      b.phone || '',
      b.tags.join('; '),
      b.criteria.propertyTypes?.join('; ') || '',
      b.criteria.minPrice || '',
      b.criteria.maxPrice || '',
      b.criteria.locations?.join('; ') || '',
      b.criteria.rehabTolerance || '',
      b.dealCount,
    ]);

    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buyers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} buyers`);
  };

  const importBuyers = async (rows: any[]): Promise<{ success: number; failed: number }> => {
    try {
      const response = await buyersApi.import(rows);
      if (response.error) throw new Error(response.error);
      const result = response.data as any;
      await fetchBuyers();
      return { success: result?.imported || rows.length, failed: result?.failed || 0 };
    } catch {
      toast.error('Failed to import buyers');
      return { success: 0, failed: rows.length };
    }
  };

  useEffect(() => {
    if (user) {
      fetchBuyers();
    } else {
      setBuyersList([]);
    }
  }, [user]);

  return {
    buyers: buyersList,
    loading,
    fetchBuyers,
    addBuyer,
    updateBuyer,
    deleteBuyer,
    matchBuyersToProperty,
    exportBuyers,
    importBuyers,
  };
}
