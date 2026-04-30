import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookOpen, FileText, PlayCircle, Users, Plus, ArrowRight } from 'lucide-react'
import { StatCard, Card } from '@/components/ui'
import { StatusBadge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { where, orderBy, limit } from 'firebase/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: questions } = useCollection('question_bank')
  const { data: templates } = useCollection('exam_templates')
  const { data: exams } = useCollection('exams', [orderBy('created_at', 'desc'), limit(5)])
  const { data: submissions } = useCollection('submissions')

  const activeExams = exams.filter(e => e.status === 'active')

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Tổng quan</h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Câu hỏi"
          value={questions.length}
          subtitle="trong ngân hàng"
          icon={<BookOpen size={20} />}
          color="indigo"
        />
        <StatCard
          title="Đề thi"
          value={templates.length}
          subtitle="template sẵn có"
          icon={<FileText size={20} />}
          color="purple"
        />
        <StatCard
          title="Ca thi"
          value={exams.length}
          subtitle={`${activeExams.length} đang diễn ra`}
          icon={<PlayCircle size={20} />}
          color="emerald"
        />
        <StatCard
          title="Bài nộp"
          value={submissions.length}
          subtitle="tổng số bài"
          icon={<Users size={20} />}
          color="orange"
        />
      </div>

      {/* Active exams */}
      {activeExams.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Ca thi đang diễn ra
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeExams.map(exam => (
              <Card key={exam.id} hover onClick={() => navigate(`/teacher/monitor/${exam.id}`)} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-800">{exam.template_snapshot?.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Lớp {exam.class} · Mã: <span className="font-mono font-bold text-indigo-600">{exam.exam_code}</span></p>
                  </div>
                  <StatusBadge status={exam.status} />
                </div>
                <button className="mt-3 flex items-center gap-1 text-sm text-indigo-600 font-semibold hover:underline">
                  Theo dõi <ArrowRight size={14} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Thao tác nhanh</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: 'Thêm câu hỏi', desc: 'Thêm vào ngân hàng', icon: BookOpen, color: 'from-indigo-500 to-indigo-600', to: '/teacher/questions' },
            { label: 'Tạo đề thi', desc: 'Tạo template mới', icon: FileText, color: 'from-purple-500 to-purple-600', to: '/teacher/templates/new' },
            { label: 'Mở ca thi', desc: 'Tổ chức thi mới', icon: PlayCircle, color: 'from-emerald-500 to-emerald-600', to: '/teacher/exams/new' },
          ].map(({ label, desc, icon: Icon, color, to }) => (
            <motion.button
              key={to}
              onClick={() => navigate(to)}
              whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
              whileTap={{ scale: 0.97 }}
              className={`p-3 sm:p-5 rounded-2xl bg-gradient-to-br ${color} text-white text-left shadow-md`}
            >
              <Icon size={22} className="mb-2 opacity-90" />
              <p className="font-bold text-sm sm:text-base leading-tight">{label}</p>
              <p className="text-xs opacity-75 mt-0.5 hidden sm:block">{desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent exams */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">Ca thi gần đây</h2>
          <button onClick={() => navigate('/teacher/exams')} className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
            Xem tất cả <ArrowRight size={14} />
          </button>
        </div>
        <Card className="overflow-hidden">
          {exams.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <PlayCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p>Chưa có ca thi nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Tên đề</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mã</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lớp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {exams.map(exam => (
                  <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-800 text-sm">{exam.template_snapshot?.name || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-indigo-600 text-sm">{exam.exam_code}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{exam.class}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={exam.status} /></td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => navigate(`/teacher/monitor/${exam.id}`)}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
