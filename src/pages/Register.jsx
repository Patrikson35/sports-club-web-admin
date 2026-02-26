import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import './Register.css'

function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    registrationType: '',
    sport: '',
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        throw new Error('Všetky polia sú povinné')
      }

      if (formData.password.length < 6) {
        throw new Error('Heslo musí mať aspoň 6 znakov')
      }

      const response = await api.register({
        registrationType: formData.registrationType,
        sport: formData.sport,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      })

      alert('Registrácia úspešná! Skontrolujte svoj email pre overenie účtu.')
      navigate('/login')
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Chyba pri registrácii')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group select-group">
            <select
              name="registrationType"
              value={formData.registrationType}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">Registrovať sa ako</option>
              <option value="player">Hráč</option>
              <option value="coach">Tréner</option>
              <option value="club">Klub</option>
              <option value="parent">Rodič</option>
            </select>
          </div>

          <div className="form-group select-group">
            <select
              name="sport"
              value={formData.sport}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">Výber šport</option>
              <option value="basketball">Basketbal</option>
              <option value="football">Futbal</option>
              <option value="volleyball">Volejbal</option>
              <option value="handball">Hádzaná</option>
              <option value="hockey">Hokej</option>
              <option value="tennis">Tenis</option>
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

          {error && <div className="error-message">{error}</div>}

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
        </form>
      </div>
    </div>
  )
}

export default Register
