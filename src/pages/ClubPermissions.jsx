import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import './ClubPermissions.css'

function ClubPermissions() {
  const [clubId, setClubId] = useState(null)
  const [catalog, setCatalog] = useState({})
  const [members, setMembers] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingByUser, setSavingByUser] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const permissionGroups = useMemo(() => Object.entries(catalog || {}), [catalog])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const myClub = await api.getMyClub()
      const resolvedClubId = myClub?.id

      if (!resolvedClubId) {
        throw new Error('Klub nebol nájdený')
      }

      const [catalogResponse, membersResponse] = await Promise.all([
        api.getPermissionCatalog(),
        api.getClubMembersPermissions(resolvedClubId)
      ])

      setClubId(resolvedClubId)
      setCatalog(catalogResponse?.catalog || {})
      setMembers(membersResponse?.members || [])

      const initialDrafts = {}
      for (const member of membersResponse?.members || []) {
        initialDrafts[member.userId] = {
          customTitle: member.customTitle || '',
          permissions: [...(member.delegatedPermissions || [])]
        }
      }
      setDrafts(initialDrafts)
    } catch (err) {
      setError(err.message || 'Nepodarilo sa načítať oprávnenia klubu')
    } finally {
      setLoading(false)
    }
  }

  const updateDraftTitle = (userId, value) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        customTitle: value,
        permissions: [...(prev[userId]?.permissions || [])]
      }
    }))
  }

  const togglePermission = (userId, permission) => {
    setDrafts((prev) => {
      const current = prev[userId] || { customTitle: '', permissions: [] }
      const hasPermission = current.permissions.includes(permission)
      const nextPermissions = hasPermission
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]

      return {
        ...prev,
        [userId]: {
          ...current,
          permissions: nextPermissions
        }
      }
    })
  }

  const saveMember = async (userId) => {
    if (!clubId) return

    try {
      setSavingByUser((prev) => ({ ...prev, [userId]: true }))
      setError('')
      setSuccess('')

      const memberDraft = drafts[userId] || { customTitle: '', permissions: [] }
      await api.updateClubMemberPermissions(clubId, userId, {
        customTitle: memberDraft.customTitle,
        permissions: memberDraft.permissions
      })

      setMembers((prev) => prev.map((member) => {
        if (member.userId !== userId) return member
        return {
          ...member,
          customTitle: memberDraft.customTitle,
          delegatedPermissions: [...memberDraft.permissions]
        }
      }))

      setSuccess('Oprávnenia člena boli uložené')
    } catch (err) {
      setError(err.message || 'Nepodarilo sa uložiť oprávnenia člena')
    } finally {
      setSavingByUser((prev) => ({ ...prev, [userId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="club-permissions-container">
        <div className="page-header">
          <h2>Oprávnenia klubu</h2>
          <p>Načítavam oprávnenia členov...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="club-permissions-container">
      <div className="page-header">
        <h2>Oprávnenia klubu</h2>
        <p>Delegovanie práv pre členov klubu</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="permissions-members-list">
        {members.map((member) => {
          const draft = drafts[member.userId] || { customTitle: '', permissions: [] }
          const isSaving = Boolean(savingByUser[member.userId])

          return (
            <div className="permissions-member-card" key={member.userId}>
              <div className="permissions-member-header">
                <div>
                  <h3>{member.firstName} {member.lastName}</h3>
                  <p>{member.email}</p>
                  <span className="permissions-role-badge">Rola: {member.role}</span>
                </div>
              </div>

              <div className="permissions-title-row">
                <label>Vlastný titul v klube</label>
                <input
                  type="text"
                  value={draft.customTitle}
                  onChange={(e) => updateDraftTitle(member.userId, e.target.value)}
                  placeholder="napr. ekonomka, riaditeľ klubu"
                />
              </div>

              <div className="permissions-grid">
                {permissionGroups.map(([groupName, groupPermissions]) => (
                  <div className="permissions-group" key={groupName}>
                    <h4>{groupName}</h4>
                    {groupPermissions.map((permission) => (
                      <label key={`${member.userId}-${permission}`} className="permission-checkbox">
                        <input
                          type="checkbox"
                          checked={draft.permissions.includes(permission)}
                          onChange={() => togglePermission(member.userId, permission)}
                        />
                        <span>{permission}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>

              <div className="permissions-member-actions">
                <button
                  className="btn"
                  onClick={() => saveMember(member.userId)}
                  disabled={isSaving}
                  type="button"
                >
                  {isSaving ? 'Ukladám...' : 'Uložiť člena'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ClubPermissions
