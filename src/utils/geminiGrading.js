import { GoogleGenerativeAI } from '@google/generative-ai'
import mammoth from 'mammoth'
import JSZip from 'jszip'

async function extractDocxText(arrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value || ''
}

async function extractPptxText(arrayBuffer) {
  const zip = new JSZip()
  await zip.loadAsync(arrayBuffer)

  const slideFiles = Object.keys(zip.files)
    .filter(name => /ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
      return na - nb
    })

  let allText = ''
  for (const slideFile of slideFiles) {
    const content = await zip.files[slideFile].async('text')
    const matches = content.match(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g) || []
    const slideText = matches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ')
    if (slideText) allText += `[Slide] ${slideText}\n`
  }

  return allText || '(Không đọc được nội dung)'
}

export async function gradeFileWithGemini({ fileUrl, fileName, rubric, apiKey }) {
  const response = await fetch(fileUrl)
  if (!response.ok) throw new Error('Không tải được file bài làm')
  const arrayBuffer = await response.arrayBuffer()

  const lower = (fileName || '').toLowerCase()
  let content = ''
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    content = await extractDocxText(arrayBuffer)
  } else if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
    content = await extractPptxText(arrayBuffer)
  } else {
    throw new Error('Định dạng không hỗ trợ: ' + fileName)
  }

  const totalMax = (rubric || []).reduce((s, r) => s + (r.score || 0), 0)
  const rubricText = (rubric || []).map((r, i) =>
    `- Tiêu chí ${i + 1}: "${r.criterion}" — tối đa ${r.score} điểm${r.description ? ` (${r.description})` : ''}`
  ).join('\n')

  const prompt = `Bạn là giáo viên chấm bài môn Tin học tiểu học Việt Nam.

Bài làm (file "${fileName}"):
---
${(content || '').slice(0, 8000)}
---

Rubric chấm điểm (tổng tối đa ${totalMax} điểm):
${rubricText}

Chấm điểm từng tiêu chí. Trả về chỉ JSON (không markdown, không giải thích thêm):
{
  "details": [
    {"criterion": "tên tiêu chí", "score": điểm_số, "max_score": điểm_tối_đa, "comment": "nhận xét ngắn"}
  ],
  "ai_comment": "nhận xét tổng quan về bài làm"
}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini trả về định dạng không hợp lệ')
  const parsed = JSON.parse(jsonMatch[0])

  const totalScore = (parsed.details || []).reduce((s, d) => s + (Number(d.score) || 0), 0)

  return {
    score: Math.min(totalScore, totalMax),
    max_score: totalMax,
    details: parsed.details || [],
    ai_comment: parsed.ai_comment || '',
  }
}
