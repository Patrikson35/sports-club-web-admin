import { useState, useEffect } from 'react'
import { api } from '../api'

function Teams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const data = await api.getTeams()
      setTeams(data.teams)
    } catch (error) {
      console.error('Chyba načítání týmů:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div className="unified-page">
      <div className="page-header">
        <h2>Týmy</h2>
        <p>Správa týmů a kategorií</p>
      </div>

      <div className="unified-toolbar">
        <button className="btn">+ Vytvořit tým</button>
      </div>

      <div className="stats-grid">
        {teams.map((team) => (
          <div key={team.id} className="stat-card">
            <h3>{team.name}</h3>
            <div className="value">{team.playerCount}</div>
            <p className="unified-table-note">
              Kategorie: {team.ageGroup}
            </p>
            <button className="btn btn-secondary" style={{ width: '100%' }}>
              Zobrazit detail
            </button>
          </div>
        ))}
      </div>

      {teams.length === 0 && (
        <div className="card">
          <p className="unified-empty">
            Žádné týmy v systému
          </p>
        </div>
      )}
    </div>
  )
}

export default Teams
