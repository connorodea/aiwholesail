import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface HeadingProps {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  size?: 'sm' | 'md' | 'xl' | '2xl';
}

export function Heading({ children, className, as: Tag = 'h2', size = 'md' }: HeadingProps) {
  const sizeMap = {
    sm: 'text-xl md:text-2xl md:leading-snug',
    md: 'text-3xl md:text-5xl md:leading-tight',
    xl: 'text-4xl md:text-6xl md:leading-none',
    '2xl': 'text-5xl md:text-7xl md:leading-none',
  };

  return (
    <Tag
      className={cn(
        'max-w-5xl mx-auto text-center tracking-tight font-medium',
        'bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-white to-white',
        sizeMap[size],
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function Subheading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm md:text-base max-w-4xl mx-auto text-center my-4 text-neutral-400 font-normal', className)}>
      {children}
    </p>
  );
}
