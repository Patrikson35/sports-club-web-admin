import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import './VerifyEmail.css'

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      verifyToken(token)
    } else {
      setStatus('error')
      setMessage('Chýba overovací token')
    }
  }, [searchParams])

  const verifyToken = async (token) => {
    try {
      const response = await api.verifyEmail(token)
      setStatus('success')
      setMessage(response.message || 'Email bol úspešne overený!')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Neplatný alebo expirovaný overovací link')
    }
  }

  const handleResend = async () => {
    if (!email) {
      alert('Zadajte email adresu')
      return
    }

    setResending(true)
    try {
      await api.resendVerification(email)
      alert('Overovací email bol odoslaný. Skontrolujte svoju schránku.')
    } catch (error) {
      alert('Chyba pri odosielaní: ' + error.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        {status === 'verifying' && (
          <div className="status-message">
            <div className="spinner"></div>
            <h2>Overujem email...</h2>
            <p>Prosím počkajte</p>
          </div>
        )}

        {status === 'success' && (
          <div className="status-message success">
            <div className="icon">✅</div>
            <h2>Email overený!</h2>
            <p>{message}</p>
            <p className="redirect-info">Presmerovanie na prihlásenie...</p>
            <button 
              onClick={() => navigate('/login')} 
              className="btn-primary"
            >
              Prihlásiť sa teraz
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="status-message error">
            <div className="icon">❌</div>
            <h2>Chyba overenia</h2>
            <p>{message}</p>
            
            <div className="resend-section">
              <p>Potrebujete nový overovací link?</p>
              <div className="resend-form">
                <input
                  type="email"
                  placeholder="Váš email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="btn-primary"
                >
                  {resending ? 'Odosielam...' : 'Odoslať znovu'}
                </button>
              </div>
            </div>

            <button 
              onClick={() => navigate('/login')} 
              className="btn-secondary"
            >
              Späť na prihlásenie
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail
