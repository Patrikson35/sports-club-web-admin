import { useState, useEffect } from 'react'
import { api } from '../api'

function Tests() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      const data = await api.getTestResults()
      setResults(data.results)
    } catch (error) {
      console.error('Chyba načítání výsledků:', error)
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
        <h2>Testy</h2>
        <p>Výsledky a statistiky testů</p>
      </div>

      <div className="actions">
        <button className="btn">+ Zadat nový test</button>
        <button className="btn btn-secondary">📊 Statistiky</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Rychlostné testy</h3>
        <table>
          <thead>
            <tr>
              <th>Hráč</th>
              <th>Test</th>
              <th>Výsledek</th>
              <th>Datum</th>
              <th>Poznámka</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Žádné výsledky testů
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id}>
                  <td><strong>{result.player?.name}</strong></td>
                  <td>{result.test?.name}</td>
                  <td>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: 'var(--accent)'
                    }}>
                      {result.value} {result.unit}
                    </span>
                  </td>
                  <td>{new Date(result.testDate).toLocaleDateString('cs-CZ')}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {result.notes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Typy testů</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px' }}>
            <strong>Rychlostné</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              10m, 30m, 100m, Omikový běh
            </p>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px' }}>
            <strong>Silové</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Tlak, Sed-lehy
            </p>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px' }}>
            <strong>Kondiční</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Výdrž, Cooper test
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Tests
