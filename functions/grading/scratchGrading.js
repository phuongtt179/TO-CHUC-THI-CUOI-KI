'use strict'

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

/**
 * Runs a Scratch .sb3 file against test cases using scratch-vm headless.
 * Falls back to structural analysis if VM fails.
 */
async function gradeScratchFile({ fileUrl, testCases }) {
  const results = []

  try {
    const buffer = await fetchBuffer(fileUrl)
    const vmResults = await runWithVM(buffer, testCases)
    return vmResults
  } catch (vmError) {
    console.warn('VM execution failed, falling back to structural analysis:', vmError.message)
    try {
      const buffer = await fetchBuffer(fileUrl)
      return await structuralAnalysis(buffer, testCases)
    } catch (e) {
      return testCases.map(tc => ({
        input: Array.isArray(tc.input) ? tc.input.join(',') : tc.input,
        expected: tc.expected,
        actual: null,
        passed: false,
        score: 0,
        error: 'Không thể chạy file: ' + e.message,
      }))
    }
  }
}

async function runWithVM(buffer, testCases) {
  // Dynamic require to handle potential load failures
  let ScratchVM
  try {
    ScratchVM = require('scratch-vm')
  } catch (e) {
    throw new Error('scratch-vm not available: ' + e.message)
  }

  const results = []

  for (const testCase of testCases) {
    const inputs = Array.isArray(testCase.input)
      ? testCase.input.map(String)
      : String(testCase.input).split(',').map(s => s.trim())

    let output = null
    let error = null

    try {
      const vm = new ScratchVM()

      // Set up answer injection
      let inputQueue = [...inputs]
      const outputs = []

      vm.runtime.on('QUESTION', (_question) => {
        const answer = inputQueue.shift() || ''
        vm.runtime.emit('ANSWER', answer)
      })

      vm.runtime.on('SAY', (_target, _type, message) => {
        if (message) outputs.push(String(message))
      })

      await vm.loadProject(buffer)
      vm.start()
      vm.greenFlag()

      // Wait for execution (max 5 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000))
      vm.stopAll()
      vm.runtime.stopAll()

      output = outputs[outputs.length - 1] || null

    } catch (e) {
      error = e.message
    }

    const passed = output !== null && normalizeOutput(output) === normalizeOutput(testCase.expected)

    results.push({
      input: Array.isArray(testCase.input) ? testCase.input.join(', ') : testCase.input,
      expected: testCase.expected,
      actual: output || '(không có output)',
      passed,
      score: passed ? (testCase.score || 0) : 0,
      error,
    })
  }

  return results
}

function normalizeOutput(str) {
  return String(str || '').trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
}

/**
 * Fallback: parse .sb3 JSON structure and check for expected patterns
 */
async function structuralAnalysis(buffer, testCases) {
  const zip = await JSZip.loadAsync(buffer)
  const projectFile = zip.files['project.json']
  if (!projectFile) throw new Error('Invalid .sb3 file')

  const projectJson = JSON.parse(await projectFile.async('string'))

  // Extract all block opcodes and values from all sprites
  const allBlocks = []
  for (const target of (projectJson.targets || [])) {
    for (const [id, block] of Object.entries(target.blocks || {})) {
      allBlocks.push(block)
    }
  }

  // Check for conditional structures (if/else)
  const hasConditionals = allBlocks.some(b =>
    b.opcode === 'control_if' || b.opcode === 'control_if_else'
  )

  // Check for say blocks
  const hasSay = allBlocks.some(b => b.opcode === 'looks_say' || b.opcode === 'looks_sayforsecs')

  // Check for ask blocks (input)
  const hasAsk = allBlocks.some(b => b.opcode === 'sensing_askandwait')

  // Check for comparison operators
  const hasComparisons = allBlocks.some(b =>
    ['operator_gt', 'operator_lt', 'operator_equals'].includes(b.opcode)
  )

  const structureScore = (hasConditionals ? 1 : 0) + (hasSay ? 1 : 0) + (hasAsk ? 1 : 0) + (hasComparisons ? 1 : 0)
  const looksCorrect = structureScore >= 3

  return testCases.map((tc, idx) => ({
    input: Array.isArray(tc.input) ? tc.input.join(', ') : tc.input,
    expected: tc.expected,
    actual: looksCorrect ? '(phân tích cấu trúc - có vẻ đúng)' : '(phân tích cấu trúc - cần kiểm tra)',
    passed: looksCorrect && idx === 0,
    score: looksCorrect && idx === 0 ? (tc.score || 0) : 0,
    error: 'Dùng phân tích tĩnh (không thể chạy trực tiếp)',
  }))
}

module.exports = { gradeScratchFile }
