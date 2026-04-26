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
      className="bg-white rounded-2xl p-6 shadow-card border border-gray-100 flex items-start gap-4"
    >
      <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md', colorMap[color])}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  )
}
