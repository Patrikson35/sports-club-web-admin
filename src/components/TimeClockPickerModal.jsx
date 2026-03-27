import { useEffect, useMemo, useState } from 'react'
import './TimeClockPickerModal.css'

const CLOCK_OUTER_HOUR_VALUES = [0, ...Array.from({ length: 11 }, (_, index) => index + 13)]
const CLOCK_INNER_HOUR_VALUES = [12, ...Array.from({ length: 11 }, (_, index) => index + 1)]
const CLOCK_MINUTE_MARKS = Array.from({ length: 12 }, (_, index) => index * 5)

const getClockDialItemStyle = (index, totalItems, radiusPercent = 41) => {
  const angleDeg = (index / totalItems) * 360 - 90
  const angleRad = (angleDeg * Math.PI) / 180
  const x = 50 + (Math.cos(angleRad) * radiusPercent)
  const y = 50 + (Math.sin(angleRad) * radiusPercent)

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)'
  }
}

const parseTimeValue = (value) => {
  const source = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!source) return { hour: 0, minute: 0 }

  return {
    hour: Math.max(0, Math.min(23, Number(source[1]) || 0)),
    minute: Math.max(0, Math.min(59, Number(source[2]) || 0))
  }
}

function TimeClockPickerModal({ isOpen, value, onClose, onApply, ariaLabel = 'Výber času' }) {
  const parsedValue = useMemo(() => parseTimeValue(value), [value])
  const [step, setStep] = useState('hour')
  const [draftHour, setDraftHour] = useState(parsedValue.hour)
  const [draftMinute, setDraftMinute] = useState(parsedValue.minute)

  useEffect(() => {
    if (!isOpen) return
    setStep('hour')
    setDraftHour(parsedValue.hour)
    setDraftMinute(parsedValue.minute)
  }, [isOpen, parsedValue.hour, parsedValue.minute])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelectHour = (hourValue) => {
    const safeHour = Math.max(0, Math.min(23, Number(hourValue) || 0))
    setDraftHour(safeHour)
    setStep('minute')
  }

  const handleSelectMinute = (minuteValue) => {
    const safeMinute = Math.max(0, Math.min(59, Number(minuteValue) || 0))
    setDraftMinute(safeMinute)
  }

  const adjustMinute = (delta) => {
    const safeDelta = Number(delta) || 0
    setDraftMinute((prev) => ((prev + safeDelta) % 60 + 60) % 60)
  }

  const handleApply = () => {
    const nextValue = `${String(draftHour).padStart(2, '0')}:${String(draftMinute).padStart(2, '0')}`
    const applyResult = onApply?.(nextValue)
    if (applyResult === false) return
    onClose?.()
  }

  return (
    <div className="time-clock-overlay" role="presentation" onClick={() => onClose?.()}>
      <div
        className="time-clock-modal"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="time-clock-head">
          <strong>{String(draftHour).padStart(2, '0')}:{String(draftMinute).padStart(2, '0')}</strong>
          <div className="time-clock-step-tabs" role="tablist" aria-label="Krok výberu času">
            <button
              type="button"
              role="tab"
              aria-selected={step === 'hour'}
              className={`time-clock-step-btn ${step === 'hour' ? 'active' : ''}`}
              onClick={() => setStep('hour')}
            >
              Hodiny
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={step === 'minute'}
              className={`time-clock-step-btn ${step === 'minute' ? 'active' : ''}`}
              onClick={() => setStep('minute')}
            >
              Minúty
            </button>
          </div>
        </div>

        <div className="time-clock-dial" aria-label={step === 'hour' ? 'Ciferník hodín' : 'Ciferník minút'}>
          {step === 'hour' ? (
            <>
              {CLOCK_OUTER_HOUR_VALUES.map((hourValue, index) => (
                <button
                  key={`clock-hour-outer-${hourValue}`}
                  type="button"
                  className={`time-clock-item time-clock-item--outer ${draftHour === hourValue ? 'active' : ''}`}
                  style={getClockDialItemStyle(index, CLOCK_OUTER_HOUR_VALUES.length, 44)}
                  onClick={() => handleSelectHour(hourValue)}
                >
                  {String(hourValue).padStart(2, '0')}
                </button>
              ))}

              {CLOCK_INNER_HOUR_VALUES.map((hourValue, index) => {
                const normalizedHour = hourValue === 12 ? 12 : hourValue
                const isActive = draftHour >= 1 && draftHour <= 12 && draftHour === normalizedHour

                return (
                  <button
                    key={`clock-hour-inner-${hourValue}`}
                    type="button"
                    className={`time-clock-item time-clock-item--inner ${isActive ? 'active' : ''}`}
                    style={getClockDialItemStyle(index, CLOCK_INNER_HOUR_VALUES.length, 28)}
                    onClick={() => handleSelectHour(normalizedHour)}
                  >
                    {String(hourValue)}
                  </button>
                )
              })}
            </>
          ) : (
            CLOCK_MINUTE_MARKS.map((minuteValue, index, source) => (
              <button
                key={`clock-minute-${minuteValue}`}
                type="button"
                className={`time-clock-item ${draftMinute === minuteValue ? 'active' : ''}`}
                style={getClockDialItemStyle(index, source.length, 41)}
                onClick={() => handleSelectMinute(minuteValue)}
              >
                {String(minuteValue).padStart(2, '0')}
              </button>
            ))
          )}

          {step === 'minute' ? (
            <div className="time-clock-minute-adjust">
              <button type="button" onClick={() => adjustMinute(-1)} aria-label="Ubrať minútu">-1</button>
              <span>{String(draftMinute).padStart(2, '0')}</span>
              <button type="button" onClick={() => adjustMinute(1)} aria-label="Pridať minútu">+1</button>
            </div>
          ) : null}
        </div>

        <div className="time-clock-actions">
          <button type="button" className="time-clock-action-btn" onClick={() => onClose?.()}>Zrušiť</button>
          <button type="button" className="time-clock-action-btn primary" onClick={handleApply}>Použiť</button>
        </div>
      </div>
    </div>
  )
}

export default TimeClockPickerModal
