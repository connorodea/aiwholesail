import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { contracts as contractsApi } from '@/lib/api-client';
import { GeneratedContract, ContractData } from '@/types/contracts';
import { toast } from 'sonner';

function mapContract(raw: any): GeneratedContract {
  return {
    id: raw.id,
    userId: raw.user_id || '',
    leadId: raw.lead_id || null,
    contractType: raw.contract_type || raw.contractType || 'assignment_agreement',
    contractData: raw.contract_data || raw.contractData || {},
    pdfUrl: raw.pdf_url || raw.pdfUrl || null,
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

export function useContracts() {
  const [contractsList, setContractsList] = useState<GeneratedContract[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchContracts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await contractsApi.list();
      if (response.error) throw new Error(response.error);
      const data = response.data as any;
      const list = Array.isArray(data) ? data : data?.contracts || [];
      setContractsList(list.map(mapContract));
    } catch {
      toast.error('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const generateContract = async (contractData: ContractData, leadId?: string): Promise<GeneratedContract | null> => {
    try {
      const response = await contractsApi.generate({ ...contractData, leadId });
      if (response.error) throw new Error(response.error);
      const result = response.data as any;

      // Download the PDF if base64 is returned
      if (result.pdfBase64 || result.pdf_base64) {
        downloadPdf(
          result.pdfBase64 || result.pdf_base64,
          `${contractData.contractType}_${Date.now()}.pdf`
        );
      }

      const newContract = mapContract(result.contract || result);
      setContractsList(prev => [newContract, ...prev]);
      toast.success('Contract generated');
      return newContract;
    } catch {
      toast.error('Failed to generate contract');
      return null;
    }
  };

  const deleteContract = async (id: string): Promise<boolean> => {
    const prev = [...contractsList];
    setContractsList(c => c.filter(x => x.id !== id));
    try {
      const response = await contractsApi.delete(id);
      if (response.error) throw new Error(response.error);
      toast.success('Contract deleted');
      return true;
    } catch {
      setContractsList(prev);
      toast.error('Failed to delete contract');
      return false;
    }
  };

  const downloadPdf = (base64: string, filename: string) => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (user) fetchContracts();
    else setContractsList([]);
  }, [user]);

  return {
    contracts: contractsList,
    loading,
    fetchContracts,
    generateContract,
    deleteContract,
  };
}
