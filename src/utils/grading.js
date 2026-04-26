export const QUESTION_TYPES = {
  mc: 'Trắc nghiệm',
  true_false: 'Đúng / Sai',
  fill_blank: 'Điền từ',
  sort_order: 'Sắp xếp thứ tự',
  drag_fill: 'Kéo thả từ',
  word_sort: 'Sắp xếp từ',
  matching: 'Nối đôi',
  essay: 'Tự luận',
}

export const QUESTION_TYPE_COLORS = {
  mc: 'bg-blue-100 text-blue-700',
  true_false: 'bg-green-100 text-green-700',
  fill_blank: 'bg-yellow-100 text-yellow-700',
  sort_order: 'bg-orange-100 text-orange-700',
  drag_fill: 'bg-red-100 text-red-700',
  word_sort: 'bg-pink-100 text-pink-700',
  matching: 'bg-purple-100 text-purple-700',
  essay: 'bg-gray-100 text-gray-700',
}

export function gradeMCAnswer(question, studentAnswer) {
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return { correct: false, score: 0 }
  }

  const correct = normalizeAnswer(studentAnswer) === normalizeAnswer(question.correct_answer)
  return { correct, score: correct ? (question.score || 0) : 0 }
}

function normalizeAnswer(answer) {
  if (Array.isArray(answer)) {
    return answer.map(a => String(a).trim().toLowerCase()).sort().join(',')
  }
  return String(answer).trim().toLowerCase()
}

export function gradeMatchingAnswer(question, studentAnswer) {
  if (!studentAnswer || typeof studentAnswer !== 'object') return { correct: false, score: 0 }
  const correct_answer = question.correct_answer
  let allCorrect = true
  for (const key of Object.keys(correct_answer)) {
    if (String(studentAnswer[key]).trim() !== String(correct_answer[key]).trim()) {
      allCorrect = false
      break
    }
  }
  return { correct: allCorrect, score: allCorrect ? (question.score || 0) : 0 }
}

export function gradeSortAnswer(question, studentAnswer) {
  if (!Array.isArray(studentAnswer)) return { correct: false, score: 0 }
  const correct = JSON.stringify(studentAnswer) === JSON.stringify(question.correct_answer)
  return { correct, score: correct ? (question.score || 0) : 0 }
}

export function gradeQuestion(question, studentAnswer) {
  switch (question.type) {
    case 'mc':
    case 'true_false':
    case 'drag_fill':
      return gradeMCAnswer(question, studentAnswer)
    case 'fill_blank': {
      if (!studentAnswer) return { correct: false, score: 0 }
      const correctAnswers = question.correct_answer.split(',').map(a => a.trim().toLowerCase())
      const studentAnswers = Array.isArray(studentAnswer)
        ? studentAnswer.map(a => String(a).trim().toLowerCase())
        : [String(studentAnswer).trim().toLowerCase()]
      const correct = correctAnswers.every((ca, i) => ca === (studentAnswers[i] || ''))
      return { correct, score: correct ? (question.score || 0) : 0 }
    }
    case 'sort_order':
    case 'word_sort':
      return gradeSortAnswer(question, studentAnswer)
    case 'matching':
      return gradeMatchingAnswer(question, studentAnswer)
    case 'essay':
      return { correct: null, score: 0, manual: true }
    default:
      return { correct: false, score: 0 }
  }
}

export function gradeAllMC(questions, answers) {
  let totalScore = 0
  const details = []
  for (const q of questions) {
    const result = gradeQuestion(q, answers[q.id])
    details.push({
      question_id: q.id,
      question: q.question,
      type: q.type,
      is_correct: result.correct,
      score: result.score,
      max_score: q.score || 0,
      student_answer: answers[q.id],
      correct_answer: q.correct_answer,
      manual: result.manual || false,
    })
    totalScore += result.score
  }
  return { totalScore, details }
}

export function scaleToTen(rawScore, maxScore) {
  if (!maxScore || maxScore === 0) return 0
  return Math.round((rawScore / maxScore) * 10 * 100) / 100
}
