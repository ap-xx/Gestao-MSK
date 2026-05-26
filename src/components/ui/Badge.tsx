import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'green' | 'red' | 'gray' | 'blue' | 'purple';
  size?: 'sm' | 'md';
}

const variants = {
  gold: 'status-pending',
  green: 'status-active',
  red: 'status-inactive',
  gray: 'bg-white/10 text-gray-300 border border-white/10',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({ children, variant = 'gray', size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}
