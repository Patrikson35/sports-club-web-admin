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
      setTrainings(data.trainings)
    } catch (error) {
      console.error('Chyba načítání tréninků:', error)
    } finally {
      setLoading(false)
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
  }

  const saveComposer = () => {
    window.alert('Formulár je pripravený. Ďalší krok: napojenie na uloženie do API.')
  }

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
        <button className="btn" type="button" onClick={() => setIsComposerOpen(true)}>+ Naplánovať tréning</button>
      </div>

      {isComposerOpen ? (
        <div className="training-composer-shell">
          <div className="training-composer-head">
            <div>
              <h3>Poskladať tréningovú jednotku</h3>
              <p>Vytvorte presný časový a obsahový plán tréningu.</p>
            </div>
            <button type="button" className="btn btn-secondary training-composer-close-btn" onClick={closeComposer}>Zavrieť</button>
          </div>

          <div className="training-composer-meta-grid">
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
              <button type="button" className="btn btn-secondary training-composer-cancel-btn" onClick={closeComposer}>Zrušiť</button>
              <button type="button" className="btn training-composer-save-btn" onClick={saveComposer}>Uložiť tréning</button>
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
