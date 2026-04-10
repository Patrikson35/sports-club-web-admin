import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import './Matches.css'

const MATCH_CATEGORY_INDICATORS_STORAGE_KEY = 'matchesCategoryIndicators'
const MATCH_RECORDINGS_STORAGE_KEY = 'matchesRecordings'
const MATCH_PAIRINGS_STORAGE_KEY = 'matchesPairings'

const DEFAULT_INDICATORS = {
  result: true,
  scorers: true,
  assists: false,
  yellowCards: false,
  redCards: false
}

const CREATE_MATCH_INITIAL_DRAFT = {
  teamId: '',
  opponent: '',
  matchDate: '',
  matchTime: '',
  location: '',
  matchType: 'liga',
  status: 'scheduled',
  homeScore: '',
  awayScore: '',
  notes: ''
}

const normalizeIndicators = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    result: source.result !== false,
    scorers: source.scorers !== false,
    assists: Boolean(source.assists),
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

const formatMatchTypeShort = (value) => {
  const source = String(value || '').trim().toLowerCase()
  if (!source) return 'MZ'
  if (source.includes('poh') || source.includes('cup')) return 'CUP'
  if (source.includes('priat') || source.includes('friend') || source === 'pz') return 'PZ'
  if (source.includes('liga') || source.includes('majstr') || source === 'mz') return 'MZ'
  return String(value || '').trim().slice(0, 4).toUpperCase() || 'MZ'
}

const toDateKey = (input) => {
  if (!input) return ''
  const value = new Date(input)
  if (Number.isNaN(value.getTime())) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCalendarCells = (baseDate) => {
  const year = baseDate.getFullYear()
  const monthIndex = baseDate.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const dayOffset = (firstDay.getDay() + 6) % 7
  const cells = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - dayOffset + 1
    const date = new Date(year, monthIndex, dayNumber)
    cells.push({
      id: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      date,
      dateKey: toDateKey(date),
      dayLabel: date.getDate(),
      inCurrentMonth: dayNumber >= 1 && dayNumber <= daysInMonth,
      isToday: toDateKey(date) === toDateKey(new Date())
    })
  }

  return cells
}

