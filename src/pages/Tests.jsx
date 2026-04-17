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
    <div className="unified-page">
      <div className="page-header">
        <h2>Testy</h2>
        <p>Výsledky a statistiky testů</p>
      </div>

      <div className="unified-toolbar">
        <button className="btn">+ Zadat nový test</button>
        <button className="btn btn-secondary">📊 Statistiky</button>
      </div>

      <div className="card">
        <h3>Rychlostné testy</h3>
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
                <td colSpan="5" className="unified-empty">
                  Žádné výsledky testů
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id}>
                  <td><strong>{result.player?.name}</strong></td>
                  <td>{result.test?.name}</td>
                  <td>
                    <span className="unified-accent-value">
                      {result.value} {result.unit}
                    </span>
                  </td>
                  <td>{new Date(result.testDate).toLocaleDateString('cs-CZ')}</td>
                  <td className="unified-table-note">
                    {result.notes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Typy testů</h3>
        <div className="unified-info-cards">
          <div className="unified-info-card">
            <strong>Rychlostné</strong>
            <p>
              10m, 30m, 100m, Omikový běh
            </p>
          </div>
          <div className="unified-info-card">
            <strong>Silové</strong>
            <p>
              Tlak, Sed-lehy
            </p>
          </div>
          <div className="unified-info-card">
            <strong>Kondiční</strong>
            <p>
              Výdrž, Cooper test
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Tests
