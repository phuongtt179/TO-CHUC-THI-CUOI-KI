import { cn } from '@/utils/cn'

const STATUS_CONFIG = {
  waiting: { label: 'Chờ', color: 'bg-gray-100 text-gray-600' },
  doing: { label: 'Đang thi', color: 'bg-blue-100 text-blue-700 animate-pulse' },
  submitted: { label: 'Đã nộp', color: 'bg-emerald-100 text-emerald-700' },
  submitted_auto: { label: 'Nộp tự động', color: 'bg-orange-100 text-orange-700' },
  graded: { label: 'Đã chấm', color: 'bg-purple-100 text-purple-700' },
  active: { label: 'Đang diễn ra', color: 'bg-blue-100 text-blue-700' },
  ended: { label: 'Kết thúc', color: 'bg-gray-100 text-gray-500' },
  pending: { label: 'Chờ chấm', color: 'bg-yellow-100 text-yellow-700' },
}

export function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', config.color, className)}>
      {config.label}
    </span>
  )
}

export function Badge({ children, color = 'gray', className }) {
  const colorMap = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', colorMap[color], className)}>
      {children}
    </span>
  )
}

export function GradeBadge({ grade }) {
  const colors = { 3: 'blue', 4: 'green', 5: 'purple' }
  return <Badge color={colors[grade] || 'gray'}>Khối {grade}</Badge>
}
