import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'
import './Trainings.css'

const DEFAULT_COMPOSER_SECTIONS = [
  {
    id: 'warmup',
    order: '01',
    title: 'Prípravná časť',
    estimatedMinutes: 20,
    exercises: [
      { id: 'warmup-1', name: 'Dynamický strečing a mobilizácia', focus: 'Kĺbová pohyblivosť, zahriatie', minutes: 10 },
      { id: 'warmup-2', name: 'Koordinačný rebrík - level II', focus: 'Frekvencia, propriocepcia', minutes: 10 }
    ]
  },
  {
    id: 'main',
    order: '02',
    title: 'Hlavná časť',
    estimatedMinutes: 55,
    exercises: [
      { id: 'main-1', name: 'Súbojová hra 3v3 s prechodom', focus: 'Prechodová fáza, zakončenie', minutes: 25 }
    ]
  },
  {
    id: 'finish',
    order: '03',
    title: 'Záver',
    estimatedMinutes: 15,
    exercises: []
  }
]

function Trainings() {
  const [trainings, setTrainings] = useState([])
  const [loading, setLoading] = useState(true)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [teamOptions, setTeamOptions] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [isSavingComposer, setIsSavingComposer] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [composerSuccess, setComposerSuccess] = useState('')
  const [sessionMeta, setSessionMeta] = useState({
    date: new Date().toISOString().slice(0, 10),
    timeFrom: '16:00',
    timeTo: '17:30',
    location: 'Hlavné ihrisko A'
  })
  const [sections, setSections] = useState(DEFAULT_COMPOSER_SECTIONS)

  useEffect(() => {
    loadTrainings()
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

  const loadTeamsForComposer = async () => {
    try {
      const response = await api.getTeams()
      const teams = Array.isArray(response?.teams)
        ? response.teams
            .map((team) => ({
              id: String(team?.id || '').trim(),
              name: String(team?.name || '').trim()
            }))
            .filter((team) => team.id && team.name)
        : []

      setTeamOptions(teams)

      if (teams.length === 1) {
        setSelectedTeamId(teams[0].id)
      } else if (!teams.some((team) => team.id === selectedTeamId)) {
        setSelectedTeamId('')
      }
    } catch (error) {
      setTeamOptions([])
      setSelectedTeamId('')
      setComposerError('Nepodarilo sa načítať kategórie pre plánovanie tréningu.')
    }
  }

  const totalComposerMinutes = useMemo(() => (
    sections.reduce((total, section) => {
      const sectionMinutes = Array.isArray(section?.exercises)
        ? section.exercises.reduce((acc, exercise) => acc + (Number(exercise?.minutes) || 0), 0)
        : 0
      return total + sectionMinutes
    }, 0)
  ), [sections])

  const totalComposerExercises = useMemo(() => (
    sections.reduce((total, section) => total + (Array.isArray(section?.exercises) ? section.exercises.length : 0), 0)
  ), [sections])

  const updateSessionMeta = (field, value) => {
    setSessionMeta((prev) => ({ ...prev, [field]: value }))
  }

  const updateExerciseMinutes = (sectionId, exerciseId, value) => {
    const parsed = Number.parseInt(String(value || '0'), 10)
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        exercises: section.exercises.map((exercise) => (
          exercise.id === exerciseId ? { ...exercise, minutes: safeValue } : exercise
        ))
      }
    }))
  }

  const removeExercise = (sectionId, exerciseId) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        exercises: section.exercises.filter((exercise) => exercise.id !== exerciseId)
      }
    }))
  }

  const addExerciseToSection = (sectionId) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      const nextIndex = section.exercises.length + 1
      return {
        ...section,
        exercises: [
          ...section.exercises,
          {
            id: `${sectionId}-${Date.now()}-${nextIndex}`,
            name: `Nové cvičenie ${nextIndex}`,
            focus: 'Doplňte zameranie cvičenia',
            minutes: 10
          }
        ]
      }
    }))
  }

  const closeComposer = () => {
    setIsComposerOpen(false)
    setComposerError('')
    setComposerSuccess('')
  }

  const saveComposer = async () => {
    const resolvedTeamId = String(selectedTeamId || '').trim()
    if (!resolvedTeamId) {
      setComposerError('Vyberte kategóriu tréningu.')
      setComposerSuccess('')
      return
    }

    const totalMinutes = sections.reduce((sum, section) => {
      const sectionMinutes = Array.isArray(section?.exercises)
        ? section.exercises.reduce((acc, exercise) => acc + (Number(exercise?.minutes) || 0), 0)
        : 0
      return sum + sectionMinutes
    }, 0)

    const title = totalMinutes > 0
      ? `Tréningová jednotka (${totalMinutes} min)`
      : 'Tréningová jednotka'

    const payload = {
      title,
      date: String(sessionMeta.date || '').trim(),
      start_time: String(sessionMeta.timeFrom || '').trim(),
      end_time: String(sessionMeta.timeTo || '').trim(),
      location: String(sessionMeta.location || '').trim(),
      session_type: 'training',
      indicatorCode: 'TJ',
      recurrence_rule: JSON.stringify({
        indicatorCode: 'TJ',
        source: 'trainings-composer',
        totalMinutes
      }),
      exercises: []
    }

    if (!payload.date || !payload.start_time || !payload.end_time) {
      setComposerError('Doplňte dátum a čas tréningu.')
      setComposerSuccess('')
      return
    }

    setIsSavingComposer(true)
    setComposerError('')
    setComposerSuccess('')

    try {
      await api.createTeamTrainingSession(resolvedTeamId, payload)
      await loadTrainings()
      setComposerSuccess('Tréning bol uložený a priradený do plánovača aj dochádzky.')
      setIsComposerOpen(false)
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setComposerError(message || 'Tréning sa nepodarilo uložiť.')
    } finally {
      setIsSavingComposer(false)
    }
  }

  useEffect(() => {
    if (!isComposerOpen) return
    loadTeamsForComposer()
  }, [isComposerOpen])

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div className="unified-page">
      <div className="page-header">
        <h2>Tréninky</h2>
        <p>Plánování a správa tréninků</p>
      </div>

      <div className="unified-toolbar">
        <button className="btn training-open-btn" type="button" onClick={() => setIsComposerOpen(true)}>+ Naplánovať tréning</button>
      </div>

      {isComposerOpen ? (
        <div className="training-composer-modal-backdrop" onClick={closeComposer}>
          <div className="training-composer-shell" onClick={(event) => event.stopPropagation()}>
            <div className="training-composer-head">
              <div>
                <h3>Poskladať tréningovú jednotku</h3>
                <p>Vytvorte presný časový a obsahový plán tréningu.</p>
              </div>
              <button type="button" className="btn btn-secondary training-composer-close-btn" onClick={closeComposer}>Zavrieť</button>
            </div>

            <div className="training-composer-meta-grid">
              {teamOptions.length > 1 ? (
                <div className="training-composer-field">
                  <label>Kategória</label>
                  <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(String(event.target.value || ''))}>
                    <option value="">Vyber kategóriu</option>
                    {teamOptions.map((team) => (
                      <option key={`composer-team-${team.id}`} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {teamOptions.length === 1 ? (
                <div className="training-composer-field">
                  <label>Kategória</label>
                  <input type="text" value={teamOptions[0].name} readOnly />
                </div>
              ) : null}

              <div className="training-composer-field">
                <label>Dátum</label>
                <input type="date" value={sessionMeta.date} onChange={(event) => updateSessionMeta('date', event.target.value)} />
              </div>
              <div className="training-composer-field">
                <label>Čas začiatku</label>
                <input type="time" value={sessionMeta.timeFrom} onChange={(event) => updateSessionMeta('timeFrom', event.target.value)} />
              </div>
              <div className="training-composer-field">
                <label>Čas konca</label>
                <input type="time" value={sessionMeta.timeTo} onChange={(event) => updateSessionMeta('timeTo', event.target.value)} />
              </div>
              <div className="training-composer-field">
                <label>Lokalita</label>
                <input type="text" value={sessionMeta.location} onChange={(event) => updateSessionMeta('location', event.target.value)} />
              </div>
            </div>

            <div className="training-composer-sections">
              {sections.map((section) => {
                const sectionTotal = section.exercises.reduce((sum, exercise) => sum + (Number(exercise.minutes) || 0), 0)
                return (
                  <section key={section.id} className="training-composer-section">
                    <div className="training-composer-section-head">
                      <div className="training-composer-section-title-wrap">
                        <span className="training-composer-order-chip">{section.order}</span>
                        <h4>{section.title}</h4>
                      </div>
                      <span className="training-composer-duration">Odhadovaný čas: {sectionTotal || section.estimatedMinutes} min</span>
                    </div>

                    {section.exercises.length === 0 ? (
                      <div className="training-composer-empty">V tejto sekcii zatiaľ nemáte žiadne cvičenia.</div>
                    ) : (
                      <div className="training-composer-exercises">
                        {section.exercises.map((exercise) => (
                          <article key={exercise.id} className="training-composer-exercise-row">
                            <div className="training-composer-exercise-main">
                              <strong>{exercise.name}</strong>
                              <p>{exercise.focus}</p>
                            </div>
                            <div className="training-composer-exercise-controls">
                              <input
                                type="number"
                                min="1"
                                value={exercise.minutes}
                                onChange={(event) => updateExerciseMinutes(section.id, exercise.id, event.target.value)}
                              />
                              <span>min</span>
                              <button type="button" className="training-composer-delete-btn" onClick={() => removeExercise(section.id, exercise.id)}>
                                <span className="material-icons-round" aria-hidden="true">delete</span>
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    <button type="button" className="training-composer-add-btn" onClick={() => addExerciseToSection(section.id)}>
                      <span className="material-icons-round" aria-hidden="true">database</span>
                      <span>Pridať cvičenie z databázy</span>
                    </button>
                  </section>
                )
              })}
            </div>

            <div className="training-composer-footer">
              {composerError ? <p className="unified-muted" style={{ color: '#fca5a5', margin: 0 }}>{composerError}</p> : null}
              {composerSuccess ? <p className="unified-muted" style={{ color: '#9ae6b4', margin: 0 }}>{composerSuccess}</p> : null}
              <div className="training-composer-summary">
                <div>
                  <small>Celkové trvanie</small>
                  <strong>{totalComposerMinutes} min</strong>
                </div>
                <div>
                  <small>Počet cvičení</small>
                  <strong>{totalComposerExercises}</strong>
                </div>
              </div>

              <div className="training-composer-actions">
                <button type="button" className="btn btn-secondary training-composer-cancel-btn" onClick={closeComposer} disabled={isSavingComposer}>Zrušiť</button>
                <button type="button" className="btn training-composer-save-btn" onClick={saveComposer} disabled={isSavingComposer}>{isSavingComposer ? 'Ukladám...' : 'Uložiť tréning'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Název</th>
              <th>Datum</th>
              <th>Místo</th>
              <th>Cvičení</th>
              <th>Stav</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {trainings.length === 0 ? (
              <tr>
                <td colSpan="6" className="unified-empty">
                  Žádné tréninky
                </td>
              </tr>
            ) : (
              trainings.map((training) => (
                <tr key={training.id}>
                  <td><strong>{training.name}</strong></td>
                  <td>{new Date(training.date).toLocaleDateString('cs-CZ')}</td>
                  <td>{training.location}</td>
                  <td>{training.exerciseCount} cvičení</td>
                  <td>
                    <span className={`unified-badge ${training.status === 'completed' ? 'success' : 'warning'}`}>
                      {training.status === 'completed' ? 'Dokončeno' : 'Naplánováno'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary">
                      Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Trainings
