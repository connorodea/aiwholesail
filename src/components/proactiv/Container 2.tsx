import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-7xl mx-auto px-4', className)}>
      {children}
    </div>
  );
}
