import { useState, useEffect } from 'react'
import { api } from '../api'
import './RegistrationApprovals.css'

function RegistrationApprovals() {
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, userId: '', action: '', fullName: '' })

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

  const openRegistrationConfirm = (userId, action, fullName) => {
    setConfirmDialog({
      open: true,
      userId: String(userId || ''),
      action: String(action || ''),
      fullName: String(fullName || '').trim()
    })
  }

  const closeRegistrationConfirm = () => {
    if (actionInProgress) return
    setConfirmDialog({ open: false, userId: '', action: '', fullName: '' })
  }

  useEffect(() => {
    if (!confirmDialog.open) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !actionInProgress) {
        closeRegistrationConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmDialog.open, actionInProgress])

  const handleApprove = (userId, fullName) => {
    openRegistrationConfirm(userId, 'approve', fullName)
  }

  const handleReject = (userId, fullName) => {
    openRegistrationConfirm(userId, 'reject', fullName)
  }

  const confirmRegistrationAction = async () => {
    if (!confirmDialog.userId || !confirmDialog.action) return

    const userId = confirmDialog.userId
    const action = confirmDialog.action

    try {
      setActionInProgress(true)
      if (action === 'approve') {
        await api.approveRegistration(userId)
        alert('Registrácia schválená!')
      } else {
        await api.rejectRegistration(userId)
        alert('Registrácia zamietnutá')
      }

      setConfirmDialog({ open: false, userId: '', action: '', fullName: '' })
      loadPendingUsers()
    } catch (error) {
      console.error(action === 'approve' ? 'Chyba schvaľovania:' : 'Chyba zamietania:', error)
      alert(action === 'approve' ? 'Nepodarilo sa schváliť registráciu' : 'Nepodarilo sa zamietnuť registráciu')
    } finally {
      setActionInProgress(false)
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
                  onClick={() => handleApprove(user.id, `${user.first_name || ''} ${user.last_name || ''}`)}
                >
                  ✓ Schváliť
                </button>
                <button 
                  className="btn btn-reject"
                  onClick={() => handleReject(user.id, `${user.first_name || ''} ${user.last_name || ''}`)}
                >
                  ✕ Zamietnuť
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDialog.open ? (
        <div
          className="registration-confirm-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Potvrdenie registrácie"
          onClick={closeRegistrationConfirm}
        >
          <div className="registration-confirm-modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{confirmDialog.action === 'approve' ? 'Schváliť registráciu' : 'Zamietnuť registráciu'}</h3>
            <p>
              {confirmDialog.action === 'approve'
                ? `Naozaj chceš schváliť registráciu používateľa „${confirmDialog.fullName || 'používateľ'}“?`
                : `Naozaj chceš zamietnuť registráciu používateľa „${confirmDialog.fullName || 'používateľ'}“? Používateľ bude vymazaný.`}
            </p>

            <div className="registration-confirm-modal-actions">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={closeRegistrationConfirm}
                disabled={actionInProgress}
              >
                Zrušiť
              </button>
              <button
                type="button"
                className={`btn ${confirmDialog.action === 'approve' ? 'btn-approve' : 'btn-reject'}`}
                onClick={confirmRegistrationAction}
                disabled={actionInProgress}
              >
                {actionInProgress
                  ? (confirmDialog.action === 'approve' ? 'Schvaľujem...' : 'Zamietam...')
                  : (confirmDialog.action === 'approve' ? 'Schváliť' : 'Zamietnuť')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default RegistrationApprovals
