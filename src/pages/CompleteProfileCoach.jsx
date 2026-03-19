import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import './CompleteProfile.css'

function CompleteProfileCoach() {
  const navigate = useNavigate()
  const coachPhotoInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('')
  
  const [formData, setFormData] = useState({
    isClubCoach: false,
    isPersonalCoach: false,
    clubName: '',
    coachPhoto: null,
    country: 'SK'
  })

  useEffect(() => {
    const loadCoachProfile = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) {
          setError('Relácia vypršala. Prihláste sa prosím znova.')
          navigate('/login')
          return
        }

        api.setToken(token)
        const profile = await api.getCoachProfile()
        setFormData(prev => ({
          ...prev,
          isClubCoach: Boolean(profile.isClubCoach),
          isPersonalCoach: Boolean(profile.isPersonalCoach),
          clubName: profile.clubName || '',
          country: profile.country || 'SK'
        }))
        setExistingPhotoUrl(profile.photo || '')
      } catch (err) {
        if (err?.status === 401 || err?.status === 403 || /Access token required|Invalid or expired token/i.test(err?.message || '')) {
          setError('Relácia vypršala. Prihláste sa prosím znova.')
          navigate('/login')
          return
        }
        console.error('Nepodarilo sa načítať coach profil:', err)
      }
    }

    loadCoachProfile()
  }, [navigate])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null
    setFormData(prev => ({
      ...prev,
      coachPhoto: file
    }))
    setError('')
  }

  const openCoachPhotoPicker = () => {
    coachPhotoInputRef.current?.click()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        throw new Error('Relácia vypršala. Prihláste sa prosím znova.')
      }

      api.setToken(token)

      if (!formData.isClubCoach && !formData.isPersonalCoach) {
        throw new Error('Vyberte aspoň jeden typ trénera')
      }

      let uploadedPhotoUrl = existingPhotoUrl
      if (formData.coachPhoto) {
        const uploadResult = await api.uploadCoachPhoto(formData.coachPhoto)
        uploadedPhotoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
      }

      const coachData = {
        isClubCoach: formData.isClubCoach,
        isPersonalCoach: formData.isPersonalCoach,
        clubName: formData.clubName,
        photo: uploadedPhotoUrl,
        country: formData.country
      }

      await api.completeCoachProfile(coachData)
      
      alert('Profil trénera bol úspešne vytvorený!')
      navigate('/dashboard')
      
    } catch (err) {
      if (err?.status === 401 || err?.status === 403 || /Access token required|Invalid or expired token/i.test(err?.message || '')) {
        setError('Relácia vypršala. Prihláste sa prosím znova.')
        navigate('/login')
        return
      }
      setError(err.response?.data?.message || err.message || 'Chyba pri ukladaní')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="complete-profile-container">
      <div className="complete-profile-card">
        <div className="complete-profile-header">
          <h2>Podrobnosti o trénerovi</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="complete-profile-form" style={{ flex: 1, justifyContent: 'flex-end', gap: '16px' }}>
          <div className="coach-top-fields" style={{ marginTop: 'auto' }}>
            <div className="coach-checkboxes">
              <label className="checkbox-label" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                <input
                  type="checkbox"
                  name="isClubCoach"
                  checked={formData.isClubCoach}
                  onChange={handleCheckboxChange}
                  style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    width: '14px',
                    height: '14px',
                    minWidth: '14px',
                    minHeight: '14px',
                    display: 'inline-block',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderRadius: '2px',
                    background: formData.isClubCoach ? '#ff6b00' : '#2a2a2a',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }}
                />
                <span style={{ color: '#fff' }}>klubový tréner</span>
              </label>

              <label className="checkbox-label" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                <input
                  type="checkbox"
                  name="isPersonalCoach"
                  checked={formData.isPersonalCoach}
                  onChange={handleCheckboxChange}
                  style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    width: '14px',
                    height: '14px',
                    minWidth: '14px',
                    minHeight: '14px',
                    display: 'inline-block',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderRadius: '2px',
                    background: formData.isPersonalCoach ? '#ff6b00' : '#2a2a2a',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }}
                />
                <span style={{ color: '#fff' }}>osobný tréner</span>
              </label>
            </div>

            <input
              type="text"
              name="clubName"
              value={formData.clubName}
              onChange={handleInputChange}
              placeholder="Meno klubu"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              ref={coachPhotoInputRef}
              type="file"
              id="coachPhoto"
              name="coachPhoto"
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <div className="club-upload-row">
              <input
                type="text"
                readOnly
                value={formData.coachPhoto ? formData.coachPhoto.name : 'Fotka trénera'}
                className="form-input club-upload-display"
                onClick={openCoachPhotoPicker}
              />
              <button type="button" className="club-upload-trigger" onClick={openCoachPhotoPicker}>
                pridať fotku
              </button>
            </div>
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
            {loading ? 'Ukladám...' : 'Uložiť trénera'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CompleteProfileCoach
