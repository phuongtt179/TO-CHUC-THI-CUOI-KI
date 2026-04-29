import { useState, useEffect } from 'react'
import { getDocumentOnce } from './useFirestore'

// Always fetches latest question_image / option_images from bank,
// so edited images appear even in old exam snapshots.
export function useQuestionsWithImages(rawQuestions) {
  const [questions, setQuestions] = useState(rawQuestions || [])

  useEffect(() => {
    if (!rawQuestions?.length) { setQuestions([]); return }

    Promise.all(rawQuestions.map(async q => {
      try {
        const latest = await getDocumentOnce('question_bank', q.id)
        if (!latest) return q
        return {
          ...q,
          question_image: latest.question_image ?? q.question_image,
          option_images: latest.option_images ?? q.option_images,
        }
      } catch { return q }
    })).then(setQuestions)
  }, [rawQuestions?.length, rawQuestions?.[0]?.id])

  return questions
}
