'use strict'

const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onCall } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

setGlobalOptions({ region: 'asia-southeast1', memory: '1GiB', timeoutSeconds: 300 })

const { gradeWordFile } = require('./grading/wordGrading')
const { gradeScratchFile } = require('./grading/scratchGrading')

// ── Auto-grade on submission (Firestore trigger) ──────────
exports.onSubmissionCreated = onDocumentCreated(
  'submissions/{submissionId}',
  async (event) => {
    const submission = event.data.data()
    const submissionId = event.params.submissionId

    try {
      const examSnap = await db.collection('exams').doc(submission.exam_id).get()
      const exam = examSnap.data()
      const template = exam?.template_snapshot || submission.exam_snapshot

      if (!template) {
        console.log('No template found for submission', submissionId)
        return
      }

      // Grade MC
      const { gradeAllMC } = require('./grading/mcGrading')
      const mcQuestions = template.mc_questions || []
      const { totalScore: mcScore, details: mcDetails } = gradeAllMC(
        mcQuestions,
        submission.mc_answers || {}
      )

      const maxMC = mcQuestions.reduce((s, q) => s + (q.score || 0), 0)
      const maxPractice = (template.practice_parts || []).reduce((s, p) => {
        if (p.rubric) return s + p.rubric.reduce((rs, r) => rs + (r.score || 0), 0)
        if (p.scratch_tests) return s + p.scratch_tests.reduce((ts, t) => ts + (t.score || 0), 0)
        return s
      }, 0)
      const maxTotal = maxMC + maxPractice

      await db.collection('scores').doc(submissionId).set({
        student_id: submission.student_id,
        exam_id: submission.exam_id,
        student_name: '',
        student_class: '',
        mc_score: mcScore,
        mc_details: mcDetails,
        practice_scores: [],
        total_raw: mcScore,
        total_max: maxTotal,
        total_final: maxTotal > 0 ? Math.round((mcScore / maxTotal) * 10 * 100) / 100 : 0,
        grading_status: 'mc_done',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })

      // Update student name/class from students collection
      const studentSnap = await db.collection('students').doc(submission.student_id).get()
      if (studentSnap.exists) {
        const student = studentSnap.data()
        await db.collection('scores').doc(submissionId).update({
          student_name: student.name || '',
          student_class: student.class || '',
        })
      }

      console.log(`Graded MC for ${submissionId}: ${mcScore}/${maxMC}`)
    } catch (e) {
      console.error('Error grading submission:', e)
    }
  }
)

