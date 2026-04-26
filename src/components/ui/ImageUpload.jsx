import { useState, useRef } from 'react'
import { Image, X } from 'lucide-react'
import { uploadToCloudinary } from '@/utils/cloudinary'
import { cn } from '@/utils/cn'

export function ImageUpload({ value, onChange, label, folder = 'questions' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadToCloudinary(file, folder)
      onChange(url)
    } catch (e) {
      setError(e.message)
      console.error('Cloudinary upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="uploaded"
            className="max-h-48 rounded-xl border border-gray-200 object-contain"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed text-sm transition-colors',
            uploading
              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer'
          )}
        >
          {uploading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Image size={16} />
          )}
          {uploading ? 'Đang upload lên Cloudinary...' : 'Thêm hình ảnh'}
        </button>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  )
}
