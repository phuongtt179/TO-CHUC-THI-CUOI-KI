import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react'
import { where, orderBy } from 'firebase/firestore'
import { Button, Card, Select, PageLoader } from '@/components/ui'
import { StatusBadge } from '@/components/ui'
import { useCollection, queryOnce } from '@/hooks/useFirestore'
import { exportExamToExcel } from '@/utils/export'
import toast from 'react-hot-toast'

export function ExportPage() {
  const [searchParams] = useSearchParams()
  const [selectedExam, setSelectedExam] = useState(searchParams.get('exam') || '')
  const [exporting, setExporting] = useState(false)
  const [preview, setPreview] = useState(null)

  const { data: exams } = useCollection('exams', [orderBy('created_at', 'desc')])

  const { data: students } = useCollection(
    'students',
    selectedExam ? [where('exam_id', '==', selectedExam)] : []
  )

  const { data: scores } = useCollection(
    'scores',
    selectedExam ? [where('exam_id', '==', selectedExam)] : []
  )

  const selectedExamData = exams.find(e => e.id === selectedExam)

  const handleExport = async () => {
    if (!selectedExam) { toast.error('Vui lòng chọn ca thi'); return }
    setExporting(true)
    try {
      exportExamToExcel(selectedExamData, students, scores)
      toast.success('Đã xuất file Excel!')
    } catch (e) {
      toast.error('Lỗi: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  const submitted = students.filter(s => ['submitted', 'submitted_auto', 'graded'].includes(s.status))

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Xuất kết quả Excel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Xuất danh sách điểm theo ca thi</p>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <Select
            label="Chọn ca thi"
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
          >
            <option value="">-- Chọn ca thi --</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>
                {e.template_snapshot?.name} · Lớp {e.class} · Mã {e.exam_code}
              </option>
            ))}
          </Select>

          {selectedExam && selectedExamData && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 rounded-xl p-4"
            >
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <p className="text-2xl font-bold text-gray-800">{students.length}</p>
                  <p className="text-xs text-gray-500">Học sinh vào thi</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{submitted.length}</p>
                  <p className="text-xs text-gray-500">Đã nộp bài</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{scores.length}</p>
                  <p className="text-xs text-gray-500">Đã chấm điểm</p>
                </div>
              </div>
              <StatusBadge status={selectedExamData.status} />
            </motion.div>
          )}

          <Button
            icon={<Download size={16} />}
            loading={exporting}
            onClick={handleExport}
            disabled={!selectedExam}
            size="lg"
          >
            Xuất Excel
          </Button>
        </div>
      </Card>

      {selectedExam && students.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet size={16} /> Xem trước dữ liệu
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">STT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Họ tên</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Lớp</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">TN</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Word</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Scratch</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Tổng/10</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((s, idx) => {
                  const sc = scores.find(sc => sc.student_id === s.id)
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.class}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{sc?.mc_score ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {sc?.practice_scores?.find(p => p.type === 'word')?.score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {sc?.practice_scores?.find(p => p.type === 'scratch')?.score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-700">
                        {sc?.total_final ?? '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
