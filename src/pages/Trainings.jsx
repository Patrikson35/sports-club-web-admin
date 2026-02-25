import { useState, useEffect } from 'react'
import { api } from '../api'

function Trainings() {
  const [trainings, setTrainings] = useState([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>Tréninky</h2>
        <p>Plánování a správa tréninků</p>
      </div>

      <div className="actions">
        <button className="btn">+ Naplánovat trénink</button>
      </div>

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
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
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
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: training.status === 'completed' ? 'var(--success)' : 'var(--accent)',
                      color: training.status === 'completed' ? '#fff' : '#000'
                    }}>
                      {training.status === 'completed' ? 'Dokončeno' : 'Naplánováno'}
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
    </div>
  )
}

export default Trainings
