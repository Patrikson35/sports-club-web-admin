import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import './ParentConsent.css'

function ParentConsent() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading, ready, submitting, success, error
  const [consentData, setConsentData] = useState(null)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      // Token je validný - zobrazíme formulár
      setStatus('ready')
      // V reálnej aplikácii by sme načítali info o dieťati z tokenu
    } else {
      setStatus('error')
      setError('Chýba overovací token')
    }
  }, [searchParams])

  const handleSubmitConsent = async (consentGiven) => {
    const token = searchParams.get('token')
    setStatus('submitting')

    try {
      const response = await api.verifyParentConsent(token, consentGiven)
      setStatus('success')
      setConsentData({
        consentGiven,
        message: response.message
      })

      // Redirect after 5 seconds
      setTimeout(() => {
        navigate('/login')
      }, 5000)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Chyba pri spracovaní súhlasu')
    }
  }

  if (status === 'loading') {
    return (
      <div className="consent-container">
        <div className="consent-card">
          <div className="spinner"></div>
          <p>Načítavam...</p>
        </div>
      </div>
    )
  }

  if (status === 'submitting') {
    return (
      <div className="consent-container">
        <div className="consent-card">
          <div className="spinner"></div>
          <p>Spracovávam...</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="consent-container">
        <div className="consent-card">
          <div className="success-message">
            <div className="icon">
              {consentData.consentGiven ? '✅' : 'ℹ️'}
            </div>
            <h2>
              {consentData.consentGiven 
                ? 'Súhlas bol udelený' 
                : 'Súhlas bol zamietnutý'}
            </h2>
            <p>
              {consentData.consentGiven
                ? 'Účet vášho dieťaťa bol aktivovaný. Môže sa prihlásiť a začať používať aplikáciu.'
                : 'Účet vášho dieťaťa zostáva deaktivovaný. Ak si rozmyslíte, môžete nám napísať.'}
            </p>
            <p className="redirect-info">Presmerovanie...</p>
            <button 
              onClick={() => navigate('/login')} 
              className="btn-primary"
            >
              Pokračovať
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="consent-container">
        <div className="consent-card">
          <div className="error-message">
            <div className="icon">❌</div>
            <h2>Chyba</h2>
            <p>{error}</p>
            <button 
              onClick={() => navigate('/login')} 
              className="btn-secondary"
            >
              Späť na prihlásenie
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main consent form
  return (
    <div className="consent-container">
      <div className="consent-card">
        <h1>Rodičovský súhlas</h1>
        <p className="subtitle">Ochrana osobných údajov neplnoletých osôb (COPPA/GDPR)</p>

        <div className="consent-content">
          <div className="info-section">
            <h3>Vaše dieťa sa zaregistrovalo do Sports Club</h3>
            <p>
              Keďže má menej ako 16 rokov, potrebujeme váš súhlas na spracovanie osobných údajov.
            </p>
          </div>

          <div className="data-section">
            <h3>Aké údaje budeme spracovávať?</h3>
            <ul>
              <li>Meno a priezvisko</li>
              <li>Dátum narodenia</li>
              <li>Email adresa (ak bola poskytnutá)</li>
              <li>Tréningové údaje a hodnotenia</li>
              <li>Fotografie z tréningov (ak budú poskytnuté)</li>
            </ul>
          </div>

          <div className="purpose-section">
            <h3>Na aký účel?</h3>
            <ul>
              <li>Evidencia účasti na tréningoch</li>
              <li>Sledovanie výkonnosti a progresu</li>
              <li>Komunikácia ohľadom tréningov</li>
              <li>Vytvorenie tréningového profilu</li>
            </ul>
          </div>

          <div className="rights-section">
            <h3>Vaše práva</h3>
            <ul>
              <li>Kedykoľvek môžete súhlas odvolať</li>
              <li>Máte právo na prístup k údajom dieťaťa</li>
              <li>Môžete požiadať o vymazanie údajov</li>
              <li>Údaje nebudú zdieľané s tretími stranami</li>
            </ul>
          </div>

          <div className="checkbox-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                Súhlasím so spracovaním osobných údajov môjho dieťaťa v súlade s GDPR a COPPA. 
                Prečítal(a) som si informácie a rozumiem svojim právam.
              </span>
            </label>
          </div>

          <div className="actions">
            <button
              onClick={() => handleSubmitConsent(true)}
              disabled={!agreed}
              className="btn-approve"
            >
              ✓ Udeliť súhlas
            </button>
            <button
              onClick={() => handleSubmitConsent(false)}
              className="btn-reject"
            >
              ✕ Zamietnuť
            </button>
          </div>

          <div className="footer-note">
            <small>
              V prípade otázok nás kontaktujte na: privacy@sportsclub.com
            </small>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ParentConsent
