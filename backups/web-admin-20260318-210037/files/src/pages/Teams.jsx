import { useState, useEffect } from 'react'
import { api } from '../api'

function Teams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editName, setEditName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamPlayers, setTeamPlayers] = useState([])
  const [candidatePlayers, setCandidatePlayers] = useState([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [draggedPlayer, setDraggedPlayer] = useState(null)
  const [dragOverZone, setDragOverZone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const data = await api.getTeams()
      setTeams(data.teams)
    } catch (error) {
      console.error('Chyba načítání týmů:', error)
      setError(error.message || 'Nepodarilo sa načítať kategórie')
    } finally {
      setLoading(false)
    }
  }

  const openTeamDetail = async (team) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      setSelectedTeam(team)
      setSelectedCandidateId('')

      const [playersResponse, candidatesResponse] = await Promise.all([
        api.getTeamPlayers(team.id),
        api.getTeamCandidatePlayers(team.id)
      ])

      setTeamPlayers(playersResponse?.players || [])
      setCandidatePlayers(candidatesResponse?.candidates || [])
    } catch (err) {
      setError(err.message || 'Nepodarilo sa načítať detail kategórie')
    } finally {
      setLoading(false)
    }
  }

  const closeTeamDetail = () => {
    setSelectedTeam(null)
    setTeamPlayers([])
    setCandidatePlayers([])
    setSelectedCandidateId('')
    setDraggedPlayer(null)
    setDragOverZone('')
  }

  const refreshTeamDetail = async () => {
    if (!selectedTeam) return
    const [playersResponse, candidatesResponse] = await Promise.all([
      api.getTeamPlayers(selectedTeam.id),
      api.getTeamCandidatePlayers(selectedTeam.id)
    ])

    setTeamPlayers(playersResponse?.players || [])
    setCandidatePlayers(candidatesResponse?.candidates || [])
  }

  const handleAssignPlayer = async () => {
    const userId = Number(selectedCandidateId)
    if (!userId) {
      setError('Vyberte hráča na priradenie')
      return
    }

    await assignPlayerById(userId)
    setSelectedCandidateId('')
  }

  const assignPlayerById = async (userId) => {
    try {
      setAssigning(true)
      setError('')
      setSuccess('')
      await api.assignPlayerToTeam(selectedTeam.id, { userId })
      setSuccess('Hráč bol priradený do kategórie')
      await refreshTeamDetail()
      await loadTeams()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa priradiť hráča')
    } finally {
      setAssigning(false)
    }
  }

  const removePlayerById = async (userId) => {
    try {
      setAssigning(true)
      setError('')
      setSuccess('')
      await api.removePlayerFromTeam(selectedTeam.id, userId)
      setSuccess('Hráč bol odobratý z kategórie')
      await refreshTeamDetail()
      await loadTeams()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odobrať hráča')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemovePlayer = async (userId) => {
    const confirmed = window.confirm('Naozaj chcete odobrať hráča z tejto kategórie?')
    if (!confirmed) return

    await removePlayerById(userId)
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) {
      setError('Názov kategórie je povinný')
      return
    }

    try {
      setCreating(true)
      setError('')
      setSuccess('')
      await api.createTeam({ name, ageGroup: name })
      setNewCategoryName('')
      setSuccess('Kategória bola úspešne vytvorená')
      await loadTeams()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa vytvoriť kategóriu')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (team) => {
    setEditingTeamId(team.id)
    setEditName(team.name || '')
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditingTeamId(null)
    setEditName('')
  }

  const handleSaveEdit = async (teamId) => {
    const name = editName.trim()
    if (!name) {
      setError('Názov kategórie je povinný')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.updateTeam(teamId, { name, ageGroup: name })
      setSuccess('Kategória bola úspešne upravená')
      setEditingTeamId(null)
      setEditName('')
      await loadTeams()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa upraviť kategóriu')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (teamId) => {
    const confirmed = window.confirm('Naozaj chcete zmazať túto kategóriu?')
    if (!confirmed) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteTeam(teamId)
      setSuccess('Kategória bola úspešne zmazaná')
      await loadTeams()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa zmazať kategóriu')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (userId, source) => {
    if (assigning) return
    setDraggedPlayer({ userId, source })
  }

  const handleDropToTeam = async () => {
    if (!draggedPlayer || draggedPlayer.source !== 'available') {
      setDraggedPlayer(null)
      setDragOverZone('')
      return
    }

    await assignPlayerById(draggedPlayer.userId)
    setDraggedPlayer(null)
    setDragOverZone('')
  }

  const handleDropToAvailable = async () => {
    if (!draggedPlayer || draggedPlayer.source !== 'team') {
      setDraggedPlayer(null)
      setDragOverZone('')
      return
    }

    await removePlayerById(draggedPlayer.userId)
    setDraggedPlayer(null)
    setDragOverZone('')
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>Kategórie</h2>
        <p>Správa kategórií</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="actions">
        <input
          style={{ minWidth: '260px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '10px 12px' }}
          placeholder="Názov kategórie"
          value={newCategoryName}
          onChange={(e) => {
            setNewCategoryName(e.target.value)
            setError('')
            setSuccess('')
          }}
        />
        <button className="btn" onClick={handleCreateCategory} disabled={creating}>
          {creating ? 'Vytváram...' : '+ Vytvoriť kategóriu'}
        </button>
      </div>

      <div className="stats-grid">
        {teams.map((team) => (
          <div key={team.id} className="stat-card">
            {editingTeamId === team.id ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}
              />
            ) : (
              <h3>{team.name}</h3>
            )}
            <div className="value">{team.playerCount}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
              Kategorie: {team.ageGroup}
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              {editingTeamId === team.id ? (
                <>
                  <button className="btn" style={{ flex: 1 }} onClick={() => handleSaveEdit(team.id)}>
                    Uložiť
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cancelEdit}>
                    Zrušiť
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openTeamDetail(team)}>
                    Detail
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => startEdit(team)}>
                    Upraviť
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleDelete(team.id)}>
                    Zmazať
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedTeam && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Detail kategórie: {selectedTeam.name}</h3>
            <button className="btn btn-secondary" onClick={closeTeamDetail}>Zavrieť</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <select
              value={selectedCandidateId}
              onChange={(e) => setSelectedCandidateId(e.target.value)}
              style={{ minWidth: '280px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '10px 12px' }}
            >
              <option value="">Vyberte hráča na priradenie</option>
              {candidatePlayers
                .filter((candidate) => !candidate.isInCurrentTeam)
                .map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId}>
                    {candidate.firstName} {candidate.lastName}
                  </option>
                ))}
            </select>
            <button className="btn" onClick={handleAssignPlayer} disabled={assigning}>
              {assigning ? 'Priraďujem...' : 'Priradiť hráča'}
            </button>
          </div>

          {teamPlayers.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>V tejto kategórii zatiaľ nie sú žiadni hráči</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {teamPlayers.map((player) => (
                <div
                  key={player.userId || player.id}
                  draggable={!assigning}
                  onDragStart={() => handleDragStart(player.userId, 'team')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', cursor: assigning ? 'default' : 'grab' }}
                >
                  <div>
                    <strong>{player.firstName} {player.lastName}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{player.email || ''}</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => handleRemovePlayer(player.userId)} disabled={assigning}>
                    Odobrať
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverZone('available')
              }}
              onDragLeave={() => setDragOverZone((zone) => (zone === 'available' ? '' : zone))}
              onDrop={(e) => {
                e.preventDefault()
                handleDropToAvailable()
              }}
              style={{ border: `1px dashed ${dragOverZone === 'available' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', padding: '10px' }}
            >
              <h4 style={{ marginTop: 0 }}>Dostupní hráči (drag & drop)</h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {candidatePlayers.filter((candidate) => !candidate.isInCurrentTeam).map((candidate) => (
                  <div
                    key={candidate.userId}
                    draggable={!assigning}
                    onDragStart={() => handleDragStart(candidate.userId, 'available')}
                    style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', cursor: assigning ? 'default' : 'grab' }}
                  >
                    {candidate.firstName} {candidate.lastName}
                  </div>
                ))}
                {candidatePlayers.filter((candidate) => !candidate.isInCurrentTeam).length === 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Žiadni dostupní hráči</div>
                )}
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverZone('team')
              }}
              onDragLeave={() => setDragOverZone((zone) => (zone === 'team' ? '' : zone))}
              onDrop={(e) => {
                e.preventDefault()
                handleDropToTeam()
              }}
              style={{ border: `1px dashed ${dragOverZone === 'team' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', padding: '10px' }}
            >
              <h4 style={{ marginTop: 0 }}>Hráči v kategórii (drag & drop)</h4>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Presuň sem hráča zo zoznamu dostupných pre priradenie. Presuň hráča späť do ľavého boxu pre odobratie.
              </div>
            </div>
          </div>
        </div>
      )}

      {teams.length === 0 && (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Žiadne kategórie v systéme
          </p>
        </div>
      )}
    </div>
  )
}

export default Teams
