import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import './CompleteProfile.css'

function CompleteProfilePlayer() {
  const navigate = useNavigate()
  const adultPhotoInputRef = useRef(null)
  const childPhotoInputRefs = useRef({})
  const [initializing, setInitializing] = useState(true)
  const [isParentFlow, setIsParentFlow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [adultData, setAdultData] = useState({
    clubName: '',
    personalId: '',
    photo: null,
    existingPhoto: ''
  })

  const [children, setChildren] = useState([
    {
      firstName: '',
      lastName: '',
      clubName: '',
      personalId: '',
      photo: null,
      existingPhoto: ''
    }
  ])

  useEffect(() => {
    let isMounted = true

    const loadContext = async () => {
      try {
        const context = await api.getRegistrationContext()
        if (!isMounted) return

        const parentFlow = Boolean(context?.isParentFlow)
        setIsParentFlow(parentFlow)

        const token = localStorage.getItem('authToken')
        if (!token) {
          setError('Relácia vypršala. Prihláste sa prosím znova.')
          navigate('/login')
          return
        }

        api.setToken(token)

        if (parentFlow) {
          const childrenResponse = await api.getMyPlayerChildrenProfiles()
          if (!isMounted) return

          if (Array.isArray(childrenResponse?.children) && childrenResponse.children.length > 0) {
            setChildren(
              childrenResponse.children.map((child, index) => ({
                firstName: index === 0 ? '' : (child.firstName || ''),
                lastName: index === 0 ? '' : (child.lastName || ''),
                clubName: child.clubName || '',
                personalId: index === 0 ? '' : (child.personalId || ''),
                photo: null,
                existingPhoto: index === 0 ? '' : (child.photo || '')
              }))
            )
          }
        } else {
          const profile = await api.getMyPlayerProfile()
          if (!isMounted) return

          setAdultData((prev) => ({
            ...prev,
            clubName: profile?.clubName || '',
            personalId: profile?.personalId || '',
            existingPhoto: profile?.photo || ''
          }))
        }
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Nepodarilo sa načítať typ registrácie')
      } finally {
        if (isMounted) {
          setInitializing(false)
        }
      }
    }

    loadContext()
    return () => {
      isMounted = false
    }
  }, [navigate])

  const handleAdultInputChange = (e) => {
    const { name, value } = e.target
    setAdultData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const handleAdultFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAdultData(prev => ({
        ...prev,
        photo: file,
        existingPhoto: ''
      }))
    }
  }

  const openAdultPhotoPicker = () => {
    adultPhotoInputRef.current?.click()
  }

  const handleChildInputChange = (index, field, value) => {
    setChildren((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [field]: value
      }
      return next
    })
    setError('')
  }

  const handleChildFileChange = (index, file) => {
    if (!file) return

    setChildren((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        photo: file,
        existingPhoto: ''
      }
      return next
    })
  }

  const openChildPhotoPicker = (index) => {
    childPhotoInputRefs.current[index]?.click()
  }

  const addChild = () => {
    setChildren((prev) => [
      ...prev,
      {
        firstName: '',
        lastName: '',
        clubName: '',
        personalId: '',
        photo: null,
        existingPhoto: ''
      }
    ])
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

      if (!isParentFlow) {
        if (!adultData.clubName.trim()) {
          throw new Error('Pole klub je povinné')
        }

        if (!adultData.personalId.trim()) {
          throw new Error('Rodné číslo je povinné')
        }

        let uploadedPhotoUrl = adultData.existingPhoto || ''
        if (adultData.photo) {
          const uploadResult = await api.uploadImage(adultData.photo, 'player-photos')
          uploadedPhotoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
        }

        await api.completePlayerProfile({
          clubName: adultData.clubName,
          personalId: adultData.personalId,
          photo: uploadedPhotoUrl
        })
      } else {
        const hasInvalidChild = children.some(
          (child) => !child.firstName.trim() || !child.lastName.trim() || !child.clubName.trim() || !child.personalId.trim()
        )

        if (hasInvalidChild) {
          throw new Error('Vyplňte meno, priezvisko, klub a rodné číslo pre každé dieťa')
        }

        const childrenPayload = []

        for (const child of children) {
          let uploadedPhotoUrl = child.existingPhoto || ''

          if (child.photo) {
            const uploadResult = await api.uploadImage(child.photo, 'player-photos')
            uploadedPhotoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
          }

          childrenPayload.push({
            firstName: child.firstName,
            lastName: child.lastName,
            clubName: child.clubName,
            personalId: child.personalId,
            photo: uploadedPhotoUrl
          })
        }

        await api.completePlayerChildrenProfiles(childrenPayload)
      }

      alert('Profil hráča bol úspešne vytvorený!')
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

  if (initializing) {
    return (
      <div className="complete-profile-container">
        <div className="complete-profile-card">
          <div className="complete-profile-header">
            <h2>Podrobnosti o hráčovi</h2>
          </div>
          <form className="complete-profile-form">
            <div className="form-group">
              <input className="form-input" placeholder="Načítavam..." disabled />
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="complete-profile-container">
      <div className="complete-profile-card">
        <div className="complete-profile-header">
          <h2>Podrobnosti o hráčovi</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="complete-profile-form">
          {!isParentFlow && (
            <>
              <div className="form-group">
                <input
                  type="text"
                  name="clubName"
                  value={adultData.clubName}
                  onChange={handleAdultInputChange}
                  placeholder="Názov klubu"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="text"
                  name="personalId"
                  value={adultData.personalId}
                  onChange={handleAdultInputChange}
                  placeholder="Rodné číslo"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group club-upload-row">
                <input
                  type="text"
                  readOnly
                  value={adultData.photo ? adultData.photo.name : (adultData.existingPhoto ? 'Fotka nahraná' : 'Pridať fotku')}
                  className="form-input club-upload-display"
                  onClick={openAdultPhotoPicker}
                />
                <button type="button" className="club-upload-trigger" onClick={openAdultPhotoPicker}>Pridať fotku</button>
                <input
                  ref={adultPhotoInputRef}
                  id="player-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleAdultFileChange}
                  className="club-logo-hidden-input"
                />
              </div>
            </>
          )}

          {isParentFlow && (
            <>
              {children.map((child, index) => (
                <div key={index} className="player-child-section">
                  <div className="form-group">
                    <input
                      type="text"
                      value={child.firstName}
                      onChange={(e) => handleChildInputChange(index, 'firstName', e.target.value)}
                      placeholder="Meno dieťaťa"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      value={child.lastName}
                      onChange={(e) => handleChildInputChange(index, 'lastName', e.target.value)}
                      placeholder="Priezvisko dieťaťa"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      value={child.clubName}
                      onChange={(e) => handleChildInputChange(index, 'clubName', e.target.value)}
                      placeholder="Názov klubu"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      value={child.personalId}
                      onChange={(e) => handleChildInputChange(index, 'personalId', e.target.value)}
                      placeholder="Rodné číslo"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group club-upload-row">
                    <input
                      type="text"
                      readOnly
                      value={child.photo ? child.photo.name : (child.existingPhoto ? 'Fotka nahraná' : 'Pridať fotku')}
                      className="form-input club-upload-display"
                      onClick={() => openChildPhotoPicker(index)}
                    />
                    <button type="button" className="club-upload-trigger" onClick={() => openChildPhotoPicker(index)}>Pridať fotku</button>
                    <input
                      ref={(element) => {
                        if (element) {
                          childPhotoInputRefs.current[index] = element
                        }
                      }}
                      id={`child-photo-${index}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleChildFileChange(index, e.target.files?.[0])}
                      className="club-logo-hidden-input"
                    />
                  </div>

                  {index < children.length - 1 && <div className="player-child-separator" />}
                </div>
              ))}

              <button
                type="button"
                onClick={addChild}
                className="btn-submit btn-add-child"
              >
                pridať dieťa
              </button>
            </>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Ukladám...' : 'Uložiť hráča'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CompleteProfilePlayer
