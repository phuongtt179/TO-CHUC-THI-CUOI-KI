// Reusable printable exam content — used by PrintExamPage and BatchPrintPage
const OPTION_LABELS = 'ABCDEFGHIJ'

export function ExamPrintContent({ student, submission, score }) {
  const template = submission?.exam_snapshot || {}
  const mcQuestions = template.mc_questions || []
  const practiceParts = template.practice_parts || []
  const mc_answers = submission?.mc_answers || {}
  const mc_details = score?.mc_details || []
  const practiceScores = score?.practice_scores || []

  const gradeNum = student?.class?.match(/\d/)?.[0] || ''
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
    <div style={{
      fontFamily: 'Times New Roman, Times, serif',
      fontSize: '13pt',
      color: '#000',
      backgroundColor: '#fff',
      padding: '15mm',
      width: '210mm',
      minHeight: '297mm',
      boxSizing: 'border-box',
    }}>
      {/* HEADER TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1.5px solid black', padding: '6px 10px', width: '50%', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold', textAlign: 'center' }}>TRƯỜNG TH NGUYỄN PHAN VINH</div>
              <div style={{ marginTop: '4px' }}>Họ và tên: <strong>{student?.name}</strong></div>
              <div>Lớp: <strong>{student?.class}</strong></div>
              <div style={{ fontWeight: 'bold', marginTop: '4px' }}>ĐỀ CHÍNH THỨC</div>
            </td>
            <td style={{ border: '1.5px solid black', padding: '6px 10px', width: '50%', textAlign: 'center', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14pt' }}>ĐỀ KIỂM TRA CUỐI HỌC KÌ II</div>
              <div style={{ fontWeight: 'bold' }}>NĂM HỌC: {schoolYear}</div>
              <div style={{ fontWeight: 'bold' }}>MÔN TIN HỌC {gradeNum ? `– LỚP ${gradeNum}` : ''}</div>
              <div style={{ fontStyle: 'italic' }}>Thời gian làm bài: {duration} phút</div>
            </td>
          </tr>
          <tr>
            <td style={{ border: '1.5px solid black', padding: '6px 10px' }}>
              <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>Điểm</span>:&nbsp;
              <span style={{ fontWeight: 'bold', fontSize: '18pt' }}>{score?.total_final ?? '___'}</span>
              <span style={{ fontSize: '11pt' }}> /10</span>
            </td>
            <td style={{ border: '1.5px solid black', padding: '6px 10px' }}>
              <span style={{ fontStyle: 'italic' }}>Nhận xét</span>:{' '}
              {score?.practice_scores?.[0]?.ai_comment || '...................................................................'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* PHẦN I: TRẮC NGHIỆM */}
      {mcQuestions.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13pt', marginBottom: '10px' }}>
            PHẦN I: TRẮC NGHIỆM ({mcTotal} điểm)
          </div>
          {mcQuestions.map((q, idx) => {
            const detail = mc_details.find(d => d.question_id === q.id) || {}
            const studentAns = detail.student_answer ?? mc_answers[q.id]
            return (
              <QuestionRow
                key={q.id}
                question={q}
                idx={idx}
                studentAnswer={studentAns}
                isCorrect={detail.is_correct}
                earnedScore={detail.score ?? 0}
              />
            )
          })}
        </div>
      )}

      {/* PHẦN II: THỰC HÀNH */}
      {practiceParts.length > 0 && (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '13pt', marginBottom: '10px' }}>
            PHẦN II: THỰC HÀNH ({practiceTotal} điểm)
          </div>
          {practiceParts.map((part, idx) => {
            const partSub = (submission?.practice_submissions || []).find(p => p.part_id === part.id)
            const partScore = practiceScores.find(p => p.part_id === part.id)
            const maxScore = part.type === 'scratch'
              ? (part.max_score || 0)
              : (part.rubric || []).reduce((s, r) => s + (r.score || 0), 0)
            return (
              <div key={part.id} style={{ border: '1px solid #999', borderRadius: '4px', padding: '8px 10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div>
                    <strong>Câu {idx + 1}</strong>
                    {part.type === 'scratch' ? ' (Scratch)' : part.type === 'ppt' ? ' (PowerPoint)' : ' (Word)'}
                    {part.prompt && <span style={{ color: '#555', marginLeft: '8px', fontSize: '11pt' }}>{part.prompt}</span>}
                  </div>
                  <strong style={{ color: partScore ? (partScore.score >= maxScore * 0.8 ? '#15803d' : partScore.score >= maxScore * 0.4 ? '#b45309' : '#dc2626') : '#999' }}>
                    {partScore ? partScore.score : '—'}/{maxScore}đ
                  </strong>
                </div>
                {partSub && (
                  <div style={{ fontSize: '11pt', color: '#555' }}>
                    File nộp: <strong style={{ color: '#000' }}>{partSub.file_name || '—'}</strong>
                  </div>
                )}
                {partScore?.details?.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', paddingLeft: '12px', borderLeft: '2px solid #ddd', marginTop: '3px' }}>
                    <span>{d.criterion}</span>
                    <strong>{d.score}/{d.max_score}đ</strong>
                  </div>
                ))}
                {partScore?.ai_comment && (
                  <div style={{ marginTop: '4px', fontSize: '11pt', fontStyle: 'italic', color: '#555', paddingLeft: '12px', borderLeft: '2px solid #818cf8' }}>
                    {partScore.ai_comment}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* SCORE SUMMARY */}
      <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '2px solid black', display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ border: '1.5px solid black', padding: '3px 12px', fontWeight: 'bold' }}>Trắc nghiệm</td>
              <td style={{ border: '1.5px solid black', padding: '3px 12px' }}>{score?.mc_score ?? '—'}/{mcTotal}đ</td>
            </tr>
            {practiceScores.map((ps, i) => (
              <tr key={i}>
                <td style={{ border: '1.5px solid black', padding: '3px 12px', fontWeight: 'bold' }}>
                  {ps.type === 'scratch' ? 'Scratch' : 'Thực hành'}
                </td>
                <td style={{ border: '1.5px solid black', padding: '3px 12px' }}>{ps.score}/{ps.max_score}đ</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <td style={{ border: '1.5px solid black', padding: '3px 12px', fontWeight: 'bold' }}>TỔNG</td>
              <td style={{ border: '1.5px solid black', padding: '3px 12px', fontWeight: 'bold', fontSize: '16pt' }}>
                {score?.total_final ?? '—'}/10
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuestionRow({ question, idx, studentAnswer, isCorrect, earnedScore }) {
  const { type, options = [], correct_answer } = question

  const optStyle = (val) => {
    const v = val.toString().toUpperCase()
    const chosen = (studentAnswer || '').toString().toUpperCase() === v
    const correct = (correct_answer || '').toString().toUpperCase() === v
    if (chosen && correct) return { backgroundColor: '#dcfce7', fontWeight: 'bold', color: '#15803d' }
    if (chosen && !correct) return { backgroundColor: '#fee2e2', fontWeight: 'bold', color: '#dc2626' }
    if (!chosen && correct && studentAnswer) return { backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 'bold' }
    return {}
  }

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 'bold', flexShrink: 0 }}>Câu {idx + 1}.</span>
        <span style={{ flex: 1 }}>{question.question}</span>
        <span style={{
          flexShrink: 0,
          fontWeight: 'bold',
          fontSize: '11pt',
          color: isCorrect === true ? '#15803d' : isCorrect === false ? '#dc2626' : '#999',
          minWidth: '40px',
          textAlign: 'right',
        }}>
          {isCorrect === true ? '✓' : isCorrect === false ? '✗' : ''} {earnedScore}đ
        </span>
      </div>

      {/* MC / True-False options */}
      {(type === 'mc' || type === 'true_false') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', paddingLeft: '24px', marginTop: '4px', fontSize: '12pt' }}>
          {options.map((opt, i) => {
            const val = type === 'true_false' ? opt : OPTION_LABELS[i]
            const chosen = (studentAnswer || '').toString().toUpperCase() === val.toString().toUpperCase()
            const correctOpt = (correct_answer || '').toString().toUpperCase() === val.toString().toUpperCase()
            return (
              <div key={i} style={{ padding: '2px 6px', borderRadius: '3px', ...optStyle(val) }}>
                {type !== 'true_false' && <strong>{OPTION_LABELS[i]}. </strong>}
                {opt}
                {chosen && correctOpt && ' ✓'}
                {chosen && !correctOpt && ' ✗'}
                {!chosen && correctOpt && studentAnswer && ' ← đúng'}
              </div>
            )
          })}
        </div>
      )}

      {/* Fill blank */}
      {type === 'fill_blank' && (
        <div style={{ paddingLeft: '24px', fontSize: '12pt', marginTop: '2px' }}>
          <em style={{ color: '#555' }}>Học sinh: </em>
          <span style={{ fontWeight: 'bold', color: isCorrect ? '#15803d' : '#dc2626' }}>
            {Array.isArray(studentAnswer) ? studentAnswer.join(', ') : (studentAnswer || '(chưa trả lời)')}
          </span>
          {!isCorrect && (
            <span style={{ marginLeft: '12px', color: '#15803d', fontSize: '11pt' }}>
              → Đúng: <strong>{Array.isArray(correct_answer) ? correct_answer.join(', ') : correct_answer}</strong>
            </span>
          )}
        </div>
      )}

      {/* Sort / Word sort */}
      {(type === 'sort_order' || type === 'word_sort') && (
        <div style={{ paddingLeft: '24px', fontSize: '12pt', marginTop: '2px' }}>
          <span style={{ fontWeight: 'bold', color: isCorrect ? '#15803d' : '#dc2626' }}>
            {Array.isArray(studentAnswer) ? studentAnswer.join(type === 'word_sort' ? ' ' : ' → ') : (studentAnswer || '(chưa trả lời)')}
          </span>
          {!isCorrect && (
            <div style={{ color: '#15803d', fontSize: '11pt' }}>
              Đúng: <strong>{Array.isArray(correct_answer) ? correct_answer.join(type === 'word_sort' ? ' ' : ' → ') : correct_answer}</strong>
            </div>
          )}
        </div>
      )}

      {/* Matching */}
      {type === 'matching' && (
        <div style={{ paddingLeft: '24px', fontSize: '12pt', marginTop: '2px' }}>
          {options.map((_, i) => {
            const label = OPTION_LABELS[i]
            const stuAns = studentAnswer?.[label]
            const correctAns = correct_answer?.[label]
            const ok = stuAns === correctAns
            return (
              <span key={i} style={{ marginRight: '12px', color: ok ? '#15803d' : '#dc2626' }}>
                {label}→{stuAns || '?'}{!ok && ` (đúng: ${correctAns})`}
              </span>
            )
          })}
        </div>
      )}

      {/* Essay */}
      {type === 'essay' && studentAnswer && (
        <div style={{ paddingLeft: '24px', fontSize: '12pt', fontStyle: 'italic', color: '#555', marginTop: '2px', borderLeft: '2px solid #ddd' }}>
          {studentAnswer}
        </div>
      )}
    </div>
  )
}
