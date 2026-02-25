import { useState, useEffect } from 'react'
import { api } from '../api'

function Matches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    try {
      const data = await api.getMatches()
      setMatches(data.matches)
    } catch (error) {
      console.error('Chyba načítání zápasů:', error)
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
        <h2>Zápasy</h2>
        <p>Správa zápasů a výsledků</p>
      </div>

      <div className="actions">
        <button className="btn">+ Přidat zápas</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Soupeř</th>
              <th>Místo</th>
              <th>Výsledek</th>
              <th>Stav</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Žádné zápasy
                </td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.id}>
                  <td>{new Date(match.matchDate).toLocaleDateString('cs-CZ')}</td>
                  <td>
                    <strong>Hvězdna vs {match.opponent}</strong>
                  </td>
                  <td>{match.location}</td>
                  <td>
                    {match.result ? (
                      <span style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: 'var(--accent)'
                      }}>
                        {match.result}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: match.status === 'completed' ? 'var(--success)' : 'var(--accent)',
                      color: match.status === 'completed' ? '#fff' : '#000'
                    }}>
                      {match.status === 'completed' ? 'Odehráno' : 'Naplánováno'}
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

export default Matches
