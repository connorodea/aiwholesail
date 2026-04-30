import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function FeatureIconContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg', className)}>
      {/* Glow */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-cyan-500/20 to-transparent blur-sm" />
      {/* Inner */}
      <div className="relative flex h-full w-full items-center justify-center rounded-lg border border-white/10 bg-neutral-900 shadow-[0px_1px_0px_0px_rgba(255,255,255,0.1)_inset]">
        {children}
      </div>
    </div>
  );
}
