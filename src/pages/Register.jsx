import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import './Register.css'

const DEFAULT_REGISTRATION_SPORTS = [
  { key: 'football', label: 'Futbal' },
  { key: 'hockey', label: 'Hokej' },
  { key: 'basketball', label: 'Basketbal' },
  { key: 'handball', label: 'Hadzana' },
  { key: 'volleyball', label: 'Volejbal' },
  { key: 'tennis', label: 'Tenis' }
]

function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [sportsOptions, setSportsOptions] = useState(DEFAULT_REGISTRATION_SPORTS)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [verificationLink, setVerificationLink] = useState('')
  
  const [formData, setFormData] = useState({
    registrationType: '',
    sport: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dob: ''
  })

  useEffect(() => {
    let isMounted = true

    const loadSports = async () => {
      try {
        const response = await api.getRegistrationSports()
        if (!isMounted) return

        const normalized = (Array.isArray(response?.sports) ? response.sports : [])
          .map((item) => ({
            key: String(item?.key || '').trim(),
            label: String(item?.label || '').trim()
          }))
          .filter((item) => item.key && item.label)

        if (normalized.length > 0) {
          setSportsOptions(normalized)
        }
      } catch {
        if (!isMounted) return
        setSportsOptions(DEFAULT_REGISTRATION_SPORTS)
      }
    }

    loadSports()

    return () => {
      isMounted = false
    }
  }, [])

  const mapRegistrationTypeToRole = (registrationType) => {
    switch (registrationType) {
      case 'club':
        return 'club_admin'
      case 'club_coach':
        return 'coach'
      case 'private_coach':
        return 'private_coach'
      case 'player':
        return 'player'
      default:
        return ''
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    setVerificationLink('')

    try {
      // Validate all fields are filled
      if (!formData.registrationType || !formData.sport || !formData.firstName || 
          !formData.lastName || !formData.email || !formData.password || !formData.dob) {
        throw new Error('Všetky polia sú povinné')
      }

      if (formData.password.length < 6) {
        throw new Error('Heslo musí mať aspoň 6 znakov')
      }

      const role = mapRegistrationTypeToRole(formData.registrationType)
      if (!role) {
        throw new Error('Neplatný typ registrácie')
      }

      const response = await api.register({
        registrationType: formData.registrationType,
        sport: formData.sport,
        role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        dob: formData.dob,
        country: 'SK',
        languagePreference: 'sk'
      })

      const linkFromApi = response?.verification?.link || ''
      setVerificationLink(linkFromApi)
      setSuccessMessage('Registrácia úspešná. Ak email nepríde, použite odkaz nižšie na overenie účtu.')

      if (!linkFromApi) {
        alert('Registrácia úspešná! Skontrolujte svoj email pre overenie účtu.')
        navigate('/login')
      }
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Chyba pri registrácii')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-card-header">
          <h2>Registrácia</h2>
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group select-group">
            <select
              name="registrationType"
              value={formData.registrationType}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="">Registrovať sa ako</option>
              <option value="club">Klub</option>
              <option value="club_coach">Klubový tréner</option>
              <option value="private_coach">Privátny tréner</option>
              <option value="player">Hráč</option>
            </select>
          </div>

          <div className="form-group select-group">
            <select
              name="sport"
              value={formData.sport}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="">Výber šport</option>
              {sportsOptions.map((sport) => (
                <option key={`registration-sport-${sport.key}`} value={sport.key}>{sport.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="Meno"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Priezvisko"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Heslo"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#ff6b00',
              background: '#ff6b00',
              color: '#fff',
              border: 'none',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 15px rgba(255, 107, 0, 0.3)',
              transition: 'all 0.3s'
            }}
          >
            {loading ? 'Registrujem...' : 'Registrovať'}
          </button>

          {verificationLink && (
            <div className="verification-link-box">
              <p>Overenie účtu:</p>
              <a href={verificationLink} target="_blank" rel="noreferrer">{verificationLink}</a>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/login')}
              >
                Pokračovať na prihlásenie
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default Register
