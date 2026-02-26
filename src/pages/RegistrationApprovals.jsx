import { useState, useEffect } from 'react'
import { api } from '../api'
import './RegistrationApprovals.css'

function RegistrationApprovals() {
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPendingUsers()
  }, [])

  const loadPendingUsers = async () => {
    try {
      const data = await api.getPendingRegistrations()
      setPendingUsers(data.users || [])
    } catch (error) {
      console.error('Chyba načítání čekajících registrací:', error)
      alert('Nepodařilo se načíst čekající registrace')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    if (!confirm('Schváliť túto registráciu?')) return

    try {
      await api.approveRegistration(userId)
      alert('Registrácia schválená!')
      loadPendingUsers()
    } catch (error) {
      console.error('Chyba schvaľovania:', error)
      alert('Nepodarilo sa schváliť registráciu')
    }
  }

  const handleReject = async (userId) => {
    if (!confirm('Zamietnuť túto registráciu? Užívateľ bude vymazaný.')) return

    try {
      await api.rejectRegistration(userId)
      alert('Registrácia zamietnutá')
      loadPendingUsers()
    } catch (error) {
      console.error('Chyba zamietania:', error)
      alert('Nepodarilo sa zamietnuť registráciu')
    }
  }

  const getRoleLabel = (role) => {
    const labels = {
      club: 'Klub',
      coach: 'Trenér',
      player: 'Hráč',
      admin: 'Admin',
      parent: 'Rodič'
    }
    return labels[role] || role
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>Čakajúce registrácie</h2>
        <p>Správa registrácií čakajúcich na schválenie</p>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Žiadne čakajúce registrácie
          </p>
        </div>
      ) : (
        <div className="approvals-list">
          {pendingUsers.map((user) => (
            <div key={user.id} className="approval-card">
              <div className="approval-info">
                <div className="approval-header">
                  <h3>{user.first_name} {user.last_name}</h3>
                  <span className={`role-badge role-${user.role}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </div>
                <p className="approval-detail">
                  <strong>Email:</strong> {user.email}
                </p>
                {user.club_name && (
                  <p className="approval-detail">
                    <strong>Klub:</strong> {user.club_name}
                  </p>
                )}
                <p className="approval-detail">
                  <strong>Dátum registrácie:</strong>{' '}
                  {new Date(user.created_at).toLocaleDateString('sk-SK', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="approval-actions">
                <button 
                  className="btn btn-approve"
                  onClick={() => handleApprove(user.id)}
                >
                  ✓ Schváliť
                </button>
                <button 
                  className="btn btn-reject"
                  onClick={() => handleReject(user.id)}
                >
                  ✕ Zamietnuť
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RegistrationApprovals
