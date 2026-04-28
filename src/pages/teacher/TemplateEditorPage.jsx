import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Search, Shuffle, Save, ArrowLeft,
  ChevronDown, ChevronUp, Settings, FileText, Code2, Upload, X, RefreshCw
} from 'lucide-react'
import { where, orderBy } from 'firebase/firestore'
import { Button, Input, Select, Textarea, Card, Modal, Badge, PageLoader } from '@/components/ui'
import { useCollection, addDocument, updateDocument, getDocumentOnce, queryOnce } from '@/hooks/useFirestore'
import { uploadToCloudinary } from '@/utils/cloudinary'
import { QUESTION_TYPES, QUESTION_TYPE_COLORS } from '@/utils/grading'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

const DEFAULT_RUBRIC = [
  { id: crypto.randomUUID(), name: 'Nội dung', score: 4 },
  { id: crypto.randomUUID(), name: 'Hình ảnh', score: 2 },
  { id: crypto.randomUUID(), name: 'Trình bày', score: 2 },
]

const DEFAULT_TEST = { id: crypto.randomUUID(), input: '', expected: '', score: 2.5 }

const DEFAULT_PART = (type) => ({
  id: crypto.randomUUID(),
  type,
  prompt: '',
  rubric: type !== 'scratch' ? [...DEFAULT_RUBRIC] : null,
  scratch_tests: null,
  max_score: type === 'scratch' ? 3 : null,
})

