import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import './Matches.css'

const MATCH_CATEGORY_INDICATORS_STORAGE_KEY = 'matchesCategoryIndicators'
const MATCH_RECORDINGS_STORAGE_KEY = 'matchesRecordings'
const MATCH_PAIRINGS_STORAGE_KEY = 'matchesPairings'
const MATCH_LOCAL_CREATED_STORAGE_KEY = 'matchesLocalCreated'
const MATCH_LOCAL_EDITED_STORAGE_KEY = 'matchesLocalEdited'
const MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY = 'matchesLocalPlayerStats'

const DEFAULT_INDICATORS = {
  result: true,
  halfTimeResult: true,
  scorers: true,
  assists: false,
  yellowCards: false,
  redCards: false
}

const PLAYER_EVIDENCE_INDICATOR_COLUMNS = [
  { key: 'scorers', label: 'G', ariaLabel: 'Strelec' },
  { key: 'assists', label: 'A', ariaLabel: 'Asistencia' },
  { key: 'yellowCards', label: 'ŽK', ariaLabel: 'Žltá karta' },
  { key: 'redCards', label: 'ČK', ariaLabel: 'Červená karta' }
]

const CREATE_MATCH_INITIAL_DRAFT = {
  teamId: '',
  opponent: '',
  matchDate: '',
  matchTime: '',
  location: '',
  matchType: 'MZ',
  status: 'scheduled',
  homeScore: '',
  awayScore: '',
  halfHomeScore: '',
  halfAwayScore: '',
  period1HomeScore: '',
  period1AwayScore: '',
  period2HomeScore: '',
  period2AwayScore: '',
  period3HomeScore: '',
  period3AwayScore: '',
  notes: ''
}

const DEFAULT_MATCH_TYPE_OPTIONS = [
  { code: 'MZ', label: 'MZ' },
  { code: 'PZ', label: 'PZ' },
  { code: 'CUP', label: 'CUP' }
]

const MONTH_NAMES = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December']
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

const parseDayMonth = (value) => {
  const input = String(value || '').trim()
  const match = input.match(/^(\d{1,2})\.(\d{1,2})\.?$/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(day) || !Number.isInteger(month)) return null
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return { day, month }
}

const isMonthDayInRange = (point, from, to) => {
  if (!point || !from || !to) return false
  const pointValue = (point.month * 100) + point.day
  const fromValue = (from.month * 100) + from.day
  const toValue = (to.month * 100) + to.day

  if (fromValue <= toValue) {
    return pointValue >= fromValue && pointValue <= toValue
  }

  return pointValue >= fromValue || pointValue <= toValue
}

const normalizeIndicators = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return {
    result: true,
    halfTimeResult: source.halfTimeResult !== false,
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

const readLocalArray = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeLocalArray = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []))
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

const toPlayerName = (player) => {
  const composed = `${String(player?.firstName || '').trim()} ${String(player?.lastName || '').trim()}`.trim()
  return composed || String(player?.displayName || player?.name || 'Neznámy hráč')
}

const toPlayerAvatar = (player) => String(player?.photo ?? player?.photoUrl ?? player?.avatar ?? '').trim()

const toCreatePlayerKey = (player) => {
  const userId = String(player?.userId || '').trim()
  if (userId) return `user-${userId}`
  const id = String(player?.id || '').trim()
  if (id) return `id-${id}`
  const name = toPlayerName(player)
  const jersey = String(player?.jerseyNumber || '').trim()
  return `fallback-${name}-${jersey}`
}

const toNameInitials = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'H'
  if (parts.length === 1) return String(parts[0][0] || '').toUpperCase()
  return `${String(parts[0][0] || '').toUpperCase()}${String(parts[1][0] || '').toUpperCase()}`
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

const normalizeLocationValue = (value) => {
  const source = String(value || '').trim().toLowerCase()
  if (!source) return ''
  if (source === 'doma' || source === 'home' || source.includes('dom')) return 'doma'
  if (source === 'vonku' || source === 'away' || source.includes('hos') || source.includes('von')) return 'vonku'
  return ''
}

const parseResultScore = (value) => {
  const source = String(value || '').trim()
  if (!source) return { homeScore: '', awayScore: '' }
  const match = source.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!match) return { homeScore: '', awayScore: '' }
  return {
    homeScore: String(match[1] || '').trim(),
    awayScore: String(match[2] || '').trim()
  }
}

const hasScoreValue = (value) => {
  if (value === null || value === undefined) return false
  return String(value).trim() !== ''
}

const pickScoreValue = (...candidates) => {
  for (const candidate of candidates) {
    if (hasScoreValue(candidate)) {
      return String(candidate).trim()
    }
  }
  return ''
}

const toNormalizedPlayerNameKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')

