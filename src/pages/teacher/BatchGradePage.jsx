import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Brain, CheckCircle, AlertCircle, Loader2, FileText, Code2 } from 'lucide-react'
import { where } from 'firebase/firestore'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { Button, Card, PageLoader } from '@/components/ui'
import { useDocument, useCollection } from '@/hooks/useFirestore'
import { gradeFileWithGemini } from '@/utils/geminiGrading'
import { db } from '@/firebase/config'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'

export function BatchGradePage() {
  const navigate = useNavigate()
  const { examId } = useParams()

  const { data: exam, loading: examLoading } = useDocument('exams', examId)
  const { data: allStudents } = useCollection('students', [where('exam_id', '==', examId)])

  const submittedStudents = [...allStudents]
    .filter(s => ['submitted', 'submitted_auto', 'graded'].includes(s.status))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))

  const [selected, setSelected] = useState(new Set())
  const [grading, setGrading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState({})

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const template = exam?.template_snapshot

  const practiceParts = template?.practice_parts || []
  const hasWordParts = practiceParts.some(p => p.type === 'word' || p.type === 'ppt')
  const hasScratchParts = practiceParts.some(p => p.type === 'scratch')

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === submittedStudents.length) setSelected(new Set())
    else setSelected(new Set(submittedStudents.map(s => s.id)))
  }

  const handleGrade = async () => {
    if (selected.size === 0) { toast.error('Chọn ít nhất 1 học sinh'); return }
    if (!apiKey) { toast.error('Chưa cấu hình VITE_GEMINI_API_KEY'); return }
    if (!hasWordParts) { toast.error('Đề thi này không có phần Word/PPT để chấm tự động'); return }

    setGrading(true)
    setResults({})
    const list = submittedStudents.filter(s => selected.has(s.id))

    for (let i = 0; i < list.length; i++) {
      setCurrentIdx(i)
      const student = list[i]

      try {
        const subSnap = await getDoc(doc(db, 'submissions', student.id))
        if (!subSnap.exists()) {
          setResults(prev => ({ ...prev, [student.id]: { error: 'Không tìm thấy bài nộp' } }))
          continue
        }
        const submission = subSnap.data()
        const examSnapshot = submission.exam_snapshot || template

        const scoreSnap = await getDoc(doc(db, 'scores', student.id))
        const existingScore = scoreSnap.exists() ? scoreSnap.data() : {}
        const practiceScores = [...(existingScore.practice_scores || [])]

        for (const partSub of (submission.practice_submissions || [])) {
          if (!partSub.file_url) continue
          if (!['word', 'ppt'].includes(partSub.type)) continue

          const partTemplate = (examSnapshot?.practice_parts || []).find(p => p.id === partSub.part_id)
          if (!partTemplate || !partTemplate.rubric?.length) continue

          const graded = await gradeFileWithGemini({
            fileUrl: partSub.file_url,
            fileName: partSub.file_name || 'file.docx',
            rubric: partTemplate.rubric,
            apiKey,
          })

          const idx = practiceScores.findIndex(p => p.part_id === partSub.part_id)
          const entry = { part_id: partSub.part_id, type: partSub.type, ...graded }
          if (idx >= 0) practiceScores[idx] = entry
          else practiceScores.push(entry)
        }

        const mcScore = existingScore.mc_score || 0
        const practiceTotal = practiceScores.reduce((s, p) => s + (p.score || 0), 0)
        const totalRaw = mcScore + practiceTotal
        const totalMax = existingScore.total_max || 10
        const totalFinal = totalMax > 0 ? Math.round((totalRaw / totalMax) * 10 * 100) / 100 : 0

        await updateDoc(doc(db, 'scores', student.id), {
          practice_scores: practiceScores,
          total_raw: totalRaw,
          total_final: totalFinal,
          grading_status: 'fully_graded',
          updated_at: serverTimestamp(),
        })
        await updateDoc(doc(db, 'students', student.id), { status: 'graded' })

        setResults(prev => ({ ...prev, [student.id]: { success: true, totalFinal } }))
      } catch (e) {
        console.error(student.name, e)
        setResults(prev => ({ ...prev, [student.id]: { error: e.message } }))
      }

      // 1.5s delay to avoid Gemini rate limiting
      if (i < list.length - 1) await new Promise(r => setTimeout(r, 1500))
    }

    setGrading(false)
    const successCount = Object.values(results).filter(r => r.success).length
    toast.success(`Hoàn thành chấm ${list.length} bài!`)
  }

  if (examLoading) return <PageLoader />

  const allSelected = selected.size > 0 && selected.size === submittedStudents.length
  const someSelected = selected.size > 0 && selected.size < submittedStudents.length
  const gradingList = submittedStudents.filter(s => selected.has(s.id))

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Chấm bài tự động</h1>
          <p className="text-sm text-gray-500">{template?.name} · Lớp {exam?.class}</p>
        </div>
        <Button
          icon={<Brain size={16} />}
          loading={grading}
          disabled={selected.size === 0 || grading}
          onClick={handleGrade}
        >
          Chấm {selected.size > 0 ? `${selected.size} bài` : 'bài'}
        </Button>
      </div>

      {/* Info */}
      <div className="flex gap-3">
        {hasWordParts && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 rounded-xl px-3 py-2 text-sm font-medium">
            <FileText size={14} /> Word/PPT — Gemini tự chấm
          </div>
        )}
        {hasScratchParts && (
          <div className="flex items-center gap-2 bg-orange-50 text-orange-700 rounded-xl px-3 py-2 text-sm font-medium">
            <Code2 size={14} /> Scratch — Giáo viên chấm tay
          </div>
        )}
      </div>

      {/* API Key warning */}
      {!apiKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Chưa cấu hình Gemini API Key</p>
            <p className="text-xs text-amber-600 mt-1">
              Thêm <code className="bg-amber-100 px-1 rounded font-mono">VITE_GEMINI_API_KEY=...</code> vào file <code className="bg-amber-100 px-1 rounded font-mono">.env</code>
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {grading && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={16} className="text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-indigo-800">
              Đang chấm {currentIdx + 1}/{gradingList.length}: {gradingList[currentIdx]?.name}
            </p>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentIdx + 1) / gradingList.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Student list */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected }}
            onChange={toggleAll}
            disabled={grading}
            className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
          />
          <h2 className="font-bold text-gray-800 flex-1">
            Bài đã nộp ({submittedStudents.length})
          </h2>
          {selected.size > 0 && (
            <span className="text-sm text-indigo-600 font-semibold">Đã chọn {selected.size}</span>
          )}
        </div>

        {submittedStudents.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Chưa có học sinh nào nộp bài</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {submittedStudents.map((student, idx) => {
              const result = results[student.id]
              const isCurrent = grading && gradingList[currentIdx]?.id === student.id
              return (
                <div key={student.id} className={cn(
                  'flex items-center gap-4 px-5 py-3.5 transition-colors',
                  result?.success ? 'bg-emerald-50' : 'hover:bg-gray-50',
                  isCurrent && 'bg-indigo-50'
                )}>
                  <input
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={() => toggleSelect(student.id)}
                    disabled={grading}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-400 w-6">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                    <p className="text-xs text-gray-500">Lớp {student.class} · {student.computer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && <Loader2 size={14} className="text-indigo-500 animate-spin" />}
                    {result?.success && (
                      <>
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700">{result.totalFinal}/10đ</span>
                      </>
                    )}
                    {result?.error && (
                      <div className="flex items-center gap-1">
                        <AlertCircle size={14} className="text-red-500" />
                        <span className="text-xs text-red-500 max-w-[200px] truncate">{result.error}</span>
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/teacher/review/${student.id}`)}
                      className="text-xs text-indigo-600 font-semibold hover:underline ml-2"
                    >
                      Xem bài
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