export function TemplateEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [form, setForm] = useState({
    name: '',
    grade: 3,
    duration: 35,
    mc_questions: [],
    practice_parts: [],
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showQBank, setShowQBank] = useState(false)
  const [qBankGrade, setQBankGrade] = useState(0)
  const [qBankType, setQBankType] = useState('')
  const [qBankTopic, setQBankTopic] = useState('')
  const [qBankSearch, setQBankSearch] = useState('')
  const [qBankConstraints, setQBankConstraints] = useState([orderBy('created_at', 'desc')])

  const { data: bankQuestions } = useCollection('question_bank', qBankConstraints)

  useEffect(() => {
    if (isEdit) {
      getDocumentOnce('exam_templates', id).then(data => {
        if (data) setForm(data)
        setLoading(false)
      })
    }
  }, [id])

  useEffect(() => {
    const c = []
    if (qBankGrade) c.push(where('grade', '==', qBankGrade))
    if (qBankType) c.push(where('type', '==', qBankType))
    c.push(orderBy('created_at', 'desc'))
    setQBankConstraints(c)
  }, [qBankGrade, qBankType])

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const allTopics = [...new Set(bankQuestions.map(q => q.topic).filter(Boolean))].sort()

  const filteredBank = bankQuestions.filter(q =>
    !form.mc_questions.some(mq => mq.id === q.id) &&
    (!qBankSearch || q.question?.toLowerCase().includes(qBankSearch.toLowerCase())) &&
    (!qBankTopic || q.topic === qBankTopic)
  )

  const addQuestion = (q) => {
    set('mc_questions', [...form.mc_questions, q])
  }

  const removeQuestion = (qid) => {
    set('mc_questions', form.mc_questions.filter(q => q.id !== qid))
  }

  const addRandom = () => {
    const available = filteredBank.slice()
    const count = Math.min(10, available.length)
    const shuffled = available.sort(() => Math.random() - 0.5).slice(0, count)
    set('mc_questions', [...form.mc_questions, ...shuffled])
  }

  const applyCommonScore = () => {
    const score = prompt('Điểm chung cho tất cả câu hỏi trắc nghiệm:')
    if (!score) return
    const s = parseFloat(score)
    if (isNaN(s)) return
    set('mc_questions', form.mc_questions.map(q => ({ ...q, score: s })))
    toast.success(`Đã áp dụng ${s}đ cho tất cả câu hỏi`)
  }

  const addPracticePart = (type) => {
    set('practice_parts', [...form.practice_parts, DEFAULT_PART(type)])
  }

  const updatePart = (partId, updates) => {
    set('practice_parts', form.practice_parts.map(p => p.id === partId ? { ...p, ...updates } : p))
  }

  const removePart = (partId) => {
    set('practice_parts', form.practice_parts.filter(p => p.id !== partId))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên đề'); return }
    if (form.mc_questions.length === 0) { toast.error('Vui lòng chọn ít nhất 1 câu hỏi'); return }
    setSaving(true)
    try {
      const data = { ...form }
      if (isEdit) {
        await updateDocument('exam_templates', id, data)
        toast.success('Đã cập nhật đề thi')
      } else {
        await addDocument('exam_templates', data)
        toast.success('Đã tạo đề thi')
      }
      navigate('/teacher/templates')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const syncQuestionsFromBank = async () => {
    if (form.mc_questions.length === 0) return
    setSyncing(true)
    try {
      const updated = await Promise.all(
        form.mc_questions.map(q => getDocumentOnce('question_bank', q.id))
      )
      set('mc_questions', form.mc_questions.map((q, i) =>
        updated[i] ? { ...updated[i], score: q.score } : q
      ))
      toast.success('Đã cập nhật câu hỏi từ ngân hàng (kể cả hình ảnh)')
    } catch (e) {
      toast.error('Lỗi đồng bộ: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <PageLoader />

  const totalMCScore = form.mc_questions.reduce((s, q) => s + (q.score || 0), 0)
  const totalPracticeScore = form.practice_parts.reduce((s, p) => {
    if (p.rubric) return s + p.rubric.reduce((rs, r) => rs + (r.score || 0), 0)
    if (p.max_score) return s + p.max_score
    return s
  }, 0)

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/teacher/templates')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{isEdit ? 'Chỉnh sửa đề thi' : 'Tạo đề thi mới'}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-xl">
          <span>Tổng điểm:</span>
          <span className="font-bold text-gray-800">{(totalMCScore + totalPracticeScore).toFixed(2)}đ</span>
        </div>
        <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>
          Lưu đề thi
        </Button>
      </div>

      {/* Basic info */}
      <Card className="p-5">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Settings size={16} className="text-indigo-500" /> Thông tin đề thi
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Tên đề thi"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="VD: Đề thi Tin học cuối kì..."
            containerClass="col-span-1"
          />
          <Select label="Khối" value={form.grade} onChange={e => set('grade', Number(e.target.value))}>
            <option value={3}>Khối 3</option>
            <option value={4}>Khối 4</option>
            <option value={5}>Khối 5</option>
          </Select>
          <Input
            label="Thời gian (phút)"
            type="number"
            min="1"
            max="180"
            value={form.duration}
            onChange={e => set('duration', Number(e.target.value))}
            suffix="phút"
          />
        </div>
      </Card>

      {/* MC Questions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" />
            Phần trắc nghiệm
            <span className="text-sm font-normal text-gray-500">({form.mc_questions.length} câu · {totalMCScore.toFixed(2)}đ)</span>
          </h2>
          <div className="flex gap-2">
            {form.mc_questions.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={applyCommonScore}>
                  Áp dụng điểm chung
                </Button>
                <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} loading={syncing} onClick={syncQuestionsFromBank} title="Cập nhật hình ảnh từ ngân hàng câu hỏi">
                  Đồng bộ hình ảnh
                </Button>
              </>
            )}
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowQBank(true)}>
              Thêm câu hỏi
            </Button>
          </div>
        </div>

        {form.mc_questions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-sm">Chưa có câu hỏi nào</p>
            <button onClick={() => setShowQBank(true)} className="mt-2 text-sm text-indigo-600 font-medium hover:underline">
              + Chọn từ ngân hàng
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {form.mc_questions.map((q, idx) => (
              <div key={q.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{q.question}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', QUESTION_TYPE_COLORS[q.type])}>
                      {QUESTION_TYPES[q.type]}
                    </span>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={q.score || 0}
                  onChange={e => set('mc_questions', form.mc_questions.map((mq, i) =>
                    i === idx ? { ...mq, score: parseFloat(e.target.value) || 0 } : mq
                  ))}
                  className="w-16 text-center rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-indigo-400"
                />
                <span className="text-xs text-gray-400">đ</span>
                <button onClick={() => removeQuestion(q.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Practice Parts */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Code2 size={16} className="text-purple-500" />
            Phần thực hành
            <span className="text-sm font-normal text-gray-500">({form.practice_parts.length} phần · {totalPracticeScore.toFixed(2)}đ)</span>
          </h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => addPracticePart('word')}>
              Word/PPT
            </Button>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => addPracticePart('scratch')}>
              Scratch
            </Button>
          </div>
        </div>

        {form.practice_parts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-sm">Chưa có phần thực hành</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {form.practice_parts.map((part, idx) => (
              <PracticePartEditor key={part.id} part={part} idx={idx} onUpdate={updatePart} onRemove={removePart} />
            ))}
          </div>
        )}
      </Card>

      {/* Question bank modal */}
      <Modal
        isOpen={showQBank}
        onClose={() => setShowQBank(false)}
        title="Chọn câu hỏi từ ngân hàng"
        size="xl"
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <Input
              placeholder="Tìm kiếm..."
              value={qBankSearch}
              onChange={e => setQBankSearch(e.target.value)}
              icon={<Search size={15} />}
              className="flex-1"
            />
            <Select value={qBankGrade} onChange={e => setQBankGrade(Number(e.target.value))} className="w-32">
              <option value={0}>Tất cả</option>
              <option value={3}>Khối 3</option>
              <option value={4}>Khối 4</option>
              <option value={5}>Khối 5</option>
            </Select>
            <Select value={qBankType} onChange={e => setQBankType(e.target.value)} className="w-40">
              <option value="">Tất cả dạng</option>
              {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Select value={qBankTopic} onChange={e => setQBankTopic(e.target.value)} className="w-44">
              <option value="">Tất cả chủ đề</option>
              {allTopics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Button variant="secondary" icon={<Shuffle size={14} />} onClick={addRandom}>
              Random 10
            </Button>
          </div>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {filteredBank.map(q => (
              <div key={q.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', QUESTION_TYPE_COLORS[q.type])}>
                      {QUESTION_TYPES[q.type]}
                    </span>
                    {q.topic && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{q.topic}</span>
                    )}
                    <span className="text-xs text-gray-400">{q.score}đ</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{q.question}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => addQuestion(q)}>
                  + Chọn
                </Button>
              </div>
            ))}
            {filteredBank.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">Không có câu hỏi phù hợp</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PracticePartEditor({ part, idx, onUpdate, onRemove }) {
  const [collapsed, setCollapsed] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const pdfRef = useRef(null)

  const handlePdfUpload = async (file) => {
    if (!file) return
    setUploadingPdf(true)
    try {
      const url = await uploadToCloudinary(file, 'practice_prompts')
      onUpdate(part.id, { prompt_file_url: url, prompt_file_name: file.name })
      toast.success('Đã tải lên đề bài PDF')
    } catch (e) {
      toast.error('Lỗi upload: ' + e.message)
    } finally {
      setUploadingPdf(false)
    }
  }

  const updateRubric = (rubricId, updates) => {
    onUpdate(part.id, {
      rubric: part.rubric.map(r => r.id === rubricId ? { ...r, ...updates } : r)
    })
  }

  const addRubric = () => {
    onUpdate(part.id, {
      rubric: [...(part.rubric || []), { id: crypto.randomUUID(), name: '', score: 2 }]
    })
  }

  const removeRubric = (rid) => {
    onUpdate(part.id, { rubric: part.rubric.filter(r => r.id !== rid) })
  }

  const updateTest = (testId, updates) => {
    onUpdate(part.id, {
      scratch_tests: part.scratch_tests.map(t => t.id === testId ? { ...t, ...updates } : t)
    })
  }

  const addTest = () => {
    onUpdate(part.id, {
      scratch_tests: [...(part.scratch_tests || []), { id: crypto.randomUUID(), input: '', expected: '', score: 2.5 }]
    })
  }

  const removeTest = (tid) => {
    onUpdate(part.id, { scratch_tests: part.scratch_tests.filter(t => t.id !== tid) })
  }

  const typeLabel = { word: 'Word/PPT', scratch: 'Scratch' }

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-bold',
            part.type === 'word' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
          )}>
            {typeLabel[part.type]}
          </span>
          <span className="text-sm font-medium text-gray-700">Câu thực hành {idx + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onRemove(part.id) }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
          {collapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 flex flex-col gap-4">
              <Textarea
                label="Đề bài / Yêu cầu (văn bản)"
                value={part.prompt}
                onChange={e => onUpdate(part.id, { prompt: e.target.value })}
                placeholder="Nhập yêu cầu cho học sinh..."
                rows={3}
              />

              {/* PDF upload for prompt */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">
                  File đề bài (PDF) — học sinh xem khi làm bài
                </label>
                {part.prompt_file_url ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <FileText size={16} className="text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-blue-700 font-medium flex-1 truncate">{part.prompt_file_name || 'đề bài.pdf'}</span>
                    <a href={part.prompt_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Xem</a>
                    <button
                      onClick={() => onUpdate(part.id, { prompt_file_url: '', prompt_file_name: '' })}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => pdfRef.current?.click()}
                    disabled={uploadingPdf}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm w-fit"
                  >
                    <Upload size={15} />
                    {uploadingPdf ? 'Đang tải...' : 'Upload PDF đề bài'}
                  </button>
                )}
                <input
                  ref={pdfRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => handlePdfUpload(e.target.files[0])}
                />
              </div>

              {part.type !== 'scratch' && part.rubric && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">
                      Rubric chấm điểm
                      <span className="ml-2 text-gray-400 font-normal">
                        (tổng: {part.rubric.reduce((s, r) => s + (r.score || 0), 0)}đ)
                      </span>
                    </label>
                    <button type="button" onClick={addRubric} className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
                      <Plus size={14} /> Thêm tiêu chí
                    </button>
                  </div>
                  {part.rubric.map(r => (
                    <div key={r.id} className="flex items-center gap-2">
                      <Input
                        value={r.name}
                        onChange={e => updateRubric(r.id, { name: e.target.value })}
                        placeholder="Tên tiêu chí"
                        containerClass="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={r.score}
                        onChange={e => updateRubric(r.id, { score: parseFloat(e.target.value) || 0 })}
                        suffix="đ"
                        containerClass="w-32"
                      />
                      <button onClick={() => removeRubric(r.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {part.type === 'scratch' && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-700 flex-shrink-0">Điểm tối đa</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={part.max_score ?? 3}
                      onChange={e => onUpdate(part.id, { max_score: parseFloat(e.target.value) || 0 })}
                      className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-center font-bold text-orange-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    <span className="text-sm text-gray-500">điểm — giáo viên chấm thủ công</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
