import { cn } from '@/utils/cn'
import { motion } from 'framer-motion'

export function Card({ children, className, hover, onClick }) {
  const Component = hover ? motion.div : 'div'
  const hoverProps = hover ? {
    whileHover: { y: -2, boxShadow: '0 8px 40px rgba(0,0,0,0.14)' },
    transition: { type: 'spring', stiffness: 400, damping: 25 }
  } : {}

  return (
    <Component
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl shadow-card border border-gray-100',
        hover && 'cursor-pointer',
        className
      )}
      {...hoverProps}
    >
      {children}
    </Component>
  )
}

export function StatCard({ title, value, subtitle, icon, color = 'indigo' }) {
  const colorMap = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
  }
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
      className="bg-white rounded-2xl p-3 sm:p-5 shadow-card border border-gray-100"
    >
      <div className={cn('w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md mb-2', colorMap[color])}>
        {icon}
      </div>
      <p className="text-xs sm:text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{subtitle}</p>}
    </motion.div>
  )
}
