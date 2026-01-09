import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantClasses = {
  primary: 'bg-orange hover:bg-orange/90 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  danger: 'bg-pink hover:bg-pink/90 text-white',
  success: 'bg-green hover:bg-green/90 text-white',
  info: 'bg-blue hover:bg-blue/90 text-white',
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        font-semibold rounded-lg
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-150
        touch-manipulation min-h-[48px]
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
