import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { cn } from '@/utils/cn'

const OPTION_LABELS = 'ABCDEFGHIJ'

const PAIR_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-400', dot: 'bg-indigo-400' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', dot: 'bg-emerald-400' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400', dot: 'bg-amber-400' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400', dot: 'bg-purple-400' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-400', dot: 'bg-pink-400' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-400', dot: 'bg-cyan-400' },
]

export function QuestionRenderer({ question, answer, onChange, locked }) {
  const { type } = question
  const commonProps = { question, answer, onChange, locked }

  const renderers = {
    mc: MCRenderer,
    true_false: TrueFalseRenderer,
    fill_blank: FillBlankRenderer,
    sort_order: SortOrderRenderer,
    drag_fill: DragFillRenderer,
    word_sort: WordSortRenderer,
    matching: MatchingRenderer,
    essay: EssayRenderer,
  }

  const Component = renderers[type] || MCRenderer

  return (
    <div className="flex flex-col gap-4">
      {/* fill_blank and drag_fill render question text inline, skip duplicate */}
      {type !== 'fill_blank' && type !== 'drag_fill' && <QuestionText question={question} />}
      <Component {...commonProps} />
    </div>
  )
}

function QuestionText({ question }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-gray-800 font-medium text-base leading-relaxed">
        {question.question}
      </p>
      {question.question_image && (
        <img
          src={question.question_image}
          alt="câu hỏi"
          className="max-h-64 rounded-xl border border-gray-200 object-contain"
        />
      )}
    </div>
  )
}

