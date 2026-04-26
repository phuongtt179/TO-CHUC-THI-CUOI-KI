import JSZip from 'jszip'

// Returns scratchblocks markup for a reporter block
function reporterMarkup(block, blocks) {
  if (!block) return '(...)'
  const op = block.opcode
  if (op === 'sensing_answer') return '(trả lời :: sensing)'
  if (op === 'sensing_timer') return '(đồng hồ :: sensing)'
  if (op === 'sensing_username') return '(tên người dùng :: sensing)'
  if (op === 'sensing_current') return '(thời gian hiện tại :: sensing)'
  if (op === 'sensing_dayssince2000') return '(ngày kể từ 2000 :: sensing)'
  if (op === 'data_variable') {
    const v = block.fields?.VARIABLE?.[0] || '?'
    return `(${v} :: variables)`
  }
  if (op === 'data_listcontents') {
    const l = block.fields?.LIST?.[0] || '?'
    return `(${l} :: list)`
  }
  if (op === 'motion_xposition') return '(x :: motion)'
  if (op === 'motion_yposition') return '(y :: motion)'
  if (op === 'motion_direction') return '(hướng :: motion)'
  if (op === 'looks_size') return '(kích thước :: looks)'
  if (op === 'looks_costume') return '(trang phục :: looks)'
  if (op === 'sound_volume') return '(âm lượng :: sound)'
  if (op?.startsWith('operator_')) return '(...)'
  const category = OPCODE_CATEGORY[op] || 'custom'
  return `(... :: ${category})`
}

// Number input — returns (value) or (reporter :: cat)
function N(inputs, blocks, name, def = '0') {
  const input = inputs?.[name]
  if (!input) return `(${def})`
  const slot = input[1]
  if (Array.isArray(slot)) {
    const v = slot[1]
    return v !== undefined && v !== '' ? `(${v})` : `(${def})`
  }
  if (typeof slot === 'string' && blocks[slot]) {
    const inner = blocks[slot]
    if (inner?.shadow) {
      const ff = Object.values(inner.fields || {})[0]
      return ff?.[0] !== undefined ? `(${ff[0]})` : `(${def})`
    }
    return reporterMarkup(inner, blocks)
  }
  return `(${def})`
}

// String input — returns [value] or (reporter :: cat)
function S(inputs, blocks, name, def = '') {
  const input = inputs?.[name]
  if (!input) return `[${def}]`
  const slot = input[1]
  if (Array.isArray(slot)) {
    const v = slot[1]
    return v !== undefined ? `[${v}]` : `[${def}]`
  }
  if (typeof slot === 'string' && blocks[slot]) {
    const inner = blocks[slot]
    if (inner?.shadow) {
      const ff = Object.values(inner.fields || {})[0]
      return ff?.[0] !== undefined ? `[${ff[0]}]` : `[${def}]`
    }
    return reporterMarkup(inner, blocks)
  }
  return `[${def}]`
}

// Dropdown input from inputs (shadow block with field)
function D(inputs, blocks, name, def = '...') {
  const input = inputs?.[name]
  if (!input) return `[${def} v]`
  const slot = input[1]
  if (Array.isArray(slot)) return `[${slot[1] ?? def} v]`
  if (typeof slot === 'string' && blocks[slot]) {
    const inner = blocks[slot]
    if (inner?.shadow) {
      const ff = Object.values(inner.fields || {})[0]
      return ff?.[0] ? `[${ff[0]} v]` : `[${def} v]`
    }
  }
  return `[${def} v]`
}

