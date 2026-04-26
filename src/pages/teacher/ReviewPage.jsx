import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Code2, Brain, AlertCircle, Save, Printer, ExternalLink } from 'lucide-react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { Button, Card, PageLoader, Badge } from '@/components/ui'
import { useDocument } from '@/hooks/useFirestore'
import { QuestionReview } from '@/components/questions/QuestionReview'
import { gradeFileWithGemini } from '@/utils/geminiGrading'
import { db } from '@/firebase/config'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'

export function ReviewPage() {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const [grading, setGrading] = useState(false)

  const { data: student, loading: sLoading } = useDocument('students', studentId)
  const { data: submission, loading: subLoading } = useDocument('submissions', studentId)
  const { data: score, loading: scoreLoading } = useDocument('scores', studentId)

  const loading = sLoading || subLoading || scoreLoading

  const handleAIGrade = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) { toast.error('Chưa cấu hình VITE_GEMINI_API_KEY'); return }
    if (!submission) return

    setGrading(true)
    try {
      const template = submission.exam_snapshot
      const practiceScores = [...(score?.practice_scores || [])]

      for (const partSub of (submission.practice_submissions || [])) {
        if (!partSub.file_url || !['word', 'ppt'].includes(partSub.type)) continue
        const partTemplate = (template?.practice_parts || []).find(p => p.id === partSub.part_id)
        if (!partTemplate?.rubric?.length) continue

        const result = await gradeFileWithGemini({
          fileUrl: partSub.file_url,
          fileName: partSub.file_name || 'file.docx',
          rubric: partTemplate.rubric,
          apiKey,
        })

        const idx = practiceScores.findIndex(p => p.part_id === partSub.part_id)
        const entry = { part_id: partSub.part_id, type: partSub.type, ...result }
        if (idx >= 0) practiceScores[idx] = entry
        else practiceScores.push(entry)
      }

      const mcScore = score?.mc_score || 0
      const practiceTotal = practiceScores.reduce((s, p) => s + (p.score || 0), 0)
      const totalMax = score?.total_max || 10

      await updateDoc(doc(db, 'scores', studentId), {
        practice_scores: practiceScores,
        total_raw: mcScore + practiceTotal,
        total_final: totalMax > 0 ? Math.round(((mcScore + practiceTotal) / totalMax) * 10 * 100) / 100 : 0,
        grading_status: 'fully_graded',
        updated_at: serverTimestamp(),
      })
      await updateDoc(doc(db, 'students', studentId), { status: 'graded' })

      toast.success('Đã chấm AI xong!')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setGrading(false)
    }
  }

  const handleSaveManualScore = async (partId, partType, manualScore, maxScore) => {
    try {
      const practiceScores = [...(score?.practice_scores || [])]
      const idx = practiceScores.findIndex(p => p.part_id === partId)
      const clamped = Math.min(Math.max(Number(manualScore) || 0, 0), maxScore)
      const entry = {
        ...(idx >= 0 ? practiceScores[idx] : {}),
        part_id: partId,
        type: partType,
        score: clamped,
        max_score: maxScore,
        manual: true,
        ai_comment: (idx >= 0 ? practiceScores[idx]?.ai_comment : '') || 'Giáo viên chấm thủ công',
      }
      if (idx >= 0) practiceScores[idx] = entry
      else practiceScores.push(entry)

      const mcScore = score?.mc_score || 0
      const practiceTotal = practiceScores.reduce((s, p) => s + (p.score || 0), 0)
      const totalMax = score?.total_max || 10

      await updateDoc(doc(db, 'scores', studentId), {
        practice_scores: practiceScores,
        total_raw: mcScore + practiceTotal,
        total_final: totalMax > 0 ? Math.round(((mcScore + practiceTotal) / totalMax) * 10 * 100) / 100 : 0,
        grading_status: 'fully_graded',
        updated_at: serverTimestamp(),
      })
      await updateDoc(doc(db, 'students', studentId), { status: 'graded' })
      toast.success('Đã lưu điểm!')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  if (loading) return <PageLoader />
  if (!student || !submission) return (
    <div className="p-8 text-center text-gray-400">
      <AlertCircle size={40} className="mx-auto mb-3" />
      <p>Không tìm thấy bài nộp</p>
    </div>
  )

  const template = submission?.exam_snapshot || null
  const mc_questions = template?.mc_questions || []
  const mc_answers = submission?.mc_answers || {}
  const mc_details = score?.mc_details || []

  const hasWordParts = (submission.practice_submissions || []).some(p => ['word', 'ppt'].includes(p.type))

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Xem bài: {student.name}</h1>
          <p className="text-sm text-gray-500">Lớp {student.class} · {student.computer_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            icon={<Printer size={14} />}
            onClick={() => navigate(`/teacher/print/${studentId}`)}
          >
            In bài
          </Button>
          {hasWordParts && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Brain size={14} />}
              loading={grading}
              onClick={handleAIGrade}
            >
              Chấm AI
            </Button>
          )}
          {score && (
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-700">{score.total_final}/10</p>
              <p className="text-xs text-gray-400">Tổng điểm</p>
            </div>
          )}
        </div>
      </div>

      {/* Score summary */}
      {score && (
        <Card className="p-5">
          <h2 className="font-bold text-gray-800 mb-3">Tổng kết điểm</h2>
          <div className="grid grid-cols-4 gap-4">
            <ScoreTile label="Trắc nghiệm" value={score.mc_score} max={mc_questions.reduce((s, q) => s + (q.score || 0), 0)} color="indigo" />
            {(score.practice_scores || []).map((ps, i) => (
              <ScoreTile
                key={i}
                label={ps.type === 'scratch' ? 'Scratch' : 'Word/PPT'}
                value={ps.score}
                max={ps.max_score}
                color={ps.type === 'scratch' ? 'orange' : 'blue'}
              />
            ))}
            <ScoreTile label="Tổng /10" value={score.total_final} max={10} color="emerald" highlight />
          </div>
        </Card>
      )}

      {/* MC Section */}
      <Card className="p-5">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-500" /> Phần trắc nghiệm
          {score && (
            <Badge color="indigo">{score.mc_score}đ / {mc_questions.reduce((s, q) => s + (q.score || 0), 0)}đ</Badge>
          )}
        </h2>
        <div className="flex flex-col gap-3">
          {mc_questions.map((q, idx) => {
            const detail = mc_details.find(d => d.question_id === q.id) || {}
            return (
              <div key={q.id}>
                <p className="text-xs font-semibold text-gray-400 mb-1.5">Câu {idx + 1}</p>
                <QuestionReview
                  question={q}
                  studentAnswer={detail.student_answer ?? mc_answers[q.id]}
                  result={{
                    is_correct: detail.is_correct,
                    score: detail.score ?? 0,
                    max_score: q.score ?? 0,
                    manual: detail.manual,
                  }}
                />
              </div>
            )
          })}
          {mc_questions.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">Không có câu trắc nghiệm</p>
          )}
        </div>
      </Card>

      {/* Practice Section */}
      {(submission.practice_submissions || []).map((ps, idx) => {
        const partTemplate = template?.practice_parts?.find(p => p.id === ps.part_id)
        const practiceScore = score?.practice_scores?.find(p => p.part_id === ps.part_id)
        return (
          <PracticeReview
            key={ps.part_id}
            submission={ps}
            idx={idx}
            practiceScore={practiceScore}
            template={partTemplate}
            onSaveManualScore={handleSaveManualScore}
          />
        )
      })}
    </div>
  )
}

