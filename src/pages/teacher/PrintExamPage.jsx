import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { useDocument } from '@/hooks/useFirestore'
import { useQuestionsWithImages } from '@/hooks/useQuestionsWithImages'
import { PageLoader } from '@/components/ui'
import { cn } from '@/utils/cn'

const OPTION_LABELS = 'ABCDEFGHIJ'

export function PrintExamPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const { data: student, loading: sLoading } = useDocument('students', studentId)
  const { data: submission, loading: subLoading } = useDocument('submissions', studentId)
  const { data: score, loading: scoreLoading } = useDocument('scores', studentId)

  const mcQuestions = useQuestionsWithImages(submission?.exam_snapshot?.mc_questions)

  useEffect(() => {
    document.title = student ? `Bài thi - ${student.name}` : 'In bài thi'
  }, [student])

  if (sLoading || subLoading || scoreLoading) return <PageLoader />
  if (!student || !submission) return <div className="p-8 text-gray-400 text-center">Không tìm thấy bài nộp</div>

  const template = submission.exam_snapshot || {}
  const practiceParts = template.practice_parts || []
  // mcQuestions already declared above via useQuestionsWithImages
  const mc_answers = submission.mc_answers || {}
  const mc_details = score?.mc_details || []
  const practiceScores = score?.practice_scores || []

  // Derive grade number from class string (e.g. "5A1" → 5)
  const gradeNum = student.class?.match(/\d/)?.[0] || ''
  const currentYear = new Date().getFullYear()
  const schoolYear = `${currentYear - 1}-${currentYear}`
  const duration = template.duration || 35

  const mcTotal = mcQuestions.reduce((s, q) => s + (q.score || 0), 0)
  const practiceTotal = practiceParts.reduce((s, p) => {
    if (p.rubric) return s + p.rubric.reduce((r, c) => r + (c.score || 0), 0)
    if (p.max_score) return s + p.max_score
    return s
  }, 0)

  return (
    <div>
      {/* Toolbar - hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm text-gray-600 flex-1">
          Xem trước bài thi: <strong>{student.name}</strong> — {student.class}
        </span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Printer size={16} /> In / Xuất PDF
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .exam-paper { font-family: 'Times New Roman', Times, serif; font-size: 13pt; }
        .exam-paper table { border-collapse: collapse; }
        .exam-paper .header-table { width: 100%; }
        .exam-paper .header-table td { border: 1.5px solid black; padding: 6px 10px; vertical-align: top; }
      `}</style>

      {/* A4 paper */}
      <div className="print:pt-0 pt-16">
        <div className="exam-paper max-w-[210mm] mx-auto bg-white px-[15mm] py-[10mm] min-h-[297mm] print:px-0 print:py-0">

          {/* ── HEADER ── */}
          <table className="header-table mb-4">
            <tbody>
              <tr>
                <td style={{ width: '50%' }}>
                  <div className="font-bold text-center text-[13pt]">TRƯỜNG TH NGUYỄN PHAN VINH</div>
                  <div className="mt-1">Họ và tên: <span className="font-semibold">{student.name}</span></div>
                  <div>Lớp: <span className="font-semibold">{student.class}</span> /
                    <span className="ml-2 text-sm text-gray-500">{student.computer_name}</span>
                  </div>
                  <div className="font-bold mt-1">ĐỀ CHÍNH THỨC</div>
                </td>
                <td style={{ width: '50%', textAlign: 'center' }}>
                  <div className="font-bold text-[13pt]">ĐỀ KIỂM TRA CUỐI HỌC KÌ II</div>
                  <div className="font-bold">NĂM HỌC: {schoolYear}</div>
                  <div className="font-bold">MÔN TIN HỌC {gradeNum ? `– LỚP ${gradeNum}` : ''}</div>
                  <div className="italic text-[12pt]">Thời gian làm bài: {duration} phút</div>
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <span className="font-bold underline">Điểm</span>:&nbsp;
                  <span className="font-bold text-[16pt]">{score?.total_final ?? '___'}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── PHẦN I: TRẮC NGHIỆM ── */}
          {mcQuestions.length > 0 && (
            <section className="mb-6">
              <h2 className="font-bold text-[13pt] mb-3">
                PHẦN I: TRẮC NGHIỆM ({mcTotal} điểm)
              </h2>
              <div className="flex flex-col gap-4">
                {mcQuestions.map((q, idx) => {
                  const detail = mc_details.find(d => d.question_id === q.id) || {}
                  const studentAns = detail.student_answer ?? mc_answers[q.id]
                  const isCorrect = detail.is_correct
                  return (
                    <QuestionPrint
                      key={q.id}
                      question={q}
                      idx={idx}
                      studentAnswer={studentAns}
                      isCorrect={isCorrect}
                      score={detail.score ?? 0}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* ── PHẦN II: THỰC HÀNH ── */}
          {practiceParts.length > 0 && (
            <section>
              <h2 className="font-bold text-[13pt] mb-3">
                PHẦN II: THỰC HÀNH ({practiceTotal} điểm)
              </h2>
              {practiceParts.map((part, idx) => {
                const partSub = (submission.practice_submissions || []).find(p => p.part_id === part.id)
                const partScore = practiceScores.find(p => p.part_id === part.id)
                const maxScore = part.rubric
                  ? part.rubric.reduce((s, r) => s + (r.score || 0), 0)
                  : (part.max_score || 0)
                return (
                  <div key={part.id} className="mb-4 border border-gray-300 rounded p-3">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <span className="font-bold">Câu {idx + 1}</span>
                        {part.type === 'scratch' ? ' (Scratch)' : part.type === 'ppt' ? ' (PowerPoint)' : ' (Word)'}
                        {part.prompt && <span className="text-[11pt] text-gray-600 ml-2">— {part.prompt}</span>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn(
                          'font-bold text-[14pt]',
                          partScore ? (partScore.score >= maxScore * 0.8 ? 'text-green-700' : partScore.score >= maxScore * 0.4 ? 'text-amber-600' : 'text-red-600') : 'text-gray-400'
                        )}>
                          {partScore ? partScore.score : '—'}/{maxScore}đ
                        </span>
                      </div>
                    </div>
                    {partSub && (
                      <div className="text-[11pt] text-gray-600">
                        File nộp: <span className="font-medium text-gray-800">{partSub.file_name || '—'}</span>
                      </div>
                    )}
                    {partScore?.details?.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {partScore.details.map((d, i) => (
                          <div key={i} className="flex justify-between text-[11pt] pl-3 border-l-2 border-gray-200">
                            <span className="text-gray-700">{d.criterion}</span>
                            <span className="font-semibold">{d.score}/{d.max_score}đ</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {partScore?.ai_comment && (
                      <div className="mt-2 text-[11pt] italic text-gray-600 pl-3 border-l-2 border-indigo-300">
                        {partScore.ai_comment}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}


        </div>
      </div>
    </div>
  )
}

function QuestionPrint({ question, idx, studentAnswer, isCorrect, score }) {
  const { type, options = [], correct_answer } = question
  const ca = (correct_answer || '').toString().toUpperCase()
  const sa = (studentAnswer || '').toString().toUpperCase()

  const answerColor = (opt) => {
    const o = opt.toString().toUpperCase()
    if (o === sa && o === ca) return 'bg-green-100 font-bold text-green-800'
    if (o === sa && o !== ca) return 'bg-red-100 font-bold text-red-700 line-through'
    if (o === ca && sa !== ca) return 'bg-green-50 font-bold text-green-700'
    return ''
  }

  return (
    <div>
      <div className="flex items-start gap-2 mb-1">
        <span className="font-bold flex-shrink-0">Câu {idx + 1}.</span>
        <div className="flex-1">
          <span>{question.question}</span>
          {question.question_image && (
            <img src={question.question_image} alt="" className="mt-1 max-h-40 object-contain" />
          )}
        </div>
        <span className={cn(
          'flex-shrink-0 text-[11pt] font-bold px-2',
          isCorrect === true ? 'text-green-700' : isCorrect === false ? 'text-red-600' : 'text-gray-400'
        )}>
          {isCorrect === true ? '✓' : isCorrect === false ? '✗' : ''} {score}đ
        </span>
      </div>

      {/* MC / True-False */}
      {(type === 'mc' || type === 'true_false') && (
        <div className="grid grid-cols-2 gap-1 pl-6 text-[12pt]">
          {options.map((opt, i) => {
            const label = type === 'true_false' ? opt : OPTION_LABELS[i]
            const val = type === 'true_false' ? opt : OPTION_LABELS[i]
            const chosen = (studentAnswer || '').toString().toUpperCase() === val.toString().toUpperCase()
            const isCorrectOpt = (correct_answer || '').toString().toUpperCase() === val.toString().toUpperCase()
            const optImg = question.option_images?.[i]
            return (
              <div key={i} className={cn('px-2 py-0.5 rounded', answerColor(val))}>
                {type !== 'true_false' && <span className="font-bold mr-1">{label}.</span>}
                {opt}
                {optImg && <img src={optImg} alt="" className="mt-0.5 max-h-20 object-contain" />}
                {chosen && isCorrectOpt && <span className="ml-1 text-green-600">✓</span>}
                {chosen && !isCorrectOpt && <span className="ml-1 text-red-500">✗</span>}
                {!chosen && isCorrectOpt && studentAnswer && <span className="ml-1 text-green-500">←đúng</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Fill blank */}
      {type === 'fill_blank' && (
        <div className="pl-6 text-[12pt]">
          <span className="italic text-gray-600">Học sinh trả lời: </span>
          <span className={cn('font-semibold', isCorrect ? 'text-green-700' : 'text-red-600')}>
            {Array.isArray(studentAnswer) ? studentAnswer.join(', ') : (studentAnswer || '(chưa trả lời)')}
          </span>
          {!isCorrect && (
            <span className="ml-3 text-green-700 text-[11pt]">
              → Đáp án đúng: <strong>{Array.isArray(correct_answer) ? correct_answer.join(', ') : correct_answer}</strong>
            </span>
          )}
        </div>
      )}

      {/* Sort order / Word sort */}
      {(type === 'sort_order' || type === 'word_sort') && (
        <div className="pl-6 text-[12pt]">
          <span className="italic text-gray-600">Thứ tự học sinh: </span>
          <span className={cn('font-semibold', isCorrect ? 'text-green-700' : 'text-red-600')}>
            {Array.isArray(studentAnswer) ? studentAnswer.join(type === 'word_sort' ? ' ' : ' → ') : (studentAnswer || '(chưa trả lời)')}
          </span>
          {!isCorrect && (
            <div className="text-green-700 text-[11pt] mt-0.5">
              Đáp án đúng: <strong>{Array.isArray(correct_answer) ? correct_answer.join(type === 'word_sort' ? ' ' : ' → ') : correct_answer}</strong>
            </div>
          )}
        </div>
      )}

      {/* Matching */}
      {type === 'matching' && (
        <div className="pl-6 text-[12pt]">
          {options.map((opt, i) => {
            const label = OPTION_LABELS[i]
            const stuAns = studentAnswer?.[label]
            const correctAns = correct_answer?.[label]
            const pairCorrect = stuAns === correctAns
            return (
              <div key={i} className={cn('flex gap-2', !pairCorrect && 'text-red-600')}>
                <span className="font-bold">{label}</span>
                <span>→</span>
                <span className={pairCorrect ? 'text-green-700 font-semibold' : 'line-through'}>
                  {stuAns || '?'}
                </span>
                {!pairCorrect && <span className="text-green-700 ml-1">(đúng: {correctAns})</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Essay */}
      {type === 'essay' && studentAnswer && (
        <div className="pl-6 text-[12pt] italic text-gray-700 border-l-2 border-gray-200 ml-4">
          {studentAnswer}
        </div>
      )}
    </div>
  )
}