const OPCODES = {
  // Events
  event_whenflagclicked: () => 'Khi nhấn cờ xanh',
  event_whenkeypressed: (b) => `Khi nhấn phím [${b.fields?.KEY_OPTION?.[0] || 'space'} v]`,
  event_whenthisspriteclicked: () => 'Khi click vào nhân vật',
  event_whenstageclicked: () => 'Khi click vào sân khấu',
  event_whenbroadcastreceived: (b) => `Khi nhận [${b.fields?.BROADCAST_OPTION?.[0] || ''} v]`,
  event_broadcast: (b, bs) => `Phát thông điệp ${S(b.inputs, bs, 'BROADCAST_INPUT', '...')}`,
  event_broadcastandwait: (b, bs) => `Phát thông điệp ${S(b.inputs, bs, 'BROADCAST_INPUT', '...')} và đợi`,
  event_whengreaterthan: (b) => `Khi ${b.fields?.WHENGREATERTHANMENU?.[0] || ''} > ...`,

  // Control
  control_wait: (b, bs) => `Đợi ${N(b.inputs, bs, 'DURATION', '1')} giây`,
  control_repeat: (b, bs) => `Lặp ${N(b.inputs, bs, 'TIMES', '10')} lần`,
  control_forever: () => 'Lặp mãi',
  control_if: () => 'Nếu <...> thì',
  control_if_else: () => 'Nếu <...> thì',
  control_wait_until: () => 'Đợi đến khi <...>',
  control_repeat_until: () => 'Lặp đến khi <...>',
  control_stop: (b) => `Dừng [${b.fields?.STOP_OPTION?.[0] || 'all'} v]`,
  control_start_as_clone: () => 'Khi bắt đầu là bản sao',
  control_create_clone_of: (b, bs) => `Tạo bản sao của ${D(b.inputs, bs, 'CLONE_OPTION', '_myself_')}`,
  control_delete_this_clone: () => 'Xóa bản sao này',

  // Motion
  motion_movesteps: (b, bs) => `Di chuyển ${N(b.inputs, bs, 'STEPS', '10')} bước`,
  motion_turnright: (b, bs) => `Quay phải ${N(b.inputs, bs, 'DEGREES', '15')} độ`,
  motion_turnleft: (b, bs) => `Quay trái ${N(b.inputs, bs, 'DEGREES', '15')} độ`,
  motion_goto: (b, bs) => `Đến vị trí ${D(b.inputs, bs, 'TO', '...')}`,
  motion_gotoxy: (b, bs) => `Đến x: ${N(b.inputs, bs, 'X', '0')} y: ${N(b.inputs, bs, 'Y', '0')}`,
  motion_glideto: (b, bs) => `Trượt ${N(b.inputs, bs, 'SECS', '1')} giây đến ${D(b.inputs, bs, 'TO', '...')}`,
  motion_glidesecstoxy: (b, bs) => `Trượt ${N(b.inputs, bs, 'SECS', '1')} giây đến x: ${N(b.inputs, bs, 'X', '0')} y: ${N(b.inputs, bs, 'Y', '0')}`,
  motion_changexby: (b, bs) => `Thay đổi x thêm ${N(b.inputs, bs, 'DX', '10')}`,
  motion_changeyby: (b, bs) => `Thay đổi y thêm ${N(b.inputs, bs, 'DY', '10')}`,
  motion_setx: (b, bs) => `Đặt x = ${N(b.inputs, bs, 'X', '0')}`,
  motion_sety: (b, bs) => `Đặt y = ${N(b.inputs, bs, 'Y', '0')}`,
  motion_ifonedgebounce: () => 'Nếu chạm biên thì nảy',
  motion_setrotationstyle: (b) => `Kiểu xoay: [${b.fields?.STYLE?.[0] || ''} v]`,
  motion_pointindirection: (b, bs) => `Quay về hướng ${N(b.inputs, bs, 'DIRECTION', '90')}`,
  motion_pointtowards: (b, bs) => `Quay về phía ${D(b.inputs, bs, 'TOWARDS', '...')}`,

  // Looks
  looks_say: (b, bs) => `Nói ${S(b.inputs, bs, 'MESSAGE', '')}`,
  looks_sayforsecs: (b, bs) => `Nói ${S(b.inputs, bs, 'MESSAGE', '')} trong ${N(b.inputs, bs, 'SECS', '2')} giây`,
  looks_think: (b, bs) => `Nghĩ ${S(b.inputs, bs, 'MESSAGE', '')}`,
  looks_thinkforsecs: (b, bs) => `Nghĩ ${S(b.inputs, bs, 'MESSAGE', '')} trong ${N(b.inputs, bs, 'SECS', '2')} giây`,
  looks_switchcostumeto: (b, bs) => `Đổi trang phục thành ${D(b.inputs, bs, 'COSTUME', '...')}`,
  looks_nextcostume: () => 'Trang phục tiếp theo',
  looks_switchbackdropto: (b, bs) => `Đổi phông nền thành ${D(b.inputs, bs, 'BACKDROP', '...')}`,
  looks_nextbackdrop: () => 'Phông nền tiếp theo',
  looks_changesizeby: (b, bs) => `Thay đổi kích thước thêm ${N(b.inputs, bs, 'CHANGE', '10')}`,
  looks_setsizeto: (b, bs) => `Đặt kích thước = ${N(b.inputs, bs, 'SIZE', '100')} %`,
  looks_changeeffectby: (b, bs) => `Thay đổi hiệu ứng [${b.fields?.EFFECT?.[0] || ''} v] thêm ${N(b.inputs, bs, 'CHANGE', '25')}`,
  looks_seteffectto: (b, bs) => `Đặt hiệu ứng [${b.fields?.EFFECT?.[0] || ''} v] = ${N(b.inputs, bs, 'VALUE', '0')}`,
  looks_cleargraphiceffects: () => 'Xóa hiệu ứng',
  looks_show: () => 'Hiện nhân vật',
  looks_hide: () => 'Ẩn nhân vật',
  looks_gotofrontback: (b) => `Đưa lên [${b.fields?.FRONT_BACK?.[0] === 'front' ? 'trước' : 'sau'} v]`,
  looks_goforwardbackwardlayers: (b, bs) => `Thay đổi ${N(b.inputs, bs, 'NUM', '1')} lớp [${b.fields?.FORWARD_BACKWARD?.[0] || ''} v]`,

  // Sound
  sound_play: (b, bs) => `Phát âm thanh ${D(b.inputs, bs, 'SOUND_MENU', '...')}`,
  sound_playuntildone: (b, bs) => `Phát âm thanh ${D(b.inputs, bs, 'SOUND_MENU', '...')} và đợi`,
  sound_stopallsounds: () => 'Dừng tất cả âm thanh',
  sound_changeeffectby: (b, bs) => `Thay đổi hiệu ứng [${b.fields?.EFFECT?.[0] || ''} v] thêm ${N(b.inputs, bs, 'VALUE', '10')}`,
  sound_seteffectto: (b, bs) => `Đặt hiệu ứng [${b.fields?.EFFECT?.[0] || ''} v] = ${N(b.inputs, bs, 'VALUE', '100')}`,
  sound_changevolumeby: (b, bs) => `Thay đổi âm lượng thêm ${N(b.inputs, bs, 'VOLUME', '-10')}`,
  sound_setvolumeto: (b, bs) => `Đặt âm lượng = ${N(b.inputs, bs, 'VOLUME', '100')} %`,

  // Variables
  data_setvariableto: (b, bs) => `Đặt [${b.fields?.VARIABLE?.[0] || 'biến'} v] thành ${N(b.inputs, bs, 'VALUE', '')}`,
  data_changevariableby: (b, bs) => `Thêm ${N(b.inputs, bs, 'VALUE', '1')} vào [${b.fields?.VARIABLE?.[0] || 'biến'} v]`,
  data_showvariable: (b) => `Hiện biến [${b.fields?.VARIABLE?.[0] || ''} v]`,
  data_hidevariable: (b) => `Ẩn biến [${b.fields?.VARIABLE?.[0] || ''} v]`,
  data_addtolist: (b, bs) => `Thêm ${N(b.inputs, bs, 'ITEM', '')} vào [${b.fields?.LIST?.[0] || ''} v]`,
  data_deleteoflist: (b, bs) => `Xóa mục ${N(b.inputs, bs, 'INDEX', '1')} khỏi [${b.fields?.LIST?.[0] || ''} v]`,
  data_insertatlist: (b, bs) => `Chèn ${S(b.inputs, bs, 'ITEM', '')} vào vị trí ${N(b.inputs, bs, 'INDEX', '1')} của [${b.fields?.LIST?.[0] || ''} v]`,
  data_replaceitemoflist: (b, bs) => `Thay mục ${N(b.inputs, bs, 'INDEX', '1')} trong [${b.fields?.LIST?.[0] || ''} v] thành ${S(b.inputs, bs, 'ITEM', '')}`,

  // Sensing
  sensing_askandwait: (b, bs) => `Hỏi ${S(b.inputs, bs, 'QUESTION', '')} và đợi`,
  sensing_setdragmode: (b) => `Đặt chế độ kéo [${b.fields?.DRAG_MODE?.[0] || ''} v]`,
  sensing_resettimer: () => 'Đặt lại đồng hồ',

  // Pen
  pen_clear: () => 'Xóa bản vẽ',
  pen_stamp: () => 'Đóng dấu',
  pen_penDown: () => 'Hạ bút',
  pen_penUp: () => 'Nhấc bút',
  pen_setPenColorToColor: () => 'Đặt màu bút',
  pen_setPenSizeTo: (b, bs) => `Đặt kích thước bút = ${N(b.inputs, bs, 'SIZE', '1')}`,
}

