import { cn } from '@/utils/cn'
import { motion } from 'framer-motion'

const variants = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-md',
  success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
  outline: 'bg-transparent border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
  xl: 'px-8 py-4 text-lg rounded-2xl',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  onClick,
  type = 'button',
  icon,
  ...props
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none',
        variants[variant],
        sizes[size],
        (disabled || loading) && 'opacity-60 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
    </motion.button>
  )
}