const buildPlayerEvidenceDraftFromRecording = (recording, teamPlayers) => {
  const sourcePlayers = Array.isArray(teamPlayers) ? teamPlayers : []
  if (sourcePlayers.length === 0) {
    return {
      draft: {},
      hasScorers: false,
      hasAssists: false,
      hasYellowCards: false,
      hasRedCards: false
    }
  }

  const playerIdByName = new Map()
  sourcePlayers.forEach((player) => {
    const userId = String(player?.userId || '').trim()
    if (!userId) return
    const normalized = toNormalizedPlayerNameKey(toPlayerName(player))
    if (!normalized || playerIdByName.has(normalized)) return
    playerIdByName.set(normalized, userId)
  })

  const nextDraft = {}
  let hasScorers = false
  let hasAssists = false
  let hasYellowCards = false
  let hasRedCards = false

  const ensureEntry = (userId) => {
    if (!nextDraft[userId]) {
      nextDraft[userId] = {
        scorers: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0
      }
    }
    return nextDraft[userId]
  }

  const scorers = Array.isArray(recording?.scorers) ? recording.scorers : []
  scorers.forEach((item) => {
    const key = toNormalizedPlayerNameKey(item?.name)
    const userId = playerIdByName.get(key)
    if (!userId) return
    const entry = ensureEntry(userId)
    entry.scorers += 1
    hasScorers = true
  })

  const assists = Array.isArray(recording?.assists) ? recording.assists : []
  assists.forEach((item) => {
    const key = toNormalizedPlayerNameKey(item?.name)
    const userId = playerIdByName.get(key)
    if (!userId) return
    const entry = ensureEntry(userId)
    entry.assists += 1
    hasAssists = true
  })

  const cards = Array.isArray(recording?.cards) ? recording.cards : []
  cards.forEach((item) => {
    const key = toNormalizedPlayerNameKey(item?.name)
    const userId = playerIdByName.get(key)
    if (!userId) return
    const entry = ensureEntry(userId)
    const cardType = String(item?.type || '').trim().toLowerCase()
    if (cardType === 'red') {
      entry.redCards += 1
      hasRedCards = true
      return
    }
    entry.yellowCards += 1
    hasYellowCards = true
  })

  return {
    draft: nextDraft,
    hasScorers,
    hasAssists,
    hasYellowCards,
    hasRedCards
  }
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
  const [matchTypeOptions, setMatchTypeOptions] = useState(DEFAULT_MATCH_TYPE_OPTIONS)
  const [myClubName, setMyClubName] = useState('')
  const [myClubSportKey, setMyClubSportKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categoryIndicators, setCategoryIndicators] = useState({ default: { ...DEFAULT_INDICATORS } })
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('all')
  const [quickCreateCategoryKey, setQuickCreateCategoryKey] = useState('')
  const [selectedTimeline, setSelectedTimeline] = useState(() => `month-${new Date().getMonth()}`)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [attendanceSeasons, setAttendanceSeasons] = useState([])
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState(() => toDateKey(new Date()))
  const [createDraft, setCreateDraft] = useState({ ...CREATE_MATCH_INITIAL_DRAFT })
  const [createEditingMatchId, setCreateEditingMatchId] = useState(null)
  const [createIndicators, setCreateIndicators] = useState({ ...DEFAULT_INDICATORS })
  const [createSessionTime, setCreateSessionTime] = useState('')
  const [createPlayerAttendanceDraft, setCreatePlayerAttendanceDraft] = useState({})
  const [createPlayerEvidenceDraft, setCreatePlayerEvidenceDraft] = useState({})
  const [matchPendingDelete, setMatchPendingDelete] = useState(null)
  const [matchRecordings, setMatchRecordings] = useState({})
  const [matchPairings, setMatchPairings] = useState({})
  const [matchPlayerStats, setMatchPlayerStats] = useState({})
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
  const monthsScrollRef = useRef(null)
  const monthsWrapRef = useRef(null)

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    const localIndicators = readLocalObject(MATCH_CATEGORY_INDICATORS_STORAGE_KEY)
    const localRecordings = readLocalObject(MATCH_RECORDINGS_STORAGE_KEY)
    const localPairings = readLocalObject(MATCH_PAIRINGS_STORAGE_KEY)
    const localCreatedMatches = readLocalArray(MATCH_LOCAL_CREATED_STORAGE_KEY)
    const localEditedMatches = readLocalObject(MATCH_LOCAL_EDITED_STORAGE_KEY)
    const localPlayerStats = readLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY)

    try {
      setLoading(true)
      setError('')
      const [matchesData, teamsData, playersData, myClubData, clubsData, categorySettingsResponse, attendanceSeasonsResponse, metricsResponse] = await Promise.all([
        api.getMatches(),
        api.getTeams().catch(() => ({ teams: [] })),
        api.getPlayers().catch(() => ({ players: [] })),
        api.getMyClub().catch(() => ({})),
        api.getClubs().catch(() => ({ clubs: [] })),
        api.getMatchCategoryIndicators().catch(() => ({ settings: [] })),
        api.getAttendanceSeasons().catch(() => ({ seasons: [] })),
        api.getMetrics({ context: 'attendance' }).catch(() => ({ metrics: [] }))
      ])

      const fetchedMatches = Array.isArray(matchesData?.matches) ? matchesData.matches : []
      const patchedServerMatches = fetchedMatches.map((match) => {
        const key = String(match?.id || '').trim()
        const patch = key ? localEditedMatches?.[key] : null
        if (!patch || typeof patch !== 'object') return match

        return {
          ...match,
          ...patch,
          team: {
            ...(match?.team && typeof match.team === 'object' ? match.team : {}),
            ...(patch?.team && typeof patch.team === 'object' ? patch.team : {})
          }
        }
      })
      const mergedMatches = [
        ...localCreatedMatches,
        ...patchedServerMatches
      ]
      const fetchedTeams = Array.isArray(teamsData?.teams) ? teamsData.teams : []
      const fetchedPlayers = Array.isArray(playersData?.players) ? playersData.players : []
      setMatches(mergedMatches)
      setTeams(fetchedTeams)
      setAttendanceSeasons(Array.isArray(attendanceSeasonsResponse?.seasons) ? attendanceSeasonsResponse.seasons : [])
      setPlayers(fetchedPlayers)
      setClubs(Array.isArray(clubsData?.clubs) ? clubsData.clubs : [])
      setMyClubName(String(myClubData?.name || '').trim())
      setMyClubSportKey(String(myClubData?.sportKey || myClubData?.sport || myClubData?.sportType || '').trim().toLowerCase())

      const metricRows = Array.isArray(metricsResponse?.metrics) ? metricsResponse.metrics : []
      const foundMatchTypes = metricRows
        .map((metric) => String(metric?.shortName || metric?.name || '').trim().toUpperCase())
        .filter((code) => code === 'MZ' || code === 'PZ' || code === 'CUP')
      const uniqueTypes = Array.from(new Set(foundMatchTypes))
      const normalizedTypeOrder = ['MZ', 'PZ', 'CUP'].filter((code) => uniqueTypes.includes(code))
      const resolvedTypeOptions = normalizedTypeOrder.length > 0
        ? normalizedTypeOrder.map((code) => ({ code, label: code }))
        : DEFAULT_MATCH_TYPE_OPTIONS
      setMatchTypeOptions(resolvedTypeOptions)

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
      setMatchPlayerStats(localPlayerStats)
    } catch (loadError) {
      console.error('Chyba načítania zápasov:', loadError)
      setError('Nepodarilo sa načítať zápasy. Skúste to znova.')
      setMatches(localCreatedMatches)
      setCategoryIndicators({ default: { ...DEFAULT_INDICATORS }, ...localIndicators })
      setMatchRecordings(localRecordings)
      setMatchPairings(localPairings)
      setMatchPlayerStats(localPlayerStats)
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
    const monthMatch = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
    const selectedSeasonId = String(selectedTimeline || '').startsWith('season-')
      ? String(selectedTimeline || '').slice(7)
      : null

    const timelineMatches = (Array.isArray(matches) ? matches : []).filter((match) => {
      const resolvedDate = new Date(match?.matchDate)
      if (Number.isNaN(resolvedDate.getTime())) return false

      if (monthMatch) {
        const monthIndex = Number(monthMatch[1])
        return resolvedDate.getMonth() === monthIndex
      }

      if (selectedSeasonId) {
        const selectedSeason = (Array.isArray(attendanceSeasons) ? attendanceSeasons : []).find((item) => String(item?.id ?? '') === selectedSeasonId)
        const seasonFrom = selectedSeason ? parseDayMonth(selectedSeason.from) : null
        const seasonTo = selectedSeason ? parseDayMonth(selectedSeason.to) : null
        if (!seasonFrom || !seasonTo) return true
        return isMonthDayInRange({ day: resolvedDate.getDate(), month: resolvedDate.getMonth() + 1 }, seasonFrom, seasonTo)
      }

      return true
    })

    if (selectedCategoryKey === 'all') return timelineMatches
    return timelineMatches.filter((match) => getCategoryKey(match) === selectedCategoryKey)
  }, [matches, selectedCategoryKey, selectedTimeline, attendanceSeasons])

  const monthTimelineButtons = useMemo(() => (
    MONTH_NAMES.map((monthName, index) => ({
      id: `month-${index}`,
      type: 'month',
      label: MONTH_SHORT_NAMES[index] || monthName,
      monthIndex: index
    }))
  ), [])

  const seasonTimelineButtons = useMemo(() => (
    (Array.isArray(attendanceSeasons) ? attendanceSeasons : []).map((season) => ({
      id: `season-${season.id}`,
      type: 'season',
      label: String(season?.name || 'Obdobie'),
      from: String(season?.from || ''),
      to: String(season?.to || '')
    }))
  ), [attendanceSeasons])

  const matchesStats = useMemo(() => {
    const source = Array.isArray(filteredMatches) ? filteredMatches : []
    let wins = 0
    let draws = 0
    let losses = 0
    let goalsFor = 0
    let goalsAgainst = 0
    let decidedMatches = 0

    source.forEach((match) => {
      const scorePair = getPerspectiveScorePair(match)
      if (!scorePair) return

      const ownGoals = scorePair.goalsFor
      const opponentGoals = scorePair.goalsAgainst
      goalsFor += ownGoals
      goalsAgainst += opponentGoals
      decidedMatches += 1

      if (ownGoals > opponentGoals) wins += 1
      else if (ownGoals === opponentGoals) draws += 1
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
  }, [filteredMatches, matchRecordings])

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

  function getRecordingForMatch(matchId) {
    const key = String(matchId || '').trim()
    const source = key ? matchRecordings?.[key] : null
    return source && typeof source === 'object'
      ? source
      : { homeScore: '', awayScore: '', scorers: [], assists: [], cards: [] }
  }

  function getMatchResult(match) {
    const recording = getRecordingForMatch(match?.id)
    const resolvedHomeScore = pickScoreValue(recording.homeScore, match?.homeScore, match?.home_score)
    const resolvedAwayScore = pickScoreValue(recording.awayScore, match?.awayScore, match?.away_score)

    if (resolvedHomeScore !== '' && resolvedAwayScore !== '') {
      return `${resolvedHomeScore}:${resolvedAwayScore}`
    }
    return String(match?.result || '').trim()
  }

  const getPerspectiveScorePair = (match) => {
    const parsed = parseResultScore(getMatchResult(match))
    const home = Number(parsed.homeScore)
    const away = Number(parsed.awayScore)
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null

    const location = normalizeLocationValue(match?.location || match?.venue || match?.homeAway)
    if (location === 'vonku') {
      return {
        goalsFor: away,
        goalsAgainst: home
      }
    }

    return {
      goalsFor: home,
      goalsAgainst: away
    }
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
    if (String(indicatorKey || '') === 'result') return
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

  const openCreateMatchModal = (options = {}) => {
    const requestedTeamId = String(options?.teamId || '').trim()
    const requestedCategoryKey = String(options?.categoryKey || '').trim()
    const defaultTeam = requestedTeamId
      ? (teams.find((team) => String(team?.id || '') === requestedTeamId) || null)
      : (requestedCategoryKey
        ? (teams.find((team) => String(team?.ageGroup || '').trim() === requestedCategoryKey) || teams[0] || null)
        : (teams[0] || null))
    const resolvedTeamId = defaultTeam ? String(defaultTeam.id) : ''
    const resolvedCategory = String(defaultTeam?.ageGroup || 'default').trim() || 'default'
    const resolvedDateKey = toDateKey(options?.matchDate) || toDateKey(new Date())
    const resolvedMatchType = String(options?.matchType || matchTypeOptions[0]?.code || 'MZ').trim().toUpperCase()

    setCreateDraft({
      ...CREATE_MATCH_INITIAL_DRAFT,
      teamId: resolvedTeamId,
      matchDate: resolvedDateKey,
      matchType: resolvedMatchType
    })
    setCreateEditingMatchId(null)
    setCreateSessionTime('')
    setCreatePlayerAttendanceDraft({})
    setCreatePlayerEvidenceDraft({})
    setCreateIndicators(getIndicatorsForCategory(resolvedCategory))
    setShowCreateModal(true)
  }

  const closeCreateMatchModal = () => {
    setShowCreateModal(false)
    setCreateEditingMatchId(null)
    setCreateSessionTime('')
    setCreatePlayerAttendanceDraft({})
    setCreatePlayerEvidenceDraft({})
    setCreateDraft({ ...CREATE_MATCH_INITIAL_DRAFT })
    setCreateIndicators({ ...DEFAULT_INDICATORS })
  }

  const openEditMatchModal = async (match) => {
    const matchId = String(match?.id || '').trim()
    if (!matchId) return

    const existingRecording = getRecordingForMatch(match?.id)
    let fetchedEvidence = null
    let fetchedLineup = null

    try {
      const [evidenceResponse, lineupResponse] = await Promise.all([
        api.getMatchEvidence(matchId).catch(() => null),
        api.getMatchLineup(matchId).catch(() => null)
      ])
      fetchedEvidence = evidenceResponse
      fetchedLineup = lineupResponse
    } catch {
      fetchedEvidence = null
      fetchedLineup = null
    }

    const recording = {
      homeScore: fetchedEvidence?.evidence?.homeScore ?? existingRecording?.homeScore ?? '',
      awayScore: fetchedEvidence?.evidence?.awayScore ?? existingRecording?.awayScore ?? '',
      scorers: Array.isArray(fetchedEvidence?.evidence?.scorers)
        ? fetchedEvidence.evidence.scorers
        : (Array.isArray(existingRecording?.scorers) ? existingRecording.scorers : []),
      assists: Array.isArray(fetchedEvidence?.evidence?.assists)
        ? fetchedEvidence.evidence.assists
        : (Array.isArray(existingRecording?.assists) ? existingRecording.assists : []),
      cards: Array.isArray(fetchedEvidence?.evidence?.cards)
        ? fetchedEvidence.evidence.cards
        : (Array.isArray(existingRecording?.cards) ? existingRecording.cards : [])
    }

    const matchTeamId = String(match?.team?.id || match?.teamId || match?.team_id || '').trim()
    const defaultTeam = teams.find((team) => String(team?.id || '') === matchTeamId) || null
    const resolvedTeamId = defaultTeam ? String(defaultTeam.id) : matchTeamId
    const resolvedCategory = String(defaultTeam?.ageGroup || match?.team?.ageGroup || match?.categoryKey || 'default').trim() || 'default'
    const resolvedDateKey = toDateKey(match?.matchDate || match?.match_date || match?.date) || toDateKey(new Date())
    const resolvedMatchType = String(match?.matchType || match?.match_type || match?.type || matchTypeOptions[0]?.code || 'MZ').trim().toUpperCase()
    const resolvedLocation = normalizeLocationValue(match?.location || match?.venue || match?.homeAway)
    const resolvedStatus = String(match?.status || match?.state || 'scheduled').trim() || 'scheduled'
    const resolvedNotes = String(match?.notes || match?.note || '').trim()
    const resolvedOpponent = String(match?.opponent || match?.opponentTeam || match?.opponent_team || '').trim()
    const resultFromText = parseResultScore(match?.result)
    const resolvedHomeScore = pickScoreValue(recording.homeScore, match?.homeScore, match?.home_score, resultFromText.homeScore)
    const resolvedAwayScore = pickScoreValue(recording.awayScore, match?.awayScore, match?.away_score, resultFromText.awayScore)

    const teamPlayers = players.filter((player) => String(player?.team?.id || '') === resolvedTeamId)
    const evidencePrefill = buildPlayerEvidenceDraftFromRecording(recording, teamPlayers)
    const localPlayerStatsForMatch = matchPlayerStats?.[matchId] && typeof matchPlayerStats[matchId] === 'object'
      ? matchPlayerStats[matchId]
      : {}
    const lineupPlayers = [
      ...(Array.isArray(fetchedLineup?.starting) ? fetchedLineup.starting : []),
      ...(Array.isArray(fetchedLineup?.substitutes) ? fetchedLineup.substitutes : [])
    ]
    const lineupIds = new Set(
      lineupPlayers
        .map((row) => String(row?.player?.id || row?.playerId || '').trim())
        .filter(Boolean)
    )

    const attendanceFromLocal = localPlayerStatsForMatch?.attendanceDraft && typeof localPlayerStatsForMatch.attendanceDraft === 'object'
      ? localPlayerStatsForMatch.attendanceDraft
      : {}
    const hasLocalAttendance = Object.keys(attendanceFromLocal).length > 0

    const attendancePrefill = {}
    teamPlayers.forEach((player) => {
      const userId = String(player?.userId || '').trim()
      if (!userId) return

      const localEntry = attendanceFromLocal[userId] && typeof attendanceFromLocal[userId] === 'object'
        ? attendanceFromLocal[userId]
        : null

      if (localEntry) {
        attendancePrefill[userId] = {
          attended: localEntry.attended !== false,
          time: String(localEntry.time || '').replace(/[^\d]/g, '').slice(0, 3)
        }
        return
      }

      if (lineupIds.size > 0) {
        attendancePrefill[userId] = {
          attended: lineupIds.has(userId),
          time: ''
        }
      }
    })

    const evidenceFromLocal = localPlayerStatsForMatch?.evidenceDraft && typeof localPlayerStatsForMatch.evidenceDraft === 'object'
      ? localPlayerStatsForMatch.evidenceDraft
      : {}
    const mergedEvidenceDraft = { ...evidencePrefill.draft }
    Object.entries(evidenceFromLocal).forEach(([playerId, rawEntry]) => {
      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {}
      mergedEvidenceDraft[String(playerId || '').trim()] = {
        scorers: Math.max(0, Math.min(99, Number(entry.scorers) || 0)),
        assists: Math.max(0, Math.min(99, Number(entry.assists) || 0)),
        yellowCards: Math.max(0, Math.min(99, Number(entry.yellowCards) || 0)),
        redCards: Math.max(0, Math.min(99, Number(entry.redCards) || 0))
      }
    })

    setCreateEditingMatchId(matchId)
    setCreateDraft({
      ...CREATE_MATCH_INITIAL_DRAFT,
      teamId: resolvedTeamId,
      opponent: resolvedOpponent,
      matchDate: resolvedDateKey,
      location: resolvedLocation,
      matchType: resolvedMatchType,
      status: resolvedStatus,
      notes: resolvedNotes,
      homeScore: resolvedHomeScore,
      awayScore: resolvedAwayScore
    })

    setMatchRecordings((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const next = {
        ...source,
        [matchId]: {
          ...recording
        }
      }
      writeLocalObject(MATCH_RECORDINGS_STORAGE_KEY, next)
      return next
    })

    setSelectedCalendarDateKey(resolvedDateKey)
    setCreateSessionTime(String(localPlayerStatsForMatch?.sessionTime || '').replace(/[^\d]/g, '').slice(0, 3))
    setCreatePlayerAttendanceDraft(hasLocalAttendance || lineupIds.size > 0 ? attendancePrefill : {})
    setCreatePlayerEvidenceDraft(mergedEvidenceDraft)
    setCreateIndicators({
      ...getIndicatorsForCategory(resolvedCategory),
      scorers: evidencePrefill.hasScorers ? true : getIndicatorsForCategory(resolvedCategory).scorers,
      assists: evidencePrefill.hasAssists ? true : getIndicatorsForCategory(resolvedCategory).assists,
      yellowCards: evidencePrefill.hasYellowCards ? true : getIndicatorsForCategory(resolvedCategory).yellowCards,
      redCards: evidencePrefill.hasRedCards ? true : getIndicatorsForCategory(resolvedCategory).redCards
    })
    setShowCreateModal(true)
  }

  const selectedCreateTeam = useMemo(
    () => teams.find((team) => String(team?.id || '') === String(createDraft.teamId || '')) || null,
    [teams, createDraft.teamId]
  )

  const isCreateMatchHockey = useMemo(() => {
    const candidateValues = [
      myClubSportKey,
      selectedCreateTeam?.sportKey,
      selectedCreateTeam?.sport,
      selectedCreateTeam?.sportType,
      selectedCreateTeam?.name,
      selectedCreateTeam?.ageGroup
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)

    return candidateValues.some((value) => value.includes('hockey') || value.includes('hokej'))
  }, [myClubSportKey, selectedCreateTeam])

  const createMatchDateLabel = useMemo(() => {
    const resolved = new Date(createDraft.matchDate || selectedCalendarDateKey)
    if (Number.isNaN(resolved.getTime())) return '-'
    return resolved.toLocaleDateString('sk-SK')
  }, [createDraft.matchDate, selectedCalendarDateKey])

  const isCreateAwayMatch = String(createDraft.location || '').trim() === 'vonku'

  const createCategoryKey = String(selectedCreateTeam?.ageGroup || 'default').trim() || 'default'

  const availablePlayersForCreate = useMemo(() => {
    const selectedTeamId = String(createDraft.teamId || '')
    if (!selectedTeamId) return []

    const source = players.filter((player) => String(player?.team?.id || '') === selectedTeamId)
    const uniqueMap = new Map()
    source.forEach((player) => {
      const dedupeKey = toCreatePlayerKey(player)
      if (!uniqueMap.has(dedupeKey)) {
        uniqueMap.set(dedupeKey, player)
      }
    })

    return Array.from(uniqueMap.values())
  }, [players, createDraft.teamId])

  const updateCreateSessionTime = (nextTime) => {
    const normalized = String(nextTime || '').replace(/[^\d]/g, '').slice(0, 3)
    setCreateSessionTime(normalized)
    setCreatePlayerAttendanceDraft((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const next = { ...source }
      Object.keys(next).forEach((playerKey) => {
        const current = next[playerKey] && typeof next[playerKey] === 'object' ? next[playerKey] : { attended: true, time: '' }
        if (current.attended === false) return
        next[playerKey] = {
          ...current,
          time: normalized
        }
      })
      return next
    })
  }

  const getCreatePlayerAttendanceEntry = (userId) => {
    const key = String(userId || '').trim()
    const source = key ? createPlayerAttendanceDraft?.[key] : null
    if (source && typeof source === 'object') {
      return {
        attended: source.attended !== false,
        time: String(source.time || '').trim()
      }
    }
    return {
      attended: true,
      time: String(createSessionTime || '').trim()
    }
  }

  const toggleCreatePlayerAttendance = (userId, attended) => {
    const resolvedId = String(userId || '').trim()
    if (!resolvedId) return
    setCreatePlayerAttendanceDraft((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[resolvedId] && typeof source[resolvedId] === 'object'
        ? source[resolvedId]
        : { attended: true, time: String(createSessionTime || '').trim() }
      return {
        ...source,
        [resolvedId]: {
          attended: Boolean(attended),
          time: attended
            ? (String(current.time || '').trim() || String(createSessionTime || '').trim())
            : ''
        }
      }
    })
  }

  const updateCreatePlayerTime = (userId, nextTime) => {
    const resolvedId = String(userId || '').trim()
    if (!resolvedId) return
    const normalized = String(nextTime || '').replace(/[^\d]/g, '').slice(0, 3)
    setCreatePlayerAttendanceDraft((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[resolvedId] && typeof source[resolvedId] === 'object'
        ? source[resolvedId]
        : { attended: true, time: String(createSessionTime || '').trim() }
      return {
        ...source,
        [resolvedId]: {
          ...current,
          time: normalized
        }
      }
    })
  }

  const handleCreateTeamChange = (teamId) => {
    const resolvedTeam = teams.find((team) => String(team?.id || '') === String(teamId || '')) || null
    const resolvedCategory = String(resolvedTeam?.ageGroup || 'default').trim() || 'default'
    setCreateDraft((prev) => ({ ...prev, teamId: String(teamId || '') }))
    setCreateIndicators(getIndicatorsForCategory(resolvedCategory))
    setCreatePlayerAttendanceDraft({})
    setCreatePlayerEvidenceDraft({})
  }

  useEffect(() => {
    const sourcePlayers = Array.isArray(availablePlayersForCreate) ? availablePlayersForCreate : []
    if (sourcePlayers.length === 0) {
      setCreatePlayerAttendanceDraft({})
      setCreatePlayerEvidenceDraft({})
      return
    }

    setCreatePlayerAttendanceDraft((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const next = {}
      sourcePlayers.forEach((player) => {
        const key = String(player?.userId || '').trim()
        if (!key) return
        const current = source[key] && typeof source[key] === 'object'
          ? source[key]
          : { attended: true, time: String(createSessionTime || '').trim() }
        next[key] = {
          attended: current.attended !== false,
          time: String(current.time || '').replace(/[^\d]/g, '').slice(0, 3)
        }
      })
      return next
    })
  }, [availablePlayersForCreate, createSessionTime])

  useEffect(() => {
    const sourcePlayers = Array.isArray(availablePlayersForCreate) ? availablePlayersForCreate : []
    if (sourcePlayers.length === 0) {
      setCreatePlayerEvidenceDraft({})
      return
    }

    setCreatePlayerEvidenceDraft((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const next = {}
      sourcePlayers.forEach((player) => {
        const key = String(player?.userId || '').trim()
        if (!key) return
        const current = source[key] && typeof source[key] === 'object' ? source[key] : {}
        next[key] = {
          scorers: Math.max(0, Math.min(99, Number(current.scorers) || 0)),
          assists: Math.max(0, Math.min(99, Number(current.assists) || 0)),
          yellowCards: Math.max(0, Math.min(99, Number(current.yellowCards) || 0)),
          redCards: Math.max(0, Math.min(99, Number(current.redCards) || 0))
        }
      })
      return next
    })
  }, [availablePlayersForCreate])

  const getCreatePlayerEvidenceEntry = (userId) => {
    const key = String(userId || '').trim()
    const source = key ? createPlayerEvidenceDraft?.[key] : null
    if (source && typeof source === 'object') {
      return {
        scorers: Math.max(0, Math.min(99, Number(source.scorers) || 0)),
        assists: Math.max(0, Math.min(99, Number(source.assists) || 0)),
        yellowCards: Math.max(0, Math.min(99, Number(source.yellowCards) || 0)),
        redCards: Math.max(0, Math.min(99, Number(source.redCards) || 0))
      }
    }
    return {
      scorers: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0
    }
  }

  const updateCreatePlayerEvidence = (userId, indicatorKey, nextValue) => {
    const resolvedId = String(userId || '').trim()
    const resolvedIndicatorKey = String(indicatorKey || '').trim()
    if (!resolvedId || !resolvedIndicatorKey) return
    const normalizedValue = String(nextValue || '').replace(/[^\d]/g, '').slice(0, 2)
    const resolvedCount = Math.max(0, Math.min(99, Number(normalizedValue || 0)))

    setCreatePlayerEvidenceDraft((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {}
      const current = source[resolvedId] && typeof source[resolvedId] === 'object' ? source[resolvedId] : {}
      return {
        ...source,
        [resolvedId]: {
          scorers: Math.max(0, Math.min(99, Number(current.scorers) || 0)),
          assists: Math.max(0, Math.min(99, Number(current.assists) || 0)),
          yellowCards: Math.max(0, Math.min(99, Number(current.yellowCards) || 0)),
          redCards: Math.max(0, Math.min(99, Number(current.redCards) || 0)),
          [resolvedIndicatorKey]: resolvedCount
        }
      }
    })
  }

  const createPlayerEvidenceColumns = useMemo(() => {
    return PLAYER_EVIDENCE_INDICATOR_COLUMNS.filter((item) => createIndicators?.[item.key])
  }, [createIndicators])

  const createPlayerRowsGridTemplate = useMemo(() => {
    const evidenceColumnsCount = createPlayerEvidenceColumns.length
    if (evidenceColumnsCount === 0) return 'minmax(0, 1fr) 140px'
    return `minmax(0, 1fr) 140px repeat(${evidenceColumnsCount}, 62px)`
  }, [createPlayerEvidenceColumns])

  useEffect(() => {
    if (!showCreateModal) return
    const resolvedDate = String(selectedCalendarDateKey || '').trim()
    if (!resolvedDate) return
    setCreateDraft((prev) => {
      if (String(prev?.matchDate || '').trim() === resolvedDate) return prev
      return {
        ...prev,
        matchDate: resolvedDate
      }
    })
  }, [showCreateModal, selectedCalendarDateKey])

  const selectedCreatePlayerIds = useMemo(() => {
    return availablePlayersForCreate
      .map((player) => String(player?.userId || '').trim())
      .filter((playerId) => {
        if (!playerId) return false
        const attendance = getCreatePlayerAttendanceEntry(playerId)
        return attendance.attended !== false
      })
  }
  , [availablePlayersForCreate, createPlayerAttendanceDraft, createSessionTime])

  useEffect(() => {
    const current = String(quickCreateCategoryKey || '')
    const exists = orderedCategoryKeys.includes(current)
    if (exists) return
    setQuickCreateCategoryKey('')
  }, [orderedCategoryKeys, quickCreateCategoryKey])

  const resolvedQuickCreateCategoryKey = selectedCategoryKey === 'all'
    ? String(quickCreateCategoryKey || '')
    : String(selectedCategoryKey || '')

  const selectedCalendarDateLabel = useMemo(() => {
    const resolvedDate = new Date(selectedCalendarDateKey)
    if (Number.isNaN(resolvedDate.getTime())) return '-'
    return resolvedDate.toLocaleDateString('sk-SK')
  }, [selectedCalendarDateKey])

  const handleQuickCreateMatch = () => {
    if (!selectedCalendarDateKey) {
      setError('Najprv vyberte deň v kalendári.')
      return
    }

    if (!resolvedQuickCreateCategoryKey) {
      setError('Vyberte kategóriu pre nový zápas.')
      return
    }

    openCreateMatchModal({
      categoryKey: resolvedQuickCreateCategoryKey,
      matchDate: selectedCalendarDateKey
    })
  }

  const submitCreateMatch = async () => {
    const payloadTeamId = Number(createDraft.teamId || 0)
    const payloadOpponent = String(createDraft.opponent || '').trim()
    const payloadMatchDate = String(createDraft.matchDate || '').trim()

    if (!payloadTeamId || !payloadOpponent || !payloadMatchDate) {
      setError('Vyplňte kategóriu a súpera.')
      return
    }

    const playerNameById = new Map(
      availablePlayersForCreate
        .map((player) => {
          const key = String(player?.userId || '').trim()
          if (!key) return null
          return [key, toPlayerName(player)]
        })
        .filter(Boolean)
    )

    const selectedScorers = []
    const selectedAssists = []
    const selectedCards = []

    Object.entries(createPlayerEvidenceDraft && typeof createPlayerEvidenceDraft === 'object' ? createPlayerEvidenceDraft : {}).forEach(([playerId, indicators]) => {
      const evidence = indicators && typeof indicators === 'object' ? indicators : {}
      const playerName = String(playerNameById.get(String(playerId || '')) || '').trim()
      if (!playerName) return

      const scorersCount = Math.max(0, Math.min(99, Number(evidence.scorers) || 0))
      const assistsCount = Math.max(0, Math.min(99, Number(evidence.assists) || 0))
      const yellowCardsCount = Math.max(0, Math.min(99, Number(evidence.yellowCards) || 0))
      const redCardsCount = Math.max(0, Math.min(99, Number(evidence.redCards) || 0))

      if (createIndicators.scorers && scorersCount > 0) {
        for (let index = 0; index < scorersCount; index += 1) {
          selectedScorers.push({
            id: `create-scorer-${playerId}-${index}`,
            name: playerName,
            minute: ''
          })
        }
      }

      if (createIndicators.assists && assistsCount > 0) {
        for (let index = 0; index < assistsCount; index += 1) {
          selectedAssists.push({
            id: `create-assist-${playerId}-${index}`,
            name: playerName,
            minute: ''
          })
        }
      }

      if (createIndicators.yellowCards && yellowCardsCount > 0) {
        for (let index = 0; index < yellowCardsCount; index += 1) {
          selectedCards.push({
            id: `create-card-yellow-${playerId}-${index}`,
            name: playerName,
            minute: '',
            type: 'yellow'
          })
        }
      }

      if (createIndicators.redCards && redCardsCount > 0) {
        for (let index = 0; index < redCardsCount; index += 1) {
          selectedCards.push({
            id: `create-card-red-${playerId}-${index}`,
            name: playerName,
            minute: '',
            type: 'red'
          })
        }
      }
    })

    setCreating(true)
    setError('')
    setSuccess('')

    if (createEditingMatchId) {
      try {
        const editedMatchId = Number(createEditingMatchId)
        const shouldSaveEvidence =
          selectedScorers.length > 0 ||
          selectedAssists.length > 0 ||
          selectedCards.length > 0 ||
          String(createDraft.homeScore || '').trim() !== '' ||
          String(createDraft.awayScore || '').trim() !== ''

        if (Number.isInteger(editedMatchId) && editedMatchId > 0 && shouldSaveEvidence) {
          await api.updateMatchEvidence(editedMatchId, {
            homeScore: createIndicators.result ? createDraft.homeScore : null,
            awayScore: createIndicators.result ? createDraft.awayScore : null,
            scorers: selectedScorers,
            assists: selectedAssists,
            cards: selectedCards
          })
        }

        const editedPatch = {
          opponent: payloadOpponent,
          matchDate: payloadMatchDate,
          location: String(createDraft.location || '').trim() || null,
          matchType: String(createDraft.matchType || '').trim() || null,
          status: String(createDraft.status || 'scheduled').trim() || 'scheduled',
          notes: String(createDraft.notes || '').trim() || null,
          homeScore: createIndicators.result ? (String(createDraft.homeScore || '').trim() || null) : null,
          awayScore: createIndicators.result ? (String(createDraft.awayScore || '').trim() || null) : null,
          team: {
            id: Number(selectedCreateTeam?.id || payloadTeamId || 0),
            name: String(selectedCreateTeam?.name || '').trim() || 'Kategória',
            ageGroup: String(selectedCreateTeam?.ageGroup || createCategoryKey || 'default').trim() || 'default'
          }
        }

        const localEditedMatches = readLocalObject(MATCH_LOCAL_EDITED_STORAGE_KEY)
        writeLocalObject(MATCH_LOCAL_EDITED_STORAGE_KEY, {
          ...(localEditedMatches && typeof localEditedMatches === 'object' ? localEditedMatches : {}),
          [String(createEditingMatchId)]: editedPatch
        })

        const localPlayerStats = readLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY)
        const nextPlayerStats = {
          ...(localPlayerStats && typeof localPlayerStats === 'object' ? localPlayerStats : {}),
          [String(createEditingMatchId)]: {
            sessionTime: String(createSessionTime || '').replace(/[^\d]/g, '').slice(0, 3),
            attendanceDraft: createPlayerAttendanceDraft && typeof createPlayerAttendanceDraft === 'object'
              ? createPlayerAttendanceDraft
              : {},
            evidenceDraft: createPlayerEvidenceDraft && typeof createPlayerEvidenceDraft === 'object'
              ? createPlayerEvidenceDraft
              : {}
          }
        }
        writeLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY, nextPlayerStats)
        setMatchPlayerStats(nextPlayerStats)

        await loadMatches()
        setSuccess('Zápas bol upravený.')
        closeCreateMatchModal()
      } catch (editError) {
        console.error('Chyba pri úprave zápasu:', editError)
        setError(editError?.message || 'Zápas sa nepodarilo upraviť.')
      } finally {
        setCreating(false)
      }
      return
    }

    try {
      const selectedPlayerIdsPayload = selectedCreatePlayerIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)

      const createPayload = {
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
        selectedPlayers: selectedPlayerIdsPayload,
        homeScore: createIndicators.result ? createDraft.homeScore : null,
        awayScore: createIndicators.result ? createDraft.awayScore : null,
        // Keep create payload lightweight; detailed evidence is saved in a dedicated follow-up request.
        scorers: [],
        assists: [],
        cards: []
      }

      let createResponse = null
      let createWithLineupFallbackUsed = false

      try {
        createResponse = await api.createMatch(createPayload)
      } catch (primaryCreateError) {
        // Older DB snapshots may not support lineup writes during create; retry without selected players.
        createResponse = await api.createMatch({
          ...createPayload,
          selectedPlayers: []
        })
        createWithLineupFallbackUsed = true
      }

      const createdMatch = createResponse?.match
      const createdMatchId = Number(createdMatch?.id || 0)
      const shouldSaveEvidence =
        selectedScorers.length > 0 ||
        selectedAssists.length > 0 ||
        selectedCards.length > 0

      if (createdMatchId > 0 && shouldSaveEvidence) {
        try {
          await api.updateMatchEvidence(createdMatchId, {
            homeScore: createIndicators.result ? createDraft.homeScore : null,
            awayScore: createIndicators.result ? createDraft.awayScore : null,
            scorers: selectedScorers,
            assists: selectedAssists,
            cards: selectedCards
          })
        } catch (evidenceSaveError) {
          console.error('Chyba pri ukladaní evidencie nového zápasu:', evidenceSaveError)
          setSuccess('Zápas bol vytvorený, ale evidenčné údaje sa nepodarilo uložiť. Skúste ich doplniť v detaile zápasu.')
          await loadMatches()
          closeCreateMatchModal()
          return
        }
      }

      if (createdMatchId > 0) {
        const localPlayerStats = readLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY)
        const nextPlayerStats = {
          ...(localPlayerStats && typeof localPlayerStats === 'object' ? localPlayerStats : {}),
          [String(createdMatchId)]: {
            sessionTime: String(createSessionTime || '').replace(/[^\d]/g, '').slice(0, 3),
            attendanceDraft: createPlayerAttendanceDraft && typeof createPlayerAttendanceDraft === 'object'
              ? createPlayerAttendanceDraft
              : {},
            evidenceDraft: createPlayerEvidenceDraft && typeof createPlayerEvidenceDraft === 'object'
              ? createPlayerEvidenceDraft
              : {}
          }
        }
        writeLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY, nextPlayerStats)
        setMatchPlayerStats(nextPlayerStats)
      }

      await loadMatches()

      if (createWithLineupFallbackUsed) {
        setSuccess('Zápas bol pridaný. Predvyplnená zostava hráčov nebola pri vytváraní uložená (fallback kompatibility).')
      } else {
        setSuccess('Zápas bol úspešne pridaný.')
      }
      closeCreateMatchModal()
    } catch (createError) {
      console.error('Chyba pri vytváraní zápasu:', createError)

      const localMatchId = `local-${Date.now()}`
      const localHomeScoreRaw = createIndicators.result ? Number(createDraft.homeScore) : NaN
      const localAwayScoreRaw = createIndicators.result ? Number(createDraft.awayScore) : NaN
      const localHomeScore = Number.isFinite(localHomeScoreRaw) ? localHomeScoreRaw : null
      const localAwayScore = Number.isFinite(localAwayScoreRaw) ? localAwayScoreRaw : null

      const localMatch = {
        id: localMatchId,
        opponent: payloadOpponent,
        matchDate: payloadMatchDate,
        location: String(createDraft.location || '').trim() || null,
        matchType: String(createDraft.matchType || '').trim() || null,
        homeScore: localHomeScore,
        awayScore: localAwayScore,
        result: Number.isFinite(localHomeScore) && Number.isFinite(localAwayScore)
          ? `${localHomeScore}:${localAwayScore}`
          : null,
        status: String(createDraft.status || 'scheduled').trim() || 'scheduled',
        team: {
          id: Number(selectedCreateTeam?.id || payloadTeamId || 0),
          name: String(selectedCreateTeam?.name || '').trim() || 'Kategória',
          ageGroup: String(selectedCreateTeam?.ageGroup || createCategoryKey || 'default').trim() || 'default'
        },
        isLocalFallback: true
      }

      const localCreatedMatches = readLocalArray(MATCH_LOCAL_CREATED_STORAGE_KEY)
      writeLocalArray(MATCH_LOCAL_CREATED_STORAGE_KEY, [localMatch, ...localCreatedMatches])

      const localPlayerStats = readLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY)
      const nextPlayerStats = {
        ...(localPlayerStats && typeof localPlayerStats === 'object' ? localPlayerStats : {}),
        [String(localMatchId)]: {
          sessionTime: String(createSessionTime || '').replace(/[^\d]/g, '').slice(0, 3),
          attendanceDraft: createPlayerAttendanceDraft && typeof createPlayerAttendanceDraft === 'object'
            ? createPlayerAttendanceDraft
            : {},
          evidenceDraft: createPlayerEvidenceDraft && typeof createPlayerEvidenceDraft === 'object'
            ? createPlayerEvidenceDraft
            : {}
        }
      }
      writeLocalObject(MATCH_LOCAL_PLAYER_STATS_STORAGE_KEY, nextPlayerStats)
      setMatchPlayerStats(nextPlayerStats)

      setMatches((prev) => [localMatch, ...(Array.isArray(prev) ? prev : [])])
      setError('')
      setSuccess(`Serverové uloženie zlyhalo (${createError?.message || 'neznáma chyba'}). Zápas bol dočasne uložený lokálne.`)
      closeCreateMatchModal()
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
    setCalendarDate((prev) => {
      const nextDate = new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      setSelectedTimeline(`month-${nextDate.getMonth()}`)
      return nextDate
    })
  }

  const selectMonthByIndex = (monthIndex) => {
    if (!Number.isInteger(monthIndex)) return
    const normalizedMonth = Math.max(0, Math.min(11, monthIndex))
    setSelectedTimeline(`month-${normalizedMonth}`)
    setCalendarDate((prev) => new Date(prev.getFullYear(), normalizedMonth, 1))
  }

  const handleTimelineSelect = (item) => {
    setSelectedTimeline(item.id)
    if (item.type === 'month' && Number.isInteger(item.monthIndex)) {
      selectMonthByIndex(item.monthIndex)
      return
    }

    if (item.type === 'season') {
      const seasonFrom = parseDayMonth(item.from)
      if (seasonFrom?.month) {
        setCalendarDate((prev) => new Date(prev.getFullYear(), seasonFrom.month - 1, 1))
      }
    }
  }

  const getVisibleMonthCount = () => {
    if (!monthsWrapRef.current) return 9
    const raw = window.getComputedStyle(monthsWrapRef.current).getPropertyValue('--visible-months')
    const parsed = parseInt(String(raw || '').trim(), 10)
    if (!Number.isInteger(parsed)) return 9
    return Math.max(1, Math.min(12, parsed))
  }

  const getOneMonthOffset = () => {
    const monthsRow = monthsScrollRef.current?.querySelector('.matches-months-row')
    const firstMonthButton = monthsRow?.querySelector('.matches-month-btn')
    const buttonWidth = firstMonthButton ? firstMonthButton.getBoundingClientRect().width : 0
    const rowStyles = monthsRow ? window.getComputedStyle(monthsRow) : null
    const gapValue = rowStyles ? parseFloat(rowStyles.columnGap || rowStyles.gap || '0') : 0
    return Math.max(1, Math.round(buttonWidth + (Number.isFinite(gapValue) ? gapValue : 0)))
  }

  const alignMonthsToMonth = (monthIndex) => {
    if (!monthsScrollRef.current || !Number.isInteger(monthIndex)) return

    const visibleCount = getVisibleMonthCount()
    const oneMonthOffset = getOneMonthOffset()
    const half = Math.floor(visibleCount / 2)
    const maxStart = Math.max(0, 12 - visibleCount)
    const startIndex = Math.min(maxStart, Math.max(0, monthIndex - half))
    monthsScrollRef.current.scrollLeft = startIndex * oneMonthOffset
  }

  const scrollMonths = (direction) => {
    if (!monthsScrollRef.current) return
    const selectedMonthMatch = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
    const currentMonthIndex = selectedMonthMatch ? Number(selectedMonthMatch[1]) : calendarDate.getMonth()
    const nextMonthIndex = Math.max(0, Math.min(11, currentMonthIndex + direction))
    if (nextMonthIndex !== currentMonthIndex) {
      selectMonthByIndex(nextMonthIndex)
    }

    const oneMonthOffset = getOneMonthOffset()
    const container = monthsScrollRef.current
    container.scrollLeft += direction * oneMonthOffset
  }

  useEffect(() => {
    const selectedSeasonId = String(selectedTimeline || '').startsWith('season-')
      ? String(selectedTimeline || '').slice(7)
      : null

    if (!selectedSeasonId) return
    const exists = seasonTimelineButtons.some((item) => String(item.id) === `season-${selectedSeasonId}`)
    if (!exists) {
      setSelectedTimeline(`month-${calendarDate.getMonth()}`)
    }
  }, [selectedTimeline, seasonTimelineButtons, calendarDate])

  useEffect(() => {
    const matched = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
    const selectedMonthIndex = matched ? Number(matched[1]) : null
    if (!Number.isInteger(selectedMonthIndex)) return
    const rafId = window.requestAnimationFrame(() => {
      alignMonthsToMonth(selectedMonthIndex)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [selectedTimeline])

  useEffect(() => {
    const handleResize = () => {
      const matched = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
      const selectedMonthIndex = matched ? Number(matched[1]) : null
      if (!Number.isInteger(selectedMonthIndex)) return
      alignMonthsToMonth(selectedMonthIndex)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [selectedTimeline])

  const requestDeleteMatch = (match) => {
    setMatchPendingDelete(match)
  }

  const cancelDeleteMatch = () => {
    setMatchPendingDelete(null)
  }

  const deleteMatch = async () => {
    const rawMatchId = String(matchPendingDelete?.id || '').trim()
    if (rawMatchId.startsWith('local-')) {
      const localCreatedMatches = readLocalArray(MATCH_LOCAL_CREATED_STORAGE_KEY)
      const nextLocalMatches = localCreatedMatches.filter((item) => String(item?.id || '') !== rawMatchId)
      writeLocalArray(MATCH_LOCAL_CREATED_STORAGE_KEY, nextLocalMatches)
      setMatches((prev) => (Array.isArray(prev) ? prev.filter((item) => String(item?.id || '') !== rawMatchId) : []))
      setMatchPendingDelete(null)
      setError('')
      setSuccess('Lokálne uložený zápas bol odstránený.')
      return
    }

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

      <div className="matches-timeline-stack" style={{ marginBottom: '12px' }}>
        <div className="matches-timeline-row">
          <div className="matches-months-wrap" ref={monthsWrapRef}>
            <button type="button" className="matches-month-nav" onClick={() => scrollMonths(-1)} aria-label="Predchádzajúci mesiac">
              <span className="material-icons-round" aria-hidden="true">chevron_left</span>
            </button>

            <div className="matches-months-viewport" ref={monthsScrollRef}>
              <div className="matches-months-row">
                {monthTimelineButtons.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`card matches-timeline-btn matches-month-btn ${selectedTimeline === item.id ? 'active' : ''}`}
                    onClick={() => handleTimelineSelect(item)}
                  >
                    <span className="matches-timeline-btn-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="matches-month-nav" onClick={() => scrollMonths(1)} aria-label="Nasledujúci mesiac">
              <span className="material-icons-round" aria-hidden="true">chevron_right</span>
            </button>
          </div>

          {seasonTimelineButtons.length > 0 ? (
            <div className="matches-periods-fixed">
              {seasonTimelineButtons.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`card matches-timeline-btn matches-month-btn matches-period-btn ${selectedTimeline === item.id ? 'active' : ''}`}
                  onClick={() => handleTimelineSelect(item)}
                >
                  <span className="matches-timeline-btn-label">{item.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="matches-main-grid">
        <div className="card matches-list-panel">
          <div className="matches-panel-head">
            <h3>{showCreateModal ? (createEditingMatchId ? 'Upraviť zápas' : 'Pridať zápas') : 'Zoznam zápasov'}</h3>
            {showCreateModal ? (
              <button
                type="button"
                className="matches-close-btn"
                onClick={closeCreateMatchModal}
                aria-label="Zavrieť formulár pridania zápasu"
              >
                <span className="material-icons-round" aria-hidden="true">close</span>
              </button>
            ) : (
              <span>{filteredMatches.length} položiek</span>
            )}
          </div>

          {showCreateModal ? (
            <>
              <p className="matches-create-modal-note">Vyplňte základné údaje, nastavte ukazovatele a vyberte hráčov pre zápas.</p>

              <div className="matches-create-grid matches-create-grid-top-row">
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
                  <label htmlFor="create-match-location">Ihrisko</label>
                  <select
                    id="create-match-location"
                    value={createDraft.location}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, location: event.target.value }))}
                  >
                    <option value="">Vyberte</option>
                    <option value="doma">Doma</option>
                    <option value="vonku">Vonku</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="create-match-type">Typ zápasu</label>
                  <select
                    id="create-match-type"
                    value={createDraft.matchType}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, matchType: event.target.value }))}
                  >
                    {matchTypeOptions.map((item) => (
                      <option key={`match-type-option-${item.code}`} value={item.code}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="matches-create-grid matches-create-grid-opponent-row">
                <div className="form-group matches-opponent-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="create-match-opponent">Názov súpera</label>
                  <input
                    id="create-match-opponent"
                    type="text"
                    value={createDraft.opponent}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, opponent: event.target.value }))}
                    placeholder="Názov súpera"
                  />
                </div>
              </div>

              <p className="matches-create-date-hint">Dátum zápasu sa preberá z kalendára: <strong>{createMatchDateLabel}</strong></p>

              <div className="card" style={{ marginBottom: '10px' }}>
                {createIndicators.result ? (
                  <div className={`matches-score-wrap ${isCreateMatchHockey ? '' : 'matches-score-wrap-single-row'}`.trim()}>
                    {isCreateAwayMatch ? (
                      <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        Pri ihrisku Vonku zadávajte výsledok ako D = domáci tím (súper), H = hostia (náš tím).
                      </p>
                    ) : null}
                    {isCreateMatchHockey ? (
                      <>
                        <div className="matches-score-grid matches-score-grid-main">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="create-match-home-score">Domáci</label>
                            <input
                              id="create-match-home-score"
                              type="number"
                              min="0"
                              className="matches-score-main-input"
                              value={createDraft.homeScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, homeScore: event.target.value }))}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="create-match-away-score">Hostia</label>
                            <input
                              id="create-match-away-score"
                              type="number"
                              min="0"
                              className="matches-score-main-input"
                              value={createDraft.awayScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, awayScore: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="matches-score-periods-grid matches-score-periods-grid-hockey">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="create-match-period1-home-score">1. tretina (D/H)</label>
                          <div className="matches-score-mini-pair">
                            <input
                              id="create-match-period1-home-score"
                              type="number"
                              min="0"
                              className="matches-score-mini-input"
                              placeholder="D"
                              value={createDraft.period1HomeScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, period1HomeScore: event.target.value }))}
                            />
                            <input
                              id="create-match-period1-away-score"
                              type="number"
                              min="0"
                              className="matches-score-mini-input"
                              placeholder="H"
                              value={createDraft.period1AwayScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, period1AwayScore: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="create-match-period2-home-score">2. tretina (D/H)</label>
                          <div className="matches-score-mini-pair">
                            <input
                              id="create-match-period2-home-score"
                              type="number"
                              min="0"
                              className="matches-score-mini-input"
                              placeholder="D"
                              value={createDraft.period2HomeScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, period2HomeScore: event.target.value }))}
                            />
                            <input
                              id="create-match-period2-away-score"
                              type="number"
                              min="0"
                              className="matches-score-mini-input"
                              placeholder="H"
                              value={createDraft.period2AwayScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, period2AwayScore: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="create-match-period3-home-score">3. tretina (D/H)</label>
                          <div className="matches-score-mini-pair">
                            <input
                              id="create-match-period3-home-score"
                              type="number"
                              min="0"
                              className="matches-score-mini-input"
                              placeholder="D"
                              value={createDraft.period3HomeScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, period3HomeScore: event.target.value }))}
                            />
                            <input
                              id="create-match-period3-away-score"
                              type="number"
                              min="0"
                              className="matches-score-mini-input"
                              placeholder="H"
                              value={createDraft.period3AwayScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, period3AwayScore: event.target.value }))}
                            />
                          </div>
                        </div>
                        </div>
                      </>
                    ) : (
                      <div className={`matches-score-dual-layout ${createIndicators.halfTimeResult === false ? 'matches-score-dual-layout-single' : ''}`.trim()}>
                        <div className="matches-score-layout-block">
                          <h4 className="matches-create-card-title">Výsledok zápasu</h4>
                          <div className="matches-score-main-pair">
                            <input
                              id="create-match-home-score"
                              type="number"
                              min="0"
                              className="matches-score-main-input"
                              placeholder="D"
                              value={createDraft.homeScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, homeScore: event.target.value }))}
                            />
                            <input
                              id="create-match-away-score"
                              type="number"
                              min="0"
                              className="matches-score-main-input"
                              placeholder="H"
                              value={createDraft.awayScore}
                              onChange={(event) => setCreateDraft((prev) => ({ ...prev, awayScore: event.target.value }))}
                            />
                          </div>
                        </div>
                        {createIndicators.halfTimeResult !== false ? (
                          <div className="matches-score-layout-block">
                            <h4 className="matches-create-card-title">Výsledok polčasu</h4>
                            <div className="matches-score-main-pair">
                              <input
                                id="create-match-half-home-score"
                                type="number"
                                min="0"
                                className="matches-score-main-input"
                                placeholder="D"
                                value={createDraft.halfHomeScore}
                                onChange={(event) => setCreateDraft((prev) => ({ ...prev, halfHomeScore: event.target.value }))}
                              />
                              <input
                                id="create-match-half-away-score"
                                type="number"
                                min="0"
                                className="matches-score-main-input"
                                placeholder="H"
                                value={createDraft.halfAwayScore}
                                onChange={(event) => setCreateDraft((prev) => ({ ...prev, halfAwayScore: event.target.value }))}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="card" style={{ marginBottom: '10px' }}>
                <h4 className="matches-create-card-title">Zoznam hráčov</h4>
                {!createDraft.teamId ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Najprv vyberte kategóriu.</p>
                ) : availablePlayersForCreate.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Pre túto kategóriu sa nenašli žiadni hráči.</p>
                ) : (
                  <div
                    className="matches-player-attendance-head matches-player-attendance-table-head"
                    style={{ gridTemplateColumns: createPlayerRowsGridTemplate }}
                  >
                    <span>HRÁČ</span>
                    <span className="matches-player-attendance-head-time">
                      <span className="matches-player-minutes-head">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="matches-player-minutes-head-input"
                          value={createSessionTime}
                          onChange={(event) => updateCreateSessionTime(event.target.value)}
                          aria-label="Minúty zápasu"
                          placeholder="min"
                        />
                        <span>MIN</span>
                      </span>
                    </span>
                    {createPlayerEvidenceColumns.map((column) => (
                      <span
                        key={`create-player-evidence-head-${column.key}`}
                        className="matches-player-evidence-head-cell"
                        title={column.ariaLabel}
                      >
                        {column.label}
                      </span>
                    ))}
                  </div>
                )}
                {createDraft.teamId && availablePlayersForCreate.length > 0 ? (
                  <div className="matches-player-list matches-player-attendance-list">
                    {availablePlayersForCreate.map((player) => {
                      const playerKey = String(player?.userId || '')
                      const attendance = getCreatePlayerAttendanceEntry(playerKey)
                      const evidence = getCreatePlayerEvidenceEntry(playerKey)
                      const playerName = toPlayerName(player)
                      const avatarUrl = toPlayerAvatar(player)
                      return (
                        <div
                          key={`match-create-player-${playerKey}`}
                          className="matches-player-row matches-player-attendance-row"
                          style={{ gridTemplateColumns: createPlayerRowsGridTemplate }}
                        >
                          <span className="matches-player-cell">
                            <span className="matches-player-avatar" aria-hidden="true">
                              {avatarUrl
                                ? <img src={avatarUrl} alt="" />
                                : <span>{toNameInitials(playerName)}</span>}
                            </span>
                            <span>
                              {playerName}
                              {player.jerseyNumber ? ` #${player.jerseyNumber}` : ''}
                            </span>
                          </span>
                          <span className="matches-player-attendance-controls">
                            <label className="matches-row-switch" aria-label={`Účasť hráča ${playerName}`}>
                              <input
                                type="checkbox"
                                checked={attendance.attended !== false}
                                onChange={(event) => toggleCreatePlayerAttendance(playerKey, event.target.checked)}
                              />
                              <span className="matches-row-switch-slider" />
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="matches-player-time-input"
                              value={attendance.time}
                              onChange={(event) => updateCreatePlayerTime(playerKey, event.target.value)}
                              disabled={attendance.attended === false}
                              placeholder="min"
                            />
                          </span>
                          {createPlayerEvidenceColumns.map((column) => (
                            <span key={`create-player-evidence-cell-${playerKey}-${column.key}`} className="matches-player-evidence-cell">
                              <input
                                type="text"
                                inputMode="numeric"
                                className="matches-player-evidence-input"
                                value={String(Math.max(0, Number(evidence?.[column.key]) || 0))}
                                onChange={(event) => updateCreatePlayerEvidence(playerKey, column.key, event.target.value)}
                                disabled={attendance.attended === false}
                                aria-label={`${column.ariaLabel} hráča ${playerName}`}
                                placeholder="0"
                              />
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
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
                  {creating ? 'Ukladám...' : (createEditingMatchId ? 'Uložiť zmeny' : 'Pridať zápas')}
                </button>
              </div>
            </>
          ) : (
            <>
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
                                  onClick={() => openEditMatchModal(match)}
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
            </>
          )}
        </div>

        <div className="matches-side-stack">
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
                const typeTokens = dayMatches.map((item) => formatMatchTypeShort(item?.matchType))
                const hasTJ = typeTokens.includes('TJ')
                const hasMZ = typeTokens.includes('MZ')
                const hasPZ = typeTokens.includes('PZ')
                const hasCUP = typeTokens.includes('CUP')
                return (
                  <button
                    key={cell.id}
                    type="button"
                    className={`matches-calendar-day ${cell.inCurrentMonth ? '' : 'muted'} ${cell.isToday ? 'today' : ''} ${selectedCalendarDateKey === cell.dateKey ? 'active' : ''} ${hasTJ ? 'has-tj' : ''} ${hasMZ ? 'has-mz' : ''} ${hasPZ ? 'has-pz' : ''} ${hasCUP ? 'has-cup' : ''}`.trim()}
                    title={dayMatches.length > 0
                      ? `${cell.dayLabel}. ${calendarTitle}: ${dayMatches.length} zápas(y)`
                      : `${cell.dayLabel}. ${calendarTitle}`}
                    onClick={() => {
                      setSelectedCalendarDateKey(cell.dateKey)
                    }}
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
                  </button>
                )
              })}
            </div>

            <div className="matches-calendar-legend">
              <span className="matches-calendar-legend-item">
                <span className="matches-calendar-legend-dot mz" aria-hidden="true" />
                MZ
              </span>
              <span className="matches-calendar-legend-item">
                <span className="matches-calendar-legend-dot pz" aria-hidden="true" />
                PZ
              </span>
              <span className="matches-calendar-legend-item">
                <span className="matches-calendar-legend-dot cup" aria-hidden="true" />
                CUP
              </span>
            </div>
          </div>

          <div className="card matches-panel matches-manage-panel">
            <div className="matches-panel-head">
              <h3>Pridať zápas</h3>
              <span>{selectedCalendarDateLabel}</span>
            </div>

            <div className={`matches-manage-controls ${selectedCategoryKey === 'all' ? '' : 'single'}`}>
              {selectedCategoryKey === 'all' ? (
                <select
                  className="matches-manage-select"
                  value={quickCreateCategoryKey}
                  onChange={(event) => setQuickCreateCategoryKey(String(event.target.value || ''))}
                >
                  <option value="">Vyber kategóriu</option>
                  {orderedCategoryKeys.map((key) => (
                    <option key={`match-manage-team-${key}`} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                className={`btn matches-manage-btn ${selectedCategoryKey === 'all' ? '' : 'full'}`}
                onClick={handleQuickCreateMatch}
                disabled={!selectedCalendarDateKey || !resolvedQuickCreateCategoryKey}
              >
                Pridať zápas
              </button>
            </div>
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
