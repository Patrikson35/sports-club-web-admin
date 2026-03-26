import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'

const SPORT_LABELS = {
  football: 'Futbal',
  futsal: 'Futsal',
  basketball: 'Basketbal',
  volleyball: 'Volejbal',
  handball: 'Hádzaná',
  hockey: 'Hokej',
  tennis: 'Tenis',
  athletics: 'Atletika'
}

const formatSportLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Nezaradený šport'
  if (SPORT_LABELS[normalized]) return SPORT_LABELS[normalized]
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [dashboardStats, clubsData] = await Promise.all([
        api.getDashboardStats(),
        api.getClubs()
      ])

      setStats(dashboardStats)
      setClubs(Array.isArray(clubsData?.clubs) ? clubsData.clubs : [])
    } catch (error) {
      console.error('Chyba načítání statistik:', error)
    } finally {
      setLoading(false)
    }
  }

  const sportBlocks = useMemo(() => {
    const grouped = new Map()

    ;(Array.isArray(clubs) ? clubs : []).forEach((club) => {
      const sportKey = String(club?.sport || '').trim().toLowerCase() || 'unassigned'
      if (!grouped.has(sportKey)) {
        grouped.set(sportKey, {
          key: sportKey,
          label: formatSportLabel(sportKey === 'unassigned' ? '' : sportKey),
          clubCount: 0,
          playerCount: 0,
          countries: new Set()
        })
      }

      const entry = grouped.get(sportKey)
      entry.clubCount += 1

      const rawPlayerCount = Number(club?.player_count ?? club?.playerCount ?? 0)
      entry.playerCount += Number.isFinite(rawPlayerCount) ? rawPlayerCount : 0

      const country = String(club?.country || '').trim().toUpperCase()
      if (country) {
        entry.countries.add(country)
      }
    })

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        registeredCountries: item.countries.size
      }))
      .sort((a, b) => {
        if (b.clubCount !== a.clubCount) return b.clubCount - a.clubCount
        return a.label.localeCompare(b.label, 'sk')
      })
  }, [clubs])

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

      <div className="card dashboard-sports-card">
        <h3 style={{ marginBottom: '16px' }}>Bloky podľa druhu športu</h3>

        {sportBlocks.length === 0 ? (
          <p className="dashboard-empty-text">Zatiaľ nie sú dostupné kluby na vytvorenie športových blokov.</p>
        ) : (
          <div className="dashboard-sport-blocks">
            {sportBlocks.map((block) => (
              <section key={block.key} className="dashboard-sport-block" aria-label={`Športový blok ${block.label}`}>
                <h4>{block.label}</h4>

                <div className="dashboard-sport-cards">
                  <article className="dashboard-sport-stat-card">
                    <span>Počet klubov</span>
                    <strong>{block.clubCount}</strong>
                  </article>

                  <article className="dashboard-sport-stat-card">
                    <span>Počet hráčov</span>
                    <strong>{block.playerCount}</strong>
                  </article>

                  <article className="dashboard-sport-stat-card">
                    <span>Počet registrovaných krajín</span>
                    <strong>{block.registeredCountries}</strong>
                  </article>
                </div>
              </section>
            ))}
          </div>
        )}
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
