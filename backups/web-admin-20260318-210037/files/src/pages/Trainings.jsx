import { useMemo, useState, useEffect } from 'react'
import { api } from '../api'
import './Trainings.css'

const makeDraftItem = () => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  exerciseName: '',
  duration: 10
})

const defaultDateValue = () => new Date().toISOString().slice(0, 10)

const defaultExerciseOptions = [
  'Bežecká abeceda - dynamická',
  'Rozcvička s loptou v kruhu',
  'Koordinačný rebrík',
  'Hra 4 na 4 na malé bránky',
  'Nácvik hernej kombinácie v strede',
  'Zakončenie po krídelnej akcii',
  'Statický strečing - regenerácia'
]

const sectionDefinitions = [
  {
    key: 'warmup',
    title: 'Prípravná časť (Warm-up)',
    icon: 'local_fire_department',
    tone: 'warmup'
  },
  {
    key: 'main',
    title: 'Hlavná časť (Main part)',
    icon: 'sports_soccer',
    tone: 'main'
  },
  {
    key: 'conclusion',
    title: 'Záver (Conclusion)',
    icon: 'self_improvement',
    tone: 'conclusion'
  }
]

function Trainings() {
  const [trainings, setTrainings] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSavingPlanner, setIsSavingPlanner] = useState(false)
  const [plannerError, setPlannerError] = useState('')
  const [isPlannerOpen, setIsPlannerOpen] = useState(false)
  const [exerciseOptions, setExerciseOptions] = useState(defaultExerciseOptions)
  const [plannerDraft, setPlannerDraft] = useState({
    teamId: '',
    date: defaultDateValue(),
    startTime: '17:00',
    location: '',
    sections: {
      warmup: [makeDraftItem()],
      main: [makeDraftItem()],
      conclusion: [makeDraftItem()]
    }
  })

  useEffect(() => {
    loadTrainings()
    loadTeams()
  }, [])

  useEffect(() => {
    const preferredStorageKeys = ['exerciseDatabaseItems:global', 'exerciseDatabaseItems']
    for (const key of preferredStorageKeys) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) continue

        const names = parsed
          .map((item) => String(item?.name || '').trim())
          .filter(Boolean)

        if (names.length > 0) {
          setExerciseOptions(Array.from(new Set(names)))
          return
        }
      } catch {
        // Ignore parse errors and continue with fallback options.
      }
    }
  }, [])

  const loadTrainings = async () => {
    try {
      const data = await api.getTrainings()
      setTrainings(Array.isArray(data?.trainings) ? data.trainings : [])
    } catch (error) {
      console.error('Chyba načítání tréninků:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeams = async () => {
    try {
      const data = await api.getTeams()
      const normalizedTeams = (Array.isArray(data?.teams) ? data.teams : [])
        .map((team) => ({
          id: String(team?.id || '').trim(),
          name: String(team?.name || team?.title || '').trim()
        }))
        .filter((team) => team.id && team.name)

      setTeams(normalizedTeams)
      setPlannerDraft((prev) => ({
        ...prev,
        teamId: String(prev?.teamId || '').trim() || String(normalizedTeams[0]?.id || '')
      }))
    } catch (error) {
      console.error('Chyba načítania tímov:', error)
      setTeams([])
    }
  }

  const sectionMinutes = useMemo(() => {
    const entries = sectionDefinitions.map((section) => {
      const sectionItems = Array.isArray(plannerDraft.sections?.[section.key])
        ? plannerDraft.sections[section.key]
        : []
      const minutes = sectionItems.reduce((sum, item) => {
        const duration = Number.parseInt(String(item?.duration || 0), 10)
        return sum + (Number.isFinite(duration) && duration > 0 ? duration : 0)
      }, 0)
      return { key: section.key, minutes }
    })

    return Object.fromEntries(entries.map((entry) => [entry.key, entry.minutes]))
  }, [plannerDraft.sections])

  const totalMinutes = useMemo(
    () => Object.values(sectionMinutes).reduce((sum, minutes) => sum + minutes, 0),
    [sectionMinutes]
  )

  const totalExercises = useMemo(() => {
    return Object.values(plannerDraft.sections || {}).reduce((sum, sectionItems) => {
      const count = Array.isArray(sectionItems)
        ? sectionItems.filter((item) => String(item?.exerciseName || '').trim()).length
        : 0
      return sum + count
    }, 0)
  }, [plannerDraft.sections])

  const intensityLevel = useMemo(() => {
    if (totalMinutes >= 90) return 5
    if (totalMinutes >= 75) return 4
    if (totalMinutes >= 60) return 3
    if (totalMinutes >= 40) return 2
    if (totalMinutes > 0) return 1
    return 0
  }, [totalMinutes])

  const updateDraftField = (field, value) => {
    setPlannerDraft((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const updateSectionItem = (sectionKey, itemId, field, value) => {
    setPlannerDraft((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: (Array.isArray(prev.sections?.[sectionKey]) ? prev.sections[sectionKey] : []).map((item) => {
          if (item.id !== itemId) return item
          return {
            ...item,
            [field]: value
          }
        })
      }
    }))
  }

  const addSectionItem = (sectionKey) => {
    setPlannerDraft((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: [...(Array.isArray(prev.sections?.[sectionKey]) ? prev.sections[sectionKey] : []), makeDraftItem()]
      }
    }))
  }

  const removeSectionItem = (sectionKey, itemId) => {
    setPlannerDraft((prev) => {
      const source = Array.isArray(prev.sections?.[sectionKey]) ? prev.sections[sectionKey] : []
      const filtered = source.filter((item) => item.id !== itemId)

      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: filtered.length > 0 ? filtered : [makeDraftItem()]
        }
      }
    })
  }

  const resetPlanner = () => {
    setPlannerDraft({
      teamId: String(teams[0]?.id || ''),
      date: defaultDateValue(),
      startTime: '17:00',
      location: '',
      sections: {
        warmup: [makeDraftItem()],
        main: [makeDraftItem()],
        conclusion: [makeDraftItem()]
      }
    })
  }

  const closePlanner = () => {
    setIsPlannerOpen(false)
    setPlannerError('')
    resetPlanner()
  }

  const savePlannerTraining = async () => {
    if (isSavingPlanner) return

    const teamId = String(plannerDraft.teamId || '').trim()
    if (!teamId) {
      setPlannerError('Vyberte tím, pre ktorý chcete tréning uložiť.')
      return
    }

    const location = String(plannerDraft.location || '').trim()
    const formattedDate = String(plannerDraft.date || '').trim()
    const startTime = String(plannerDraft.startTime || '17:00').trim() || '17:00'
    const selectedExerciseNames = Object.values(plannerDraft.sections || {})
      .flatMap((items) => (Array.isArray(items) ? items : []))
      .map((item) => String(item?.exerciseName || '').trim())
      .filter(Boolean)

    const [hour, minute] = startTime.split(':').map((value) => Number.parseInt(value, 10))
    const startDateTime = new Date(`${formattedDate || defaultDateValue()}T00:00:00`)
    startDateTime.setHours(Number.isFinite(hour) ? hour : 17, Number.isFinite(minute) ? minute : 0, 0, 0)

    const resolvedDuration = totalMinutes > 0 ? totalMinutes : 60
    const endDateTime = new Date(startDateTime.getTime() + resolvedDuration * 60 * 1000)

    const descriptionSections = sectionDefinitions
      .map((section) => {
        const sectionItems = Array.isArray(plannerDraft.sections?.[section.key]) ? plannerDraft.sections[section.key] : []
        const labels = sectionItems
          .map((item) => String(item?.exerciseName || '').trim())
          .filter(Boolean)
        if (labels.length === 0) return null
        return `${section.title}: ${labels.join(', ')}`
      })
      .filter(Boolean)

    const payload = {
      title: selectedExerciseNames[0]
        ? `${selectedExerciseNames[0]} (${startDateTime.toLocaleDateString('sk-SK')})`
        : `Tréning ${startDateTime.toLocaleDateString('sk-SK')}`,
      session_type: 'training',
      start_at: startDateTime.toISOString(),
      end_at: endDateTime.toISOString(),
      location: location || 'Nezadané miesto',
      description: descriptionSections.join(' | ') || undefined,
      exercises: selectedExerciseNames,
      total_minutes: resolvedDuration
    }

    setIsSavingPlanner(true)
    setPlannerError('')

    try {
      await api.createTeamTrainingSession(teamId, payload)
      await loadTrainings()
      closePlanner()
    } catch (error) {
      console.error('Chyba pri ukladaní tréningu:', error)

      const fallbackPayload = {
        name: payload.title,
        date: payload.start_at,
        location: payload.location,
        exerciseCount: selectedExerciseNames.length,
        status: 'planned'
      }

      try {
        await api.createTraining(fallbackPayload)
        await loadTrainings()
        closePlanner()
      } catch (fallbackError) {
        console.error('Chyba pri fallback ukladaní tréningu:', fallbackError)
        setPlannerError('Tréning sa nepodarilo uložiť. Skontrolujte, či máte vybraný správny tím a oprávnenie tréning vytvárať.')
      }
    } finally {
      setIsSavingPlanner(false)
    }
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div className="trainings-page">
      <div className="page-header">
        <h2>Tréninky</h2>
        <p>Plánování a správa tréninků</p>
      </div>

      {isPlannerOpen ? (
        <div className="trainings-planner-shell">
          <div className="trainings-planner-head">
            <div>
              <h3>Poskladať tréningovú jednotku</h3>
              <p>Vytvorte štruktúrovaný plán tréningu pre váš tím.</p>
            </div>
            <div className="trainings-planner-head-actions">
              <button type="button" className="btn btn-secondary" onClick={closePlanner}>Zrušiť</button>
              <button type="button" className="btn trainings-primary-btn" onClick={savePlannerTraining} disabled={isSavingPlanner}>
                {isSavingPlanner ? 'Ukladám...' : 'Uložiť tréning'}
              </button>
            </div>
          </div>

          {plannerError ? (
            <div className="trainings-planner-error" role="alert">{plannerError}</div>
          ) : null}

          <section className="trainings-planner-card">
            <div className="trainings-planner-grid-4">
              <div className="trainings-planner-field">
                <label>Tím</label>
                <div className="trainings-planner-input-wrap trainings-planner-select-wrap">
                  <span className="material-icons-round" aria-hidden="true">groups</span>
                  <select
                    value={plannerDraft.teamId}
                    onChange={(event) => updateDraftField('teamId', event.target.value)}
                  >
                    <option value="">Vyberte tím</option>
                    {teams.map((team) => (
                      <option key={`planner-team-${team.id}`} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="trainings-planner-field">
                <label>Dátum TJ</label>
                <div className="trainings-planner-input-wrap">
                  <span className="material-icons-round" aria-hidden="true">calendar_today</span>
                  <input
                    type="date"
                    value={plannerDraft.date}
                    onChange={(event) => updateDraftField('date', event.target.value)}
                  />
                </div>
              </div>

              <div className="trainings-planner-field">
                <label>Čas začiatku</label>
                <div className="trainings-planner-input-wrap">
                  <span className="material-icons-round" aria-hidden="true">schedule</span>
                  <input
                    type="time"
                    value={plannerDraft.startTime}
                    onChange={(event) => updateDraftField('startTime', event.target.value)}
                  />
                </div>
              </div>

              <div className="trainings-planner-field">
                <label>Miesto</label>
                <div className="trainings-planner-input-wrap">
                  <span className="material-icons-round" aria-hidden="true">location_on</span>
                  <input
                    type="text"
                    placeholder="Hlavné ihrisko"
                    value={plannerDraft.location}
                    onChange={(event) => updateDraftField('location', event.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {sectionDefinitions.map((section) => {
            const sectionItems = Array.isArray(plannerDraft.sections?.[section.key]) ? plannerDraft.sections[section.key] : []
            return (
              <section key={section.key} className="trainings-planner-section">
                <div className="trainings-planner-section-head">
                  <div className={`trainings-planner-section-icon ${section.tone}`}>
                    <span className="material-icons-round" aria-hidden="true">{section.icon}</span>
                  </div>
                  <h4>{section.title}</h4>
                  <span className="trainings-planner-minutes">{sectionMinutes[section.key] || 0} minút</span>
                </div>

                <div className="trainings-planner-items">
                  {sectionItems.map((item) => (
                    <div key={item.id} className="trainings-planner-item-row">
                      <span className="material-icons-round trainings-planner-drag" aria-hidden="true">drag_indicator</span>
                      <div className="trainings-planner-item-main">
                        <select
                          value={item.exerciseName}
                          onChange={(event) => updateSectionItem(section.key, item.id, 'exerciseName', event.target.value)}
                        >
                          <option value="">Vyberte cvičenie</option>
                          {exerciseOptions.map((option) => (
                            <option key={`${section.key}-${item.id}-${option}`} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>

                      <div className="trainings-planner-item-duration">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={item.duration}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10)
                            updateSectionItem(section.key, item.id, 'duration', Number.isFinite(parsed) ? parsed : 0)
                          }}
                        />
                        <span>min.</span>
                      </div>

                      <button
                        type="button"
                        className="trainings-planner-item-delete"
                        onClick={() => removeSectionItem(section.key, item.id)}
                        aria-label="Odstrániť cvičenie"
                        title="Odstrániť cvičenie"
                      >
                        <span className="material-icons-round" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="trainings-planner-add-item-btn"
                    onClick={() => addSectionItem(section.key)}
                  >
                    <span className="material-icons-round" aria-hidden="true">add_circle</span>
                    Pridať cvičenie
                  </button>
                </div>
              </section>
            )
          })}

          <section className="trainings-planner-summary">
            <div className="trainings-planner-summary-item">
              <span>Celkový čas</span>
              <strong>{totalMinutes} minút</strong>
            </div>
            <div className="trainings-planner-summary-item">
              <span>Počet cvičení</span>
              <strong>{totalExercises}</strong>
            </div>
            <div className="trainings-planner-summary-item">
              <span>Intenzita</span>
              <div className="trainings-planner-intensity-bars" aria-label="Intenzita tréningu">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <i key={`intensity-bar-${bar}`} className={bar <= intensityLevel ? 'active' : ''} />
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <>
          <div className="actions">
            <button className="btn trainings-primary-btn" onClick={() => setIsPlannerOpen(true)}>+ Naplánovať tréning</button>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Názov</th>
                  <th>Dátum</th>
                  <th>Miesto</th>
                  <th>Cvičenia</th>
                  <th>Stav</th>
                  <th>Akcie</th>
                </tr>
              </thead>
              <tbody>
                {trainings.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Žiadne tréningy
                    </td>
                  </tr>
                ) : (
                  trainings.map((training) => (
                    <tr key={training.id}>
                      <td><strong>{training.name || training.title || 'Tréning'}</strong></td>
                      <td>{new Date(training.date || training.start_at || training.startAt || Date.now()).toLocaleDateString('sk-SK')}</td>
                      <td>{training.location || 'Nezadané miesto'}</td>
                      <td>{training.exerciseCount || training.exercise_count || training.exercises_count || 0} cvičení</td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: (training.status === 'completed' || training.status === 'done') ? 'var(--success)' : 'var(--accent)',
                          color: (training.status === 'completed' || training.status === 'done') ? '#fff' : '#000'
                        }}>
                          {(training.status === 'completed' || training.status === 'done') ? 'Dokončené' : 'Naplánované'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default Trainings
