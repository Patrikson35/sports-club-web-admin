import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import './MyClub.css'

const DEFAULT_REGISTRATION_SPORTS = [
  { key: 'football', label: 'Futbal', sortOrder: 1, isActive: true },
  { key: 'hockey', label: 'Hokej', sortOrder: 2, isActive: true },
  { key: 'basketball', label: 'Basketbal', sortOrder: 3, isActive: true },
  { key: 'handball', label: 'Hadzana', sortOrder: 4, isActive: true },
  { key: 'volleyball', label: 'Volejbal', sortOrder: 5, isActive: true },
  { key: 'tennis', label: 'Tenis', sortOrder: 6, isActive: true }
]

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
  const [showSportForm, setShowSportForm] = useState(false)
  const [editingSportIndex, setEditingSportIndex] = useState(-1)
  const [sportDraft, setSportDraft] = useState(createEmptySportRow(0))
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

        setSports(normalized.length > 0 ? normalized : DEFAULT_REGISTRATION_SPORTS)
        setError('')
      } catch (loadError) {
        if (!isMounted) return
        const message = String(loadError?.payload?.error || loadError?.payload?.message || loadError?.message || '').trim()
        setError(message || 'Nastavenia sportov sa nepodarilo nacitat.')
        setSports(DEFAULT_REGISTRATION_SPORTS)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSports()

    return () => {
      isMounted = false
    }
  }, [])

  const resetSportDraft = () => {
    setSportDraft(createEmptySportRow(sortedSports.length))
    setEditingSportIndex(-1)
  }

  const openCreateSportForm = () => {
    resetSportDraft()
    setShowSportForm(true)
  }

  const openEditSportForm = (index) => {
    const source = sortedSports[index]
    if (!source) return

    setSportDraft({
      key: String(source.key || '').trim(),
      label: String(source.label || '').trim(),
      sortOrder: Number.isFinite(Number(source.sortOrder)) ? Number(source.sortOrder) : (index + 1),
      isActive: source.isActive !== false
    })
    setEditingSportIndex(index)
    setShowSportForm(true)
  }

  const removeSportRow = (index) => {
    setSports((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index)
      return next.map((item, itemIndex) => ({
        ...item,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (itemIndex + 1)
      }))
    })
    setSuccess('')

    if (editingSportIndex === index) {
      setShowSportForm(false)
      resetSportDraft()
    }
  }

  const saveSportDraftLocally = () => {
    const label = String(sportDraft.label || '').trim()
    const key = normalizeSportKey(sportDraft.key || label)
    const sortOrder = Number.isFinite(Number(sportDraft.sortOrder)) ? Number(sportDraft.sortOrder) : (sortedSports.length + 1)
    const isActive = sportDraft.isActive !== false

    if (!label) {
      setError('Nazov sportu je povinny.')
      return
    }

    if (!key) {
      setError('Kluc sportu je povinny.')
      return
    }

    setError('')
    setSuccess('')

    setSports((prev) => {
      const next = [...prev]
      const payload = { key, label, sortOrder, isActive }

      if (editingSportIndex >= 0 && editingSportIndex < next.length) {
        next[editingSportIndex] = payload
      } else {
        next.push(payload)
      }

      return next
    })

    setShowSportForm(false)
    resetSportDraft()
  }

  const resetToDefaultSports = () => {
    setSports(DEFAULT_REGISTRATION_SPORTS)
    setShowSportForm(false)
    resetSportDraft()
    setSuccess('')
    setError('')
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
    <div className="my-club-container">
      <div className="club-header">
        <div>
          <h1>Nastavenie webu</h1>
        </div>
      </div>

      <div className="club-tabs" role="navigation" aria-label="Sekcie nastavenia webu">
        <button type="button" className="club-tab active" aria-current="page">
          Sporty
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="form-section settings-layout members-layout" style={{ marginTop: '24px' }}>
        <aside className="card settings-sidebar-card" aria-label="Nastavenie webu - navigacia sekcii">
          <nav className="settings-submenu" aria-label="Submenu nastavenia webu">
            <a
              href="#"
              className="settings-submenu-item active"
              onClick={(event) => event.preventDefault()}
              aria-current="page"
            >
              <span className="material-icons-round" aria-hidden="true">sports</span>
              <span>Sporty</span>
            </a>
          </nav>
        </aside>

        <div className="settings-main">
          <div className="members-categories-stack">
            <div className="card members-card members-count-card">
              <div className="members-card-bg">
                <span className="material-icons-round">sports</span>
              </div>
              <h3 style={{ marginBottom: '6px' }}>
                <span className="section-icon material-icons-round">sports</span>
                Pocet sportov
              </h3>
              <div className="members-count">{sortedSports.length} <span>sportov</span></div>
            </div>

            <div className="card members-card members-categories-list-card">
              <h3 style={{ marginBottom: '10px' }}>Zoznam sportov</h3>

              {sortedSports.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Zatial neexistuju ziadne sporty</p>
              ) : (
                sortedSports.map((sport, index) => (
                  <div key={`web-sport-row-${sport.key}-${index}`} className="member-category-row">
                    <div className="member-category-main">
                      <span className="material-icons-round member-category-drag-icon" aria-hidden="true">drag_indicator</span>
                      <div>
                        <strong>{sport.label}</strong>
                        <div className="member-category-meta">{sport.key} | poradie: {sport.sortOrder} | {sport.isActive ? 'aktivny' : 'neaktivny'}</div>
                      </div>
                    </div>

                    <div className="member-category-actions">
                      <button
                        type="button"
                        className="role-action-btn role-action-edit"
                        onClick={() => openEditSportForm(index)}
                        disabled={loading}
                        aria-label={`Upravit sport ${sport.label}`}
                        title="Upravit sport"
                      >
                        <span className="material-icons-round" aria-hidden="true">edit</span>
                      </button>
                      <button
                        type="button"
                        className="role-action-btn role-action-delete"
                        onClick={() => removeSportRow(index)}
                        disabled={loading}
                        aria-label={`Odstranit sport ${sport.label}`}
                        title="Odstranit sport"
                      >
                        <span className="material-icons-round" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="members-categories-actions" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`manager-add-btn ${showSportForm ? 'category-form-toggle-cancel' : ''}`}
                onClick={() => {
                  if (showSportForm) {
                    setShowSportForm(false)
                    resetSportDraft()
                    return
                  }
                  openCreateSportForm()
                }}
                disabled={loading}
              >
                {showSportForm ? 'Zrusit formular' : 'Vytvorit sport'}
              </button>

              <button
                type="button"
                className="btn-secondary exercise-db-filter-reset-btn"
                onClick={resetToDefaultSports}
                disabled={loading}
              >
                Obnovit default
              </button>
            </div>

            {showSportForm ? (
              <div className="card members-category-form-card">
                <div className="form-group">
                  <label htmlFor="web-settings-sport-name">Nazov sportu</label>
                  <input
                    id="web-settings-sport-name"
                    type="text"
                    value={sportDraft.label}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Napr. Futbal"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="web-settings-sport-key">Kluc sportu</label>
                  <input
                    id="web-settings-sport-key"
                    type="text"
                    value={sportDraft.key}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, key: normalizeSportKey(event.target.value) }))}
                    placeholder="football"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="web-settings-sport-order">Poradie</label>
                  <input
                    id="web-settings-sport-order"
                    type="number"
                    min="1"
                    value={sportDraft.sortOrder}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 1 }))}
                  />
                </div>

                <label className="planner-stitch-checkbox-option">
                  <input
                    type="checkbox"
                    checked={sportDraft.isActive}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <span>Aktivny sport</span>
                </label>

                <div className="form-actions">
                  <button
                    type="button"
                    className="manager-add-btn"
                    onClick={saveSportDraftLocally}
                    disabled={loading}
                  >
                    {editingSportIndex >= 0 ? 'Ulozit upravy' : 'Ulozit'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="members-categories-actions">
              <button type="button" className="manager-add-btn" onClick={saveSports} disabled={saving}>
                {saving ? 'Ukladam...' : 'Ulozit nastavenie webu'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WebSettings