function Matches() {
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [myClubName, setMyClubName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categoryIndicators, setCategoryIndicators] = useState({ default: { ...DEFAULT_INDICATORS } })
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [createDraft, setCreateDraft] = useState({ ...CREATE_MATCH_INITIAL_DRAFT })
  const [createIndicators, setCreateIndicators] = useState({ ...DEFAULT_INDICATORS })
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
  const [matchPendingDelete, setMatchPendingDelete] = useState(null)
  const [matchRecordings, setMatchRecordings] = useState({})
  const [matchPairings, setMatchPairings] = useState({})
  const [openedMatch, setOpenedMatch] = useState(null)
  const [matchDraft, setMatchDraft] = useState({
    homeScore: '',
    awayScore: '',
    scorerName: '',
    scorerMinute: '',
    assistName: '',
    assistMinute: '',
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
      const [matchesData, teamsData, playersData, myClubData, clubsData, categorySettingsResponse] = await Promise.all([
        api.getMatches(),
        api.getTeams().catch(() => ({ teams: [] })),
        api.getPlayers().catch(() => ({ players: [] })),
        api.getMyClub().catch(() => ({})),
        api.getClubs().catch(() => ({ clubs: [] })),
        api.getMatchCategoryIndicators().catch(() => ({ settings: [] }))
      ])

      const fetchedMatches = Array.isArray(matchesData?.matches) ? matchesData.matches : []
      const fetchedTeams = Array.isArray(teamsData?.teams) ? teamsData.teams : []
      const fetchedPlayers = Array.isArray(playersData?.players) ? playersData.players : []
      setMatches(fetchedMatches)
      setTeams(fetchedTeams)
      setPlayers(fetchedPlayers)
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
          assists: Array.isArray(item?.evidence?.assists) ? item.evidence.assists : [],
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
    const fromTeams = teams.map((team) => String(team?.ageGroup || '').trim()).filter(Boolean)
    return Array.from(new Set(['default', ...fromMatches, ...fromSettings, ...fromTeams]))
  }, [matches, categoryIndicators, teams])

  useEffect(() => {
    if (selectedCategoryKey !== 'all' && !categoryKeys.includes(selectedCategoryKey)) {
      setSelectedCategoryKey('all')
    }
  }, [categoryKeys, selectedCategoryKey])

  const filteredMatches = useMemo(() => {
    if (selectedCategoryKey === 'all') return matches
    return matches.filter((match) => getCategoryKey(match) === selectedCategoryKey)
  }, [matches, selectedCategoryKey])

  const matchesStats = useMemo(() => {
    const source = Array.isArray(filteredMatches) ? filteredMatches : []
    let wins = 0
    let draws = 0
    let losses = 0
    let goalsFor = 0
    let goalsAgainst = 0
    let decidedMatches = 0

    source.forEach((match) => {
      const resultRaw = String(getMatchResult(match) || '').trim()
      const parts = resultRaw.split(':').map((value) => Number(value))
      if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return

      const home = parts[0]
      const away = parts[1]
      goalsFor += home
      goalsAgainst += away
      decidedMatches += 1

      if (home > away) wins += 1
      else if (home === away) draws += 1
      else losses += 1
    })

    const points = (wins * 3) + draws
    const maxPoints = decidedMatches * 3
    const successRate = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0

    return {
      total: source.length,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      successRate
    }
  }, [filteredMatches])

  const orderedCategoryKeys = useMemo(() => {
    const source = Array.isArray(categoryKeys) ? categoryKeys : []
    const availableKeys = new Set(source.filter((key) => key && key !== 'default'))
    const picked = new Set()

    const sortedTeamKeys = [...teams]
      .sort((left, right) => {
        const leftOrder = Number(left?.sortOrder || 0)
        const rightOrder = Number(right?.sortOrder || 0)
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return Number(left?.id || 0) - Number(right?.id || 0)
      })
      .map((team) => String(team?.ageGroup || '').trim())
      .filter((key) => key && availableKeys.has(key) && !picked.has(key))

    sortedTeamKeys.forEach((key) => picked.add(key))

    const remainingKeys = [...availableKeys]
      .filter((key) => !picked.has(key))
      .sort((left, right) => left.localeCompare(right, 'sk', { sensitivity: 'base' }))

    return [...sortedTeamKeys, ...remainingKeys]
  }, [categoryKeys, teams])

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
      : { homeScore: '', awayScore: '', scorers: [], assists: [], cards: [] }
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

  const getAssistsSummary = (match) => {
    const recording = getRecordingForMatch(match?.id)
    const assists = Array.isArray(recording?.assists) ? recording.assists : []
    if (assists.length === 0) return '-'
    return assists.map((item) => `${item.name}${item.minute ? ` (${item.minute}')` : ''}`).join(', ')
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

  const openCreateMatchModal = () => {
    const defaultTeam = teams[0] || null
    const resolvedTeamId = defaultTeam ? String(defaultTeam.id) : ''
    const resolvedCategory = String(defaultTeam?.ageGroup || 'default').trim() || 'default'

    setCreateDraft({
      ...CREATE_MATCH_INITIAL_DRAFT,
      teamId: resolvedTeamId,
      matchDate: new Date().toISOString().slice(0, 10)
    })
    setCreateIndicators(getIndicatorsForCategory(resolvedCategory))
    setSelectedPlayerIds([])
    setShowCreateModal(true)
  }

  const closeCreateMatchModal = () => {
    setShowCreateModal(false)
    setCreateDraft({ ...CREATE_MATCH_INITIAL_DRAFT })
    setCreateIndicators({ ...DEFAULT_INDICATORS })
    setSelectedPlayerIds([])
  }

  const selectedCreateTeam = useMemo(
    () => teams.find((team) => String(team?.id || '') === String(createDraft.teamId || '')) || null,
    [teams, createDraft.teamId]
  )

  const createCategoryKey = String(selectedCreateTeam?.ageGroup || 'default').trim() || 'default'

  const availablePlayersForCreate = useMemo(() => {
    const selectedTeamId = String(createDraft.teamId || '')
    if (!selectedTeamId) return []
    return players.filter((player) => String(player?.team?.id || '') === selectedTeamId)
  }, [players, createDraft.teamId])

  const toggleCreatePlayer = (userId) => {
    const resolvedId = String(userId || '').trim()
    if (!resolvedId) return
    setSelectedPlayerIds((prev) => {
      const has = prev.includes(resolvedId)
      return has ? prev.filter((item) => item !== resolvedId) : [...prev, resolvedId]
    })
  }

  const handleCreateTeamChange = (teamId) => {
    const resolvedTeam = teams.find((team) => String(team?.id || '') === String(teamId || '')) || null
    const resolvedCategory = String(resolvedTeam?.ageGroup || 'default').trim() || 'default'
    setCreateDraft((prev) => ({ ...prev, teamId: String(teamId || '') }))
    setCreateIndicators(getIndicatorsForCategory(resolvedCategory))
    setSelectedPlayerIds([])
  }

  const submitCreateMatch = async () => {
    const payloadTeamId = Number(createDraft.teamId || 0)
    const payloadOpponent = String(createDraft.opponent || '').trim()
    const payloadMatchDate = String(createDraft.matchDate || '').trim()

    if (!payloadTeamId || !payloadOpponent || !payloadMatchDate) {
      setError('Vyplňte kategóriu, súpera a dátum zápasu.')
      return
    }

    setCreating(true)
    setError('')
    setSuccess('')

    try {
      const response = await api.createMatch({
        teamId: payloadTeamId,
        categoryKey: createCategoryKey,
        opponent: payloadOpponent,
        matchDate: payloadMatchDate,
        matchTime: String(createDraft.matchTime || '').trim() || null,
        location: String(createDraft.location || '').trim() || null,
        matchType: String(createDraft.matchType || '').trim() || null,
        status: String(createDraft.status || 'scheduled').trim() || 'scheduled',
        notes: String(createDraft.notes || '').trim() || null,
        indicators: createIndicators,
        selectedPlayers: selectedPlayerIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
        homeScore: createIndicators.result ? createDraft.homeScore : null,
        awayScore: createIndicators.result ? createDraft.awayScore : null,
        scorers: [],
        assists: [],
        cards: []
      })

      const createdMatch = response?.match
      if (createdMatch && typeof createdMatch === 'object') {
        setMatches((prev) => [createdMatch, ...(Array.isArray(prev) ? prev : [])])
      } else {
        await loadMatches()
      }

      setSuccess('Zápas bol úspešne pridaný.')
      closeCreateMatchModal()
    } catch (createError) {
      console.error('Chyba pri vytváraní zápasu:', createError)
      setError(createError?.message || 'Zápas sa nepodarilo vytvoriť.')
    } finally {
      setCreating(false)
    }
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
      assistName: '',
      assistMinute: '',
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
      assistName: '',
      assistMinute: '',
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
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], assists: [], cards: [] }
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

  const addAssistToDraft = () => {
    if (!openedMatch?.id) return
    const resolvedName = String(matchDraft.assistName || '').trim()
    if (!resolvedName) return
    const resolvedMinute = String(matchDraft.assistMinute || '').trim()

    setMatchRecordings((prev) => {
      const key = String(openedMatch.id)
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], assists: [], cards: [] }
      const next = {
        ...source,
        [key]: {
          ...current,
          assists: [
            ...(Array.isArray(current.assists) ? current.assists : []),
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: resolvedName, minute: resolvedMinute }
          ]
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })

    setMatchDraft((prev) => ({ ...prev, assistName: '', assistMinute: '' }))
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
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], assists: [], cards: [] }
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

  const removeAssist = (matchId, assistId) => {
    setMatchRecordings((prev) => {
      const key = String(matchId || '')
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[key] && typeof source[key] === 'object' ? source[key] : { scorers: [], assists: [], cards: [] }
      const next = {
        ...source,
        [key]: {
          ...current,
          assists: (Array.isArray(current.assists) ? current.assists : []).filter((item) => String(item?.id || '') !== String(assistId || ''))
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })
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
        assists: Array.isArray(nextRecordings[matchIdKey]?.assists) ? nextRecordings[matchIdKey].assists : [],
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

  const calendarCells = useMemo(() => getCalendarCells(calendarDate), [calendarDate])

  const matchesByDateKey = useMemo(() => {
    const source = Array.isArray(filteredMatches) ? filteredMatches : []
    return source.reduce((acc, match) => {
      const dateKey = toDateKey(match?.matchDate)
      if (!dateKey) return acc
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(match)
      return acc
    }, {})
  }, [filteredMatches])

  const calendarTitle = useMemo(
    () => new Intl.DateTimeFormat('sk-SK', { month: 'long', year: 'numeric' }).format(calendarDate),
    [calendarDate]
  )

  const shiftCalendarMonth = (delta) => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const requestDeleteMatch = (match) => {
    setMatchPendingDelete(match)
  }

  const cancelDeleteMatch = () => {
    setMatchPendingDelete(null)
  }

  const deleteMatch = async () => {
    const matchId = Number(matchPendingDelete?.id || 0)
    if (!matchId) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await api.deleteMatch(matchId)
      setMatches((prev) => (Array.isArray(prev) ? prev.filter((item) => Number(item?.id || 0) !== matchId) : []))
      setMatchPendingDelete(null)
      setSuccess('Zápas bol odstránený.')
    } catch (deleteError) {
      console.error('Chyba pri mazaní zápasu:', deleteError)
      setError(deleteError?.message || 'Zápas sa nepodarilo odstrániť.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Načítanie...</div>
  }

  const openedIndicators = openedMatch ? getIndicatorsForMatch(openedMatch) : DEFAULT_INDICATORS
  const openedRecording = openedMatch ? getRecordingForMatch(openedMatch.id) : { scorers: [], assists: [], cards: [] }
  const showCategoryColumn = selectedCategoryKey === 'all'

  return (
    <div>
      <div className="page-header matches-page-header">
        <div>
          <h2>Zápasy</h2>
          <p>Evidencia výsledkov, strelcov, asistencií, kariet a párovania súpera</p>
        </div>
        <button type="button" className="manager-add-btn" onClick={openCreateMatchModal}>
          Pridať zápas
        </button>
      </div>

      {error ? <div className="error-message">{error}</div> : null}
      {success ? <div className="success-message">{success}</div> : null}

      <div className="matches-stats-grid" style={{ marginBottom: '16px' }}>
        <div className="card matches-stat-card">
          <span className="material-icons-round matches-stat-icon" aria-hidden="true">sports_soccer</span>
          <p>Počet zápasov</p>
          <strong>{matchesStats.total}</strong>
        </div>
        <div className="card matches-stat-card">
          <span className="material-icons-round matches-stat-icon" aria-hidden="true">leaderboard</span>
          <p>Štatistiky</p>
          <strong>{matchesStats.wins}-{matchesStats.draws}-{matchesStats.losses}</strong>
          <small>V-R-P</small>
        </div>
        <div className="card matches-stat-card">
          <span className="material-icons-round matches-stat-icon" aria-hidden="true">query_stats</span>
          <p>Skóre</p>
          <strong>{matchesStats.goalsFor}:{matchesStats.goalsAgainst}</strong>
        </div>
        <div className="card matches-stat-card">
          <span className="material-icons-round matches-stat-icon" aria-hidden="true">military_tech</span>
          <p>Úspešnosť</p>
          <strong>{matchesStats.successRate}%</strong>
        </div>
      </div>

      <div className="matches-main-grid">
        <div className="card matches-list-panel">
          <div className="matches-panel-head">
            <h3>Zoznam zápasov</h3>
            <span>{filteredMatches.length} položiek</span>
          </div>

          <div className="matches-category-chips">
            <button
              type="button"
              className={`matches-category-chip ${selectedCategoryKey === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategoryKey('all')}
            >
              Všetky
            </button>
            {orderedCategoryKeys.map((key) => (
              <button
                key={`matches-category-chip-${key}`}
                type="button"
                className={`matches-category-chip ${selectedCategoryKey === key ? 'active' : ''}`}
                onClick={() => setSelectedCategoryKey(key)}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="matches-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Druh zápasu</th>
                  <th>Zápas</th>
                  {showCategoryColumn ? <th>Kategória</th> : null}
                  <th>Výsledok</th>
                  <th>Akcie</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={showCategoryColumn ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Žiadne zápasy
                    </td>
                  </tr>
                ) : (
                  filteredMatches.map((match) => {
                    const indicators = getIndicatorsForMatch(match)
                    return (
                      <tr key={match.id}>
                        <td>
                          <span className="matches-type-pill">{formatMatchTypeShort(match.matchType)}</span>
                        </td>
                        <td>
                          <strong>{myClubName || 'Môj klub'} vs {match.opponent || '-'}</strong>
                          <div className="matches-subline">{match.matchDate ? new Date(match.matchDate).toLocaleDateString('sk-SK') : '-'}</div>
                        </td>
                        {showCategoryColumn ? <td>{getCategoryKey(match)}</td> : null}
                        <td>
                          {indicators.result ? (
                            <span className="matches-result-value">{getMatchResult(match) || '-'}</span>
                          ) : '-'}
                        </td>
                        <td>
                          <div className="matches-actions">
                            <button
                              type="button"
                              className="matches-action-icon"
                              onClick={() => openMatchDetail(match)}
                              title="Detail"
                              aria-label="Detail"
                            >
                              <span className="material-icons-round" aria-hidden="true">visibility</span>
                            </button>
                            <button
                              type="button"
                              className="matches-action-icon"
                              onClick={() => openMatchDetail(match)}
                              title="Upraviť"
                              aria-label="Upraviť"
                            >
                              <span className="material-icons-round" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              className="matches-action-icon danger"
                              onClick={() => requestDeleteMatch(match)}
                              title="Odstrániť"
                              aria-label="Odstrániť"
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card matches-calendar-panel">
          <div className="matches-panel-head">
            <h3>Kalendár</h3>
            <div className="matches-calendar-controls">
              <button type="button" className="matches-calendar-nav" onClick={() => shiftCalendarMonth(-1)} aria-label="Predchádzajúci mesiac">
                <span className="material-icons-round" aria-hidden="true">chevron_left</span>
              </button>
              <strong>{calendarTitle}</strong>
              <button type="button" className="matches-calendar-nav" onClick={() => shiftCalendarMonth(1)} aria-label="Nasledujúci mesiac">
                <span className="material-icons-round" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="matches-calendar-weekdays" aria-hidden="true">
            <span>Po</span>
            <span>Ut</span>
            <span>St</span>
            <span>Št</span>
            <span>Pi</span>
            <span>So</span>
            <span>Ne</span>
          </div>

          <div className="matches-calendar-grid">
            {calendarCells.map((cell) => {
              const dayMatches = matchesByDateKey[cell.dateKey] || []
              const hasFinished = dayMatches.some((item) => String(item?.status || '').trim().toLowerCase() === 'finished')
              const hasCancelled = dayMatches.some((item) => String(item?.status || '').trim().toLowerCase() === 'cancelled')
              const hasPlanned = dayMatches.some((item) => !['finished', 'cancelled'].includes(String(item?.status || '').trim().toLowerCase()))
              return (
                <div
                  key={cell.id}
                  className={`matches-calendar-day ${cell.inCurrentMonth ? '' : 'muted'} ${cell.isToday ? 'today' : ''} ${hasPlanned ? 'has-planned' : ''} ${hasFinished ? 'has-finished' : ''} ${hasCancelled ? 'has-cancelled' : ''}`.trim()}
                  title={dayMatches.length > 0
                    ? `${cell.dayLabel}. ${calendarTitle}: ${dayMatches.length} zápas(y)`
                    : `${cell.dayLabel}. ${calendarTitle}`}
                >
                  <span className="matches-calendar-day-number">{cell.dayLabel}</span>
                  {dayMatches.length > 0 ? <span className="matches-calendar-day-dot" aria-hidden="true" /> : null}
                  {dayMatches.length > 0 ? (
                    <span className="matches-calendar-day-tooltip">
                      {dayMatches.slice(0, 3).map((item) => (
                        <span key={`calendar-match-tip-${item.id}`} className="matches-calendar-day-tooltip-row">
                          {formatMatchTypeShort(item.matchType)}: {myClubName || 'Môj klub'} vs {item.opponent || '-'}
                        </span>
                      ))}
                      {dayMatches.length > 3 ? (
                        <span className="matches-calendar-day-tooltip-more">+{dayMatches.length - 3} ďalších</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="matches-calendar-legend">
            <span className="matches-calendar-legend-item">
              <span className="matches-calendar-legend-dot planned" aria-hidden="true" />
              Plánované
            </span>
            <span className="matches-calendar-legend-item">
              <span className="matches-calendar-legend-dot finished" aria-hidden="true" />
              Ukončené
            </span>
            <span className="matches-calendar-legend-item">
              <span className="matches-calendar-legend-dot cancelled" aria-hidden="true" />
              Zrušené
            </span>
          </div>
        </div>
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

            {openedIndicators.assists ? (
              <div className="card" style={{ marginBottom: '10px' }}>
                <h4 style={{ marginTop: 0 }}>Asistencie (náš tím)</h4>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr) 120px auto', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Meno hráča"
                    value={matchDraft.assistName}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, assistName: event.target.value }))}
                  />
                  <input
                    type="number"
                    min="1"
                    max="130"
                    placeholder="Minúta"
                    value={matchDraft.assistMinute}
                    onChange={(event) => setMatchDraft((prev) => ({ ...prev, assistMinute: event.target.value }))}
                  />
                  <button type="button" className="btn btn-secondary" onClick={addAssistToDraft}>Pridať asistenciu</button>
                </div>

                {(openedRecording.assists || []).length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Zatiaľ bez asistencií.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {openedRecording.assists.map((item) => (
                      <li key={`assist-${item.id}`} style={{ marginBottom: '4px' }}>
                        {item.name} {item.minute ? `(${item.minute}')` : ''}
                        <button type="button" className="btn btn-secondary" style={{ marginLeft: '8px', padding: '2px 8px' }} onClick={() => removeAssist(openedMatch.id, item.id)}>Odstrániť</button>
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

      {showCreateModal ? (
        <div className="confirm-modal-overlay" onClick={closeCreateMatchModal} role="dialog" aria-modal="true" aria-label="Pridať zápas">
          <div className="confirm-modal-card matches-create-modal" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Pridať zápas</h3>
            <p className="matches-create-modal-note">Vyplňte základné údaje, nastavte ukazovatele a vyberte hráčov pre zápas.</p>

            <div className="matches-create-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-match-team">Kategória</label>
                <select
                  id="create-match-team"
                  value={createDraft.teamId}
                  onChange={(event) => handleCreateTeamChange(event.target.value)}
                >
                  <option value="">Vyberte kategóriu</option>
                  {teams.map((team) => (
                    <option key={`create-match-team-${team.id}`} value={String(team.id)}>
                      {team.name} {team.ageGroup ? `(${team.ageGroup})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-match-opponent">Súper</label>
                <input
                  id="create-match-opponent"
                  type="text"
                  value={createDraft.opponent}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, opponent: event.target.value }))}
                  placeholder="Názov súpera"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-match-date">Dátum</label>
                <input
                  id="create-match-date"
                  type="date"
                  value={createDraft.matchDate}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, matchDate: event.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-match-time">Čas</label>
                <input
                  id="create-match-time"
                  type="time"
                  value={createDraft.matchTime}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, matchTime: event.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-match-location">Miesto</label>
                <input
                  id="create-match-location"
                  type="text"
                  value={createDraft.location}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Ihrisko / adresa"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-match-type">Typ zápasu</label>
                <input
                  id="create-match-type"
                  type="text"
                  value={createDraft.matchType}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, matchType: event.target.value }))}
                  placeholder="Liga, pohár, priateľský"
                />
              </div>
            </div>

            <div className="card" style={{ marginBottom: '10px' }}>
              <h4 style={{ marginTop: 0 }}>Ukazovatele zápasu</h4>
              <div className="matches-indicators-grid">
                <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={createIndicators.result}
                    onChange={(event) => setCreateIndicators((prev) => ({ ...prev, result: event.target.checked }))}
                  />
                  <span>Výsledok</span>
                </label>
                <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={createIndicators.scorers}
                    onChange={(event) => setCreateIndicators((prev) => ({ ...prev, scorers: event.target.checked }))}
                  />
                  <span>Strelci</span>
                </label>
                <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={createIndicators.assists}
                    onChange={(event) => setCreateIndicators((prev) => ({ ...prev, assists: event.target.checked }))}
                  />
                  <span>Asistencie</span>
                </label>
                <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={createIndicators.yellowCards}
                    onChange={(event) => setCreateIndicators((prev) => ({ ...prev, yellowCards: event.target.checked }))}
                  />
                  <span>Žlté karty</span>
                </label>
                <label className="planner-stitch-checkbox-option" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={createIndicators.redCards}
                    onChange={(event) => setCreateIndicators((prev) => ({ ...prev, redCards: event.target.checked }))}
                  />
                  <span>Červené karty</span>
                </label>
              </div>

              {createIndicators.result ? (
                <div className="matches-score-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="create-match-home-score">Domáce góly</label>
                    <input
                      id="create-match-home-score"
                      type="number"
                      min="0"
                      value={createDraft.homeScore}
                      onChange={(event) => setCreateDraft((prev) => ({ ...prev, homeScore: event.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="create-match-away-score">Hosťujúce góly</label>
                    <input
                      id="create-match-away-score"
                      type="number"
                      min="0"
                      value={createDraft.awayScore}
                      onChange={(event) => setCreateDraft((prev) => ({ ...prev, awayScore: event.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="card" style={{ marginBottom: '10px' }}>
              <h4 style={{ marginTop: 0 }}>Zoznam hráčov</h4>
              {!createDraft.teamId ? (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Najprv vyberte kategóriu.</p>
              ) : availablePlayersForCreate.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Pre túto kategóriu sa nenašli žiadni hráči.</p>
              ) : (
                <div className="matches-player-list">
                  {availablePlayersForCreate.map((player) => {
                    const playerKey = String(player?.userId || '')
                    const isSelected = selectedPlayerIds.includes(playerKey)
                    return (
                      <label key={`match-create-player-${playerKey}`} className="matches-player-row">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCreatePlayer(playerKey)}
                        />
                        <span>
                          {player.firstName} {player.lastName}
                          {player.jerseyNumber ? ` #${player.jerseyNumber}` : ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label htmlFor="create-match-notes">Poznámka</label>
              <textarea
                id="create-match-notes"
                value={createDraft.notes}
                onChange={(event) => setCreateDraft((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="Voliteľná poznámka k zápasu"
              />
            </div>

            <div className="confirm-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeCreateMatchModal} disabled={creating}>Zavrieť</button>
              <button type="button" className="manager-add-btn" onClick={submitCreateMatch} disabled={creating}>
                {creating ? 'Ukladám...' : 'Pridať zápas'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {matchPendingDelete ? (
        <div className="confirm-modal-overlay" onClick={cancelDeleteMatch} role="dialog" aria-modal="true" aria-label="Potvrdenie odstránenia zápasu">
          <div className="confirm-modal-card" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Odstrániť zápas?</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Naozaj chcete odstrániť zápas proti tímu <strong>{matchPendingDelete.opponent || '-'}</strong>?
            </p>
            <div className="confirm-modal-actions">
              <button type="button" className="btn-secondary" onClick={cancelDeleteMatch} disabled={saving}>Zrušiť</button>
              <button type="button" className="manager-add-btn category-form-toggle-cancel" onClick={deleteMatch} disabled={saving}>
                {saving ? 'Odstraňujem...' : 'Odstrániť'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Matches
