import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import './CompleteProfile.css'

function CompleteProfileClub() {
  const navigate = useNavigate()
  const clubLogoInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    clubName: '',
    clubLogo: null,
    address: '',
    city: '',
    country: 'SK'
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null
    setFormData(prev => ({
      ...prev,
      clubLogo: file
    }))
    setError('')
  }

  const openFilePicker = () => {
    clubLogoInputRef.current?.click()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.clubName.trim()) {
        throw new Error('Meno klubu je povinné')
      }

      let uploadedLogoUrl = ''
      if (formData.clubLogo) {
        const uploadResult = await api.uploadClubLogo(formData.clubLogo)
        uploadedLogoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
      }

      const clubData = {
        name: formData.clubName,
        logo: uploadedLogoUrl,
        address: formData.address,
        city: formData.city,
        country: formData.country
      }

      await api.createClub(clubData)
      
      alert('Klub bol úspešne vytvorený!')
      // Force reload to apply authentication state
      window.location.href = '/'
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Chyba pri ukladaní')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="complete-profile-container">
      <div className="complete-profile-card">
        <div className="complete-profile-header">
          <h2>Podrobnosti o klubu</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="complete-profile-form" style={{ marginTop: '70px' }}>
          <div className="form-group">
            <input
              type="text"
              name="clubName"
              value={formData.clubName}
              onChange={handleInputChange}
              placeholder="Meno klubu"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              ref={clubLogoInputRef}
              type="file"
              id="clubLogo"
              name="clubLogo"
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <div className="club-upload-row">
              <input
                type="text"
                readOnly
                value={formData.clubLogo ? formData.clubLogo.name : 'Logo klubu'}
                className="form-input club-upload-display"
                onClick={openFilePicker}
              />
              <button type="button" className="club-upload-trigger" onClick={openFilePicker}>
                pridať logo
              </button>
            </div>
          </div>

          <div className="form-group">
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Adresa"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="Mesto"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              placeholder="Krajina"
              className="form-input"
            />
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Ukladám...' : 'Uložiť klub'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CompleteProfileClub