const OPCODE_CATEGORY = {
  event_whenflagclicked: 'events', event_whenkeypressed: 'events',
  event_whenthisspriteclicked: 'events', event_whenstageclicked: 'events',
  event_whenbroadcastreceived: 'events', event_broadcast: 'events',
  event_broadcastandwait: 'events', event_whengreaterthan: 'events',
  control_wait: 'control', control_repeat: 'control', control_forever: 'control',
  control_if: 'control', control_if_else: 'control', control_wait_until: 'control',
  control_repeat_until: 'control', control_stop: 'control',
  control_start_as_clone: 'events', control_create_clone_of: 'control',
  control_delete_this_clone: 'control',
  motion_movesteps: 'motion', motion_turnright: 'motion', motion_turnleft: 'motion',
  motion_goto: 'motion', motion_gotoxy: 'motion', motion_glideto: 'motion',
  motion_glidesecstoxy: 'motion', motion_changexby: 'motion', motion_changeyby: 'motion',
  motion_setx: 'motion', motion_sety: 'motion', motion_ifonedgebounce: 'motion',
  motion_setrotationstyle: 'motion', motion_pointindirection: 'motion',
  motion_pointtowards: 'motion',
  looks_say: 'looks', looks_sayforsecs: 'looks', looks_think: 'looks',
  looks_thinkforsecs: 'looks', looks_switchcostumeto: 'looks', looks_nextcostume: 'looks',
  looks_switchbackdropto: 'looks', looks_nextbackdrop: 'looks',
  looks_changesizeby: 'looks', looks_setsizeto: 'looks', looks_changeeffectby: 'looks',
  looks_seteffectto: 'looks', looks_cleargraphiceffects: 'looks',
  looks_show: 'looks', looks_hide: 'looks', looks_gotofrontback: 'looks',
  looks_goforwardbackwardlayers: 'looks',
  sound_play: 'sound', sound_playuntildone: 'sound', sound_stopallsounds: 'sound',
  sound_changeeffectby: 'sound', sound_seteffectto: 'sound',
  sound_changevolumeby: 'sound', sound_setvolumeto: 'sound',
  data_setvariableto: 'variables', data_changevariableby: 'variables',
  data_showvariable: 'variables', data_hidevariable: 'variables',
  data_addtolist: 'list', data_deleteoflist: 'list',
  data_insertatlist: 'list', data_replaceitemoflist: 'list',
  sensing_askandwait: 'sensing', sensing_setdragmode: 'sensing', sensing_resettimer: 'sensing',
  pen_clear: 'pen', pen_stamp: 'pen', pen_penDown: 'pen', pen_penUp: 'pen',
  pen_setPenColorToColor: 'pen', pen_setPenSizeTo: 'pen',
}

