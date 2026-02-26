import { useState, useEffect } from 'react'
import { api } from '../api'
import './Clubs.css'

function Clubs() {
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadClubs()
  }, [])

  const loadClubs = async () => {
    try {
      const data = await api.getClubs()
      setClubs(data.clubs)
    } catch (error) {
      console.error('Chyba načítání klubů:', error)
      alert('Nepodařilo se načíst kluby')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('Název klubu je povinný')
      return
    }

    setSubmitting(true)
    try {
      await api.createClub(formData)
      alert('Klub úspěšně vytvořen!')
      setShowForm(false)
      setFormData({ name: '', address: '', email: '', phone: '' })
      loadClubs()
    } catch (error) {
      console.error('Chyba vytváření klubu:', error)
      alert('Nepodařilo se vytvořit klub: ' + (error.message || 'Neznámá chyba'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>Kluby</h2>
        <p>Správa sportovních klubů</p>
      </div>

      <div className="actions">
        <button 
          className="btn" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Zrušit' : '+ Vytvořit klub'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Nový klub</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Název klubu *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="např. FK Slovan Bratislava"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="address">Adresa</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="např. Tehelné pole 1, Bratislava"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="např. info@klub.sk"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Telefon</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="např. +421 123 456 789"
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button 
                type="submit" 
                className="btn"
                disabled={submitting}
              >
                {submitting ? 'Vytváření...' : 'Vytvořit klub'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Zrušit
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="stats-grid">
        {clubs.map((club) => (
          <div key={club.id} className="stat-card">
            <h3>{club.name}</h3>
            <div className="club-stats">
              <div className="stat-item">
                <span className="stat-label">Týmy:</span>
                <span className="stat-value">{club.team_count || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Hráči:</span>
                <span className="stat-value">{club.player_count || 0}</span>
              </div>
            </div>
            {club.address && (
              <p className="club-info">📍 {club.address}</p>
            )}
            {club.email && (
              <p className="club-info">📧 {club.email}</p>
            )}
            {club.phone && (
              <p className="club-info">📞 {club.phone}</p>
            )}
            <button className="btn btn-secondary" style={{ marginTop: '16px', width: '100%' }}>
              Zobrazit detail
            </button>
          </div>
        ))}
      </div>

      {clubs.length === 0 && !showForm && (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Žádné kluby v systému. Klikněte na tlačítko "+ Vytvořit klub" pro vytvoření prvního klubu.
          </p>
        </div>
      )}
    </div>
  )
}

export default Clubs
