/**
 * Liquid Glass / Frosted Bubble scroll animations
 * Inspired by Apple iOS 26 liquid glass design language + OpenAI scroll reveals
 *
 * Components:
 * - ScrollReveal: fade + blur + scale on scroll into view
 * - GlassMorph: frosted glass container with liquid refraction effect
 * - FloatingOrb: animated liquid bubble that responds to scroll
 * - LiquidSection: full section wrapper with glass reveal animation
 */

import { useRef, useEffect, useState, ReactNode } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============ SCROLL REVEAL ============
// Fades in + de-blurs + scales up as element scrolls into view (like OpenAI sections)

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  blur?: boolean;
  scale?: boolean;
  once?: boolean;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = 'up',
  blur = true,
  scale = false,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-80px' });

  const directionMap = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
    none: {},
  };

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        filter: blur ? 'blur(10px)' : 'blur(0px)',
        scale: scale ? 0.95 : 1,
        ...directionMap[direction],
      }}
      animate={isInView ? {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        x: 0,
        y: 0,
      } : undefined}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============ GLASS MORPH CONTAINER ============
// Frosted glass card with liquid refraction edge glow

interface GlassMorphProps {
  children: ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'heavy';
  glow?: boolean;
}

export function GlassMorph({
  children,
  className,
  intensity = 'medium',
  glow = false,
}: GlassMorphProps) {
  const blurMap = {
    light: 'backdrop-blur-md',
    medium: 'backdrop-blur-xl',
    heavy: 'backdrop-blur-2xl',
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl border overflow-hidden',
        blurMap[intensity],
        'bg-white/[0.03] border-white/[0.08]',
        glow && 'shadow-[0_0_30px_rgba(56,189,248,0.08)]',
        className
      )}
      style={{
        // Liquid glass refraction effect
        backgroundImage: glow
          ? 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 60%)'
          : undefined,
      }}
    >
      {/* Top edge highlight — liquid glass rim light */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ============ FLOATING ORB ============
// Animated liquid bubble that floats and warps subtly

interface FloatingOrbProps {
  className?: string;
  color?: string;
  size?: number;
  speed?: number;
}

export function FloatingOrb({
  className,
  color = 'rgba(56,189,248,0.15)',
  size = 400,
  speed = 20,
}: FloatingOrbProps) {
  return (
    <div className={cn('absolute pointer-events-none', className)} aria-hidden="true">
      <motion.div
        animate={{
          x: [0, 30, -20, 10, 0],
          y: [0, -20, 15, -10, 0],
          scale: [1, 1.05, 0.98, 1.02, 1],
        }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 40% 40%, ${color}, transparent 70%)`,
          borderRadius: '50%',
          filter: `blur(${size / 4}px)`,
        }}
      />
    </div>
  );
}

// ============ LIQUID SECTION ============
// Full section wrapper with parallax + glass reveal

interface LiquidSectionProps {
  children: ReactNode;
  className?: string;
  orbs?: boolean;
  parallax?: boolean;
}

export function LiquidSection({
  children,
  className,
  orbs = false,
  parallax = false,
}: LiquidSectionProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useSpring(
    useTransform(scrollYProgress, [0, 1], parallax ? [60, -60] : [0, 0]),
    { stiffness: 100, damping: 30 }
  );

  return (
    <section ref={ref} className={cn('relative overflow-hidden', className)}>
      {orbs && (
        <>
          <FloatingOrb className="top-0 -left-20" color="rgba(56,189,248,0.08)" size={500} speed={25} />
          <FloatingOrb className="bottom-0 -right-20" color="rgba(168,85,247,0.06)" size={400} speed={30} />
        </>
      )}
      <motion.div style={{ y }} className="relative z-10">
        {children}
      </motion.div>
    </section>
  );
}

// ============ STAGGER CHILDREN ============
// Staggers children animations like OpenAI's section reveals

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerChildren({ children, className, staggerDelay = 0.1 }: StaggerChildrenProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Child variant for use inside StaggerChildren
export const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] },
  },
};