const HAT_OPCODES = new Set([
  'event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked',
  'event_whenstageclicked', 'event_whenbroadcastreceived', 'event_whengreaterthan',
  'control_start_as_clone',
])
const CAP_OPCODES = new Set(['control_stop', 'control_delete_this_clone'])
const CONTAINER_OPCODES = new Set([
  'control_repeat', 'control_forever', 'control_if', 'control_if_else',
  'control_repeat_until',
])

function blockLabel(block, blocks) {
  const fn = OPCODES[block.opcode]
  if (fn) return fn(block, blocks)
  return block.opcode.replace(/_/g, ' ')
}

// Tree structure for CSS rendering
export function traverseToTree(startId, blocks) {
  const nodes = []
  let currentId = startId
  while (currentId && blocks[currentId]) {
    const block = blocks[currentId]
    if (block.shadow) { currentId = block.next; continue }
    const node = {
      opcode: block.opcode,
      label: blockLabel(block, blocks),
      category: OPCODE_CATEGORY[block.opcode] || 'custom',
      isHat: HAT_OPCODES.has(block.opcode),
      isCap: CAP_OPCODES.has(block.opcode),
      isContainer: CONTAINER_OPCODES.has(block.opcode),
      sub1: [],
      sub2: null,
    }
    const sub1Id = block.inputs?.SUBSTACK?.[1]
    if (sub1Id && blocks[sub1Id]) node.sub1 = traverseToTree(sub1Id, blocks)
    const sub2Id = block.inputs?.SUBSTACK2?.[1]
    if (sub2Id && blocks[sub2Id]) node.sub2 = traverseToTree(sub2Id, blocks)
    nodes.push(node)
    currentId = block.next
  }
  return nodes
}

