import { cn } from '@/utils/cn'
import { forwardRef } from 'react'

export const Input = forwardRef(function Input({
  label,
  error,
  className,
  containerClass,
  icon,
  suffix,
  ...props
}, ref) {
  return (
    <div className={cn('flex flex-col gap-1', containerClass)}>
      {label && (
        <label className="text-sm font-semibold text-gray-700">{label}</label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-gray-400">{icon}</span>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800',
            'placeholder:text-gray-400 outline-none transition-all duration-200',
            'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
            icon && 'pl-10',
            suffix && 'pr-12',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-sm text-gray-400">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({
  label,
  error,
  className,
  containerClass,
  ...props
}, ref) {
  return (
    <div className={cn('flex flex-col gap-1', containerClass)}>
      {label && (
        <label className="text-sm font-semibold text-gray-700">{label}</label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800',
          'placeholder:text-gray-400 outline-none transition-all duration-200 resize-y min-h-[80px]',
          'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
          error && 'border-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})

export function Select({ label, error, className, containerClass, children, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1', containerClass)}>
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <select
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800',
          'outline-none transition-all duration-200 cursor-pointer',
          'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
          error && 'border-red-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
