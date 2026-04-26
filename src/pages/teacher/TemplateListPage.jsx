import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, FileText, Edit2, Trash2, Clock, BookOpen } from 'lucide-react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, ConfirmModal, GradeBadge, PageLoader } from '@/components/ui'
import { useCollection, deleteDocument } from '@/hooks/useFirestore'
import toast from 'react-hot-toast'

export function TemplateListPage() {
  const navigate = useNavigate()
  const { data: templates, loading } = useCollection('exam_templates', [orderBy('created_at', 'desc')])
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleDelete = async (id) => {
    try {
      await deleteDocument('exam_templates', id)
      toast.success('Đã xóa đề thi')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Đề thi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{templates.length} đề thi</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => navigate('/teacher/templates/new')}>
          Tạo đề mới
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Chưa có đề thi nào</p>
          <Button className="mt-4" onClick={() => navigate('/teacher/templates/new')}>
            Tạo đề đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card hover className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <GradeBadge grade={t.grade} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-base truncate">{t.name}</h3>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => navigate(`/teacher/templates/${t.id}`)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={14} />
                    {t.mc_questions?.length || 0} câu TN
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText size={14} />
                    {t.practice_parts?.length || 0} thực hành
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {t.duration} phút
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                  <button
                    onClick={() => navigate(`/teacher/exams/new?template=${t.id}`)}
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                  >
                    Tạo ca thi →
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Xóa đề thi"
        message={`Xóa đề "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        danger
      />
    </div>
  )
}
