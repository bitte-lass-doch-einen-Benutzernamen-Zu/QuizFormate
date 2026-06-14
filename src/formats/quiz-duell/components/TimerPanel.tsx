import { useEffect, useRef, useState } from 'react'

const DEFAULT_SECONDS = 60

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function TimerPanel() {
  const [duration, setDuration] = useState(DEFAULT_SECONDS)
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS)
  const [running, setRunning] = useState(false)
  const [expired, setExpired] = useState(false)
  const endTimeRef = useRef(0)

  useEffect(() => {
    if (!running) return

    const updateTimer = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      )
      setRemaining(nextRemaining)
      if (nextRemaining === 0) {
        setRunning(false)
        setExpired(true)
      }
    }

    updateTimer()
    const interval = window.setInterval(updateTimer, 250)
    return () => window.clearInterval(interval)
  }, [running])

  const updateDuration = (minutes: number, seconds: number) => {
    const nextDuration = Math.max(1, minutes * 60 + seconds)
    setDuration(nextDuration)
    setRemaining(nextDuration)
    setRunning(false)
    setExpired(false)
  }

  const toggleTimer = () => {
    if (running) {
      setRunning(false)
      return
    }

    const startValue = remaining === 0 ? duration : remaining
    setRemaining(startValue)
    setExpired(false)
    endTimeRef.current = Date.now() + startValue * 1000
    setRunning(true)
  }

  const resetTimer = () => {
    setRunning(false)
    setRemaining(duration)
    setExpired(false)
  }

  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60

  return (
    <section
      className={`timer-panel${running ? ' running' : ''}${
        running && remaining <= 10 ? ' warning' : ''
      }${expired ? ' expired' : ''}`}
      aria-label="Quiz Timer"
    >
      <div className="timer-display" aria-live="polite">
        <span>Timer</span>
        <strong>{formatTime(remaining)}</strong>
      </div>

      <div className="timer-settings">
        <label>
          <span>Min</span>
          <input
            aria-label="Timer Minuten"
            disabled={running}
            max="99"
            min="0"
            onChange={(event) =>
              updateDuration(Number(event.target.value), seconds)
            }
            type="number"
            value={minutes}
          />
        </label>
        <label>
          <span>Sek</span>
          <input
            aria-label="Timer Sekunden"
            disabled={running}
            max="59"
            min="0"
            onChange={(event) =>
              updateDuration(minutes, Math.min(59, Number(event.target.value)))
            }
            type="number"
            value={seconds}
          />
        </label>
      </div>

      <div className="timer-actions">
        <button className="timer-toggle" onClick={toggleTimer} type="button">
          {running ? 'Pause' : remaining === 0 ? 'Nochmal' : 'Start'}
        </button>
        <button onClick={resetTimer} type="button">Reset</button>
      </div>
    </section>
  )
}
