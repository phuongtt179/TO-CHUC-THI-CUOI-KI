'use strict'

const OPTION_LABELS = 'ABCDEFGHIJ'

function normalizeAnswer(answer) {
  if (Array.isArray(answer)) {
    return answer.map(a => String(a).trim().toLowerCase()).sort().join(',')
  }
  return String(answer).trim().toLowerCase()
}

function gradeQuestion(question, studentAnswer) {
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return { correct: false, score: 0 }
  }

  const { type } = question

  if (type === 'mc' || type === 'drag_fill') {
    const correct = normalizeAnswer(studentAnswer) === normalizeAnswer(question.correct_answer)
    return { correct, score: correct ? (question.score || 0) : 0 }
  }

  if (type === 'true_false') {
    const correct = String(studentAnswer).trim() === String(question.correct_answer).trim()
    return { correct, score: correct ? (question.score || 0) : 0 }
  }

  if (type === 'fill_blank') {
    const correctAnswers = question.correct_answer.split(',').map(a => a.trim().toLowerCase())
    const studentAnswers = Array.isArray(studentAnswer)
      ? studentAnswer.map(a => String(a).trim().toLowerCase())
      : [String(studentAnswer).trim().toLowerCase()]
    const correct = correctAnswers.every((ca, i) => ca === (studentAnswers[i] || ''))
    return { correct, score: correct ? (question.score || 0) : 0 }
  }

  if (type === 'sort_order' || type === 'word_sort') {
    const studentArr = Array.isArray(studentAnswer) ? studentAnswer : []
    const correctArr = Array.isArray(question.correct_answer) ? question.correct_answer : []
    const correct = JSON.stringify(studentArr) === JSON.stringify(correctArr)
    return { correct, score: correct ? (question.score || 0) : 0 }
  }

  if (type === 'matching') {
    if (typeof studentAnswer !== 'object' || studentAnswer === null) return { correct: false, score: 0 }
    const ca = question.correct_answer || {}
    const allCorrect = Object.keys(ca).every(
      k => String(studentAnswer[k]).trim() === String(ca[k]).trim()
    )
    return { correct: allCorrect, score: allCorrect ? (question.score || 0) : 0 }
  }

  if (type === 'essay') {
    return { correct: null, score: 0, manual: true }
  }

  return { correct: false, score: 0 }
}

function gradeAllMC(questions, answers) {
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
      student_answer: answers[q.id] ?? null,
      correct_answer: q.correct_answer,
      manual: result.manual || false,
    })
    totalScore += result.score
  }

  return { totalScore, details }
}

module.exports = { gradeAllMC, gradeQuestion }
