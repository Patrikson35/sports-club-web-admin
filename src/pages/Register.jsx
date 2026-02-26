import { useState, useEffect } from 'react'
import { api } from '../api'
import './Register.css'

function Register({ onBackToLogin }) {
  const [step, setStep] = useState(1)
  const [registerAs, setRegisterAs] = useState('club')
  const [loading, setLoading] = useState(false)
  const [clubs, setClubs] = useState([])
  
  // Krok 1: Základní údaje
  const [basicData, setBasicData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  })

  // Krok 2: Specifické údaje podle role
  const [clubData, setClubData] = useState({
    clubName: '',
    address: '',
    city: '',
    country: 'SK',
    logo: null
  })

  const [trainerData, setTrainerData] = useState({
    clubId: '',
    country: 'SK',
    isClubTrainer: true,
    isPersonalTrainer: false,
    photo: null
  })

  const [playerData, setPlayerData] = useState({
    clubId: '',
    dateOfBirth: '',
    height: '',
    weight: '',
    position: '',
    preferredFoot: 'right',
    photo: null
  })

  // Load clubs when step 2 and trainer/player selected
  useEffect(() => {
    if (step === 2 && (registerAs === 'trainer' || registerAs === 'player')) {
      loadClubs()
    }
  }, [step, registerAs])

  const loadClubs = async () => {
    try {
      const data = await api.getClubs()
      setClubs(data.clubs || [])
    } catch (error) {
      console.error('Chyba načítania klubov:', error)
    }
  }

  const handleStep1Submit = (e) => {
    e.preventDefault()
    
    if (!basicData.email || !basicData.password || !basicData.firstName || !basicData.lastName) {
      alert('Všetky polia sú povinné')
      return
    }

    if (basicData.password.length < 6) {
      alert('Heslo musí mať aspoň 6 znakov')
      return
    }

    setStep(2)
  }

  const handleFinalSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let registrationData = {
        ...basicData,
        registerAs
      }

      if (registerAs === 'club') {
        registrationData = { ...registrationData, ...clubData }
      } else if (registerAs === 'trainer') {
        registrationData = { ...registrationData, ...trainerData }
      } else if (registerAs === 'player') {
        registrationData = { ...registrationData, ...playerData }
      }

      await api.register(registrationData)
      alert('Registrácia úspešná! Čaká sa na schválenie.')
      onBackToLogin()
    } catch (error) {
      console.error('Chyba registrácie:', error)
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
              onClick={onBackToLogin}
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
