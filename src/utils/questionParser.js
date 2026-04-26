/**
 * Parses pasted question text from Word documents.
 * Supports all 8 question types based on format patterns.
 */

export function parseQuestionsFromText(text) {
  const blocks = splitIntoBlocks(text)
  const questions = []

  for (const block of blocks) {
    const parsed = parseBlock(block)
    if (parsed) questions.push(parsed)
  }
  return questions
}

function splitIntoBlocks(text) {
  return text
    .split(/\n(?=Câu\s+\d+[\s:.])/i)
    .map(b => b.trim())
    .filter(Boolean)
}

function parseBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return null

  const firstLine = lines[0]

  // Check for [TL] prefix → essay
  if (firstLine.match(/\[TL\]/i)) {
    return parseEssay(lines)
  }

  const answerLine = lines.find(l => l.match(/^Đáp án:\s*/i))
  if (!answerLine) return null

  const answer = answerLine.replace(/^Đáp án:\s*/i, '').trim()
  const options = lines.filter(l => l.match(/^[A-Z]\.\s+/i))
  const targets = lines.filter(l => l.match(/^>\d+\.\s+/))

  // Nối đôi: has targets (>1. ...)
  if (targets.length > 0) {
    return parseMatching(lines)
  }

  // Đúng/Sai: answer is "Đúng" or "Sai", no A/B/C/D
  if ((answer === 'Đúng' || answer === 'Sai') && options.length === 0) {
    return parseTrueFalse(lines)
  }

  // Has A/B/C/D options
  if (options.length >= 2) {
    // Sort order: answer like A,B,C,D
    if (answer.match(/^[A-Z](,[A-Z])+$/)) {
      return parseSortOrder(lines, options)
    }

    // Word sort: answer is a full sentence
    if (answer.includes(' ') && !answer.match(/^[A-Z]$/)) {
      return parseWordSort(lines, options)
    }

    // Drag fill: question has ___
    if (firstLine.includes('___') || lines[0].includes('___')) {
      return parseDragFill(lines, options)
    }

    // Standard MC
    return parseMC(lines, options)
  }

  // Fill blank: has ___ in question
  if (firstLine.includes('___') || lines.some((l, i) => i < lines.length - 1 && l.includes('___'))) {
    return parseFillBlank(lines)
  }

  return null
}

function getQuestion(lines) {
  return lines[0].replace(/^Câu\s+\d+[\s:.]+/i, '').trim()
}

function parseMC(lines, options) {
  const answer = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()
  return {
    type: 'mc',
    grade: 3,
    question: getQuestion(lines),
    options: options.map(o => o.replace(/^[A-Z]\.\s+/, '').trim()),
    correct_answer: answer?.replace(/^([A-Z])\.?\s*.*/, '$1') || answer,
    score: 0.5,
  }
}

function parseTrueFalse(lines) {
  const answer = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()
  return {
    type: 'true_false',
    grade: 3,
    question: getQuestion(lines),
    options: ['Đúng', 'Sai'],
    correct_answer: answer,
    score: 0.5,
  }
}

function parseFillBlank(lines) {
  const answer = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()
  return {
    type: 'fill_blank',
    grade: 3,
    question: getQuestion(lines),
    correct_answer: answer || '',
    score: 0.5,
  }
}

function parseSortOrder(lines, options) {
  const answer = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()
  return {
    type: 'sort_order',
    grade: 3,
    question: getQuestion(lines),
    options: options.map(o => o.replace(/^[A-Z]\.\s+/, '').trim()),
    correct_answer: answer?.split(',').map(a => a.trim()) || [],
    score: 1,
  }
}

function parseDragFill(lines, options) {
  const answer = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()
  return {
    type: 'drag_fill',
    grade: 3,
    question: getQuestion(lines),
    options: options.map(o => o.replace(/^[A-Z]\.\s+/, '').trim()),
    correct_answer: answer,
    score: 0.5,
  }
}

function parseWordSort(lines, options) {
  const answer = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()
  return {
    type: 'word_sort',
    grade: 3,
    question: getQuestion(lines),
    options: options.map(o => o.replace(/^[A-Z]\.\s+/, '').trim()),
    correct_answer: answer?.split(' ') || [],
    score: 1,
  }
}

function parseMatching(lines) {
  const options = lines.filter(l => l.match(/^[A-Z]\.\s+/)).map(o => o.replace(/^[A-Z]\.\s+/, '').trim())
  const targets = lines.filter(l => l.match(/^>\d+\.\s+/)).map(t => t.replace(/^>\d+\.\s+/, '').trim())
  const answerLine = lines.find(l => l.match(/^Đáp án:\s*/i))?.replace(/^Đáp án:\s*/i, '').trim()

  const correct_answer = {}
  if (answerLine) {
    answerLine.split(',').forEach(pair => {
      const [left, right] = pair.trim().split('-')
      if (left && right) correct_answer[left.trim()] = right.trim()
    })
  }

  return {
    type: 'matching',
    grade: 3,
    question: getQuestion(lines),
    options,
    targets,
    correct_answer,
    score: 1,
  }
}

function parseEssay(lines) {
  const hintLine = lines.find(l => l.match(/^Gợi ý:/i))
  const allowFile = lines.some(l => l.includes('[File]'))
  return {
    type: 'essay',
    grade: 3,
    question: lines[0].replace(/^\[TL\]\s*/i, '').replace(/^Câu\s+\d+[\s:.]+\[TL\]\s*/i, '').trim(),
    hint: hintLine?.replace(/^Gợi ý:\s*/i, '').trim() || '',
    allow_file: allowFile,
    correct_answer: '',
    score: 2,
  }
}