// ── Grade practice files (callable from teacher UI) ───────
exports.gradePractice = onCall(
  { memory: '2GiB', timeoutSeconds: 540, cors: true },
  async (request) => {
    const { submission_id, student_id } = request.data

    try {
      const submissionSnap = await db.collection('submissions').doc(submission_id).get()
      if (!submissionSnap.exists) throw new Error('Submission not found')
      const submission = submissionSnap.data()

      const template = submission.exam_snapshot
      if (!template) throw new Error('No exam template in submission')

      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

      const practiceScores = []

      for (const partSub of (submission.practice_submissions || [])) {
        if (!partSub.file_url) continue

        const partTemplate = (template.practice_parts || []).find(p => p.id === partSub.part_id)
        if (!partTemplate) continue

        let result
        if (partTemplate.type === 'scratch') {
          const testCases = partTemplate.scratch_tests || []
          const testResults = await gradeScratchFile({
            fileUrl: partSub.file_url,
            testCases,
          })
          const score = testResults.reduce((s, r) => s + r.score, 0)
          const max_score = testCases.reduce((s, t) => s + (t.score || 0), 0)
          result = { part_id: partSub.part_id, type: 'scratch', score, max_score, details: testResults, ai_comment: null }
        } else {
          const rubric = partTemplate.rubric || []
          const wordResult = await gradeWordFile({
            fileUrl: partSub.file_url,
            fileName: partSub.file_name || 'file.docx',
            rubric,
            apiKey,
          })
          result = { part_id: partSub.part_id, type: partTemplate.type, ...wordResult }
        }

        practiceScores.push(result)
      }

      // Update scores
      const scoreSnap = await db.collection('scores').doc(submission_id).get()
      const existingScore = scoreSnap.data() || {}
      const mcScore = existingScore.mc_score || 0
      const practiceTotal = practiceScores.reduce((s, p) => s + p.score, 0)
      const totalRaw = mcScore + practiceTotal
      const maxTotal = existingScore.total_max || 10

      await db.collection('scores').doc(submission_id).update({
        practice_scores: practiceScores,
        total_raw: totalRaw,
        total_final: maxTotal > 0 ? Math.round((totalRaw / maxTotal) * 10 * 100) / 100 : 0,
        grading_status: 'fully_graded',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Update student status
      await db.collection('students').doc(student_id || submission_id).update({
        status: 'graded',
      })

      return { success: true, practice_scores: practiceScores }
    } catch (e) {
      console.error('gradePractice error:', e)
      throw new Error('Lỗi chấm điểm: ' + e.message)
    }
  }
)

// ── Process grading queue ─────────────────────────────────
exports.processGradingQueue = onDocumentCreated(
  'grading_queue/{queueId}',
  async (event) => {
    const queueItem = event.data.data()
    const queueId = event.params.queueId

    await db.collection('grading_queue').doc(queueId).update({ status: 'processing' })

    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        console.log('No GEMINI_API_KEY, skipping auto practice grading')
        await db.collection('grading_queue').doc(queueId).update({ status: 'skipped' })
        return
      }

      const submissionSnap = await db.collection('submissions').doc(queueItem.submission_id).get()
      if (!submissionSnap.exists) return
      const submission = submissionSnap.data()

      const template = submission.exam_snapshot
      if (!template) return

      const practiceScores = []

      for (const partSub of (submission.practice_submissions || [])) {
        if (!partSub.file_url) continue
        const partTemplate = (template.practice_parts || []).find(p => p.id === partSub.part_id)
        if (!partTemplate) continue

        try {
          if (partTemplate.type === 'scratch') {
            const testResults = await gradeScratchFile({
              fileUrl: partSub.file_url,
              testCases: partTemplate.scratch_tests || [],
            })
            const score = testResults.reduce((s, r) => s + r.score, 0)
            practiceScores.push({
              part_id: partSub.part_id,
              type: 'scratch',
              score,
              max_score: (partTemplate.scratch_tests || []).reduce((s, t) => s + (t.score || 0), 0),
              details: testResults,
              ai_comment: null,
            })
          } else {
            const wordResult = await gradeWordFile({
              fileUrl: partSub.file_url,
              fileName: partSub.file_name || 'file.docx',
              rubric: partTemplate.rubric || [],
              apiKey,
            })
            practiceScores.push({ part_id: partSub.part_id, type: partTemplate.type, ...wordResult })
          }
        } catch (e) {
          console.error('Error grading part:', partSub.part_id, e)
        }
      }

      if (practiceScores.length > 0) {
        const scoreSnap = await db.collection('scores').doc(queueItem.submission_id).get()
        const existing = scoreSnap.data() || {}
        const mcScore = existing.mc_score || 0
        const practiceTotal = practiceScores.reduce((s, p) => s + p.score, 0)
        const maxTotal = existing.total_max || 10

        await db.collection('scores').doc(queueItem.submission_id).update({
          practice_scores: practiceScores,
          total_raw: mcScore + practiceTotal,
          total_final: Math.round(((mcScore + practiceTotal) / maxTotal) * 10 * 100) / 100,
          grading_status: 'fully_graded',
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        })

        await db.collection('students').doc(queueItem.student_id).update({ status: 'graded' })
      }

      await db.collection('grading_queue').doc(queueId).update({ status: 'done' })
    } catch (e) {
      console.error('Queue processing error:', e)
      await db.collection('grading_queue').doc(queueId).update({ status: 'error', error: e.message })
    }
  }
)
