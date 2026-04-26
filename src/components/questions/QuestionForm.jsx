import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Input, Textarea, Select, Button } from '@/components/ui'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { QUESTION_TYPES } from '@/utils/grading'
import { cn } from '@/utils/cn'

const DEFAULT_FORM = {
  type: 'mc',
  grade: 3,
  question: '',
  question_image: '',
  options: ['', '', '', ''],
  option_images: ['', '', '', ''],
  targets: ['', ''],
  target_images: ['', ''],
  correct_answer: 'A',
  score: 0.5,
  hint: '',
  allow_file: false,
}

export function QuestionForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial || DEFAULT_FORM)

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const setOption = (idx, value) => {
    const opts = [...(form.options || [])]
    opts[idx] = value
    set('options', opts)
  }

  const setOptionImage = (idx, value) => {
    const imgs = [...(form.option_images || Array(form.options?.length || 4).fill(''))]
    imgs[idx] = value
    set('option_images', imgs)
  }

  const setTarget = (idx, value) => {
    const tgts = [...(form.targets || [])]
    tgts[idx] = value
    set('targets', tgts)
  }

  const addOption = () => {
    set('options', [...(form.options || []), ''])
    set('option_images', [...(form.option_images || []), ''])
  }

  const removeOption = (idx) => {
    const opts = form.options.filter((_, i) => i !== idx)
    const imgs = (form.option_images || []).filter((_, i) => i !== idx)
    set('options', opts)
    set('option_images', imgs)
  }

  const setTargetImage = (idx, value) => {
    const imgs = [...(form.target_images || Array(form.targets?.length || 2).fill(''))]
    imgs[idx] = value
    set('target_images', imgs)
  }

  const addTarget = () => {
    set('targets', [...(form.targets || []), ''])
    set('target_images', [...(form.target_images || []), ''])
  }
  const removeTarget = (idx) => {
    set('targets', (form.targets || []).filter((_, i) => i !== idx))
    set('target_images', (form.target_images || []).filter((_, i) => i !== idx))
  }

  const OPTION_LABELS = 'ABCDEFGHIJ'

  return (
    <div className="flex flex-col gap-5">
      {/* Type & Grade */}
      <div className="grid grid-cols-2 gap-4">
        <Select label="Dạng câu hỏi" value={form.type} onChange={e => set('type', e.target.value)}>
          {Object.entries(QUESTION_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select label="Khối" value={form.grade} onChange={e => set('grade', Number(e.target.value))}>
          <option value={3}>Khối 3</option>
          <option value={4}>Khối 4</option>
          <option value={5}>Khối 5</option>
        </Select>
      </div>

      {/* Question text */}
      <div className="flex flex-col gap-2">
        <Textarea
          label="Nội dung câu hỏi"
          value={form.question}
          onChange={e => set('question', e.target.value)}
          placeholder={form.type === 'fill_blank' ? 'Thủ đô của Việt Nam là ___ . (dùng ___ cho chỗ trống)' : 'Nhập nội dung câu hỏi...'}
          rows={3}
        />
        <ImageUpload
          label="Hình ảnh câu hỏi (tùy chọn)"
          value={form.question_image}
          onChange={v => set('question_image', v)}
          folder="questions"
        />
      </div>

      {/* Options for relevant types */}
      {['mc', 'sort_order', 'drag_fill', 'word_sort', 'true_false'].includes(form.type) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">
              {form.type === 'true_false' ? 'Các lựa chọn' : form.type === 'word_sort' ? 'Các từ / cụm từ' : 'Các đáp án'}
            </label>
            {form.type !== 'true_false' && (
              <button type="button" onClick={addOption} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus size={14} /> Thêm
              </button>
            )}
          </div>
          {(form.options || []).map((opt, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="w-7 h-10 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm flex-shrink-0">
                {OPTION_LABELS[idx]}
              </span>
              <div className="flex-1 flex flex-col gap-1">
                <Input
                  value={opt}
                  onChange={e => setOption(idx, e.target.value)}
                  placeholder={`Đáp án ${OPTION_LABELS[idx]}`}
                />
                <ImageUpload
                  value={(form.option_images || [])[idx] || ''}
                  onChange={v => setOptionImage(idx, v)}
                  folder="questions/options"
                />
              </div>
              {form.type !== 'true_false' && (form.options || []).length > 2 && (
                <button type="button" onClick={() => removeOption(idx)} className="mt-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Targets for matching */}
      {form.type === 'matching' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Cột trái (A, B, C...)</label>
              <button type="button" onClick={addOption} className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                <Plus size={14} /> Thêm
              </button>
            </div>
            {(form.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-7 text-center font-bold text-indigo-700 text-sm">{OPTION_LABELS[idx]}</span>
                <Input value={opt} onChange={e => setOption(idx, e.target.value)} placeholder={`Khái niệm ${OPTION_LABELS[idx]}`} />
                {(form.options || []).length > 2 && (
                  <button type="button" onClick={() => removeOption(idx)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Cột phải (1, 2, 3...)</label>
              <button type="button" onClick={addTarget} className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                <Plus size={14} /> Thêm
              </button>
            </div>
            {(form.targets || []).map((tgt, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="w-7 h-10 flex items-center justify-center font-bold text-purple-700 text-sm flex-shrink-0">{idx + 1}</span>
                <div className="flex-1 flex flex-col gap-1">
                  <Input value={tgt} onChange={e => setTarget(idx, e.target.value)} placeholder={`Định nghĩa ${idx + 1}`} />
                  <ImageUpload
                    value={(form.target_images || [])[idx] || ''}
                    onChange={v => setTargetImage(idx, v)}
                    folder="questions/targets"
                  />
                </div>
                {(form.targets || []).length > 2 && (
                  <button type="button" onClick={() => removeTarget(idx)} className="mt-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correct answer */}
      <CorrectAnswerField form={form} set={set} OPTION_LABELS={OPTION_LABELS} />

      {/* Essay options */}
      {form.type === 'essay' && (
        <>
          <Input
            label="Gợi ý đáp án mẫu (hiển thị sau khi nộp bài)"
            value={form.hint}
            onChange={e => set('hint', e.target.value)}
            placeholder="Nhập gợi ý..."
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allow_file}
              onChange={e => set('allow_file', e.target.checked)}
              className="rounded w-4 h-4 text-indigo-600"
            />
            <span>Cho phép học sinh nộp file</span>
          </label>
        </>
      )}

      {/* Score */}
      <Input
        label="Điểm"
        type="number"
        min="0"
        step="0.25"
        value={form.score}
        onChange={e => set('score', parseFloat(e.target.value) || 0)}
        suffix="điểm"
        className="max-w-[160px]"
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>Hủy</Button>
        <Button loading={loading} onClick={() => onSave(form)}>Lưu câu hỏi</Button>
      </div>
    </div>
  )
}

function CorrectAnswerField({ form, set, OPTION_LABELS }) {
  const { type, options = [], targets = [] } = form

  if (type === 'mc' || type === 'drag_fill') {
    return (
      <Select
        label="Đáp án đúng"
        value={form.correct_answer}
        onChange={e => set('correct_answer', e.target.value)}
      >
        {options.map((_, idx) => (
          <option key={idx} value={OPTION_LABELS[idx]}>{OPTION_LABELS[idx]}</option>
        ))}
      </Select>
    )
  }

  if (type === 'true_false') {
    return (
      <Select label="Đáp án đúng" value={form.correct_answer} onChange={e => set('correct_answer', e.target.value)}>
        <option value="Đúng">Đúng</option>
        <option value="Sai">Sai</option>
      </Select>
    )
  }

  if (type === 'fill_blank') {
    return (
      <Input
        label="Đáp án (nhiều chỗ trống dùng dấu phẩy: Hà Nội,Hồ Chí Minh)"
        value={form.correct_answer}
        onChange={e => set('correct_answer', e.target.value)}
        placeholder="Đáp án..."
      />
    )
  }

  if (type === 'sort_order') {
    return (
      <Input
        label="Thứ tự đúng (ví dụ: A,B,C,D)"
        value={Array.isArray(form.correct_answer) ? form.correct_answer.join(',') : form.correct_answer}
        onChange={e => set('correct_answer', e.target.value.split(',').map(s => s.trim()))}
        placeholder="A,B,C,D"
      />
    )
  }

  if (type === 'word_sort') {
    return (
      <Input
        label="Câu hoàn chỉnh đúng"
        value={Array.isArray(form.correct_answer) ? form.correct_answer.join(' ') : form.correct_answer}
        onChange={e => set('correct_answer', e.target.value.split(' ').filter(Boolean))}
        placeholder="She is a beautiful teacher"
      />
    )
  }

  if (type === 'matching') {
    const pairs = []
    for (let i = 0; i < options.length; i++) {
      pairs.push({ left: OPTION_LABELS[i], right: '' })
    }
    const ca = typeof form.correct_answer === 'object' && !Array.isArray(form.correct_answer)
      ? form.correct_answer : {}

    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700">Đáp án nối (A nối với số mấy?)</label>
        {options.map((_, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="font-bold text-indigo-700 w-6">{OPTION_LABELS[idx]}</span>
            <span className="text-gray-400">→</span>
            <Select
              value={ca[OPTION_LABELS[idx]] || ''}
              onChange={e => {
                set('correct_answer', { ...ca, [OPTION_LABELS[idx]]: e.target.value })
              }}
              className="w-24"
            >
              <option value="">Chọn...</option>
              {targets.map((_, ti) => (
                <option key={ti} value={String(ti + 1)}>{ti + 1}</option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'essay') return null

  return null
}
