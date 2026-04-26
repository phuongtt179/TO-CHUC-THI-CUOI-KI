import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GraduationCap, User, Building, Monitor, Hash, ArrowRight } from 'lucide-react'
import { where } from 'firebase/firestore'
import { Input, Button } from '@/components/ui'
import { addDocument, queryOnce } from '@/hooks/useFirestore'
import toast from 'react-hot-toast'

export function JoinPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', class: '', computer_name: '', exam_code: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Vui lòng nhập họ tên'
    if (!form.class.trim()) e.class = 'Vui lòng nhập lớp'
    if (!form.computer_name.trim()) e.computer_name = 'Vui lòng nhập tên máy tính'
    if (!form.exam_code.trim()) e.exam_code = 'Vui lòng nhập mã phòng thi'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleJoin = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const code = form.exam_code.trim().toUpperCase()
      const exams = await queryOnce('exams', [where('exam_code', '==', code)])
      if (exams.length === 0) {
        toast.error('Mã phòng thi không đúng. Kiểm tra lại!')
        setErrors(e => ({ ...e, exam_code: 'Mã không tồn tại' }))
        return
      }
      const exam = exams[0]
      if (exam.status === 'ended') {
        toast.error('Ca thi này đã kết thúc.')
        return
      }

      // Check if student already joined
      const existing = await queryOnce('students', [
        where('exam_id', '==', exam.id),
        where('computer_name', '==', form.computer_name.trim()),
      ])

      let studentId
      if (existing.length > 0) {
        studentId = existing[0].id
        toast('Bạn đã vào phòng thi này rồi. Tiếp tục...', { icon: 'ℹ️' })
      } else {
        const ref = await addDocument('students', {
          exam_id: exam.id,
          exam_code: code,
          name: form.name.trim(),
          class: form.class.trim(),
          computer_name: form.computer_name.trim(),
          status: 'waiting',
          joined_at: new Date(),
        })
        studentId = ref.id
      }

      // Store in session (sessionStorage + localStorage backup for tab-close recovery)
      sessionStorage.setItem('student_id', studentId)
      sessionStorage.setItem('exam_id', exam.id)
      sessionStorage.setItem('student_name', form.name.trim())
      localStorage.setItem('exam_session', JSON.stringify({ student_id: studentId, exam_id: exam.id }))

      navigate('/exam')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
            className="absolute text-white opacity-10 text-6xl"
            style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
          >
            {['📚', '✏️', '🎓', '💻', '🌟', '📝'][i]}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Top banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 text-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3"
          >
            <GraduationCap size={32} className="text-white" />
          </motion.div>
          <h1 className="text-xl font-bold text-white">Vào phòng thi</h1>
          <p className="text-emerald-100 text-sm mt-1">Môn Tin học · Cuối kì</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 flex flex-col gap-4">
          <Input
            label="Họ và tên"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Nguyễn Văn An"
            icon={<User size={15} />}
            error={errors.name}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <Input
            label="Lớp"
            value={form.class}
            onChange={e => set('class', e.target.value)}
            placeholder="VD: 3A1, 4B2..."
            icon={<Building size={15} />}
            error={errors.class}
          />
          <Input
            label="Tên máy tính"
            value={form.computer_name}
            onChange={e => set('computer_name', e.target.value)}
            placeholder="VD: PC01, May-12..."
            icon={<Monitor size={15} />}
            error={errors.computer_name}
          />
          <div className="relative">
            <Input
              label="Mã phòng thi"
              value={form.exam_code}
              onChange={e => set('exam_code', e.target.value.toUpperCase())}
              placeholder="VD: AB3CD5"
              icon={<Hash size={15} />}
              error={errors.exam_code}
              className="font-mono text-lg tracking-widest uppercase"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              className="w-full mt-2"
              size="lg"
              loading={loading}
              onClick={handleJoin}
              icon={<ArrowRight size={18} />}
            >
              Vào phòng thi
            </Button>
          </motion.div>
        </div>

        <div className="px-8 pb-6 text-center text-xs text-gray-400">
          Nếu không có mã phòng thi, hãy hỏi giáo viên
        </div>
      </motion.div>
    </div>
  )
}
