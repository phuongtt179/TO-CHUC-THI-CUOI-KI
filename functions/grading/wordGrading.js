'use strict'

const { GoogleGenerativeAI } = require('@google/generative-ai')
const mammoth = require('mammoth')
const JSZip = require('jszip')
const https = require('https')

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function extractWordText(buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  let text = ''
  const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
  for (const slideFile of slideFiles.sort()) {
    const xml = await zip.files[slideFile].async('string')
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || []
    text += matches.map(m => m.replace(/<a:t>|<\/a:t>/g, '')).join(' ') + '\n'
  }
  return text
}

async function gradeWithGemini(docText, rubric, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const rubricText = rubric.map((r, i) =>
    `${i + 1}. ${r.name}: tối đa ${r.score} điểm`
  ).join('\n')

  const prompt = `Bạn là giáo viên chấm bài cho học sinh tiểu học (lớp 3-5). Hãy chấm bài dưới đây theo từng tiêu chí rubric.

NỘI DUNG BÀI LÀM CỦA HỌC SINH:
${docText.slice(0, 4000)}

RUBRIC CHẤM:
${rubricText}

Hãy chấm điểm từng tiêu chí và trả lời CHÍNH XÁC dưới dạng JSON sau (không thêm gì khác):
{
  "grades": [
    {"criterion": "tên tiêu chí", "score": số_điểm, "max_score": điểm_tối_đa, "comment": "nhận xét ngắn"},
    ...
  ],
  "overall_comment": "nhận xét tổng quát"
}`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    return {
      grades: rubric.map(r => ({ criterion: r.name, score: 0, max_score: r.score, comment: 'Lỗi chấm AI' })),
      overall_comment: 'Không thể phân tích nội dung'
    }
  }
}

async function gradeWordFile({ fileUrl, fileName, rubric, apiKey }) {
  try {
    const buffer = await fetchBuffer(fileUrl)
    const ext = (fileName || '').split('.').pop().toLowerCase()

    let docText
    if (ext === 'pptx') {
      docText = await extractPptxText(buffer)
    } else {
      docText = await extractWordText(buffer)
    }

    if (!docText.trim()) {
      return {
        score: 0,
        max_score: rubric.reduce((s, r) => s + r.score, 0),
        details: rubric.map(r => ({ criterion: r.name, score: 0, max_score: r.score, comment: 'File trống' })),
        ai_comment: 'File không có nội dung',
      }
    }

    const graded = await gradeWithGemini(docText, rubric, apiKey)

    const details = graded.grades.map((g, i) => ({
      criterion: g.criterion || rubric[i]?.name || '',
      score: Math.min(g.score, g.max_score || rubric[i]?.score || 0),
      max_score: g.max_score || rubric[i]?.score || 0,
      comment: g.comment || '',
    }))

    const score = details.reduce((s, d) => s + d.score, 0)
    const max_score = rubric.reduce((s, r) => s + r.score, 0)

    return {
      score,
      max_score,
      details,
      ai_comment: graded.overall_comment || '',
    }
  } catch (e) {
    console.error('Word grading error:', e)
    return {
      score: 0,
      max_score: rubric.reduce((s, r) => s + r.score, 0),
      details: rubric.map(r => ({ criterion: r.name, score: 0, max_score: r.score, comment: 'Lỗi chấm' })),
      ai_comment: 'Lỗi: ' + e.message,
    }
  }
}

module.exports = { gradeWordFile }
