import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import './Register.css'

function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [registrationType, setRegistrationType] = useState('club') // club, coach, private_coach, player, parent
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [inviteData, setInviteData] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  
  // Form data
  const [formData, setFormData] = useState({
    // Common fields
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    
    // Club-specific
    clubName: '',
    clubCity: '',
    clubAddress: '',
    clubCountry: 'SK',
    
    // Player-specific
    dateOfBirth: '',
    parentEmail: '',
    parentFirstName: '',
    parentLastName: '',
    parentPhoneNumber: '',
    
    // Invite code
    inviteCode: ''
  })

  // Load invite details if in URL
  useEffect(() => {
    const inviteCode = searchParams.get('invite')
    
    if (inviteCode) {
      loadInviteDetails(inviteCode)
    }
  }, [searchParams])

  const loadInviteDetails = async (code) => {
    setLoadingInvite(true)
    try {
      const response = await api.getInviteDetails(code)
      setInviteData(response.invite)
      setFormData(prev => ({
        ...prev,
        email: response.invite.email || '',
        inviteCode: code
      }))
      
      // Set registration type based on invite
      if (response.invite.inviteType === 'coach') {
        setRegistrationType('coach')
      } else if (response.invite.inviteType === 'assistant') {
        setRegistrationType('assistant')
      } else if (response.invite.inviteType === 'player') {
        setRegistrationType('player')
      }
    } catch (err) {
      setError('Neplatný alebo expirovaný kód pozvánky')
    } finally {
      setLoadingInvite(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const calculateAge = (dob) => {
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate common fields
      if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
        throw new Error('Všetky povinné polia musia byť vyplnené')
      }

      if (formData.password.length < 6) {
        throw new Error('Heslo musí mať aspoň 6 znakov')
      }

      let response

      switch (registrationType) {
        case 'club':
          if (!formData.clubName || !formData.clubCity || !formData.clubCountry) {
            throw new Error('Vyplňte všetky údaje o klube')
          }
          response = await api.registerClub({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber,
            clubName: formData.clubName,
            clubCity: formData.clubCity,
            clubAddress: formData.clubAddress,
            clubCountry: formData.clubCountry
          })
          break

        case 'coach':
          if (!formData.inviteCode) {
            throw new Error('Kód pozvánky je povinný pre registráciu trénera')
          }
          response = await api.registerCoach({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber,
            inviteCode: formData.inviteCode
          })
          break

        case 'private_coach':
          response = await api.registerPrivateCoach({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber
          })
          break

        case 'player':
          if (!formData.dateOfBirth) {
            throw new Error('Dátum narodenia je povinný')
          }
          
          const age = calculateAge(formData.dateOfBirth)
          const needsParent = age < 16

          if (needsParent) {
            if (!formData.parentEmail || !formData.parentFirstName || !formData.parentLastName) {
              throw new Error('Pre hráčov mladších ako 16 rokov sú povinné údaje rodiča')
            }
          }

          response = await api.registerPlayer({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            dateOfBirth: formData.dateOfBirth,
            phoneNumber: formData.phoneNumber,
            inviteCode: formData.inviteCode || undefined,
            ...(needsParent && {
              parentEmail: formData.parentEmail,
              parentFirstName: formData.parentFirstName,
              parentLastName: formData.parentLastName,
              parentPhoneNumber: formData.parentPhoneNumber
            })
          })
          break

        case 'parent':
          response = await api.registerParent({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber
          })
          break

        default:
          throw new Error('Neznámy typ registrácie')
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err.message || 'Chyba pri registrácii')
    } finally {
      setLoading(false)
    }
  }

  if (loadingInvite) {
    return (
      <div className="register-container">
        <div className="register-card">
          <p>Načítavam pozvánku...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="success-message">
            <h2>✅ Registrácia úspešná!</h2>
            <p>Skontrolujte svoj email pre overovací link.</p>
            <button onClick={() => navigate('/login')} className="btn-primary">
              Späť na prihlásenie
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <h1>Registrácia</h1>

        {inviteData && (
          <div className="invite-info">
            <p>
              <strong>Pozvánka:</strong> {inviteData.clubName}<br />
              <small>od {inviteData.inviterName}</small>
            </p>
          </div>
        )}
        
        {!inviteData && (
          <div className="registration-type-selector">
            <label>Registrujem sa ako:</label>
            <select
              value={registrationType}
              onChange={(e) => setRegistrationType(e.target.value)}
              className="form-select"
            >
              <option value="club">Správca klubu</option>
              <option value="private_coach">Súkromný tréner</option>
              <option value="player">Hráč</option>
              <option value="parent">Rodič</option>
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          {/* Common fields */}
          <div className="form-section">
            <h3>Osobné údaje</h3>
            
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={!!inviteData}
              />
            </div>

            <div className="form-group">
              <label>Heslo *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={6}
                placeholder="Min. 6 znakov"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Meno *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Priezvisko *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Telefón</label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="+421..."
              />
            </div>
          </div>

          {/* Club-specific fields */}
          {registrationType === 'club' && (
            <div className="form-section">
              <h3>Údaje o klube</h3>
              
              <div className="form-group">
                <label>Názov klubu *</label>
                <input
                  type="text"
                  name="clubName"
                  value={formData.clubName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Mesto *</label>
                  <input
                    type="text"
                    name="clubCity"
                    value={formData.clubCity}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Krajina *</label>
                  <select
                    name="clubCountry"
                    value={formData.clubCountry}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="SK">Slovensko</option>
                    <option value="CZ">Česko</option>
                    <option value="PL">Poľsko</option>
                    <option value="HU">Maďarsko</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Adresa</label>
                <input
                  type="text"
                  name="clubAddress"
                  value={formData.clubAddress}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {/* Player-specific fields */}
          {registrationType === 'player' && (
            <>
              <div className="form-section">
                <h3>Údaje hráča</h3>
                
                <div className="form-group">
                  <label>Dátum narodenia *</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    required
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {formData.dateOfBirth && calculateAge(formData.dateOfBirth) < 16 && (
                  <div className="info-message">
                    ⚠️ Pre hráčov mladších ako 16 rokov je potrebný súhlas rodiča
                  </div>
                )}
              </div>

              {formData.dateOfBirth && calculateAge(formData.dateOfBirth) < 16 && (
                <div className="form-section">
                  <h3>Údaje rodiča</h3>
                  
                  <div className="form-group">
                    <label>Email rodiča *</label>
                    <input
                      type="email"
                      name="parentEmail"
                      value={formData.parentEmail}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Meno rodiča *</label>
                      <input
                        type="text"
                        name="parentFirstName"
                        value={formData.parentFirstName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Priezvisko rodiča *</label>
                      <input
                        type="text"
                        name="parentLastName"
                        value={formData.parentLastName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Telefón rodiča</label>
                    <input
                      type="tel"
                      name="parentPhoneNumber"
                      value={formData.parentPhoneNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Registrujem...' : 'Zaregistrovať sa'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn-secondary"
            >
              Späť na prihlásenie
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
      alert('Nepodarilo sa registrovať: ' + (error.message || 'Neznáma chyba'))
    } finally {
      setLoading(false)
    }
  }

  const handleBasicChange = (e) => {
    setBasicData({ ...basicData, [e.target.name]: e.target.value })
  }

  const handleClubChange = (e) => {
    setClubData({ ...clubData, [e.target.name]: e.target.value })
  }

  const handleTrainerChange = (e) => {
    const { name, value, type, checked } = e.target
    setTrainerData({ 
      ...trainerData, 
      [name]: type === 'checkbox' ? checked : value 
    })
  }

  const handlePlayerChange = (e) => {
    setPlayerData({ ...playerData, [e.target.name]: e.target.value })
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Registrácia</h2>
        
        {step === 1 && (
          <form onSubmit={handleStep1Submit}>
            <div className="form-group">
              <label>Registrovať ako</label>
              <select 
                value={registerAs} 
                onChange={(e) => setRegisterAs(e.target.value)}
                className="form-select"
              >
                <option value="club">Klub</option>
                <option value="trainer">Trenér</option>
                <option value="player">Hráč</option>
              </select>
            </div>

            <div className="form-group">
              <label>Meno</label>
              <input
                type="text"
                name="firstName"
                value={basicData.firstName}
                onChange={handleBasicChange}
                placeholder="Meno"
                required
              />
            </div>

            <div className="form-group">
              <label>Priezvisko</label>
              <input
                type="text"
                name="lastName"
                value={basicData.lastName}
                onChange={handleBasicChange}
                placeholder="Priezvisko"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={basicData.email}
                onChange={handleBasicChange}
                placeholder="Email"
                required
              />
            </div>

            <div className="form-group">
              <label>Heslo</label>
              <input
                type="password"
                name="password"
                value={basicData.password}
                onChange={handleBasicChange}
                placeholder="Heslo (min. 6 znakov)"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Pokračovať
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-block"
              onClick={() => navigate('/login')}
            >
              Späť na prihlásenie
            </button>
          </form>
        )}

        {step === 2 && registerAs === 'club' && (
          <form onSubmit={handleFinalSubmit}>
            <h3>Podrobnosti o klube</h3>

            <div className="form-group">
              <label>Meno klubu</label>
              <input
                type="text"
                name="clubName"
                value={clubData.clubName}
                onChange={handleClubChange}
                placeholder="Meno klubu"
                required
              />
            </div>

            <div className="form-group">
              <label>Pridať logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setClubData({ ...clubData, logo: e.target.files[0] })}
              />
            </div>

            <div className="form-group">
              <label>Adresa</label>
              <input
                type="text"
                name="address"
                value={clubData.address}
                onChange={handleClubChange}
                placeholder="Adresa"
                required
              />
            </div>

            <div className="form-group">
              <label>Mesto</label>
              <input
                type="text"
                name="city"
                value={clubData.city}
                onChange={handleClubChange}
                placeholder="Mesto"
                required
              />
            </div>

            <div className="form-group">
              <label>Krajina</label>
              <select 
                name="country" 
                value={clubData.country} 
                onChange={handleClubChange}
              >
                <option value="SK">Slovensko</option>
                <option value="CZ">Česko</option>
                <option value="PL">Poľsko</option>
                <option value="HU">Maďarsko</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Ukladá sa...' : 'Uložiť klub'}
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-block"
              onClick={() => setStep(1)}
            >
              Späť
            </button>
          </form>clubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))
        )}

        {step === 2 && registerAs === 'trainer' && (
          <form onSubmit={handleFinalSubmit}>
            <h3>Podrobnosti o trénerovi</h3>

            <div className="form-group">
              <label>Meno klubu</label>
              <select 
                name="clubId" 
                value={trainerData.clubId} 
                onChange={handleTrainerChange}
                required
              >
                <option value="">Vyberte klub</option>
                {/* TODO: Load clubs from API */}
              </select>
            </div>

            <div className="form-group">
              <label>Pridať fotku</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTrainerData({ ...trainerData, photo: e.target.files[0] })}
              />
            </div>

            <div className="form-group">
              <label>Krajina</label>
              <select 
                name="country" 
                value={trainerData.country} 
                onChange={handleTrainerChange}
              >
                <option value="SK">Slovensko</option>
                <option value="CZ">Česko</option>
                <option value="PL">Poľsko</option>
                <option value="HU">Maďarsko</option>
              </select>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isClubTrainer"
                  checked={trainerData.isClubTrainer}
                  onChange={handleTrainerChange}
                />
                <span>Klubový tréner</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isPersonalTrainer"
                  checked={trainerData.isPersonalTrainer}
                  onChange={handleTrainerChange}
                />
                <span>Osobný tréner</span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Ukladá sa...' : 'Uložiť trénera'}
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-block"
              onClick={() => setStep(1)}
            >
              Späť
            </button>
          </form>
        )}

        {step === 2 && registerAs === 'player' && (
          <form onSubmit={handleFinalSubmit}>
            <h3>Podrobnosti o hráčovi</h3>

            <div className="form-group">
              <label>Meno klubu</label>
              <select 
                name="clubId" 
                value={playerData.clubId} 
                onChange={handlePlayerChange}
                required
              >clubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))
                <option value="">Vyberte klub</option>
                {/* TODO: Load clubs from API */}
              </select>
            </div>

            <div className="form-group">
              <label>Dátum narodenia</label>
              <input
                type="date"
                name="dateOfBirth"
                value={playerData.dateOfBirth}
                onChange={handlePlayerChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Pridať fotku</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPlayerData({ ...playerData, photo: e.target.files[0] })}
              />
            </div>

            <div className="form-group">
              <label>Výška (cm)</label>
              <input
                type="number"
                name="height"
                value={playerData.height}
                onChange={handlePlayerChange}
                placeholder="Výška"
              />
            </div>

            <div className="form-group">
              <label>Váha (kg)</label>
              <input
                type="number"
                name="weight"
                value={playerData.weight}
                onChange={handlePlayerChange}
                placeholder="Váha"
              />
            </div>

            <div className="form-group">
              <label>Hráčska pozícia</label>
              <select 
                name="position" 
                value={playerData.position} 
                onChange={handlePlayerChange}
                required
              >
                <option value="">Vyberte pozíciu</option>
                <option value="goalkeeper">Brankár</option>
                <option value="defender">Obranca</option>
                <option value="midfielder">Stredopoliar</option>
                <option value="forward">Útočník</option>
              </select>
            </div>

            <div className="form-group">
              <label>Ktorou hrá</label>
              <select 
                name="preferredFoot" 
                value={playerData.preferredFoot} 
                onChange={handlePlayerChange}
              >
                <option value="right">Pravá</option>
                <option value="left">Ľavá</option>
                <option value="both">Obe</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Ukladá sa...' : 'Uložiť hráča'}
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-block"
              onClick={() => setStep(1)}
            >
              Späť
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Register