// ── Multiple Choice ──────────────────────────────────────
function MCRenderer({ question, answer, onChange, locked }) {
  return (
    <div className="flex flex-col gap-2.5">
      {(question.options || []).map((opt, idx) => {
        const label = OPTION_LABELS[idx]
        const selected = answer === label
        return (
          <motion.button
            key={idx}
            type="button"
            whileTap={{ scale: 0.98 }}
            disabled={locked}
            onClick={() => !locked && onChange(label)}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200 w-full',
              selected
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30',
              locked && 'cursor-default'
            )}
          >
            <div className={cn(
              'w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg font-bold text-sm transition-colors',
              selected ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-700'
            )}>
              {label}
            </div>
            <div className="flex items-center gap-3 flex-1">
              <span className="text-gray-700 text-sm flex-1">{opt}</span>
              {(question.option_images || [])[idx] && (
                <img src={question.option_images[idx]} alt={`option ${label}`} className="h-16 rounded-lg object-contain" />
              )}
            </div>
            <div className={cn(
              'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
              selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
            )}>
              {selected && <div className="w-full h-full rounded-full bg-white scale-[0.4] block" />}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── True / False ─────────────────────────────────────────
function TrueFalseRenderer({ answer, onChange, locked }) {
  return (
    <div className="flex gap-4">
      {['Đúng', 'Sai'].map(opt => (
        <motion.button
          key={opt}
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={locked}
          onClick={() => !locked && onChange(opt)}
          className={cn(
            'flex-1 py-4 rounded-2xl border-2 font-bold text-lg transition-all duration-200',
            answer === opt
              ? opt === 'Đúng'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-red-500 bg-red-50 text-red-600'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
            locked && 'cursor-default'
          )}
        >
          {opt === 'Đúng' ? '✓ Đúng' : '✗ Sai'}
        </motion.button>
      ))}
    </div>
  )
}

// ── Fill in the Blank (inline — renders question text with blanks) ──
function FillBlankRenderer({ question, answer, onChange, locked }) {
  const blanks = (question.question.match(/___/g) || []).length || 1

  // Normalize answer to array so inputs are controlled correctly
  const answers = Array.isArray(answer)
    ? answer
    : blanks === 1
      ? [answer || '']
      : Array(blanks).fill('')

  const handleChange = (idx, val) => {
    const next = [...answers]
    next[idx] = val
    onChange(blanks === 1 ? val : next)
  }

  const parts = question.question.split('___')

  return (
    <div className="flex flex-col gap-3">
      {question.question_image && (
        <img src={question.question_image} alt="câu hỏi" className="max-h-48 rounded-xl border border-gray-200 object-contain" />
      )}
      <div className="flex flex-wrap items-center gap-1 text-gray-700 bg-gray-50 rounded-xl p-4 leading-relaxed text-base">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1 flex-wrap">
            <span>{part}</span>
            {i < parts.length - 1 && (
              <input
                type="text"
                value={answers[i] || ''}
                onChange={e => handleChange(i, e.target.value)}
                disabled={locked}
                className={cn(
                  'min-w-[100px] border-b-2 border-indigo-400 bg-transparent px-2 py-0.5 text-center',
                  'text-indigo-700 font-semibold outline-none focus:border-indigo-600',
                  locked && 'cursor-default'
                )}
                placeholder="..."
              />
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Sort Order (drag to reorder — shuffled, no A/B/C labels) ──
function SortOrderRenderer({ question, answer, onChange, locked }) {
  const options = question.options || []

  // Shuffle once on mount if no existing answer
  const [items, setItems] = useState(() => {
    if (Array.isArray(answer) && answer.length) return answer
    const labels = options.map((_, i) => OPTION_LABELS[i])
    // Fisher-Yates shuffle
    const arr = [...labels]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor)
  )

  useEffect(() => { onChange(items) }, [items])

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || locked) return
    const oldIdx = items.indexOf(active.id)
    const newIdx = items.indexOf(over.id)
    const next = arrayMove(items, oldIdx, newIdx)
    setItems(next)
    onChange(next)
  }

  const labelMap = Object.fromEntries(
    options.map((opt, i) => [OPTION_LABELS[i], opt])
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500 italic">Kéo để sắp xếp theo đúng thứ tự:</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((id, idx) => (
              <SortableItem key={id} id={id} locked={locked}>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm font-medium w-5 flex-shrink-0">{idx + 1}.</span>
                  <span className="text-gray-700 text-sm flex-1">{labelMap[id]}</span>
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ── Drag Fill — kéo hoặc nhấn vào từ để điền vào chỗ trống ─
function DragFillRenderer({ question, answer, onChange, locked }) {
  const [dropped, setDropped] = useState(answer || '')
  const [dragOver, setDragOver] = useState(false)

  const parts = question.question.split('___')
  const options = question.options || []

  const handleDrop = (e) => {
    if (locked) return
    e.preventDefault()
    const val = e.dataTransfer.getData('text/plain')
    setDropped(val); onChange(val); setDragOver(false)
  }

  const handleSelect = (label) => {
    if (locked) return
    const next = dropped === label ? '' : label
    setDropped(next); onChange(next)
  }

  const handleRemove = () => { if (locked) return; setDropped(''); onChange('') }

  const droppedText = dropped ? options[OPTION_LABELS.indexOf(dropped)] : null

  return (
    <div className="flex flex-col gap-4">
      {question.question_image && (
        <img src={question.question_image} alt="câu hỏi" className="max-h-48 rounded-xl border border-gray-200 object-contain" />
      )}

      {/* Question with drop zone */}
      <div className="flex flex-wrap items-center gap-1.5 text-gray-700 bg-gray-50 rounded-xl p-4 text-base leading-relaxed">
        <span className="font-medium">{parts[0]}</span>

        {/* Drop zone — supports both drag-and-drop and tap */}
        <div
          onDragOver={e => { if (!locked) { e.preventDefault(); setDragOver(true) } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'inline-flex items-center min-w-[110px] min-h-[40px] rounded-xl border-2 px-3 py-1 transition-all',
            dropped
              ? 'border-indigo-400 bg-indigo-50'
              : dragOver
                ? 'border-indigo-400 bg-indigo-50/50 scale-105'
                : 'border-dashed border-gray-300 bg-white'
          )}
        >
          {dropped ? (
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-indigo-700 text-sm">{droppedText}</span>
              {!locked && (
                <button onClick={handleRemove} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X size={13} />
                </button>
              )}
            </span>
          ) : (
            <span className="text-gray-400 text-sm italic">Chọn từ bên dưới</span>
          )}
        </div>

        {parts.length > 1 && <span className="font-medium">{parts[1]}</span>}
      </div>

      {/* Word bank — tap or drag */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nhấn hoặc kéo từ vào chỗ trống:</p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt, idx) => {
            const label = OPTION_LABELS[idx]
            const isUsed = dropped === label
            return (
              <motion.button
                key={idx}
                type="button"
                whileTap={{ scale: 0.95 }}
                disabled={locked}
                draggable={!locked && !isUsed}
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', label)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => handleSelect(label)}
                className={cn(
                  'flex flex-col items-center px-4 py-2 rounded-xl border-2 font-medium text-sm transition-all select-none',
                  isUsed
                    ? 'border-indigo-500 bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                    : locked
                      ? 'border-gray-200 bg-white text-gray-700 cursor-default'
                      : 'border-indigo-300 bg-white text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50 active:scale-95'
                )}
              >
                {opt}
                {(question.option_images || [])[idx] && (
                  <img src={question.option_images[idx]} alt="" className="h-12 rounded mt-1 object-contain" />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Word Sort ────────────────────────────────────────────
function WordSortRenderer({ question, answer, onChange, locked }) {
  const allWords = question.options || []
  const initial = Array.isArray(answer) && answer.length ? answer : []
  const [sentence, setSentence] = useState(initial)

  const remaining = allWords.filter((_, i) => !sentence.includes(i))

  const addWord = (idx) => {
    if (locked) return
    const next = [...sentence, idx]
    setSentence(next)
    onChange(next.map(i => allWords[i]))
  }

  const removeWord = (sentIdx) => {
    if (locked) return
    const next = sentence.filter((_, i) => i !== sentIdx)
    setSentence(next)
    onChange(next.map(i => allWords[i]))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-[52px] flex flex-wrap gap-2 p-3 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl">
        {sentence.length === 0 && (
          <span className="text-sm text-gray-400 italic">Nhấn vào từ bên dưới để xếp thành câu...</span>
        )}
        {sentence.map((wordIdx, i) => (
          <motion.button
            key={`${wordIdx}-${i}`}
            type="button"
            whileTap={{ scale: 0.95 }}
            disabled={locked}
            onClick={() => removeWord(i)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-medium text-sm hover:bg-indigo-600 transition-colors"
          >
            {allWords[wordIdx]}
          </motion.button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {allWords.map((word, idx) => {
          const used = sentence.includes(idx)
          return (
            <motion.button
              key={idx}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={locked || used}
              onClick={() => !used && addWord(idx)}
              className={cn(
                'px-3 py-1.5 rounded-lg border-2 font-medium text-sm transition-all',
                used
                  ? 'border-gray-200 bg-gray-100 text-gray-300 cursor-default'
                  : 'border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50',
                locked && 'cursor-default'
              )}
            >
              {word}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── Matching — click to pair, column B aligns with A ─────
function MatchingRenderer({ question, answer, onChange, locked }) {
  const [pairs, setPairs] = useState(
    typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
  )
  const [selectedLeft, setSelectedLeft] = useState(null)

  const options = question.options || []
  const targets = question.targets || []
  const optionImages = question.option_images || []
  const targetImages = question.target_images || []

  const colorOf = (label) => PAIR_COLORS[OPTION_LABELS.indexOf(label) % PAIR_COLORS.length]

  const pairedTargets = new Set(Object.values(pairs))
  const unpairedTargetIdxs = targets
    .map((_, i) => String(i + 1))
    .filter(t => !pairedTargets.has(t))

  const handleLeftClick = (label) => {
    if (locked) return
    setSelectedLeft(prev => prev === label ? null : label)
  }

  const handleRightClick = (targetIdx) => {
    if (locked) return
    const next = { ...pairs }

    if (!selectedLeft) {
      // Deselect/unpair by clicking paired right item
      const existingLeft = Object.entries(next).find(([, v]) => v === targetIdx)?.[0]
      if (existingLeft) {
        delete next[existingLeft]
        setPairs(next)
        onChange(next)
      }
      return
    }

    // Remove any existing pair for this left
    delete next[selectedLeft]
    // Remove any existing pair for this right (another left was paired here)
    const oldLeft = Object.entries(next).find(([, v]) => v === targetIdx)?.[0]
    if (oldLeft) delete next[oldLeft]

    next[selectedLeft] = targetIdx
    setPairs(next)
    onChange(next)
    setSelectedLeft(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Instructions */}
      <p className="text-xs text-gray-500 italic">
        Nhấn 1 mục ở cột trái → nhấn 1 mục ở cột phải để nối. Nhấn lại để bỏ nối.
      </p>

      {/* Two-column grid */}
      <div className="grid grid-cols-[1fr,32px,1fr] gap-y-2 items-stretch">
        {options.map((opt, idx) => {
          const label = OPTION_LABELS[idx]
          const pairedTarget = pairs[label]
          const color = colorOf(label)
          const isSelected = selectedLeft === label

          // The B item aligned in this row
          const targetIdx = pairedTarget
          const targetText = targetIdx ? targets[parseInt(targetIdx) - 1] : null
          const targetImg = targetIdx ? targetImages[parseInt(targetIdx) - 1] : null

          return [
            // Left cell
            <motion.button
              key={`left-${label}`}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => handleLeftClick(label)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border-2 text-left w-full min-h-[52px] transition-all',
                isSelected
                  ? `${color.border} ${color.bg} ring-2 ring-offset-1`
                  : pairedTarget
                    ? `${color.border} ${color.bg}`
                    : 'border-gray-200 bg-white hover:border-indigo-300',
                locked && 'cursor-default'
              )}
            >
              <span className={cn(
                'w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg font-bold text-sm',
                pairedTarget || isSelected ? `${color.text}` : 'text-indigo-700 bg-indigo-50'
              )}>
                {label}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-700 block leading-snug">{opt}</span>
                {optionImages[idx] && (
                  <img src={optionImages[idx]} alt="" className="h-12 rounded mt-1 object-contain" />
                )}
              </div>
            </motion.button>,

            // Connector
            <div key={`line-${label}`} className="flex items-center justify-center">
              {pairedTarget ? (
                <div className={cn('w-6 h-0.5', color.dot)} />
              ) : (
                <div className="w-6 h-0.5 bg-gray-200 border-dashed" />
              )}
            </div>,

            // Right cell
            pairedTarget ? (
              <motion.button
                key={`right-${label}`}
                layout
                type="button"
                onClick={() => handleRightClick(pairedTarget)}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border-2 text-left w-full min-h-[52px] transition-all',
                  `${color.border} ${color.bg}`,
                  locked && 'cursor-default'
                )}
              >
                <span className={cn('w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-xs font-bold', color.text)}>
                  {pairedTarget}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700 block leading-snug">{targetText}</span>
                  {targetImg && <img src={targetImg} alt="" className="h-12 rounded mt-1 object-contain" />}
                </div>
              </motion.button>
            ) : (
              <div
                key={`right-empty-${label}`}
                className={cn(
                  'flex items-center justify-center min-h-[52px] rounded-xl border-2 border-dashed transition-all',
                  selectedLeft ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 bg-gray-50'
                )}
              >
                <span className="text-xs text-gray-400 italic">
                  {selectedLeft ? '← Nhấn để nối' : '—'}
                </span>
              </div>
            )
          ]
        })}
      </div>

      {/* Pool of unpaired targets */}
      {unpairedTargetIdxs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Cột B — chưa nối {selectedLeft ? `(nhấn để nối với ${selectedLeft})` : ''}:
          </p>
          <div className="flex flex-wrap gap-2">
            {unpairedTargetIdxs.map(ti => {
              const text = targets[parseInt(ti) - 1]
              const img = targetImages[parseInt(ti) - 1]
              return (
                <motion.button
                  key={ti}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleRightClick(ti)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all',
                    selectedLeft
                      ? 'border-indigo-400 bg-indigo-50 hover:bg-indigo-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                    locked && 'cursor-default'
                  )}
                >
                  <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-xs">
                    {ti}
                  </span>
                  <div>
                    <span className="text-sm text-gray-700">{text}</span>
                    {img && <img src={img} alt="" className="h-12 rounded mt-1 object-contain" />}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {selectedLeft && (
        <p className="text-xs text-indigo-600 font-semibold animate-pulse">
          Đã chọn {selectedLeft} — nhấn một mục ở Cột B để nối
        </p>
      )}
    </div>
  )
}

// ── Essay ─────────────────────────────────────────────────
function EssayRenderer({ question, answer, onChange, locked }) {
  return (
    <div className="flex flex-col gap-2">
      {question.hint && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          <span className="font-semibold">Gợi ý: </span>{question.hint}
        </div>
      )}
      <textarea
        value={answer || ''}
        onChange={e => !locked && onChange(e.target.value)}
        disabled={locked}
        rows={5}
        placeholder="Nhập câu trả lời của em..."
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800',
          'placeholder:text-gray-400 outline-none transition-all duration-200 resize-y',
          'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
          locked && 'cursor-default bg-gray-50'
        )}
      />
    </div>
  )
}

// ── Sortable Item ─────────────────────────────────────────
function SortableItem({ id, children, locked }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 p-3 rounded-xl border-2 border-gray-200 bg-white',
        isDragging && 'shadow-xl z-50 border-indigo-300 bg-indigo-50',
        locked && 'cursor-default'
      )}
    >
      {!locked && (
        <button type="button" {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
          <GripVertical size={16} />
        </button>
      )}
      <div className="flex-1">{children}</div>
    </div>
  )
}
