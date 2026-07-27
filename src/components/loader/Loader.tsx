'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const sizeMap = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const ringMap = {
  sm: 'w-16 h-16',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export default function Loader({ size = 'md', label, className }: LoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', className)}>
      <motion.div
        className={cn('relative flex items-center justify-center rounded-full bg-primary/10', sizeMap[size])}
        animate={{ rotate: [0, 360] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
      >
        <motion.div
          className={cn('absolute rounded-full border border-primary/20', ringMap[size])}
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.75, 0.2, 0.75] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        />
        <motion.svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          className="relative z-10"
          initial={{ scale: 0.92 }}
          animate={{ scale: [0.92, 1.0, 0.92] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
        >
          <circle cx="32" cy="32" r="24" fill="var(--primary)" opacity="0.12" />
          <path
            d="M24 24h16a4 4 0 0 1 0 8H30v4h10a4 4 0 0 1 0 8H30v8"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M24 32h16" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
        </motion.svg>
      </motion.div>
      {label ? <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p> : null}
    </div>
  );
}
