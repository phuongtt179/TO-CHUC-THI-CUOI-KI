const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']

/**
 * Upload bất kỳ file nào lên Cloudinary.
 * - Ảnh → resource_type: 'image'
 * - File khác (docx, pptx, sb3, pdf...) → resource_type: 'raw'
 */
export async function uploadToCloudinary(file, folder = 'files') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Chưa cấu hình Cloudinary. Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET vào file .env'
    )
  }

  const isImage = IMAGE_TYPES.includes(file.type)
  const resourceType = isImage ? 'image' : 'raw'

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Upload thất bại (${res.status})`)
  }

  const data = await res.json()
  return data.secure_url
}

/**
 * Upload ảnh (shorthand dùng trong ImageUpload component)
 */
export async function uploadImage(file, folder = 'questions') {
  return uploadToCloudinary(file, folder)
}

/**
 * Upload file thực hành học sinh (Word, PPT, Scratch)
 */
export async function uploadPracticeFile(file, examId, studentId, partId) {
  const folder = `submissions/${examId}/${studentId}`
  return uploadToCloudinary(file, folder)
}
