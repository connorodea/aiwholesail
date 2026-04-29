import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Phone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { communications } from '@/lib/api-client';

interface CallAgentButtonProps {
  agentPhone: string;
  agentName?: string;
  propertyAddress: string;
  disabled?: boolean;
}

export function CallAgentButton({ agentPhone, agentName, propertyAddress, disabled }: CallAgentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCall = async () => {
    if (!userPhone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number to connect the call.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await communications.makeCall(agentPhone);

      if (response.error) throw new Error(response.error);

      if ((response.data as any)?.success) {
        toast({
          title: "Call initiated",
          description: `Connecting you to ${agentName || 'the listing agent'}. You should receive a call shortly.`,
        });
        setIsOpen(false);
        setUserPhone('');
      } else {
        throw new Error((response.data as any)?.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error making call:', error);
      toast({
        title: "Call failed",
        description: error.message || "Unable to connect the call. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Phone className="h-4 w-4" />
          Call Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call Listing Agent</DialogTitle>
          <DialogDescription>
            We'll connect you directly to {agentName || 'the listing agent'} at {formatPhoneNumber(agentPhone)} regarding the property at {propertyAddress}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="userPhone" className="text-sm font-medium text-foreground">
              Your Phone Number
            </label>
            <Input
              id="userPhone"
              type="tel"
              placeholder="(555) 123-4567"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              We'll call this number and connect you to the agent
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCall} 
              disabled={isLoading || !userPhone.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Phone className="h-4 w-4 mr-2 animate-pulse" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Start Call
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}