import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, Edit2, FileText, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { where, orderBy } from 'firebase/firestore'
import { Button, Input, Select, Modal, ConfirmModal, Card, Badge, PageLoader } from '@/components/ui'
import { QuestionForm } from '@/components/questions/QuestionForm'
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/hooks/useFirestore'
import { QUESTION_TYPES, QUESTION_TYPE_COLORS } from '@/utils/grading'
import { parseQuestionsFromText } from '@/utils/questionParser'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

const GRADE_OPTIONS = [0, 3, 4, 5]

export function QuestionBankPage() {
  const [filterGrade, setFilterGrade] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteGrade, setPasteGrade] = useState(3)
  const [parsed, setParsed] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  const constraints = []
  if (filterGrade) constraints.push(where('grade', '==', filterGrade))
  if (filterType) constraints.push(where('type', '==', filterType))
  constraints.push(orderBy('created_at', 'desc'))

  const { data: questions, loading } = useCollection('question_bank', constraints)

  const allTopics = [...new Set(questions.map(q => q.topic).filter(Boolean))].sort()

  const filtered = questions.filter(q =>
    (!search || q.question?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterTopic || q.topic === filterTopic)
  )

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        await updateDocument('question_bank', editing.id, form)
        toast.success('Đã cập nhật câu hỏi')
      } else {
        await addDocument('question_bank', form)
        toast.success('Đã thêm câu hỏi')
      }
      setShowForm(false)
      setEditing(null)
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDocument('question_bank', id)
      toast.success('Đã xóa câu hỏi')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  const handleParse = () => {
    const result = parseQuestionsFromText(pasteText, pasteGrade)
    setParsed(result)
    if (result.length === 0) toast.error('Không nhận dạng được câu hỏi nào')
    else toast.success(`Nhận dạng được ${result.length} câu hỏi`)
  }

  const handleImportParsed = async () => {
    setSaving(true)
    try {
      for (const q of parsed) {
        await addDocument('question_bank', { ...q, grade: pasteGrade })
      }
      toast.success(`Đã thêm ${parsed.length} câu hỏi vào Khối ${pasteGrade}`)
      setShowPaste(false)
      setPasteText('')
      setParsed([])
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} câu hỏi</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={<FileText size={16} />} onClick={() => setShowPaste(true)}>
            Paste từ Word
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setShowForm(true) }}>
            Thêm câu hỏi
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Tìm kiếm câu hỏi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<Search size={15} />}
            className="flex-1"
          />
          <Select value={filterGrade} onChange={e => setFilterGrade(Number(e.target.value))} className="w-36">
            <option value={0}>Tất cả khối</option>
            <option value={3}>Khối 3</option>
            <option value={4}>Khối 4</option>
            <option value={5}>Khối 5</option>
          </Select>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-44">
            <option value="">Tất cả dạng</option>
            {Object.entries(QUESTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="w-48">
            <option value="">Tất cả chủ đề</option>
            {allTopics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Question list */}
      {loading ? <PageLoader /> : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {filtered.map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="overflow-hidden">
                  <div
                    className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', QUESTION_TYPE_COLORS[q.type])}>
                          {QUESTION_TYPES[q.type]}
                        </span>
                        <Badge color={['', 'blue', 'green', 'purple'][q.grade - 2] || 'gray'}>Khối {q.grade}</Badge>
                        {q.topic && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{q.topic}</span>
                        )}
                        <span className="text-xs text-gray-400">{q.score}đ</span>
                      </div>
                      <p className="text-gray-800 text-sm font-medium line-clamp-2">{q.question}</p>
                      {q.question_image && <img src={q.question_image} alt="" className="h-12 rounded mt-1 object-contain" />}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditing(q); setShowForm(true) }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(q) }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                      {expandedId === q.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === q.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <QuestionPreview question={q} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Chưa có câu hỏi nào</p>
              <p className="text-sm mt-1">Thêm câu hỏi hoặc paste từ Word để bắt đầu</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
        size="lg"
      >
        <QuestionForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          loading={saving}
          existingTopics={allTopics}
        />
      </Modal>

      {/* Paste from Word Modal */}
      <Modal
        isOpen={showPaste}
        onClose={() => { setShowPaste(false); setPasteText(''); setParsed([]) }}
        title="Paste câu hỏi từ Word"
        size="xl"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Khối</label>
              <Select value={pasteGrade} onChange={e => setPasteGrade(Number(e.target.value))} className="w-32">
                <option value={3}>Khối 3</option>
                <option value={4}>Khối 4</option>
                <option value={5}>Khối 5</option>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700 mb-1 block">
                Dán nội dung câu hỏi từ Word vào đây:
              </label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={9}
                placeholder="Câu 1: Thiết bị nào dùng để nhập dữ liệu?&#10;A. Màn hình&#10;B. Bàn phím&#10;C. Loa&#10;D. Máy in&#10;Đáp án: B&#10;&#10;Câu 2: ..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono resize-y"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleParse} disabled={!pasteText.trim()}>
              Phân tích
            </Button>
            {parsed.length > 0 && (
              <Button loading={saving} onClick={handleImportParsed}>
                Thêm {parsed.length} câu hỏi vào Khối {pasteGrade}
              </Button>
            )}
          </div>
          {parsed.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
              <p className="text-sm font-semibold text-gray-700 mb-3">Xem trước {parsed.length} câu hỏi:</p>
              {parsed.map((q, i) => (
                <div key={i} className="py-2 border-b border-gray-200 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', QUESTION_TYPE_COLORS[q.type])}>
                      {QUESTION_TYPES[q.type]}
                    </span>
                    <span className="text-xs text-gray-400">{q.score}đ</span>
                  </div>
                  <p className="text-sm text-gray-700">{q.question}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Xóa câu hỏi"
        message={`Xóa câu hỏi "${deleteTarget?.question?.slice(0, 50)}..."? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        danger
      />
    </div>
  )
}

function QuestionPreview({ question }) {
  const OPTION_LABELS = 'ABCDEFGHIJ'
  return (
    <div className="text-sm flex flex-col gap-2">
      {question.options && (
        <div className="flex flex-col gap-1">
          {question.options.map((opt, i) => (
            <div key={i} className={cn(
              'flex items-center gap-2 px-2 py-1 rounded-lg',
              question.correct_answer === OPTION_LABELS[i] && 'bg-emerald-100 text-emerald-800 font-semibold'
            )}>
              <span className="font-bold w-5">{OPTION_LABELS[i]}.</span>
              <span>{opt}</span>
              {(question.option_images || [])[i] && (
                <img src={question.option_images[i]} alt="" className="h-10 rounded object-contain" />
              )}
            </div>
          ))}
        </div>
      )}
      {question.targets && (
        <div className="mt-1">
          <p className="text-xs font-semibold text-gray-500 mb-1">Cột phải:</p>
          {question.targets.map((t, i) => (
            <p key={i} className="px-2 py-0.5 text-gray-600">{i + 1}. {t}</p>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-200">
        <span className="text-gray-500">Đáp án:</span>
        <span className="font-semibold text-emerald-700">
          {Array.isArray(question.correct_answer)
            ? question.correct_answer.join(', ')
            : typeof question.correct_answer === 'object'
              ? Object.entries(question.correct_answer || {}).map(([k, v]) => `${k}→${v}`).join(', ')
              : question.correct_answer}
        </span>
      </div>
    </div>
  )
}
