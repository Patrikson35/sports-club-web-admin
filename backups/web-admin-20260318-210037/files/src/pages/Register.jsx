import { useState, useEffect } from 'react'
import { api } from '../api'
import './Register.css'

function Register() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verificationLink, setVerificationLink] = useState('')
  const [registeredUser, setRegisteredUser] = useState(null)
  
  const [formData, setFormData] = useState({
    registrationType: '',
    sport: '',
    isPlayerOlderThan18: true,
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  })

  useEffect(() => {
    api.clearToken()
    localStorage.removeItem('user')
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const handlePlayerAgeChange = (isOlderThan18) => {
    setFormData(prev => ({
      ...prev,
      isPlayerOlderThan18: isOlderThan18
    }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setVerificationLink('')
    setRegisteredUser(null)

    api.clearToken()
    localStorage.removeItem('user')

    try {
      const isUnder18Player = formData.registrationType === 'player' && !formData.isPlayerOlderThan18

      // Validate required fields
      if (!formData.registrationType || !formData.sport || !formData.password) {
        throw new Error('Všetky polia sú povinné')
      }

      if (!isUnder18Player && (!formData.firstName || !formData.lastName || !formData.email)) {
        throw new Error('Všetky polia sú povinné')
      }

      if (formData.password.length < 6) {
        throw new Error('Heslo musí mať aspoň 6 znakov')
      }

      if (isUnder18Player) {
        if (!formData.parentFirstName || !formData.parentLastName || !formData.parentEmail) {
          throw new Error('Pri hráčovi mladšom ako 18 rokov vyplňte údaje rodiča')
        }
      }

      const response = await api.register({
        registrationType: formData.registrationType,
        sport: formData.sport,
        isPlayerOlderThan18: formData.isPlayerOlderThan18,
        parentFirstName: formData.registrationType === 'player' && !formData.isPlayerOlderThan18 ? formData.parentFirstName : undefined,
        parentLastName: formData.registrationType === 'player' && !formData.isPlayerOlderThan18 ? formData.parentLastName : undefined,
        parentEmail: formData.registrationType === 'player' && !formData.isPlayerOlderThan18 ? formData.parentEmail : undefined,
        firstName: isUnder18Player ? formData.parentFirstName : formData.firstName,
        lastName: isUnder18Player ? formData.parentLastName : formData.lastName,
        email: isUnder18Player ? formData.parentEmail : formData.email,
        password: formData.password
      })

      const link = response?.verification?.link || ''
      setVerificationLink(link)
      setRegisteredUser(response?.user || null)
      setSuccess('Registrácia úspešná! Namiesto emailu môžete pokračovať cez tlačidlo nižšie.')
      
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
        {success && <div className="success-message">{success}</div>}

        {verificationLink && (
          <div className="dev-verification-box">
            <div className="dev-verification-meta">
              <div>ID: {registeredUser?.id}</div>
              <div>Rola: {registeredUser?.role}</div>
            </div>

            <button
              type="button"
              className="btn-primary btn-block"
              onClick={() => {
                window.location.href = verificationLink
              }}
            >
              Pokračovať na doregistráciu
            </button>

            <p className="dev-verification-link">{verificationLink}</p>
          </div>
        )}

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
              <option value="coach">Tréner</option>
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
              <option value="football">Futbal</option>
              <option value="hockey">Hokej</option>
              <option value="basketball">Basketbal</option>
              <option value="handball">Hádzaná</option>
              <option value="volleyball">Volejbal</option>
              <option value="tennis">Tenis</option>
            </select>
          </div>

          {formData.registrationType === 'player' && (
            <div className="form-group player-age-switch">
              <div className="switch-label">Má hráč 18 rokov a viac?</div>
              <div className="switch-buttons">
                <button
                  type="button"
                  className={`age-btn ${formData.isPlayerOlderThan18 ? 'active' : ''}`}
                  onClick={() => handlePlayerAgeChange(true)}
                >
                  áno
                </button>
                <button
                  type="button"
                  className={`age-btn ${!formData.isPlayerOlderThan18 ? 'active' : ''}`}
                  onClick={() => handlePlayerAgeChange(false)}
                >
                  nie
                </button>
              </div>
            </div>
          )}

          {formData.registrationType === 'player' && !formData.isPlayerOlderThan18 && (
            <>
              <div className="parent-title">Údaje rodiča:</div>

              <div className="form-group">
                <input
                  type="text"
                  name="parentFirstName"
                  value={formData.parentFirstName}
                  onChange={handleInputChange}
                  placeholder="Meno rodiča"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="text"
                  name="parentLastName"
                  value={formData.parentLastName}
                  onChange={handleInputChange}
                  placeholder="Priezvisko rodiča"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="email"
                  name="parentEmail"
                  value={formData.parentEmail}
                  onChange={handleInputChange}
                  placeholder="Email rodiča"
                  className="form-input"
                  required
                />
              </div>
            </>
          )}

          {!(formData.registrationType === 'player' && !formData.isPlayerOlderThan18) && (
            <>
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
            </>
          )}

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

          <a href="/login" className="register-login-link">
            Už máte účet? Prihláste sa
          </a>
        </form>
      </div>
    </div>
  )
}

export default Register
