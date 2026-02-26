import { useState } from 'react'
import { api } from '../api'
import Register from './Register'
import './Login.css'

function Login({ onLogin }) {
  const [showRegister, setShowRegister] = useState(false)
  const [email, setEmail] = useState('admin@sportsclub.sk')
  const [password, setPassword] = useState('admin123')
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
      setError(err.message || 'Přihlášení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  if (showRegister) {
    return <Register onBackToLogin={() => setShowRegister(false)} />
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>⚽ Sports Club</h1>
          <p>Admin Panel</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sportsclub.sk"
              required
            />
          </div>

          <div className="form-group">
            <label>Heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="register-link">
            <button 
              type="button" 
              className="btn-link"
              onClick={() => setShowRegister(true)}
            >
              Nemáte účet? Registrujte sa
            </button>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Přihlašuji...' : 'Přihlásit se'}
          </button>
        </form>

        <div className="login-footer">
          <p>Test účty:</p>
          <p>Admin: admin@sportsclub.sk / admin123</p>
          <p>Trenér: trener1@hvezdna.sk / coach123</p>
        </div>
      </div>
    </div>
  )
}

export default Login
