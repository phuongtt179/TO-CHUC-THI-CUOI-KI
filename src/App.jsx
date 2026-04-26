import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TeacherLayout } from '@/components/layout/TeacherLayout'

// Teacher pages
import { DashboardPage } from '@/pages/teacher/DashboardPage'
import { QuestionBankPage } from '@/pages/teacher/QuestionBankPage'
import { TemplateListPage } from '@/pages/teacher/TemplateListPage'
import { TemplateEditorPage } from '@/pages/teacher/TemplateEditorPage'
import { ExamSessionPage } from '@/pages/teacher/ExamSessionPage'
import { MonitorPage } from '@/pages/teacher/MonitorPage'
import { ReviewPage } from '@/pages/teacher/ReviewPage'
import { BatchGradePage } from '@/pages/teacher/BatchGradePage'
import { PrintExamPage } from '@/pages/teacher/PrintExamPage'
import { BatchPrintPage } from '@/pages/teacher/BatchPrintPage'
import { ExportPage } from '@/pages/teacher/ExportPage'

// Student pages
import { JoinPage } from '@/pages/student/JoinPage'
import { ExamPage } from '@/pages/student/ExamPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Student routes */}
        <Route path="/" element={<JoinPage />} />
        <Route path="/exam" element={<ExamPage />} />

        {/* Teacher routes */}
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="questions" element={<QuestionBankPage />} />
          <Route path="templates" element={<TemplateListPage />} />
          <Route path="templates/new" element={<TemplateEditorPage />} />
          <Route path="templates/:id" element={<TemplateEditorPage />} />
          <Route path="exams" element={<ExamSessionPage />} />
          <Route path="exams/new" element={<ExamSessionPage />} />
          <Route path="monitor/:examId" element={<MonitorPage />} />
          <Route path="review/:studentId" element={<ReviewPage />} />
          <Route path="batch-grade/:examId" element={<BatchGradePage />} />
          <Route path="print/:studentId" element={<PrintExamPage />} />
          <Route path="batch-print/:examId" element={<BatchPrintPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
