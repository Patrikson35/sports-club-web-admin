import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import './Login.css'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { token, user } = await api.login(email, password)
      onLogin(token, user)
    } catch (err) {
      setError(err.message || 'Prihlásenie zlyhalo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-image">
          {/* Background image will be set via CSS */}
        </div>

        <div className="login-card-header">
          <h2>Prihlasenie</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ID"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Heslo"
              className="form-input"
              required
            />
          </div>

          <div className="form-links">
            <Link to="/forgot-password" className="form-link">
              Zabudnuté heslo
            </Link>
            <Link to="/register" className="form-link">
              Registrovať
            </Link>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Zapamätať prihlásenie</span>
            </label>
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
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = '#ff7f1f';
                e.target.style.backgroundColor = '#ff7f1f';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(255, 107, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#ff6b00';
              e.target.style.backgroundColor = '#ff6b00';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(255, 107, 0, 0.3)';
            }}
          >
            {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
