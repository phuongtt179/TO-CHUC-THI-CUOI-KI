import { useState } from 'react'
import { uploadToCloudinary } from '@/utils/cloudinary'

export function useFileUpload() {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const upload = async (file, folder = 'files') => {
    setUploading(true)
    setError(null)
    setProgress(0)

    // Cloudinary không hỗ trợ progress natively qua fetch đơn giản
    // dùng XMLHttpRequest để có progress callback
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
      formData.append('folder', folder)

      const isImage = file.type.startsWith('image/')
      const resourceType = isImage ? 'image' : 'raw'
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText)
          setProgress(100)
          setUploading(false)
          resolve(data.secure_url)
        } else {
          const err = JSON.parse(xhr.responseText || '{}')
          const msg = err.error?.message || `Upload thất bại (${xhr.status})`
          setError(msg)
          setUploading(false)
          reject(new Error(msg))
        }
      }

      xhr.onerror = () => {
        setError('Lỗi kết nối')
        setUploading(false)
        reject(new Error('Lỗi kết nối mạng'))
      }

      xhr.send(formData)
    })
  }

  return { upload, progress, uploading, error }
}
