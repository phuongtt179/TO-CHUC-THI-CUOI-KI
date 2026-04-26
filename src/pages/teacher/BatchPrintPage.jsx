import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, FileDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { where } from 'firebase/firestore'
import { doc, getDoc } from 'firebase/firestore'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { Button, Card, PageLoader } from '@/components/ui'
import { useDocument, useCollection } from '@/hooks/useFirestore'
import { ExamPrintContent } from '@/components/print/ExamPrintContent'
import { db } from '@/firebase/config'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'

export function BatchPrintPage() {
  const navigate = useNavigate()
  const { examId } = useParams()

  const { data: exam, loading: examLoading } = useDocument('exams', examId)
  const { data: allStudents } = useCollection('students', [where('exam_id', '==', examId)])

  const submittedStudents = [...allStudents]
    .filter(s => ['submitted', 'submitted_auto', 'graded'].includes(s.status))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' })
  const [results, setResults] = useState([])
  const [done, setDone] = useState(false)

  const handleGenerate = async () => {
    if (submittedStudents.length === 0) { toast.error('Không có bài nào để xuất'); return }

    setGenerating(true)
    setDone(false)
    setResults([])
    setProgress({ current: 0, total: submittedStudents.length, name: '' })

    const zip = new JSZip()
    const folder = zip.folder('bai-thi')
    const resultList = []

    for (let i = 0; i < submittedStudents.length; i++) {
      const student = submittedStudents[i]
      setProgress({ current: i + 1, total: submittedStudents.length, name: student.name })

      try {
        const [subSnap, scoreSnap] = await Promise.all([
          getDoc(doc(db, 'submissions', student.id)),
          getDoc(doc(db, 'scores', student.id)),
        ])

        const submission = subSnap.exists() ? subSnap.data() : null
        const score = scoreSnap.exists() ? scoreSnap.data() : null
        if (!submission) { resultList.push({ name: student.name, error: 'Không có bài nộp' }); continue }

        // Render exam content to off-screen container
        const container = document.createElement('div')
        container.style.cssText = 'position:fixed;top:0;left:-9999px;background:white;z-index:-1;'
        document.body.appendChild(container)

        await new Promise((resolve) => {
          const root = createRoot(container)
          root.render(<ExamPrintContent student={student} submission={submission} score={score} />)
          // Wait for React render + font load
          setTimeout(resolve, 600)
        })

        // Capture to canvas
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
        })

        document.body.removeChild(container)

        // Build PDF (multi-page if content is long)
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfW = pdf.internal.pageSize.getWidth()
        const pdfH = pdf.internal.pageSize.getHeight()
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        const imgH = (canvas.height * pdfW) / canvas.width

        let yPos = 0
        let heightLeft = imgH
        let pageNum = 0

        while (heightLeft > 0) {
          if (pageNum > 0) pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, yPos, pdfW, imgH)
          heightLeft -= pdfH
          yPos -= pdfH
          pageNum++
        }

        const pdfBlob = pdf.output('blob')
        // Filename: "HoTen - Lop.pdf"
        const safeName = `${student.name} - ${student.class}`.replace(/[/\\?%*:|"<>]/g, '-')
        folder.file(`${safeName}.pdf`, pdfBlob)

        resultList.push({ name: student.name, class: student.class, score: score?.total_final, success: true })
      } catch (e) {
        console.error(student.name, e)
        resultList.push({ name: student.name, error: e.message })
        // Cleanup if container still exists
        const leftover = document.querySelector('[style*="left:-9999px"]')
        if (leftover) document.body.removeChild(leftover)
      }

      setResults([...resultList])
    }

    // Bundle and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bai-thi-${exam?.class || examId}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setGenerating(false)
    setDone(true)
    const successCount = resultList.filter(r => r.success).length
    toast.success(`Đã xuất ${successCount}/${submittedStudents.length} bài PDF!`)
  }

  if (examLoading) return <PageLoader />

  const successCount = results.filter(r => r.success).length
  const errorCount = results.filter(r => r.error).length

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Xuất PDF tất cả bài thi</h1>
          <p className="text-sm text-gray-500">{exam?.template_snapshot?.name} · Lớp {exam?.class}</p>
        </div>
        <Button
          icon={generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          disabled={generating || submittedStudents.length === 0}
          onClick={handleGenerate}
        >
          {generating ? 'Đang xuất...' : `Xuất ${submittedStudents.length} bài PDF`}
        </Button>
      </div>

      {/* Progress */}
      {generating && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={16} className="text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-indigo-800">
              Đang tạo PDF {progress.current}/{progress.total}: {progress.name}
            </p>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-indigo-500 mt-2">Mỗi bài mất khoảng 2-3 giây để xử lý...</p>
        </div>
      )}

      {/* Done */}
      {done && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800">
              Hoàn thành! Đã xuất {successCount} file PDF
            </p>
            <p className="text-sm text-emerald-600">File ZIP đã được tải xuống tự động.</p>
          </div>
        </div>
      )}

      {/* Info */}
      {!generating && !done && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">Thông tin xuất PDF:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-600">
            <li>Mỗi học sinh → 1 file PDF riêng</li>
            <li>Tất cả file được nén vào 1 file <strong>.zip</strong> và tải xuống tự động</li>
            <li>Format chuẩn đề thi: header, điểm, đáp án từng câu</li>
            <li>Thời gian: ~{Math.ceil(submittedStudents.length * 3)} giây</li>
          </ul>
        </div>
      )}

      {/* Student list */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Bài đã nộp ({submittedStudents.length})</h2>
          {results.length > 0 && (
            <div className="flex gap-3 text-sm">
              {successCount > 0 && <span className="text-emerald-600 font-semibold">✓ {successCount} thành công</span>}
              {errorCount > 0 && <span className="text-red-500 font-semibold">✗ {errorCount} lỗi</span>}
            </div>
          )}
        </div>
        {submittedStudents.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Chưa có học sinh nào nộp bài</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {submittedStudents.map((student, idx) => {
              const result = results.find(r => r.name === student.name && r.class === student.class)
              const isCurrent = generating && progress.name === student.name && !result
              return (
                <div key={student.id} className={cn(
                  'flex items-center gap-4 px-5 py-3 transition-colors',
                  result?.success ? 'bg-emerald-50' : result?.error ? 'bg-red-50' : 'hover:bg-gray-50',
                  isCurrent && 'bg-indigo-50'
                )}>
                  <span className="text-sm text-gray-400 w-6">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                    <p className="text-xs text-gray-500">Lớp {student.class} · {student.computer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && <Loader2 size={14} className="text-indigo-500 animate-spin" />}
                    {result?.success && (
                      <>
                        <CheckCircle size={14} className="text-emerald-600" />
                        {result.score != null && <span className="text-sm font-bold text-emerald-700">{result.score}/10đ</span>}
                      </>
                    )}
                    {result?.error && (
                      <div className="flex items-center gap-1">
                        <AlertCircle size={14} className="text-red-500" />
                        <span className="text-xs text-red-500">{result.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
