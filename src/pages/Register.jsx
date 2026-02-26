import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import './Register.css'

function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    registrationType: 'player',
    sport: 'basketball',
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
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        throw new Error('Všetky polia sú povinné')
      }

      if (formData.password.length < 6) {
        throw new Error('Heslo musí mať aspoň 6 znakov')
      }

      // Send registration request
      const response = await api.register({
        registrationType: formData.registrationType,
        sport: formData.sport,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      })

      // Success - show message to check email
      alert('Registrácia úspešná! Skontrolujte svoj email pre overenie účtu.')
      navigate('/login')
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Chyba pri registrácii')
    } finally {
      setLoading(false)
    }           disabled={!!inviteData}
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
         form onSubmit={handleSubmit}>
          {/* Registrovať sa ako */}
          <div className="form-group">
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

          {/* Výber šport */}
          <div className="form-group">
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

          {/* Meno */}
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

          {/* Priezvisko */}
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

          {/* Email */}
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

          {/* Heslo */}
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

          {/* Submit button */}
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
          </button