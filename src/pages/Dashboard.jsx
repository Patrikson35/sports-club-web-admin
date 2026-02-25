import { useState, useEffect } from 'react'
import { api } from '../api'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error('Chyba načítání statistik:', error)
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
        <h2>Dashboard</h2>
        <p>Přehled Sports Club systému</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Celkem hráčů</h3>
          <div className="value">{stats?.totalPlayers || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Počet týmů</h3>
          <div className="value">{stats?.totalTeams || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Nadcházející tréninky</h3>
          <div className="value">{stats?.upcomingTrainings || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Nadcházející zápasy</h3>
          <div className="value">{stats?.upcomingMatches || 0}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Rychlé akce</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="/players" className="btn">Přidat hráče</a>
          <a href="/trainings" className="btn btn-secondary">Nový trénink</a>
          <a href="/matches" className="btn btn-secondary">Nový zápas</a>
          <a href="/tests" className="btn btn-secondary">Zadat test</a>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Systémové informace</h3>
        <table>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Databáze</td>
              <td>Wedos MySQL (md395.wedos.net)</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Backend API</td>
              <td>api-simple (Node.js + Express)</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Web Admin</td>
              <td>React + Vite</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Mobilní App</td>
              <td>React Native + Expo</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Dashboard
