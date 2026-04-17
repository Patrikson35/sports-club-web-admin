import { useState, useEffect } from 'react'
import { api } from '../api'

function Players() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadPlayers()
  }, [])

  const loadPlayers = async () => {
    try {
      const data = await api.getPlayers({ search })
      setPlayers(data.players)
    } catch (error) {
      console.error('Chyba načítání hráčů:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    loadPlayers()
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div className="unified-page">
      <div className="page-header">
        <h2>Hráči</h2>
        <p>Správa hráčů a jejich dat</p>
      </div>

      <div className="unified-toolbar">
        <form onSubmit={handleSearch} className="unified-search-form">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat hráče..."
          />
          <button type="submit" className="btn">Hledat</button>
        </form>
        <button className="btn">+ Přidat hráče</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jméno</th>
              <th>Číslo dresu</th>
              <th>Pozice</th>
              <th>Tým</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan="6" className="unified-empty">
                  Žádní hráči
                </td>
              </tr>
            ) : (
              players.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{player.firstName} {player.lastName}</strong>
                    <br />
                    <small className="unified-table-note">{player.email}</small>
                  </td>
                  <td>
                    <span className="unified-badge warning">
                      #{player.jerseyNumber}
                    </span>
                  </td>
                  <td>{player.position}</td>
                  <td>{player.team?.name || '-'}</td>
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

      <div className="card">
        <p className="unified-muted">
          Celkem hráčů: <strong className="unified-accent-value">{players.length}</strong>
        </p>
      </div>
    </div>
  )
}

export default Players
