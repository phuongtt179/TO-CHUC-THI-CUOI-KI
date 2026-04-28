import { useState, useEffect, useRef } from 'react'

export function useCountdownTimer(startTime, durationMinutes, onExpire) {
  const [remaining, setRemaining] = useState(null)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (!startTime) return

    const startMs = startTime.toMillis ? startTime.toMillis() : new Date(startTime).getTime()
    // If durationMinutes is null, startTime is treated as endTime directly
    const endMs = durationMinutes ? startMs + durationMinutes * 60 * 1000 : startMs

    const tick = () => {
      const now = Date.now()
      const rem = Math.max(0, endMs - now)
      setRemaining(rem)

      if (rem <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire?.()
      }
    }

    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [startTime, durationMinutes, onExpire])

  return remaining
}

export function formatTime(ms) {
  if (ms === null || ms === undefined) return '--:--'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function getTimerColor(ms, totalMs) {
  if (ms === null) return 'text-gray-500'
  const ratio = ms / totalMs
  if (ratio > 0.5) return 'text-emerald-600'
  if (ratio > 0.25) return 'text-orange-500'
  return 'text-red-600'
}