function PracticeReview({ submission, idx, practiceScore, template, onSaveManualScore }) {
  const isWord = submission.type === 'word' || submission.type === 'ppt'
  const isScratch = submission.type === 'scratch'
  const maxScore = isScratch
    ? (template?.max_score || 0)
    : (template?.rubric || []).reduce((s, r) => s + (r.score || 0), 0)

  const [manualScore, setManualScore] = useState(practiceScore?.score ?? 0)

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          {isWord ? <FileText size={16} className="text-blue-500" /> : <Code2 size={16} className="text-orange-500" />}
          Câu thực hành {idx + 1}
          {practiceScore && (
            <Badge color={isWord ? 'blue' : 'orange'}>{practiceScore.score}đ / {practiceScore.max_score}đ</Badge>
          )}
        </h2>
      </div>

      {template?.prompt && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 font-semibold mb-1">Đề bài:</p>
          <p className="text-sm text-gray-700">{template.prompt}</p>
        </div>
      )}

      {/* File viewer */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <p className="text-xs text-gray-500 font-semibold">File nộp: <span className="text-gray-700 font-medium">{submission.file_name}</span></p>
          <a href={submission.file_url} target="_blank" rel="noreferrer"
            className="text-xs text-indigo-500 hover:underline">
            Tải xuống
          </a>
        </div>

        {isWord && submission.file_url && (
          <iframe
            src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(submission.file_url)}`}
            className="w-full rounded-xl border border-gray-200"
            style={{ height: '520px' }}
            title="Xem file"
          />
        )}

        {isScratch && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <a
                href={`https://turbowarp.org/?project_url=${encodeURIComponent(submission.file_url)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline"
              >
                <ExternalLink size={12} /> Mở trong TurboWarp Editor
              </a>
            </div>
            <iframe
              src={`https://turbowarp.org/embed?project_url=${encodeURIComponent(submission.file_url)}`}
              className="w-full rounded-xl border border-gray-200"
              style={{ height: '440px' }}
              title="Scratch player"
              allowFullScreen
            />
          </>
        )}
      </div>

      {/* Manual score input — for all types */}
      <div className={cn(
        'mt-4 p-4 rounded-xl border',
        isScratch ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'
      )}>
        <p className={cn('text-sm font-semibold mb-3', isScratch ? 'text-orange-800' : 'text-blue-800')}>
          Nhập điểm thủ công (tối đa {maxScore}đ):
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max={maxScore}
            step="0.25"
            value={manualScore}
            onChange={e => setManualScore(e.target.value)}
            className={cn(
              'w-24 px-3 py-2 rounded-xl border bg-white text-center font-bold focus:outline-none focus:ring-2',
              isScratch
                ? 'border-orange-200 text-orange-700 focus:ring-orange-300'
                : 'border-blue-200 text-blue-700 focus:ring-blue-300'
            )}
          />
          <span className={cn('text-sm', isScratch ? 'text-orange-600' : 'text-blue-600')}>
            / {maxScore} điểm
          </span>
          <Button
            size="sm"
            icon={<Save size={14} />}
            onClick={() => onSaveManualScore(submission.part_id, submission.type, manualScore, maxScore)}
          >
            Lưu điểm
          </Button>
        </div>
      </div>

      {/* AI grading results */}
      {practiceScore && isWord && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">Kết quả chấm AI:</p>
          {practiceScore.details?.map((d, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-2">
              <span className="text-sm text-gray-700">{d.criterion || d.name}</span>
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-sm font-bold',
                  d.score >= d.max_score * 0.8 ? 'text-emerald-600'
                    : d.score >= d.max_score * 0.4 ? 'text-amber-500' : 'text-red-500'
                )}>
                  {d.score}/{d.max_score}đ
                </span>
                {d.comment && <span className="text-xs text-gray-400 italic">{d.comment}</span>}
              </div>
            </div>
          ))}
          {practiceScore.ai_comment && (
            <div className="mt-2 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-700 italic">
              <Brain size={14} className="inline mr-1" /> {practiceScore.ai_comment}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ScoreTile({ label, value, max, color, highlight }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-700',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className={cn('rounded-xl p-3 text-center', colorMap[color], highlight && 'ring-2 ring-emerald-300')}>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      <p className="text-xs opacity-75 mt-0.5">{label}</p>
      <p className="text-xs opacity-50">/ {max}</p>
    </div>
  )
}
