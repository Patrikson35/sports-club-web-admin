import { useEffect, useState } from 'react'
import { api } from '../api'
import './MyClub.css'
import './WebSettings.css'

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
  const [confirmDialog, setConfirmDialog] = useState({ open: false, index: -1, label: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
          .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))

        setSports(normalized.length > 0 ? normalized : DEFAULT_REGISTRATION_SPORTS)
        setError('')
      } catch (loadError) {
        if (!isMounted) return
        const message = String(loadError?.payload?.error || loadError?.payload?.message || loadError?.message || '').trim()
        setError(message || 'Nastavenia športov sa nepodarilo načítať.')
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
    setSportDraft(createEmptySportRow(sports.length))
    setEditingSportIndex(-1)
  }

  const openCreateSportForm = () => {
    resetSportDraft()
    setShowSportForm(true)
  }

  const openEditSportForm = (index) => {
    const source = sports[index]
    if (!source) return

    setSportDraft({
      key: String(source.key || '').trim(),
      label: String(source.label || '').trim(),
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

  const openRemoveSportConfirm = (index) => {
    const sport = sports[index]
    if (!sport) return

    setConfirmDialog({
      open: true,
      index,
      label: sport.label
    })
  }

  const closeRemoveSportConfirm = () => {
    setConfirmDialog({ open: false, index: -1, label: '' })
  }

  const confirmRemoveSport = () => {
    if (confirmDialog.index < 0) return

    removeSportRow(confirmDialog.index)
    closeRemoveSportConfirm()
  }

  const toggleSportStatus = (index, nextChecked) => {
    const target = sports[index]
    if (!target) return

    setSports((prev) => prev.map((item) => {
      if (item === target) {
        return { ...item, isActive: Boolean(nextChecked) }
      }
      return item
    }))

    if (editingSportIndex === index) {
      setSportDraft((prev) => ({ ...prev, isActive: Boolean(nextChecked) }))
    }

    setSuccess('')
    setError('')
  }

  const saveSportDraftLocally = () => {
    const label = String(sportDraft.label || '').trim()
    const key = normalizeSportKey(sportDraft.key || label)
    const isActive = sportDraft.isActive !== false

    if (!label) {
      setError('Názov športu je povinný.')
      return
    }

    if (!key) {
      setError('Kľúč športu je povinný.')
      return
    }

    setError('')
    setSuccess('')

    setSports((prev) => {
      const next = [...prev]
      const payload = { key, label, isActive }

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

  const saveSports = async () => {
    const normalized = sports
      .map((item, index) => {
        const label = String(item?.label || '').trim()
        const key = normalizeSportKey(item?.key || label)
        return {
          key,
          label,
          sortOrder: index + 1,
          isActive: item?.isActive !== false
        }
      })
      .filter((item) => item.key && item.label)

    if (normalized.length === 0) {
      setError('Pridaj aspoň jeden šport pred uložením.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.updateWebSettingsSports(normalized)
      setSports(normalized)
      setSuccess('Nastavenie webu bolo uložené.')
    } catch (saveError) {
      const message = String(saveError?.payload?.error || saveError?.payload?.message || saveError?.message || '').trim()
      setError(message || 'Nastavenie webu sa nepodarilo uložiť.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Načítanie nastavení webu...</div>
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
          Športy
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
              <span>Športy</span>
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
                Počet športov
              </h3>
              <div className="members-count">{sports.length} <span>športov</span></div>
            </div>

            <div className="card members-card members-categories-list-card">
              <h3 style={{ marginBottom: '10px' }}>Zoznam športov</h3>

              {sports.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Zatiaľ neexistujú žiadne športy</p>
              ) : (
                <div className="metrics-table-wrap web-settings-metrics-wrap" role="region" aria-label="Tabuľka športov">
                  <div className="metrics-table metrics-table-head web-settings-metrics-table" role="row">
                    <div>Názov športu</div>
                    <div className="metrics-col-center">Status</div>
                    <div className="metrics-col-right manager-table-actions-head">Akcie</div>
                  </div>

                  {sports.map((sport, index) => (
                    <div key={`web-sport-row-${sport.key}-${index}`} className="metrics-table metrics-table-row web-settings-metrics-table" role="row">
                      <div className="metrics-name-cell">
                        <span className="material-icons-round metrics-drag-handle" aria-hidden="true">drag_indicator</span>
                        <div>
                          <strong>{sport.label}</strong>
                          <div className="member-category-meta">{sport.key}</div>
                        </div>
                      </div>

                      <div className="metrics-col-center">
                        <label className="metrics-switch" title="Zapnúť alebo vypnúť šport v registrácii">
                          <input
                            type="checkbox"
                            checked={sport.isActive !== false}
                            onChange={(event) => toggleSportStatus(index, event.target.checked)}
                            disabled={loading}
                          />
                          <span className="metrics-switch-track" aria-hidden="true" />
                        </label>
                      </div>

                      <div className="metrics-col-right metrics-actions">
                        <button
                          type="button"
                          className="role-action-btn role-action-edit"
                          onClick={() => openEditSportForm(index)}
                          disabled={loading}
                          aria-label={`Upraviť šport ${sport.label}`}
                          title="Upraviť šport"
                        >
                          <span className="material-icons-round" aria-hidden="true">edit</span>
                        </button>
                        <button
                          type="button"
                          className="role-action-btn role-action-delete"
                          onClick={() => openRemoveSportConfirm(index)}
                          disabled={loading}
                          aria-label={`Odstrániť šport ${sport.label}`}
                          title="Odstrániť šport"
                        >
                          <span className="material-icons-round" aria-hidden="true">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="members-categories-actions" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`manager-add-btn web-settings-create-btn ${showSportForm ? 'category-form-toggle-cancel' : ''}`}
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
                {showSportForm ? 'Zrušiť formulár' : 'Vytvoriť šport'}
              </button>

              <button
                type="button"
                className="manager-add-btn"
                onClick={saveSports}
                disabled={saving}
              >
                {saving ? 'Ukladám...' : 'Uložiť nastavenie webu'}
              </button>
            </div>

            {showSportForm ? (
              <div className="card members-category-form-card">
                <div className="form-group">
                  <label htmlFor="web-settings-sport-name">Názov športu</label>
                  <input
                    id="web-settings-sport-name"
                    type="text"
                    value={sportDraft.label}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Napr. Futbal"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="web-settings-sport-key">Kľúč športu</label>
                  <input
                    id="web-settings-sport-key"
                    type="text"
                    value={sportDraft.key}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, key: normalizeSportKey(event.target.value) }))}
                    placeholder="football"
                  />
                </div>

                <label className="planner-stitch-checkbox-option">
                  <input
                    type="checkbox"
                    checked={sportDraft.isActive}
                    onChange={(event) => setSportDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <span>Aktívny šport</span>
                </label>

                <div className="form-actions">
                  <button
                    type="button"
                    className="manager-add-btn"
                    onClick={saveSportDraftLocally}
                    disabled={loading}
                  >
                    {editingSportIndex >= 0 ? 'Uložiť úpravy' : 'Uložiť'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {confirmDialog.open ? (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" aria-label="Potvrdenie odstránenia športu">
          <div className="confirm-modal-card">
            <h3>Odstrániť šport</h3>
            <p>Naozaj chceš odstrániť šport "{confirmDialog.label}"?</p>

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeRemoveSportConfirm}
                disabled={loading}
              >
                Zrušiť
              </button>
              <button
                type="button"
                className="manager-add-btn category-form-toggle-cancel"
                onClick={confirmRemoveSport}
                disabled={loading}
              >
                Odstrániť
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WebSettings
