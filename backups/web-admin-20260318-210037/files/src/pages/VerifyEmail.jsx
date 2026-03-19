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

  const getCompleteProfilePath = (role) => {
    if (role === 'club') return '/complete-profile/club'
    if (role === 'coach' || role === 'assistant' || role === 'private_coach') return '/complete-profile/coach'
    if (role === 'player' || role === 'parent') return '/complete-profile/player'
    return '/login'
  }

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      api.clearToken()
      localStorage.removeItem('user')
      verifyToken(token)
    } else {
      setStatus('error')
      setMessage('Chýba overovací token')
    }
  }, [searchParams])

  const verifyToken = async (token) => {
    console.log('Starting verification with token:', token)
    try {
      console.log('Calling API verifyEmail...')
      const response = await api.verifyEmail(token)
      console.log('API Response:', response)
      setStatus('success')
      setMessage(response.message || 'Email bol úspešne overený!')
      
      // Auto-login: save token and user data
      if (response.token) {
        console.log('Saving auth data to localStorage')
        localStorage.setItem('authToken', response.token)
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user))
        }
        api.setToken(response.token)
      }
      
      let role = response.user?.role || response.role || null

      // Fallback: ak backend nevrátil user.role, načítame role z registračného kontextu
      if (!role && response.token) {
        try {
          const context = await api.getRegistrationContext()
          role = context?.role || null
        } catch (contextError) {
          console.warn('Nepodarilo sa načítať registration context:', contextError)
        }
      }

      const redirectPath = getCompleteProfilePath(role)
      
      // Redirect to complete-profile form
      console.log('Redirecting to:', redirectPath)
      setTimeout(() => {
        navigate(redirectPath, { replace: true })
      }, 100)
    } catch (error) {
      console.error('Verification error:', error)
      api.clearToken()
      localStorage.removeItem('user')
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
            <p className="redirect-info">Presmerovanie na doregistráciu...</p>
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
