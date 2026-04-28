import { useState, useEffect } from 'react'
import { getDocumentOnce } from './useFirestore'

/**
 * Takes an array of mc_questions from a snapshot and fills in missing
 * question_image / option_images by fetching the latest data from question_bank.
 */
export function useQuestionsWithImages(rawQuestions) {
  const [questions, setQuestions] = useState(rawQuestions || [])

  useEffect(() => {
    if (!rawQuestions?.length) { setQuestions([]); return }
    const missing = rawQuestions.some(q => !q.question_image)
    if (!missing) { setQuestions(rawQuestions); return }

    Promise.all(rawQuestions.map(async q => {
      if (q.question_image) return q
      try {
        const latest = await getDocumentOnce('question_bank', q.id)
        if (!latest) return q
        return {
          ...q,
          question_image: latest.question_image || '',
          option_images: latest.option_images || q.option_images,
        }
      } catch { return q }
    })).then(setQuestions)
  }, [rawQuestions?.length, rawQuestions?.[0]?.id])

  return questions
}
