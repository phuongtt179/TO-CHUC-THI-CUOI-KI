import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer, noPadding }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              'relative w-full bg-white rounded-2xl shadow-2xl z-10 flex flex-col max-h-[90vh]',
              sizeClasses[size]
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className={cn('overflow-y-auto flex-1', !noPadding && 'p-6')}>
              {children}
            </div>
            {footer && (
              <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Xác nhận', danger }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          Hủy
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={cn(
            'px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors',
            danger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
          )}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
