import { CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

const OPTION_LABELS = 'ABCDEFGHIJ'

export function QuestionReview({ question, studentAnswer, result }) {
  const { is_correct, score, max_score, manual } = result || {}

  return (
    <div className={cn(
      'p-4 rounded-2xl border-2',
      is_correct === true && 'border-emerald-200 bg-emerald-50/50',
      is_correct === false && 'border-red-200 bg-red-50/50',
      (is_correct === null || manual) && 'border-gray-200 bg-gray-50',
    )}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <p className="font-medium text-gray-800 text-sm">{question.question}</p>
          {question.question_image && (
            <img src={question.question_image} alt="" className="max-h-32 rounded-lg mt-2 object-contain" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {is_correct === true && <CheckCircle className="text-emerald-500" size={20} />}
          {is_correct === false && <XCircle className="text-red-500" size={20} />}
          {(is_correct === null || manual) && <MinusCircle className="text-gray-400" size={20} />}
          <span className={cn(
            'font-bold text-sm',
            is_correct === true && 'text-emerald-600',
            is_correct === false && 'text-red-500',
            (is_correct === null || manual) && 'text-gray-500',
          )}>
            {score}/{max_score}đ
          </span>
        </div>
      </div>

      <ReviewBody question={question} studentAnswer={studentAnswer} is_correct={is_correct} />

      {!is_correct && question.correct_answer !== undefined && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-emerald-700">Đáp án đúng: </span>
            {formatCorrectAnswer(question)}
          </p>
        </div>
      )}
    </div>
  )
}

function ReviewBody({ question, studentAnswer, is_correct }) {
  const { type, options = [], targets = [] } = question

  if (type === 'mc') {
    return (
      <div className="flex flex-col gap-1">
        {options.map((opt, idx) => {
          const label = OPTION_LABELS[idx]
          const isStudent = studentAnswer === label
          const isCorrect = question.correct_answer === label
          return (
            <div key={idx} className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
              isCorrect && 'bg-emerald-100 text-emerald-800 font-semibold',
              isStudent && !isCorrect && 'bg-red-100 text-red-700',
            )}>
              <span className="w-6 font-bold">{label}.</span>
              <span className="flex-1">{opt}</span>
              {isCorrect && <CheckCircle size={14} className="text-emerald-600" />}
              {isStudent && !isCorrect && <XCircle size={14} className="text-red-500" />}
            </div>
          )
        })}
      </div>
    )
  }

  if (type === 'true_false') {
    return (
      <div className="flex gap-3">
        {['Đúng', 'Sai'].map(opt => (
          <span key={opt} className={cn(
            'px-3 py-1 rounded-lg text-sm font-medium',
            question.correct_answer === opt && 'bg-emerald-100 text-emerald-800',
            studentAnswer === opt && question.correct_answer !== opt && 'bg-red-100 text-red-700',
          )}>
            {opt}
            {studentAnswer === opt && ' (em chọn)'}
          </span>
        ))}
      </div>
    )
  }

  if (type === 'fill_blank') {
    const answers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]
    return (
      <div className="text-sm text-gray-600">
        Học sinh điền: <span className={cn('font-semibold', is_correct ? 'text-emerald-700' : 'text-red-600')}>
          {answers.join(', ') || '(bỏ trống)'}
        </span>
      </div>
    )
  }

  if (type === 'matching') {
    return (
      <div className="flex flex-col gap-1">
        {options.map((opt, idx) => {
          const label = OPTION_LABELS[idx]
          const studentPick = studentAnswer?.[label]
          const correctPick = question.correct_answer?.[label]
          const correct = studentPick === correctPick
          return (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="font-bold text-indigo-600 w-6">{label}.</span>
              <span className="text-gray-600 flex-1">{opt}</span>
              <span className="text-gray-400">→</span>
              <span className={cn('font-semibold', correct ? 'text-emerald-600' : 'text-red-500')}>
                {studentPick ? `${studentPick}. ${targets[Number(studentPick) - 1] || ''}` : '(chưa chọn)'}
              </span>
              {!correct && <span className="text-xs text-gray-400">(đúng: {correctPick})</span>}
            </div>
          )
        })}
      </div>
    )
  }

  if (type === 'essay') {
    return (
      <div className="text-sm text-gray-600">
        <p className="font-semibold mb-1">Câu trả lời:</p>
        <p className="bg-white rounded-lg p-2 border border-gray-200 whitespace-pre-wrap">
          {studentAnswer || '(bỏ trống)'}
        </p>
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-600">
      Câu trả lời: <span className={cn('font-semibold', is_correct ? 'text-emerald-700' : 'text-red-600')}>
        {Array.isArray(studentAnswer) ? studentAnswer.join(', ') : (studentAnswer || '(bỏ trống)')}
      </span>
    </div>
  )
}

function formatCorrectAnswer(question) {
  const ca = question.correct_answer
  if (Array.isArray(ca)) return ca.join(', ')
  if (typeof ca === 'object' && ca !== null) {
    return Object.entries(ca).map(([k, v]) => `${k}→${v}`).join(', ')
  }
  return String(ca)
}
