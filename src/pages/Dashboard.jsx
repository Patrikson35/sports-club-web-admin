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

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'club_admin') return 'club'
  return normalized || 'club'
}

function Dashboard() {
  const [currentRole] = useState(() => {
    try {
      const raw = localStorage.getItem('user')
      const parsed = raw ? JSON.parse(raw) : null
      return normalizeRole(parsed?.role)
    } catch {
      return 'club'
    }
  })
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    loadStats()
  }, [currentRole])

  const loadStats = async () => {
    try {
      if (currentRole === 'admin') {
        const [dashboardStats, clubsData] = await Promise.all([
          api.getDashboardStats(),
          api.getClubs()
        ])
        setStats(dashboardStats)
        setClubs(Array.isArray(clubsData?.clubs) ? clubsData.clubs : [])
        return
      }

      const dashboardStats = await api.getDashboardStats()
      setStats(dashboardStats)
      setClubs([])
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

  const renderAdminDashboard = () => (
    <>
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
    </>
  )

  const renderRoleStats = (title, description, cards) => (
    <>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '8px' }}>{title}</h3>
        <p className="dashboard-empty-text">{description}</p>
      </div>
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <h3>{card.label}</h3>
            <div className="value">{card.value}</div>
          </div>
        ))}
      </div>
    </>
  )

  const roleContent = (() => {
    if (currentRole === 'admin') {
      return renderAdminDashboard()
    }

    if (currentRole === 'club') {
      return renderRoleStats('Dashboard klubu', 'Prehľad výkonu a aktivít vášho klubu.', [
        { label: 'Celkem hráčov', value: stats?.totalPlayers || 0 },
        { label: 'Počet tímov', value: stats?.totalTeams || 0 },
        { label: 'Nadchádzajúce tréningy', value: stats?.upcomingTrainings || 0 },
        { label: 'Nadchádzajúce zápasy', value: stats?.upcomingMatches || 0 }
      ])
    }

    if (currentRole === 'coach') {
      return renderRoleStats('Dashboard trénera', 'Prehľad tímových aktivít a plánovania tréningov.', [
        { label: 'Nadchádzajúce tréningy', value: stats?.upcomingTrainings || 0 },
        { label: 'Nadchádzajúce zápasy', value: stats?.upcomingMatches || 0 },
        { label: 'Počet hráčov', value: stats?.totalPlayers || 0 },
        { label: 'Počet tímov', value: stats?.totalTeams || 0 }
      ])
    }

    if (currentRole === 'assistant') {
      return renderRoleStats('Dashboard asistenta', 'Operatívny prehľad k denným tréningovým úlohám.', [
        { label: 'Tréningy tento týždeň', value: stats?.upcomingTrainings || 0 },
        { label: 'Zápasy tento týždeň', value: stats?.upcomingMatches || 0 },
        { label: 'Aktívni hráči', value: stats?.totalPlayers || 0 },
        { label: 'Aktívne tímy', value: stats?.totalTeams || 0 }
      ])
    }

    if (currentRole === 'private_coach') {
      return renderRoleStats('Dashboard súkromného trénera', 'Prehľad individuálnych tréningových aktivít.', [
        { label: 'Nadchádzajúce tréningy', value: stats?.upcomingTrainings || 0 },
        { label: 'Nadchádzajúce zápasy', value: stats?.upcomingMatches || 0 },
        { label: 'Počet hráčov', value: stats?.totalPlayers || 0 },
        { label: 'Počet tímov', value: stats?.totalTeams || 0 }
      ])
    }

    if (currentRole === 'parent') {
      return renderRoleStats('Dashboard rodiča', 'Prehľad aktivít a termínov vašich detí.', [
        { label: 'Nadchádzajúce tréningy', value: stats?.upcomingTrainings || 0 },
        { label: 'Nadchádzajúce zápasy', value: stats?.upcomingMatches || 0 },
        { label: 'Počet tímov', value: stats?.totalTeams || 0 },
        { label: 'Počet hráčov', value: stats?.totalPlayers || 0 }
      ])
    }

    return renderRoleStats('Dashboard hráča', 'Prehľad vašich najbližších športových aktivít.', [
      { label: 'Nadchádzajúce tréningy', value: stats?.upcomingTrainings || 0 },
      { label: 'Nadchádzajúce zápasy', value: stats?.upcomingMatches || 0 },
      { label: 'Počet tímov', value: stats?.totalTeams || 0 },
      { label: 'Počet hráčov', value: stats?.totalPlayers || 0 }
    ])
  })()

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Přehled Sports Club systému</p>
      </div>

      {roleContent}
    </div>
  )
}

export default Dashboard