export async function parseScratchFileAsTree(fileUrl) {
  const projectJson = await loadProjectJson(fileUrl)
  const targets = projectJson.targets || []
  const result = []
  for (const target of targets) {
    const blocks = target.blocks || {}
    const topLevels = Object.entries(blocks)
      .filter(([, b]) => b.topLevel && !b.shadow)
      .map(([id]) => id)
    if (topLevels.length === 0) continue
    const scripts = topLevels.map(id => traverseToTree(id, blocks)).filter(s => s.length > 0)
    if (scripts.length > 0) result.push({ name: target.name, isStage: target.isStage, scripts })
  }
  return result.sort((a, b) => (a.isStage ? 1 : 0) - (b.isStage ? 1 : 0))
}

function traverseToSbText(startId, blocks, depth = 0, lines = []) {
  let currentId = startId
  while (currentId && blocks[currentId]) {
    const block = blocks[currentId]
    if (block.shadow) { currentId = block.next; continue }

    const label = blockLabel(block, blocks)
    const category = OPCODE_CATEGORY[block.opcode] || 'custom'
    const indent = '  '.repeat(depth)
    let typeStr = ''
    if (HAT_OPCODES.has(block.opcode)) typeStr = 'hat '
    else if (CAP_OPCODES.has(block.opcode)) typeStr = 'cap '
    else if (CONTAINER_OPCODES.has(block.opcode)) typeStr = 'c '

    lines.push(`${indent}${label} :: ${typeStr}${category}`)

    const sub1 = block.inputs?.SUBSTACK?.[1]
    if (sub1 && blocks[sub1]) traverseToSbText(sub1, blocks, depth + 1, lines)

    const sub2 = block.inputs?.SUBSTACK2?.[1]
    if (sub2 && blocks[sub2]) {
      lines.push(`${indent}else`)
      traverseToSbText(sub2, blocks, depth + 1, lines)
    }

    if (CONTAINER_OPCODES.has(block.opcode)) lines.push(`${indent}end`)

    currentId = block.next
  }
  return lines
}

async function loadProjectJson(fileUrl) {
  const res = await fetch(fileUrl)
  if (!res.ok) throw new Error('Không tải được file Scratch')
  const arrayBuffer = await res.arrayBuffer()
  const zip = new JSZip()
  await zip.loadAsync(arrayBuffer)
  const projectFile = zip.files['project.json']
  if (!projectFile) throw new Error('File .sb3 không hợp lệ')
  return JSON.parse(await projectFile.async('text'))
}

export async function parseScratchFileAsText(fileUrl) {
  const projectJson = await loadProjectJson(fileUrl)
  const targets = projectJson.targets || []
  const result = []

  for (const target of targets) {
    const blocks = target.blocks || {}
    const topLevels = Object.entries(blocks)
      .filter(([, b]) => b.topLevel && !b.shadow)
      .map(([id]) => id)
    if (topLevels.length === 0) continue

    const scripts = topLevels
      .map(id => traverseToSbText(id, blocks).join('\n'))
      .filter(s => s.trim().length > 0)

    if (scripts.length > 0)
      result.push({ name: target.name, isStage: target.isStage, scripts })
  }

  return result.sort((a, b) => (a.isStage ? 1 : 0) - (b.isStage ? 1 : 0))
}
