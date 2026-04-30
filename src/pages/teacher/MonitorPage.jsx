import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, PlayCircle, StopCircle, Users, Clock,
  CheckCircle, RefreshCw, Eye, Download, Brain, FileDown
} from 'lucide-react'
import { where, serverTimestamp, Timestamp } from 'firebase/firestore'
import { Button, Card, StatusBadge, ConfirmModal, PageLoader } from '@/components/ui'
import { useDocument, useCollection, updateDocument, getDocumentOnce } from '@/hooks/useFirestore'
import { useCountdownTimer, formatTime, getTimerColor } from '@/hooks/useTimer'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'
import { db } from '@/firebase/config'
import { doc, updateDoc } from 'firebase/firestore'

export function MonitorPage() {
  const navigate = useNavigate()
  const { examId } = useParams()
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [syncingImages, setSyncingImages] = useState(false)

  const { data: exam, loading: examLoading } = useDocument('exams', examId)
  const { data: rawStudents } = useCollection('students', [
    where('exam_id', '==', examId),
  ])
  const students = [...rawStudents].sort((a, b) =>
    (a.computer_name || '').localeCompare(b.computer_name || '', 'vi', { numeric: true })
  )

  const { data: scores } = useCollection('scores', [
    where('exam_id', '==', examId),
  ])
  const scoreMap = Object.fromEntries(scores.map(s => [s.student_id, s]))

  const remaining = useCountdownTimer(
    exam?.start_time,
    exam?.template_snapshot?.duration,
    async () => {
      if (exam?.status === 'active') {
        await updateDoc(doc(db, 'exams', examId), { status: 'ended', end_time: serverTimestamp() })
      }
    }
  )

  const handleStart = async () => {
    try {
      const durationSeconds = (exam?.template_snapshot?.duration || 35) * 60
      const nowSeconds = Math.floor(Date.now() / 1000)
      const endTime = new Timestamp(nowSeconds + durationSeconds, 0)
      await updateDoc(doc(db, 'exams', examId), {
        status: 'active',
        start_time: serverTimestamp(),
        end_time: endTime,
      })
      toast.success('Đã phát đề thi! Học sinh có thể bắt đầu làm bài.')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  const handleEnd = async () => {
    try {
      await updateDoc(doc(db, 'exams', examId), {
        status: 'ended',
        end_time: serverTimestamp(),
      })
      toast.success('Đã kết thúc ca thi')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  const handleSyncImages = async () => {
    setSyncingImages(true)
    try {
      const refreshed = await Promise.all(
        (exam?.template_snapshot?.mc_questions || []).map(async q => {
          const latest = await getDocumentOnce('question_bank', q.id)
          return latest ? { ...latest, score: q.score } : q
        })
      )
      await updateDoc(doc(db, 'exams', examId), {
        'template_snapshot.mc_questions': refreshed,
      })
      toast.success('Đã cập nhật hình ảnh cho ca thi này')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setSyncingImages(false)
    }
  }

  const statusCounts = {
    waiting: students.filter(s => s.status === 'waiting').length,
    active: students.filter(s => s.status === 'active').length,
    submitted: students.filter(s => ['submitted', 'submitted_auto'].includes(s.status)).length,
    graded: students.filter(s => s.status === 'graded').length,
  }

  const durationMs = (exam?.template_snapshot?.duration || 35) * 60 * 1000

  if (examLoading) return <PageLoader />
  if (!exam) return <div className="p-8 text-gray-500">Không tìm thấy ca thi</div>

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <button onClick={() => navigate('/teacher/exams')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 flex-shrink-0 mt-0.5">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{exam.template_snapshot?.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lớp {exam.class} · Mã: <span className="font-mono font-bold text-indigo-600">{exam.exam_code}</span>
          </p>
        </div>

        {/* Timer */}
        {exam.status === 'active' && (
          <div className="flex flex-col items-center bg-white rounded-2xl px-4 py-2 shadow-card border border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-400 font-medium mb-0.5">Còn lại</p>
            <span className={cn('font-mono text-2xl sm:text-3xl font-bold', getTimerColor(remaining, durationMs))}>
              {formatTime(remaining)}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {exam.status === 'waiting' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={14} />}
                loading={syncingImages}
                onClick={handleSyncImages}
              >
                <span className="hidden sm:inline">Cập nhật hình ảnh</span>
                <span className="sm:hidden">Cập nhật</span>
              </Button>
              <Button
                icon={<PlayCircle size={16} />}
                onClick={() => setConfirmStart(true)}
              >
                Bắt đầu thi
              </Button>
            </>
          )}
          {exam.status === 'active' && (
            <Button variant="danger" icon={<StopCircle size={16} />} onClick={() => setConfirmEnd(true)}>
              Kết thúc
            </Button>
          )}
          {exam.status === 'ended' && (
            <>
              <Button size="sm" icon={<Brain size={14} />} onClick={() => navigate(`/teacher/batch-grade/${examId}`)}>
                Chấm bài
              </Button>
              <Button size="sm" variant="secondary" icon={<FileDown size={14} />} onClick={() => navigate(`/teacher/batch-print/${examId}`)}>
                Xuất PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/teacher/export?exam=${examId}`)} icon={<Download size={14} />}>
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status banner */}
      {exam.status === 'waiting' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
            <Clock size={16} className="text-amber-700" />
          </div>
          <div>
            <p className="font-semibold text-amber-800">Ca thi đang chờ</p>
            <p className="text-sm text-amber-600">
              Học sinh có thể vào phòng thi. Nhấn "Bắt đầu thi" khi tất cả đã vào.
            </p>
          </div>
        </motion.div>
      )}
      {exam.status === 'ended' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-600" />
          <p className="font-semibold text-emerald-800">Ca thi đã kết thúc</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng học sinh', value: students.length, color: 'bg-indigo-50 text-indigo-700' },
          { label: 'Đang chờ', value: statusCounts.waiting, color: 'bg-gray-100 text-gray-700' },
          { label: 'Đang làm', value: statusCounts.active, color: 'bg-blue-50 text-blue-700' },
          { label: 'Đã nộp', value: statusCounts.submitted + statusCounts.graded, color: 'bg-emerald-50 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl p-3 sm:p-4 text-center', s.color)}>
            <p className="text-2xl sm:text-3xl font-bold">{s.value}</p>
            <p className="text-xs sm:text-sm mt-0.5 opacity-75">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Student list */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Users size={16} /> Danh sách học sinh
          </h2>
          <span className="text-sm text-gray-500">{students.length} người</span>
        </div>
        {students.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-sm">Chưa có học sinh nào vào phòng thi</p>
            <p className="text-xs mt-1">Mã phòng: <span className="font-mono font-bold text-indigo-600">{exam.exam_code}</span></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">STT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Họ tên</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lớp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tên máy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-indigo-500 uppercase">LT</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-purple-500 uppercase">TH</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-emerald-600 uppercase">Tổng</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {students.map((s, idx) => (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-medium text-gray-800 text-sm">{s.name}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">{s.class}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 font-mono">{s.computer_name}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-3 py-3.5 text-center text-sm font-semibold text-indigo-700">
                        {scoreMap[s.id]?.mc_score ?? '—'}
                      </td>
                      <td className="px-3 py-3.5 text-center text-sm font-semibold text-purple-700">
                        {scoreMap[s.id]
                          ? (scoreMap[s.id].practice_scores || []).reduce((sum, p) => sum + (p.score || 0), 0) || '—'
                          : '—'}
                      </td>
                      <td className="px-3 py-3.5 text-center text-sm font-bold text-emerald-700">
                        {scoreMap[s.id]?.total_final ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {['submitted', 'submitted_auto', 'graded'].includes(s.status) && (
                          <button
                            onClick={() => navigate(`/teacher/review/${s.id}`)}
                            className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 ml-auto"
                          >
                            <Eye size={12} /> Xem bài
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={confirmStart}
        onClose={() => setConfirmStart(false)}
        onConfirm={handleStart}
        title="Bắt đầu ca thi"
        message={`Phát đề cho ${students.length} học sinh đang chờ? Đồng hồ đếm ngược sẽ bắt đầu ngay.`}
        confirmText="Bắt đầu"
      />
      <ConfirmModal
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={handleEnd}
        title="Kết thúc ca thi"
        message="Kết thúc ca thi? Tất cả học sinh chưa nộp sẽ bị tự động nộp bài."
        confirmText="Kết thúc"
        danger
      />
    </div>
  )
}
