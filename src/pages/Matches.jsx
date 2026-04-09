import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const MATCH_CATEGORY_INDICATORS_STORAGE_KEY = 'matchesCategoryIndicators'
const MATCH_RECORDINGS_STORAGE_KEY = 'matchesRecordings'
const MATCH_PAIRINGS_STORAGE_KEY = 'matchesPairings'

const DEFAULT_INDICATORS = {
  result: true,
  scorers: true,
  yellowCards: false,
  redCards: false
}

const normalizeIndicators = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    result: source.result !== false,
    scorers: source.scorers !== false,
    yellowCards: Boolean(source.yellowCards),
    redCards: Boolean(source.redCards)
  }
}

const readLocalObject = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeLocalObject = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value && typeof value === 'object' ? value : {}))
  } catch {
    return
  }
}

const getCategoryKey = (match) => String(match?.team?.ageGroup || 'default').trim() || 'default'

function Matches() {
  const [matches, setMatches] = useState([])
  const [clubs, setClubs] = useState([])
  const [myClubName, setMyClubName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categoryIndicators, setCategoryIndicators] = useState({ default: { ...DEFAULT_INDICATORS } })
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('default')
  const [matchRecordings, setMatchRecordings] = useState({})
  const [matchPairings, setMatchPairings] = useState({})
  const [openedMatch, setOpenedMatch] = useState(null)
  const [matchDraft, setMatchDraft] = useState({
    homeScore: '',
    awayScore: '',
    scorerName: '',
    scorerMinute: '',
    cardName: '',
    cardMinute: '',
    cardType: 'yellow',
    pairingClubId: ''
  })

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    const localIndicators = readLocalObject(MATCH_CATEGORY_INDICATORS_STORAGE_KEY)
    const localRecordings = readLocalObject(MATCH_RECORDINGS_STORAGE_KEY)
    const localPairings = readLocalObject(MATCH_PAIRINGS_STORAGE_KEY)

    try {
      setLoading(true)
      setError('')
      const [matchesData, myClubData, clubsData, categorySettingsResponse] = await Promise.all([
        api.getMatches(),
        api.getMyClub().catch(() => ({})),
        api.getClubs().catch(() => ({ clubs: [] })),
        api.getMatchCategoryIndicators().catch(() => ({ settings: [] }))
      ])

      const fetchedMatches = Array.isArray(matchesData?.matches) ? matchesData.matches : []
      setMatches(fetchedMatches)
      setClubs(Array.isArray(clubsData?.clubs) ? clubsData.clubs : [])
      setMyClubName(String(myClubData?.name || '').trim())

      const evidences = await Promise.all(
        fetchedMatches.map((match) => api.getMatchEvidence(match.id).catch(() => null))
      )

      const evidenceMap = {}
      const pairingMap = {}

      evidences.forEach((item) => {
        if (!item || !item.matchId) return
        const key = String(item.matchId)
        evidenceMap[key] = {
          homeScore: item?.evidence?.homeScore ?? '',
          awayScore: item?.evidence?.awayScore ?? '',
          scorers: Array.isArray(item?.evidence?.scorers) ? item.evidence.scorers : [],
          cards: Array.isArray(item?.evidence?.cards) ? item.evidence.cards : []
        }

        if (item?.pairing && typeof item.pairing === 'object') {
          pairingMap[key] = {
            pairedClubId: String(item.pairing.pairedClubId || ''),
            pairedClubName: String(item.pairing.pairedClubName || '').trim()
          }
        }
      })

      const apiCategorySettings = Array.isArray(categorySettingsResponse?.settings)
        ? categorySettingsResponse.settings
        : []
      const normalizedIndicatorsFromApi = apiCategorySettings.reduce((acc, row) => {
        const categoryKey = String(row?.categoryKey || '').trim()
        if (!categoryKey) return acc
        if (!acc[categoryKey]) {
          acc[categoryKey] = normalizeIndicators(row?.indicators)
        }
        return acc
      }, {})

      const serverIndicatorsRaw = Object.keys(normalizedIndicatorsFromApi).length > 0
        ? normalizedIndicatorsFromApi
        : (myClubData?.matchesCategoryIndicators && typeof myClubData.matchesCategoryIndicators === 'object'
          ? myClubData.matchesCategoryIndicators
          : localIndicators)
      const normalizedIndicators = Object.entries(serverIndicatorsRaw).reduce((acc, [categoryKey, indicators]) => {
        const key = String(categoryKey || '').trim()
        if (!key) return acc
        acc[key] = normalizeIndicators(indicators)
        return acc
      }, {})

      setCategoryIndicators({
        default: { ...DEFAULT_INDICATORS },
        ...normalizedIndicators
      })

      const serverRecordings = Object.keys(evidenceMap).length > 0
        ? evidenceMap
        : (myClubData?.matchesRecordings && typeof myClubData.matchesRecordings === 'object'
          ? myClubData.matchesRecordings
          : localRecordings)
      setMatchRecordings(serverRecordings)

      const serverPairings = Object.keys(pairingMap).length > 0
        ? pairingMap
        : (myClubData?.matchesPairings && typeof myClubData.matchesPairings === 'object'
          ? myClubData.matchesPairings
          : localPairings)
      setMatchPairings(serverPairings)
    } catch (loadError) {
      console.error('Chyba načítania zápasov:', loadError)
      setError('Nepodarilo sa načítať zápasy. Skúste to znova.')
      setCategoryIndicators({ default: { ...DEFAULT_INDICATORS }, ...localIndicators })
      setMatchRecordings(localRecordings)
      setMatchPairings(localPairings)
    } finally {
      setLoading(false)
    }
  }

  const categoryKeys = useMemo(() => {
    const fromMatches = matches.map(getCategoryKey)
    const fromSettings = Object.keys(categoryIndicators || {})
    return Array.from(new Set(['default', ...fromMatches, ...fromSettings]))
  }, [matches, categoryIndicators])

  useEffect(() => {
    if (!categoryKeys.includes(selectedCategoryKey)) {
      setSelectedCategoryKey('default')
    }
  }, [categoryKeys, selectedCategoryKey])

  const getIndicatorsForCategory = (categoryKey) => {
    const resolvedKey = String(categoryKey || 'default').trim() || 'default'
    return normalizeIndicators(categoryIndicators?.[resolvedKey] || categoryIndicators?.default || DEFAULT_INDICATORS)
  }

  const getIndicatorsForMatch = (match) => getIndicatorsForCategory(getCategoryKey(match))

  const getRecordingForMatch = (matchId) => {
    const key = String(matchId || '').trim()
    const source = key ? matchRecordings?.[key] : null
    return source && typeof source === 'object'
      ? source
      : { homeScore: '', awayScore: '', scorers: [], cards: [] }
  }

  const getMatchResult = (match) => {
    const recording = getRecordingForMatch(match?.id)
    if (recording.homeScore !== '' && recording.awayScore !== '') {
      return `${recording.homeScore}:${recording.awayScore}`
    }
    return String(match?.result || '').trim()
  }

  const getScorersSummary = (match) => {
    const recording = getRecordingForMatch(match?.id)
    const scorers = Array.isArray(recording?.scorers) ? recording.scorers : []
    if (scorers.length === 0) return '-'
    return scorers.map((item) => `${item.name}${item.minute ? ` (${item.minute}')` : ''}`).join(', ')
  }

  const getCardsSummary = (match) => {
    const recording = getRecordingForMatch(match?.id)
    const cards = Array.isArray(recording?.cards) ? recording.cards : []
    if (cards.length === 0) return '-'

    const yellow = cards.filter((item) => item.type === 'yellow').length
    const red = cards.filter((item) => item.type === 'red').length
    return `Ž ${yellow} | Č ${red}`
  }

  const getPairingLabel = (match) => {
    const pairing = matchPairings?.[String(match?.id || '')]
    if (!pairing || typeof pairing !== 'object') return 'Bez párovania'
    return String(pairing.pairedClubName || '').trim() || 'Bez párovania'
  }

  const updateCategoryIndicators = (indicatorKey, checked) => {
    setCategoryIndicators((prev) => {
      const next = {
        ...(prev && typeof prev === 'object' ? prev : {}),
        [selectedCategoryKey]: {
          ...getIndicatorsForCategory(selectedCategoryKey),
          [indicatorKey]: Boolean(checked)
        }
      }
      writeLocalObject(MATCH_CATEGORY_INDICATORS_STORAGE_KEY, next)
      return next
    })
  }

  const openMatchDetail = (match) => {
    const recording = getRecordingForMatch(match?.id)
    const pairing = matchPairings?.[String(match?.id || '')] || {}
    setOpenedMatch(match)
    setMatchDraft({
      homeScore: recording.homeScore ?? '',
      awayScore: recording.awayScore ?? '',
      scorerName: '',
      scorerMinute: '',
      cardName: '',
      cardMinute: '',
      cardType: 'yellow',
      pairingClubId: String(pairing?.pairedClubId || '')
    })
  }

  const closeMatchDetail = () => {
    setOpenedMatch(null)
    setMatchDraft({
      homeScore: '',
      awayScore: '',
      scorerName: '',
      scorerMinute: '',
      cardName: '',
      cardMinute: '',
      cardType: 'yellow',
      pairingClubId: ''
    })
  }

  const addScorerToDraft = () => {
    if (!openedMatch?.id) return
    const resolvedName = String(matchDraft.scorerName || '').trim()
    if (!resolvedName) return
    const resolvedMinute = String(matchDraft.scorerMinute || '').trim()

    setMatchRecordings((prev) => {
      const key = String(openedMatch.id)
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], cards: [] }
      const next = {
        ...source,
        [key]: {
          ...current,
          scorers: [
            ...(Array.isArray(current.scorers) ? current.scorers : []),
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: resolvedName, minute: resolvedMinute }
          ]
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })

    setMatchDraft((prev) => ({ ...prev, scorerName: '', scorerMinute: '' }))
  }

  const addCardToDraft = () => {
    if (!openedMatch?.id) return
    const resolvedName = String(matchDraft.cardName || '').trim()
    if (!resolvedName) return
    const resolvedMinute = String(matchDraft.cardMinute || '').trim()
    const resolvedType = String(matchDraft.cardType || 'yellow') === 'red' ? 'red' : 'yellow'

    setMatchRecordings((prev) => {
      const key = String(openedMatch.id)
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], cards: [] }
      const next = {
        ...source,
        [key]: {
          ...current,
          cards: [
            ...(Array.isArray(current.cards) ? current.cards : []),
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: resolvedName, minute: resolvedMinute, type: resolvedType }
          ]
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })

    setMatchDraft((prev) => ({ ...prev, cardName: '', cardMinute: '', cardType: 'yellow' }))
  }

  const removeScorer = (matchId, scorerId) => {
    setMatchRecordings((prev) => {
      const key = String(matchId || '')
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], cards: [] }
      const next = {
        ...source,
        [key]: {
          ...current,
          scorers: (Array.isArray(current.scorers) ? current.scorers : []).filter((item) => String(item?.id || '') !== String(scorerId || ''))
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })
  }

  const removeCard = (matchId, cardId) => {
    setMatchRecordings((prev) => {
      const key = String(matchId || '')
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], cards: [] }
      const next = {
        ...source,
        [key]: {
          ...current,
          cards: (Array.isArray(current.cards) ? current.cards : []).filter((item) => String(item?.id || '') !== String(cardId || ''))
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })
  }

  const saveMatchEnhancements = async () => {
    if (!openedMatch?.id) return

    const matchIdKey = String(openedMatch.id)
    const nextRecordings = {
      ...(matchRecordings && typeof matchRecordings === 'object' ? matchRecordings : {}),
      [matchIdKey]: {
        ...getRecordingForMatch(openedMatch.id),
        homeScore: String(matchDraft.homeScore || '').trim(),
        awayScore: String(matchDraft.awayScore || '').trim()
      }
    }

    const selectedPairingClubId = String(matchDraft.pairingClubId || '').trim()
    const selectedPairingClub = clubs.find((club) => String(club?.id || '') === selectedPairingClubId)
    const nextPairings = {
      ...(matchPairings && typeof matchPairings === 'object' ? matchPairings : {})
    }

    if (selectedPairingClubId) {
      nextPairings[matchIdKey] = {
        pairedClubId: selectedPairingClubId,
        pairedClubName: String(selectedPairingClub?.name || '').trim()
      }
    } else {
      delete nextPairings[matchIdKey]
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, nextRecordings)
      writeLocalObject(MATCH_PAIRINGS_STORAGE_KEY, nextPairings)

      setMatchRecordings(nextRecordings)
      setMatchPairings(nextPairings)

      await api.updateMatchEvidence(openedMatch.id, {
        homeScore: nextRecordings[matchIdKey]?.homeScore,
        awayScore: nextRecordings[matchIdKey]?.awayScore,
        scorers: Array.isArray(nextRecordings[matchIdKey]?.scorers) ? nextRecordings[matchIdKey].scorers : [],
        cards: Array.isArray(nextRecordings[matchIdKey]?.cards) ? nextRecordings[matchIdKey].cards : [],
        pairedClubId: selectedPairingClubId || null
      })

      setSuccess('Zápasové údaje boli uložené.')
      closeMatchDetail()
    } catch (saveError) {
      console.error('Chyba pri ukladaní zápasu:', saveError)
      setError('Zápasové údaje sa nepodarilo uložiť na server. Lokálna verzia ostala zachovaná.')
      closeMatchDetail()
    } finally {
      setSaving(false)
    }
  }

  const saveCategorySettings = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      writeLocalObject(MATCH_CATEGORY_INDICATORS_STORAGE_KEY, categoryIndicators)

      const targetTeamIds = Array.from(new Set(
        matches
          .filter((match) => {
            if (selectedCategoryKey === 'default') return true
            return getCategoryKey(match) === selectedCategoryKey
          })
          .map((match) => Number(match?.team?.id || 0))
          .filter((teamId) => Number.isInteger(teamId) && teamId > 0)
      ))

      if (!targetTeamIds.length) {
        setError('Pre zvolenú kategóriu sa nenašiel žiadny tím.')
        setSaving(false)
        return
      }

      await Promise.all(
        targetTeamIds.map((teamId) => api.updateMatchCategoryIndicators({
          teamId,
          categoryKey: selectedCategoryKey,
          indicators: getIndicatorsForCategory(selectedCategoryKey)
        }))
      )

      setSuccess('Nastavenie ukazovateľov podľa kategórií bolo uložené.')
    } catch (saveError) {
      console.error('Chyba pri ukladaní nastavení zápasov:', saveError)
      setError('Nastavenie sa nepodarilo uložiť na server. Lokálna verzia ostala zachovaná.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Načítanie...</div>
  }

  const selectedCategoryIndicators = getIndicatorsForCategory(selectedCategoryKey)
  const openedIndicators = openedMatch ? getIndicatorsForMatch(openedMatch) : DEFAULT_INDICATORS
  const openedRecording = openedMatch ? getRecordingForMatch(openedMatch.id) : { scorers: [], cards: [] }

  return (
    <div>
      <div className="page-header">
        <h2>Zápasy</h2>
        <p>Evidencia výsledkov, strelcov, kariet a párovania súpera</p>
      </div>

      {error ? <div className="error-message">{error}</div> : null}
      {success ? <div className="success-message">{success}</div> : null}

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Nastavenie ukazovateľov podľa kategórie</h3>
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'minmax(180px, 240px) repeat(4, minmax(120px, 1fr)) auto', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="match-category-settings">Kategória</label>
            <select
              id="match-category-settings"
              value={selectedCategoryKey}
              onChange={(event) => setSelectedCategoryKey(String(event.target.value || 'default'))}
            >
              {categoryKeys.map((key) => (
                <option key={`match-category-settings-${key}`} value={key}>
                  {key === 'default' ? 'Predvolené' : key}
                </option>
              ))}
            </select>
          </div>

          <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={selectedCategoryIndicators.result}
              onChange={(event) => updateCategoryIndicators('result', event.target.checked)}
            />
            <span>Výsledok</span>
          </label>

          <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={selectedCategoryIndicators.scorers}
              onChange={(event) => updateCategoryIndicators('scorers', event.target.checked)}
            />
            <span>Strelci</span>
          </label>

          <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={selectedCategoryIndicators.yellowCards}
              onChange={(event) => updateCategoryIndicators('yellowCards', event.target.checked)}
            />
            <span>Žlté karty</span>
          </label>

          <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={selectedCategoryIndicators.redCards}
              onChange={(event) => updateCategoryIndicators('redCards', event.target.checked)}
            />
            <span>Červené karty</span>
          </label>

          <button type="button" className="btn" onClick={saveCategorySettings} disabled={saving}>
            {saving ? 'Ukladám...' : 'Uložiť'}
          </button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Dátum</th>
              <th>Súper</th>
              <th>Kategória</th>
              <th>Výsledok</th>
              <th>Strelci</th>
              <th>Karty</th>
              <th>Párovanie</th>
              <th>Stav</th>
              <th>Akcie</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Žiadne zápasy
                </td>
              </tr>
            ) : (
              matches.map((match) => {
                const indicators = getIndicatorsForMatch(match)
                return (
                  <tr key={match.id}>
                    <td>{match.matchDate ? new Date(match.matchDate).toLocaleDateString('sk-SK') : '-'}</td>
                    <td>
                      <strong>{myClubName || 'Môj klub'} vs {match.opponent}</strong>
                    </td>
                    <td>{getCategoryKey(match)}</td>
                    <td>
                      {indicators.result ? (
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent)' }}>
                          {getMatchResult(match) || '-'}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{indicators.scorers ? getScorersSummary(match) : '-'}</td>
                    <td>{(indicators.yellowCards || indicators.redCards) ? getCardsSummary(match) : '-'}</td>
                    <td>{getPairingLabel(match)}</td>
                    <td>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: match.status === 'finished' ? 'var(--success)' : 'var(--accent)',
                        color: match.status === 'finished' ? '#fff' : '#000'
                      }}>
                        {match.status === 'finished' ? 'Ukončený' : 'Plánovaný'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => openMatchDetail(match)}>
                        Evidencia
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {openedMatch ? (
        <div className="confirm-modal-overlay" onClick={closeMatchDetail} role="dialog" aria-modal="true" aria-label="Evidencia zápasu">
          <div className="confirm-modal-card" style={{ width: 'min(980px, 96vw)', maxHeight: '88vh', overflow: 'auto' }} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>
              Evidencia zápasu: {(myClubName || 'Môj klub')} vs {openedMatch.opponent}
            </h3>

            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Domáce góly</label>
                <input
                  type="number"
                  min="0"
                  value={matchDraft.homeScore}
                  onChange={(event) => setMatchDraft((prev) => ({ ...prev, homeScore: event.target.value }))}
                  disabled={!openedIndicators.result}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Hosťujúce góly</label>
                <input
                  type="number"
                  min="0"
                  value={matchDraft.awayScore}
                  onChange={(event) => setMatchDraft((prev) => ({ ...prev, awayScore: event.target.value }))}
                  disabled={!openedIndicators.result}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Sparovaný klub v systéme</label>
                <select
                  value={matchDraft.pairingClubId}
                  onChange={(event) => setMatchDraft((prev) => ({ ...prev, pairingClubId: event.target.value }))}
                >
                  <option value="">Bez párovania</option>
                  {clubs.map((club) => (
                    <option key={`pair-club-${club.id}`} value={String(club.id)}>{club.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {openedIndicators.scorers ? (
              <div className="card" style={{ marginBottom: '10px' }}>
                <h4 style={{ marginTop: 0 }}>Strelci (náš tím)</h4>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr) 120px auto', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Meno hráča"
                    value={matchDraft.scorerName}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, scorerName: event.target.value }))}
                  />
                  <input
                    type="number"
                    min="1"
                    max="130"
                    placeholder="Minúta"
                    value={matchDraft.scorerMinute}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, scorerMinute: event.target.value }))}
                  />
                  <button type="button" className="btn btn-secondary" onClick={addScorerToDraft}>Pridať strelca</button>
                </div>

                {(openedRecording.scorers || []).length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Zatiaľ bez strelcov.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {openedRecording.scorers.map((item) => (
                      <li key={`scorer-${item.id}`} style={{ marginBottom: '4px' }}>
                        {item.name} {item.minute ? `(${item.minute}')` : ''}
                        <button type="button" className="btn btn-secondary" style={{ marginLeft: '8px', padding: '2px 8px' }} onClick={() => removeScorer(openedMatch.id, item.id)}>Odstrániť</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {(openedIndicators.yellowCards || openedIndicators.redCards) ? (
              <div className="card" style={{ marginBottom: '10px' }}>
                <h4 style={{ marginTop: 0 }}>Karty (náš tím)</h4>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr) 120px 140px auto', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Meno hráča"
                    value={matchDraft.cardName}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, cardName: event.target.value }))}
                  />
                  <input
                    type="number"
                    min="1"
                    max="130"
                    placeholder="Minúta"
                    value={matchDraft.cardMinute}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, cardMinute: event.target.value }))}
                  />
                  <select
                    value={matchDraft.cardType}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, cardType: event.target.value === 'red' ? 'red' : 'yellow' }))}
                  >
                    {openedIndicators.yellowCards ? <option value="yellow">Žltá karta</option> : null}
                    {openedIndicators.redCards ? <option value="red">Červená karta</option> : null}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={addCardToDraft}>Pridať kartu</button>
                </div>

                {(openedRecording.cards || []).length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Zatiaľ bez kariet.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {openedRecording.cards.map((item) => (
                      <li key={`card-${item.id}`} style={{ marginBottom: '4px' }}>
                        {item.type === 'red' ? 'Červená' : 'Žltá'}: {item.name} {item.minute ? `(${item.minute}')` : ''}
                        <button type="button" className="btn btn-secondary" style={{ marginLeft: '8px', padding: '2px 8px' }} onClick={() => removeCard(openedMatch.id, item.id)}>Odstrániť</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="confirm-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeMatchDetail} disabled={saving}>Zavrieť</button>
              <button type="button" className="manager-add-btn" onClick={saveMatchEnhancements} disabled={saving}>
                {saving ? 'Ukladám...' : 'Uložiť evidenciu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Matches
