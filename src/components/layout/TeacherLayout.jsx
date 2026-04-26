import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, FileText, PlayCircle,
  Monitor, Download, GraduationCap, ChevronRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { to: '/teacher', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/teacher/questions', label: 'Ngân hàng câu hỏi', icon: BookOpen },
  { to: '/teacher/templates', label: 'Đề thi', icon: FileText },
  { to: '/teacher/exams', label: 'Ca thi', icon: PlayCircle },
  { to: '/teacher/export', label: 'Xuất Excel', icon: Download },
]

export function TeacherLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 z-20">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">Hệ thống thi</p>
              <p className="text-xs text-gray-500">Giáo viên</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-indigo-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-600">
            <p className="font-semibold">Phiên hiện tại</p>
            <p className="text-indigo-400 mt-0.5">Giáo viên · Quản trị</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
