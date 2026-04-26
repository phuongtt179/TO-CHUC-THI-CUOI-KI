import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Send, CheckCircle, Lock,
  BookOpen, Wrench, Upload, X, FileText
} from 'lucide-react'
import { serverTimestamp, doc, updateDoc } from 'firebase/firestore'
import { Button, Card, Spinner } from '@/components/ui'
import { QuestionRenderer } from '@/components/questions/QuestionRenderer'
import { useDocument, updateDocument, addDocument, setDocument } from '@/hooks/useFirestore'
import { useCountdownTimer, formatTime, getTimerColor } from '@/hooks/useTimer'
import { gradeAllMC, scaleToTen } from '@/utils/grading'
import { uploadToCloudinary } from '@/utils/cloudinary'
import { db } from '@/firebase/config'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'

export function ExamPage() {
  const navigate = useNavigate()

  // Restore session from localStorage if sessionStorage was cleared (tab closed & reopened)
  let studentId = sessionStorage.getItem('student_id')
  let examId = sessionStorage.getItem('exam_id')
  if (!studentId || !examId) {
    try {
      const saved = JSON.parse(localStorage.getItem('exam_session') || 'null')
      if (saved?.student_id && saved?.exam_id) {
        studentId = saved.student_id
        examId = saved.exam_id
        sessionStorage.setItem('student_id', studentId)
        sessionStorage.setItem('exam_id', examId)
      }
    } catch {}
  }

  const { data: student } = useDocument('students', studentId)
  const { data: exam } = useDocument('exams', examId)

  const [answers, setAnswers] = useState({})
  const [practiceFiles, setPracticeFiles] = useState({})
  const [uploadStatus, setUploadStatus] = useState({}) // { [partId]: 'uploading' | 'error' }
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const autoSubmittedRef = useRef(false)
  const submittedRef = useRef(false)

  // Redirect if no session
  useEffect(() => {
    if (!studentId || !examId) navigate('/')
  }, [])

  // Clear localStorage backup when submitted
  useEffect(() => {
    if (submitted) {
      submittedRef.current = true
      localStorage.removeItem('exam_session')
    }
  }, [submitted])

  const template = exam?.template_snapshot
  const mcQuestions = template?.mc_questions || []
  const practiceParts = template?.practice_parts || []

  const handleExpire = useCallback(async () => {
    if (autoSubmittedRef.current || submittedRef.current) return
    autoSubmittedRef.current = true
    setLocked(true)
    toast('Hết giờ! Bài đang được tự động nộp...', { icon: '⏰', duration: 5000 })
    await handleSubmit(true)
  }, [])

  const remaining = useCountdownTimer(
    exam?.status === 'active' ? exam?.start_time : null,
    template?.duration,
    handleExpire
  )

  // Trigger expire if page loaded after timer already ran out
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && exam?.status === 'active') {
      handleExpire()
    }
  }, [remaining, exam?.status])

  // Lock when exam ended by teacher
  useEffect(() => {
    if (exam?.status === 'ended' && !submitted) {
      setLocked(true)
    }
  }, [exam?.status])

  const setAnswer = (questionId, value) => {
    if (locked) return
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleFileUpload = async (partId, file) => {
    if (!file) return
    setUploadStatus(prev => ({ ...prev, [partId]: 'uploading' }))
    setPracticeFiles(prev => { const next = { ...prev }; delete next[partId]; return next })
    try {
      const folder = `submissions/${examId}/${studentId}`
      const url = await uploadToCloudinary(file, folder)
      setPracticeFiles(prev => ({ ...prev, [partId]: { url, name: file.name } }))
      setUploadStatus(prev => { const next = { ...prev }; delete next[partId]; return next })
      toast.success('Đã tải lên!')
    } catch (e) {
      setUploadStatus(prev => ({ ...prev, [partId]: 'error' }))
      toast.error('Lỗi upload: ' + e.message)
    }
  }

  const handleSubmit = async (isAuto = false) => {
    if (submitting || submitted) return
    setSubmitting(true)

    try {
      // Grade MC automatically
      const { totalScore, details } = gradeAllMC(mcQuestions, answers)

      // Calculate total max
      const maxMC = mcQuestions.reduce((s, q) => s + (q.score || 0), 0)
      const maxPractice = practiceParts.reduce((s, p) => {
        if (p.rubric) return s + p.rubric.reduce((rs, r) => rs + (r.score || 0), 0)
        if (p.scratch_tests) return s + p.scratch_tests.reduce((ts, t) => ts + (t.score || 0), 0)
        return s
      }, 0)
      const maxTotal = maxMC + maxPractice

      // Build practice submissions
      const practice_submissions = practiceParts.map(p => ({
        part_id: p.id,
        type: p.type,
        file_url: practiceFiles[p.id]?.url || null,
        file_name: practiceFiles[p.id]?.name || null,
      }))

      // Save submission
      await setDocument('submissions', studentId, {
        student_id: studentId,
        exam_id: examId,
        exam_snapshot: template,
        mc_answers: answers,
        practice_submissions,
        submitted_at: serverTimestamp(),
        is_auto: isAuto,
      })

      // Save initial score (MC only)
      await setDocument('scores', studentId, {
        student_id: studentId,
        exam_id: examId,
        student_name: student?.name || '',
        student_class: student?.class || '',
        mc_score: totalScore,
        mc_details: details,
        practice_scores: [],
        total_raw: totalScore,
        total_max: maxTotal,
        total_final: scaleToTen(totalScore, maxTotal),
        grading_status: 'mc_done',
      })

      // Update student status
      await updateDoc(doc(db, 'students', studentId), {
        status: isAuto ? 'submitted_auto' : 'submitted',
        submitted_at: serverTimestamp(),
      })

      // Queue for practice grading if there are files
      if (practice_submissions.some(p => p.file_url)) {
        await addDocument('grading_queue', {
          submission_id: studentId,
          student_id: studentId,
          exam_id: examId,
          status: 'pending',
        })
      }

      localStorage.removeItem('exam_session')
      setSubmitted(true)
      setLocked(true)
    } catch (e) {
      toast.error('Lỗi nộp bài: ' + e.message)
      autoSubmittedRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Waiting state ───────────────────────────────────────
  if (!exam || !student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    )
  }

  if (exam.status === 'waiting') {
    return <WaitingScreen student={student} examCode={exam.exam_code} />
  }

  // ─── Submitted state ─────────────────────────────────────
  if (submitted || student?.status === 'submitted' || student?.status === 'submitted_auto') {
    return <SubmittedScreen student={student} isAuto={student?.status === 'submitted_auto'} />
  }

  const answeredCount = mcQuestions.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 text-sm">{student.name}</span>
              <span className="text-xs text-gray-500">Lớp {student.class} · {student.computer_name}</span>
            </div>
          </div>

          {/* Timer */}
          <div className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xl transition-all',
            remaining !== null && remaining < 5 * 60 * 1000
              ? 'bg-red-50 text-red-600 animate-pulse'
              : 'bg-indigo-50 text-indigo-700'
          )}>
            <Clock size={18} />
            {exam.status === 'active' ? formatTime(remaining) : '--:--'}
          </div>

          <Button
            icon={<Send size={16} />}
            loading={submitting}
            disabled={locked}
            onClick={() => !locked && setShowConfirm(true)}
            variant={locked ? 'ghost' : 'success'}
          >
            {locked ? 'Đã nộp bài' : 'Nộp bài'}
          </Button>
        </div>
      </div>

      {/* Locked overlay */}
      <AnimatePresence>
        {locked && !submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 text-center max-w-sm mx-4"
            >
              <Lock size={48} className="mx-auto text-indigo-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Hết giờ!</h2>
              <p className="text-gray-500 mb-4">Bài thi đang được tự động nộp...</p>
              <Spinner className="mx-auto" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex gap-6">
        {/* Main content — all questions in one scroll */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* MC section header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
              <BookOpen size={15} />
              Trắc nghiệm
              <span className="bg-indigo-500 px-1.5 py-0.5 rounded-full text-xs">
                {answeredCount}/{mcQuestions.length}
              </span>
            </div>
          </div>

          {/* MC Questions */}
          {mcQuestions.map((q, idx) => (
            <Card key={q.id} className="p-5 exam-question">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-xl font-bold text-sm',
                    answers[q.id] !== undefined && answers[q.id] !== ''
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-500'
                  )}>
                    {idx + 1}
                  </span>
                  <span className="text-xs text-gray-400">{q.score}đ</span>
                </div>
                {answers[q.id] !== undefined && answers[q.id] !== '' && (
                  <CheckCircle size={16} className="text-indigo-500" />
                )}
              </div>
              <QuestionRenderer
                question={q}
                answer={answers[q.id]}
                onChange={val => setAnswer(q.id, val)}
                locked={locked}
              />
            </Card>
          ))}

          {/* Practice section — always below MC */}
          {practiceParts.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
                  <Wrench size={15} />
                  Thực hành
                  <span className="bg-purple-500 px-1.5 py-0.5 rounded-full text-xs">
                    {Object.keys(practiceFiles).length}/{practiceParts.length}
                  </span>
                </div>
              </div>
              {practiceParts.map((part, idx) => (
                <PracticeUpload
                  key={part.id}
                  part={part}
                  idx={idx}
                  fileInfo={practiceFiles[part.id]}
                  status={uploadStatus[part.id]}
                  locked={locked}
                  onUpload={file => handleFileUpload(part.id, file)}
                  onRemove={() => {
                    setPracticeFiles(p => { const next = { ...p }; delete next[part.id]; return next })
                    setUploadStatus(p => { const next = { ...p }; delete next[part.id]; return next })
                  }}
                />
              ))}
            </>
          )}
        </div>

        {/* Navigation sidebar */}
        <div className="w-44 flex-shrink-0">
          <Card className="p-3 sticky top-24">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Trắc nghiệm</p>
            <div className="grid grid-cols-5 gap-1">
              {mcQuestions.map((q, idx) => {
                const answered = answers[q.id] !== undefined && answers[q.id] !== ''
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      document.querySelectorAll('.exam-question')[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-semibold transition-all',
                      answered ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-indigo-500 flex-shrink-0" />
                <span>Đã trả lời ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-gray-200 flex-shrink-0" />
                <span>Chưa ({mcQuestions.length - answeredCount})</span>
              </div>
            </div>
            {practiceParts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Thực hành</p>
                <div className="flex flex-col gap-1">
                  {practiceParts.map((part, idx) => {
                    const hasFile = !!practiceFiles[part.id]
                    return (
                      <div key={part.id} className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-lg text-xs',
                        hasFile ? 'bg-purple-100 text-purple-700' : 'bg-gray-50 text-gray-400'
                      )}>
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', hasFile ? 'bg-purple-500' : 'bg-gray-300')} />
                        Câu {idx + 1} {hasFile ? '✓' : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Submit confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Xác nhận nộp bài</h2>

              <div className="flex flex-col gap-2 mb-5">
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                  <span className="text-sm text-gray-600">Câu đã làm</span>
                  <span className="font-bold text-indigo-700 text-lg">{answeredCount}/{mcQuestions.length}</span>
                </div>
                {mcQuestions.length - answeredCount > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-sm text-amber-700 font-medium">⚠ Chưa làm</span>
                    <span className="font-bold text-amber-700 text-lg">{mcQuestions.length - answeredCount} câu</span>
                  </div>
                )}
                {practiceParts.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                    <span className="text-sm text-gray-600">Thực hành đã nộp</span>
                    <span className="font-bold text-purple-700 text-lg">
                      {Object.keys(practiceFiles).length}/{practiceParts.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Làm tiếp
                </button>
                <button
                  onClick={() => { setShowConfirm(false); handleSubmit(false) }}
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Nộp bài
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PracticeUpload({ part, idx, fileInfo, status, locked, onUpload, onRemove }) {
  const fileRef = useRef()
  const typeLabel = { word: 'Word (.docx)', scratch: 'Scratch (.sb3)', ppt: 'PowerPoint (.pptx)' }
  const acceptMap = { word: '.docx', scratch: '.sb3', ppt: '.pptx' }
  const uploading = status === 'uploading'
  const hasError = status === 'error'

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'w-7 h-7 flex items-center justify-center rounded-lg font-bold text-sm',
          'bg-purple-100 text-purple-700'
        )}>
          {idx + 1}
        </span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-semibold',
          part.type === 'word' ? 'bg-blue-100 text-blue-700'
            : part.type === 'ppt' ? 'bg-orange-100 text-orange-700'
            : 'bg-green-100 text-green-700'
        )}>
          {typeLabel[part.type] || part.type}
        </span>
      </div>

      {(part.prompt || part.prompt_file_url) && (
        <div className="mb-4 flex flex-col gap-2">
          {part.prompt && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs font-semibold text-purple-700 mb-1">Đề bài:</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{part.prompt}</p>
            </div>
          )}
          {part.prompt_file_url && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 px-1">
                <FileText size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">{part.prompt_file_name || 'Đề bài'}</span>
              </div>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(part.prompt_file_url)}&embedded=true`}
                className="w-full rounded-xl border border-blue-200"
                style={{ height: '480px' }}
                title="Đề bài"
              />
            </div>
          )}
        </div>
      )}

      {/* Uploading */}
      {uploading && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Spinner size="md" />
          <span className="text-sm text-blue-700 font-medium">Đang tải lên...</span>
        </div>
      )}

      {/* Error */}
      {hasError && !uploading && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <X size={18} className="text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 font-medium flex-1">Tải lên thất bại!</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Success */}
      {fileInfo && !uploading && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-700 font-medium flex-1 truncate">{fileInfo.name}</span>
          {!locked && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-lg font-semibold transition-colors"
              >
                Đổi file
              </button>
              <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload button — show when no file and not uploading */}
      {!fileInfo && !uploading && !hasError && (
        <button
          onClick={() => !locked && fileRef.current?.click()}
          disabled={locked}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-all',
            locked
              ? 'border-gray-200 text-gray-300 cursor-default'
              : 'border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50 cursor-pointer'
          )}
        >
          <Upload size={28} />
          <span className="text-sm font-medium">Tải lên file {typeLabel[part.type]}</span>
          <span className="text-xs opacity-60">Nhấn để chọn file</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={acceptMap[part.type] || '*'}
        className="hidden"
        onChange={e => onUpload(e.target.files[0])}
      />
    </Card>
  )
}

function WaitingScreen({ student, examCode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-glow-green"
        >
          <Clock size={48} className="text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Chào {student.name}!</h1>
        <p className="text-gray-500 mb-1">Lớp {student.class} · {student.computer_name}</p>
        <div className="mt-6 bg-white rounded-2xl px-8 py-4 shadow-card inline-block">
          <p className="text-sm text-gray-500">Mã phòng thi</p>
          <p className="font-mono font-bold text-3xl text-indigo-700 tracking-widest mt-1">{examCode}</p>
        </div>
        <div className="mt-8 flex items-center gap-3 text-gray-500">
          <Spinner size="sm" />
          <span className="text-sm">Chờ giáo viên phát đề...</span>
        </div>
      </motion.div>
    </div>
  )
}

function SubmittedScreen({ student, isAuto }) {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          sessionStorage.removeItem('student_id')
          sessionStorage.removeItem('exam_id')
          localStorage.removeItem('exam_session')
          navigate('/')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-glow-green"
        >
          <CheckCircle size={56} className="text-white" />
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          {isAuto ? 'Hết giờ!' : 'Nộp bài thành công!'}
        </h1>
        <p className="text-gray-500 text-lg mb-2">
          {student.name} · Lớp {student.class}
        </p>
        <p className="text-gray-400">
          {isAuto ? 'Bài của em đã được tự động nộp.' : 'Bài của em đã được nộp thành công.'}
        </p>
        <div className="mt-8 bg-white rounded-2xl px-8 py-4 shadow-card inline-block">
          <p className="text-sm text-gray-500">Kết quả sẽ được thông báo sau khi chấm xong.</p>
          <p className="text-sm text-gray-400 mt-2">
            Tự động quay về trang chủ sau <span className="font-bold text-emerald-600">{countdown}</span> giây
          </p>
        </div>
      </motion.div>
    </div>
  )
}
