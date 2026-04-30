import * as XLSX from 'xlsx'

export function exportExamToExcel(examData, students, scores) {
  const wb = XLSX.utils.book_new()

  const rows = students.map((student, idx) => {
    const score = scores.find(s => s.student_id === student.id)
    return {
      STT: idx + 1,
      'Họ tên': student.name,
      Lớp: student.class,
      'Tên máy': student.computer_name,
      'Trắc nghiệm': score?.mc_score ?? '',
      Word: score?.practice_scores?.find(p => p.type === 'word')?.score ?? '',
      Scratch: score?.practice_scores?.find(p => p.type === 'scratch')?.score ?? '',
      'Tổng thô': score?.total_raw ?? '',
      'Tổng /10': score?.total_final != null ? Math.ceil(score.total_final) : '',
      'Trạng thái': student.status,
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  ws['!cols'] = [
    { wch: 5 },
    { wch: 25 },
    { wch: 10 },
    { wch: 15 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Kết quả')

  const fileName = `ketqua_${examData?.exam_code || 'exam'}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`
  XLSX.writeFile(wb, fileName)
}

export function generateExamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
