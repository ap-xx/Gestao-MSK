import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

const variants = {
  primary: 'text-dark-900 font-semibold hover:opacity-90',
  secondary: 'bg-white/10 text-white hover:bg-white/15 border border-white/10',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/5',
  danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
  outline: 'border text-amber-400 hover:bg-amber-400/10',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200
        ${variants[variant]}
        ${sizes[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={isPrimary ? {
        background: 'linear-gradient(135deg, #d97706, #f59e0b)',
      } : isOutline ? {
        borderColor: 'rgba(217, 119, 6, 0.4)',
      } : undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  );
}
