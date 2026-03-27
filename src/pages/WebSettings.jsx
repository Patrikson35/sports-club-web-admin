import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const createEmptySportRow = (index = 0) => ({
  key: '',
  label: '',
  sortOrder: index + 1,
  isActive: true
})

const normalizeSportKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s_-]/g, '')
  .replace(/[\s-]+/g, '_')
  .replace(/^_+|_+$/g, '')

function WebSettings() {
  const [sports, setSports] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const sortedSports = useMemo(() => {
    return [...sports].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
  }, [sports])

  useEffect(() => {
    let isMounted = true

    const loadSports = async () => {
      try {
        setLoading(true)
        const response = await api.getWebSettingsSports()
        if (!isMounted) return

        const source = Array.isArray(response?.sports) ? response.sports : []
        const normalized = source
          .map((item, index) => ({
            key: String(item?.key || '').trim(),
            label: String(item?.label || '').trim(),
            sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : (index + 1),
            isActive: item?.isActive !== false
          }))
          .filter((item) => item.key || item.label)

        setSports(normalized)
        setError('')
      } catch (loadError) {
        if (!isMounted) return
        const message = String(loadError?.payload?.error || loadError?.payload?.message || loadError?.message || '').trim()
        setError(message || 'Nastavenia sportov sa nepodarilo nacitat.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSports()

    return () => {
      isMounted = false
    }
  }, [])

  const updateSportRow = (index, patch) => {
    setSports((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )))
    setSuccess('')
  }

  const removeSportRow = (index) => {
    setSports((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
    setSuccess('')
  }

  const addSportRow = () => {
    setSports((prev) => ([...prev, createEmptySportRow(prev.length)]))
    setSuccess('')
  }

  const saveSports = async () => {
    const normalized = sortedSports
      .map((item, index) => {
        const label = String(item?.label || '').trim()
        const key = normalizeSportKey(item?.key || label)
        return {
          key,
          label,
          sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : (index + 1),
          isActive: item?.isActive !== false
        }
      })
      .filter((item) => item.key && item.label)

    if (normalized.length === 0) {
      setError('Pridaj aspon jeden sport pred ulozenim.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.updateWebSettingsSports(normalized)
      setSports(normalized)
      setSuccess('Nastavenie webu bolo ulozene.')
    } catch (saveError) {
      const message = String(saveError?.payload?.error || saveError?.payload?.message || saveError?.message || '').trim()
      setError(message || 'Nastavenie webu sa nepodarilo ulozit.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Nacitanie nastaveni webu...</div>
  }

  return (
    <div className="members-categories-stack">
      <div className="exercise-library-head">
        <h2>Nastavenie webu</h2>
        <button type="button" className="manager-add-btn" onClick={addSportRow}>
          Pridat sport
        </button>
      </div>

      <div className="card settings-placeholder-card metrics-section-card">
        <div className="exercise-db-head-row" style={{ marginBottom: '0.8rem' }}>
          <div className="manager-role-heading">
            <span className="material-icons-round section-icon" aria-hidden="true">sports</span>
            <h3 className="manager-section-title">Sporty pre registracny formular</h3>
          </div>
        </div>

        {error ? (
          <p className="manager-empty-text" style={{ color: '#ef4444' }}>{error}</p>
        ) : null}

        {success ? (
          <p className="manager-empty-text" style={{ color: '#22c55e' }}>{success}</p>
        ) : null}

        {sortedSports.length === 0 ? (
          <p className="manager-empty-text">Zatial nie je pridany ziadny sport.</p>
        ) : (
          <div className="exercise-db-filters" style={{ marginBottom: '0.8rem' }}>
            {sortedSports.map((sport, index) => (
              <div key={`web-sport-${index}`} className="card settings-placeholder-card" style={{ padding: '0.9rem' }}>
                <div className="exercise-db-filters" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`sport-label-${index}`}>Nazov sportu</label>
                    <input
                      id={`sport-label-${index}`}
                      type="text"
                      value={sport.label}
                      onChange={(event) => updateSportRow(index, { label: event.target.value })}
                      placeholder="Napr. Futbal"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`sport-key-${index}`}>Kluc sportu</label>
                    <input
                      id={`sport-key-${index}`}
                      type="text"
                      value={sport.key}
                      onChange={(event) => updateSportRow(index, { key: normalizeSportKey(event.target.value) })}
                      placeholder="football"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`sport-order-${index}`}>Poradie</label>
                    <input
                      id={`sport-order-${index}`}
                      type="number"
                      min="1"
                      value={sport.sortOrder}
                      onChange={(event) => updateSportRow(index, { sortOrder: Number(event.target.value) || (index + 1) })}
                    />
                  </div>

                  <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0, alignSelf: 'end' }}>
                    <input
                      type="checkbox"
                      checked={sport.isActive}
                      onChange={(event) => updateSportRow(index, { isActive: event.target.checked })}
                    />
                    <span>Aktivny</span>
                  </label>

                  <button
                    type="button"
                    className="btn-secondary exercise-db-filter-reset-btn"
                    onClick={() => removeSportRow(index)}
                    style={{ alignSelf: 'end' }}
                  >
                    Odstranit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn-secondary exercise-db-filter-reset-btn" onClick={saveSports} disabled={saving}>
          {saving ? 'Ukladam...' : 'Ulozit nastavenie webu'}
        </button>
      </div>
    </div>
  )
}

export default WebSettings
