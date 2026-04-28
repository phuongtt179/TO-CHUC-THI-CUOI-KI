import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, PlayCircle, Clock, Users, ArrowRight, Copy, Check, Trash2 } from 'lucide-react'
import { orderBy, where } from 'firebase/firestore'
import { Button, Card, Input, Select, Modal, ConfirmModal, StatusBadge, PageLoader } from '@/components/ui'
import { useCollection, addDocument, updateDocument, deleteDocument, getDocumentOnce } from '@/hooks/useFirestore'
import { generateExamCode } from '@/utils/export'
import { serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export function ExamSessionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ template_id: searchParams.get('template') || '', class: '', duration: 35 })
  const [copied, setCopied] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const { data: exams, loading: examsLoading } = useCollection('exams', [orderBy('created_at', 'desc')])
  const { data: templates } = useCollection('exam_templates', [orderBy('created_at', 'desc')])

  useEffect(() => {
    if (searchParams.get('template')) setShowCreate(true)
  }, [])

  const handleCreate = async () => {
    if (!form.template_id) { toast.error('Vui lòng chọn đề thi'); return }
    if (!form.class.trim()) { toast.error('Vui lòng nhập tên lớp'); return }

    setCreating(true)
    try {
      const template = await getDocumentOnce('exam_templates', form.template_id)
      if (!template) throw new Error('Không tìm thấy đề thi')

      // Re-fetch latest question data from bank so images/edits are always up to date
      console.log('[ExamSession] mc_questions before refresh:', JSON.stringify(
        (template.mc_questions || []).map(q => ({ id: q.id, img: q.question_image || '(none)' }))
      ))
      const refreshed = await Promise.all(
        (template.mc_questions || []).map(async q => {
          const latest = await getDocumentOnce('question_bank', q.id)
          console.log(`[ExamSession] q.id=${q.id} → latest?.question_image=${latest?.question_image || '(none)'}`)
          return latest ? { ...latest, score: q.score } : q
        })
      )
      console.log('[ExamSession] after refresh:', JSON.stringify(
        refreshed.map(q => ({ id: q.id, img: q.question_image || '(none)' }))
      ))

      const exam_code = generateExamCode()
      await addDocument('exams', {
        template_id: form.template_id,
        template_snapshot: { ...template, mc_questions: refreshed, duration: Number(form.duration) },
        exam_code,
        class: form.class,
        status: 'waiting',
        start_time: null,
        end_time: null,
      })
      toast.success(`Đã tạo ca thi · Mã: ${exam_code}`)
      setShowCreate(false)
      setForm({ template_id: '', class: '', duration: 35 })
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('exams', deleteTarget.id)
      toast.success('Đã xóa ca thi')
      setDeleteTarget(null)
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  if (examsLoading) return <PageLoader />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ca thi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{exams.length} ca thi</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Tạo ca thi
        </Button>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <PlayCircle size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Chưa có ca thi nào</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            Tạo ca thi đầu tiên
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exams.map((exam, idx) => (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className="p-5">
                <div className="flex items-center gap-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-gray-800">
                        {exam.template_snapshot?.name || 'Đề thi'}
                      </h3>
                      <StatusBadge status={exam.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Lớp {exam.class}</span>
                      {exam.created_at && (
                        <span>{format(exam.created_at.toDate?.() || new Date(), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        {exam.template_snapshot?.duration || 35} phút
                      </span>
                    </div>
                  </div>

                  {/* Exam code */}
                  <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl">
                    <span className="text-xs text-indigo-500 font-medium">Mã phòng</span>
                    <span className="font-mono font-bold text-xl text-indigo-700 tracking-widest">
                      {exam.exam_code}
                    </span>
                    <button
                      onClick={() => copyCode(exam.exam_code)}
                      className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
                      title="Sao chép"
                    >
                      {copied === exam.exam_code ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Users size={14} />}
                      onClick={() => navigate(`/teacher/monitor/${exam.id}`)}
                    >
                      Theo dõi
                    </Button>
                    {exam.status === 'ended' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/teacher/export?exam=${exam.id}`)}
                      >
                        Xuất Excel
                      </Button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(exam)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa ca thi"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create exam modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tạo ca thi mới"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Hủy</Button>
            <Button loading={creating} onClick={handleCreate}>Tạo ca thi</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Chọn đề thi"
            value={form.template_id}
            onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}
          >
            <option value="">-- Chọn đề thi --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} (Khối {t.grade})</option>
            ))}
          </Select>
          <Input
            label="Lớp"
            value={form.class}
            onChange={e => setForm(p => ({ ...p, class: e.target.value }))}
            placeholder="VD: 3A1, 4B2..."
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Thời gian làm bài</label>
            <div className="flex flex-wrap gap-2">
              {[15, 20, 25, 30, 35, 40, 45, 60, 90].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, duration: m }))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                    form.duration === m
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {m} phút
                </button>
              ))}
            </div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-700">
            Một mã phòng thi 6 ký tự sẽ được tạo tự động.
            Học sinh dùng mã này để vào phòng thi.
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa ca thi"
        message={`Xóa ca thi "${deleteTarget?.template_snapshot?.name}" (Lớp ${deleteTarget?.class})? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        danger
      />
    </div>
  )
}
