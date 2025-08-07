import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield } from 'lucide-react';

export function TestAccountsInfo() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Test Accounts
        </CardTitle>
        <CardDescription>
          Use these accounts to test the application without payment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">Admin Account</span>
            <Badge variant="destructive">Admin</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Email:</strong> admin@test.com</p>
            <p><strong>Password:</strong> TestAdmin123!</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">Test User</span>
            <Badge variant="secondary">Pro</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Email:</strong> user@test.com</p>
            <p><strong>Password:</strong> TestUser123!</p>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>These accounts have unlimited access without payment requirements.</p>
        </div>
      </CardContent>
    </Card>
  );
}