import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { EVIDENCE_FALLBACK_COLORS, EVIDENCE_PRESET_COLORS_BY_CODE } from '../constants/evidenceColors'
import TimeClockPickerModal from '../components/TimeClockPickerModal'
import './Planner.css'

const DAY_HEADERS = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa']
const DEFAULT_PLANNER_INDICATOR_CODES = ['TJ', 'PZ', 'MZ', 'CUP']
const EVENT_METRIC_CODE_BY_TYPE = {
  training: 'TJ',
  match: 'PZ',
  cancelled: 'MZ',
  tournament: 'CUP'
}

const EVENT_TYPE_BY_METRIC_CODE = {
  TJ: 'training',
  PZ: 'match',
  MZ: 'cancelled',
  CUP: 'tournament'
}
const SESSION_TYPE_BY_METRIC_CODE = {
  TJ: 'training',
  PZ: 'match',
  MZ: 'friendly_match',
  CUP: 'tournament'
}
const PLANNER_TYPE_BY_SESSION_TYPE = {
  training: 'training',
  match: 'match',
  tournament: 'tournament',
  friendly_match: 'cancelled'
}
const EVENT_ICON_BY_TYPE = {
  training: 'fitness_center',
  match: 'sports_soccer',
  cancelled: 'cancel',
  tournament: 'emoji_events',
  'field-booking': 'calendar_month'
}
const EVENT_CATEGORY_BY_TYPE = {
  training: 'Trening',
  match: 'Zapas',
  cancelled: 'Zrusene',
  tournament: 'Turnaj',
  'field-booking': 'Rezervacia'
}
const DEFAULT_EVENT_LABEL_BY_TYPE = {
  training: 'Trening',
  match: 'Zapas',
  cancelled: 'Zrusena udalost',
  tournament: 'Turnaj'
}
const hexToRgba = (hexColor, alpha) => {
  const normalized = String(hexColor || '').replace('#', '')
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  if (expanded.length !== 6) return `rgba(148, 163, 184, ${alpha})`

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const normalizeMetricCode = (code) => String(code || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')

const toMetricShortLabel = (metric) => {
  const shortName = String(metric?.shortName || '').trim()
  if (shortName) return shortName

  const name = String(metric?.name || '').trim()
  if (!name) return 'UK'

  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return words.slice(0, 3).map((word) => String(word[0] || '').toUpperCase()).join('')
  }

  return name.slice(0, 3).toUpperCase()
}

const getEnabledEvidenceMetricIds = (metricsList, rawDraft) => {
  const sourceMetrics = Array.isArray(metricsList) ? metricsList : []
  const metricIds = sourceMetrics
    .map((metric) => String(metric?.id ?? '').trim())
    .filter(Boolean)

  if (metricIds.length === 0) return new Set()

  const baseDraft = (rawDraft && typeof rawDraft === 'object') ? rawDraft : {}
  const source = (baseDraft.evidenceColumns && typeof baseDraft.evidenceColumns === 'object')
    ? baseDraft.evidenceColumns
    : {}

  return new Set(metricIds.filter((metricId) => source[metricId] !== false))
}

const getMonthTitle = (date) => {
  const source = date instanceof Date ? date : new Date()
  const raw = new Intl.DateTimeFormat('sk-SK', { month: 'long', year: 'numeric' }).format(source)
  return raw ? `${raw[0].toUpperCase()}${raw.slice(1)}` : ''
}

const getShortMonthLabel = (date) => {
  const raw = new Intl.DateTimeFormat('sk-SK', { month: 'short' }).format(date)
  const trimmed = String(raw || '').replace('.', '').trim()
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}` : ''
}

const getWeekStartDate = (date) => {
  const source = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const mondayIndex = getMondayBasedDayIndex(source)
  source.setDate(source.getDate() - mondayIndex)
  return source
}

const getWeekTitle = (weekStartDate) => {
  const start = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate())
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  const startLabel = `${start.getDate()}. ${getShortMonthLabel(start)}`
  const endLabel = `${end.getDate()}. ${getShortMonthLabel(end)}`
  return `${startLabel} - ${endLabel} ${end.getFullYear()}`
}

const getMondayBasedDayIndex = (date) => {
  const sundayBased = date.getDay()
  return (sundayBased + 6) % 7
}

const isSameDate = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
)

const pad2 = (value) => String(value).padStart(2, '0')
const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const parseFieldDimensions = (rawDimensions) => {
  const source = String(rawDimensions || '').replace(',', '.').trim()
  if (!source) return null

  const matches = source.match(/\d+(?:\.\d+)?/g)
  if (!Array.isArray(matches) || matches.length < 2) return null

  const first = Number(matches[0])
  const second = Number(matches[1])
  if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) return null

  const longer = Math.max(first, second)
  const shorter = Math.min(first, second)
  return {
    width: longer,
    height: shorter,
    ratio: longer / shorter
  }
}

const getFieldGridLayout = (partsTotal) => {
  const total = Math.max(1, Number(partsTotal) || 1)
  if (total === 1) return { cols: 1, rows: 1 }
  if (total === 2) return { cols: 2, rows: 1 }
  if (total === 3) return { cols: 3, rows: 1 }
  if (total === 4) return { cols: 2, rows: 2 }

  const cols = Math.ceil(Math.sqrt(total))
  const rows = Math.ceil(total / cols)
  return { cols, rows }
}

const buildMonthCells = (monthDate, eventSeedByDay = new Map()) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPreviousMonth = new Date(year, month, 0).getDate()
  const monthStartsAt = getMondayBasedDayIndex(firstDayOfMonth)
  const today = new Date()
  const cells = []

  for (let index = 0; index < 42; index += 1) {
    let cellDate
    let muted = false

    if (index < monthStartsAt) {
      const day = daysInPreviousMonth - monthStartsAt + index + 1
      cellDate = new Date(year, month - 1, day)
      muted = true
    } else if (index < monthStartsAt + daysInMonth) {
      const day = index - monthStartsAt + 1
      cellDate = new Date(year, month, day)
    } else {
      const day = index - (monthStartsAt + daysInMonth) + 1
      cellDate = new Date(year, month + 1, day)
      muted = true
    }

    const cellDay = cellDate.getDate()
    const isCurrentMonth = cellDate.getMonth() === month
    const events = isCurrentMonth ? (eventSeedByDay.get(cellDay) || []) : []
    const weekDayIndex = getMondayBasedDayIndex(cellDate)
    const weekend = weekDayIndex >= 5

    cells.push({
      id: `calendar-${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDay}-${index}`,
      day: cellDay,
      dateKey: toDateKey(cellDate),
      muted,
      weekend,
      today: isCurrentMonth && isSameDate(cellDate, today),
      events
    })
  }

  return cells
}

const parsePlannerRecurrenceRule = (value) => {
  try {
    const parsed = JSON.parse(String(value || ''))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const formatEventTimeRange = (startIso, endIso) => {
  if (!startIso || !endIso) return ''

  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  return `${pad2(start.getHours())}:${pad2(start.getMinutes())} - ${pad2(end.getHours())}:${pad2(end.getMinutes())}`
}

const buildEventDateTimeIso = (dateKey, hhmm, fallbackHour = 9, fallbackMinute = 0) => {
  const date = new Date(String(dateKey || ''))
  if (Number.isNaN(date.getTime())) return null

  const match = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/)
  const hour = match ? Math.max(0, Math.min(23, Number(match[1]) || 0)) : fallbackHour
  const minute = match ? Math.max(0, Math.min(59, Number(match[2]) || 0)) : fallbackMinute

  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const toIsoFromLegacyDateTime = (dateValue, timeValue, fallbackHour = 9, fallbackMinute = 0) => {
  const base = new Date(String(dateValue || ''))
  if (Number.isNaN(base.getTime())) return null

  const match = String(timeValue || '').match(/^(\d{1,2}):(\d{2})/)
  const hour = match ? Math.max(0, Math.min(23, Number(match[1]) || 0)) : fallbackHour
  const minute = match ? Math.max(0, Math.min(59, Number(match[2]) || 0)) : fallbackMinute

  base.setHours(hour, minute, 0, 0)
  return base.toISOString()
}

const toMinutesFromHHmm = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return (Math.max(0, Math.min(23, hour)) * 60) + Math.max(0, Math.min(59, minute))
}

const isTimeOverlap = (startA, endA, startB, endB) => {
  if (![startA, endA, startB, endB].every((value) => Number.isFinite(value))) return false
  return startA < endB && startB < endA
}

const inferPlannerTypeFromSession = (session) => {
  const haystack = [
    session?.title,
    session?.name,
    session?.label,
    session?.description,
    session?.notes,
    session?.location,
  ]
    .map((value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    .join(' ')

  if (/\b(turnaj|tournament|cup)\b/.test(haystack)) return 'tournament'
  if (/\b(zapas|zapasy|match|friendly|triangel)\b/.test(haystack)) return 'match'
  if (/\b(zrusen|zrusena|cancel)\b/.test(haystack)) return 'cancelled'
  return 'training'
}

const resolveSessionTeamId = (session, fallback = '') => String(
  session?.teamId
  || session?.team_id
  || session?.team?.id
  || fallback
  || ''
).trim()

const getApiErrorMessage = (error) => {
  const payload = error?.payload
  const payloadMessage = String(payload?.message || payload?.error || '').trim()
  if (payloadMessage) return payloadMessage
  const errorMessage = String(error?.message || '').trim()
  if (errorMessage) return errorMessage
  return 'Udalost sa nepodarilo ulozit do databazy.'
}

const readCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const normalizeRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'club_admin' ? 'club' : normalized
}

function Planner() {
  const [activeView, setActiveView] = useState('month')
  const [activeMode, setActiveMode] = useState('plan')
  const [displayedMonthDate, setDisplayedMonthDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [displayedWeekStartDate, setDisplayedWeekStartDate] = useState(() => getWeekStartDate(new Date()))
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [eventForm, setEventForm] = useState({
    label: '',
    selectedTrainingGroups: [],
    type: 'training',
    indicatorCode: '',
    date: '',
    selectedDates: [],
    multiDateMode: false,
    timeFrom: '',
    timeTo: '',
    teamId: '',
    fieldId: '',
    fieldParts: '0',
    selectedFieldParts: []
  })
  const [teamFilters, setTeamFilters] = useState([{ id: 'all', label: 'Všetky' }])
  const [availableIndicatorCodes, setAvailableIndicatorCodes] = useState([...DEFAULT_PLANNER_INDICATOR_CODES])
  const [activeIndicatorCodes, setActiveIndicatorCodes] = useState(DEFAULT_PLANNER_INDICATOR_CODES)
  const [trainingDivisionGroupOptions, setTrainingDivisionGroupOptions] = useState([])
  const [clubFields, setClubFields] = useState([])
  const [plannerSessions, setPlannerSessions] = useState([])
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)
  const [editingEventId, setEditingEventId] = useState('')
  const [isPlannerTimeClockOpen, setIsPlannerTimeClockOpen] = useState(false)
  const [plannerTimeClockTarget, setPlannerTimeClockTarget] = useState('timeFrom')
  const currentRole = normalizeRole(readCurrentUser()?.role)
  const isClubRole = currentRole === 'club'
  const sidebarRef = useRef(null)

  useEffect(() => {
    if (!sidebarOpen) return
    window.requestAnimationFrame(() => {
      sidebarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [sidebarOpen])

  useEffect(() => {
    let isMounted = true
    api.getClubFields()
      .then((res) => { if (isMounted) setClubFields(Array.isArray(res?.fields) ? res.fields : []) })
      .catch(() => { if (isMounted) setClubFields([]) })
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadTrainingDivisionOptions = async () => {
      try {
        const club = await api.getMyClub()
        const divisions = Array.isArray(club?.trainingDivisions)
          ? club.trainingDivisions
              .map((item) => ({
                id: String(item?.id || '').trim(),
                name: String(item?.name || '').trim(),
                groups: Array.isArray(item?.groups)
                  ? item.groups.map((groupName) => String(groupName || '').trim()).filter(Boolean)
                  : []
              }))
              .filter((item) => item.id && item.name)
          : []

        if (divisions.length === 0) {
          if (isMounted) setTrainingDivisionGroupOptions([])
          return
        }

        let divisionsConfig = {}
        try {
          const response = await api.getTrainingExerciseDisplaySettings()
          const remoteSettings = response?.settings && typeof response.settings === 'object' ? response.settings : {}
          divisionsConfig = remoteSettings?.divisions && typeof remoteSettings.divisions === 'object'
            ? remoteSettings.divisions
            : {}
        } catch {
          divisionsConfig = {}
        }

        const visibleDivisions = divisions
          .filter((item) => {
            const config = divisionsConfig[item.id] || {}
            return config?.visible !== false
          })

        const groupOptions = visibleDivisions.flatMap((division) => {
          const divisionName = String(division?.name || '').trim()
          const groups = Array.isArray(division.groups) ? division.groups : []
          if (groups.length === 0) return []

          return groups.map((groupNameRaw) => {
            const groupName = String(groupNameRaw || '').trim()
            if (!groupName) return null

            const prefix = `${divisionName} - `
            const withoutDivisionPrefix = groupName.toLowerCase().startsWith(prefix.toLowerCase())
              ? groupName.slice(prefix.length).trim()
              : groupName
            const hasDashSeparator = withoutDivisionPrefix.includes(' - ')
            const cleaned = hasDashSeparator
              ? withoutDivisionPrefix.split(' - ').slice(1).join(' - ').trim()
              : withoutDivisionPrefix

            return {
              value: cleaned || withoutDivisionPrefix,
              label: cleaned || withoutDivisionPrefix
            }
          }).filter(Boolean)
        })

        const uniqueGroupOptions = Array.from(new Map(
          groupOptions.map((option) => [option.value, option])
        ).values())

        if (isMounted) {
          setTrainingDivisionGroupOptions(uniqueGroupOptions)
        }
      } catch {
        if (isMounted) setTrainingDivisionGroupOptions([])
      }
    }

    const handleStorage = (event) => {
      const key = String(event?.key || '')
      if (!key || key.startsWith('trainingDivisionNames:') || key.startsWith('trainingExerciseDisplaySettings:')) {
        loadTrainingDivisionOptions()
      }
    }

    loadTrainingDivisionOptions()

    return () => {
      isMounted = false
    }
  }, [])

  const resolveFieldNameById = useCallback((fieldId) => {
    const safeFieldId = String(fieldId || '').trim()
    if (!safeFieldId) return ''

    const found = clubFields.find((field) => String(field?.id ?? '').trim() === safeFieldId)
    return String(found?.name || '').trim()
  }, [clubFields])

  const plannerEvents = useMemo(() => {
    return (Array.isArray(plannerSessions) ? plannerSessions : []).map((session) => {
      const recurrenceMeta = parsePlannerRecurrenceRule(session?.recurrenceRule || session?.recurrence_rule)
      const recurrenceIndicatorCode = normalizeMetricCode(recurrenceMeta?.indicatorCode)
      const recurrenceType = EVENT_TYPE_BY_METRIC_CODE[recurrenceIndicatorCode]
      const rawSessionType = String(session?.sessionType || session?.session_type || session?.type || 'training')
      const inferredType = inferPlannerTypeFromSession(session)
      const type = recurrenceType || PLANNER_TYPE_BY_SESSION_TYPE[rawSessionType] || inferredType || 'training'
      const metricCode = recurrenceIndicatorCode || EVENT_METRIC_CODE_BY_TYPE[type] || 'TJ'
      const sessionDateValue = session?.date
        || session?.training_date
        || session?.scheduled_date
        || session?.session_date
      const sessionStartTimeValue = session?.startTime
        || session?.start_time
        || session?.time_from
        || session?.from_time
      const sessionEndTimeValue = session?.endTime
        || session?.end_time
        || session?.time_to
        || session?.to_time
      const startIso = session?.startAt
        || session?.start_at
        || toIsoFromLegacyDateTime(sessionDateValue, sessionStartTimeValue, 9, 0)
      const endIso = session?.endAt
        || session?.end_at
        || toIsoFromLegacyDateTime(sessionDateValue, sessionEndTimeValue, 10, 0)
      const startDate = new Date(startIso)

      const fieldId = String(recurrenceMeta?.fieldId || '').trim()
      const fieldName = String(recurrenceMeta?.fieldName || session?.location || '').trim() || resolveFieldNameById(fieldId)
      const selectedFieldParts = Array.isArray(recurrenceMeta?.selectedFieldParts)
        ? recurrenceMeta.selectedFieldParts
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 1)
        : []

      return {
        id: String(session?.id || ''),
        teamId: resolveSessionTeamId(session),
        type,
        metricCode,
        icon: EVENT_ICON_BY_TYPE[type] || 'event',
        category: EVENT_CATEGORY_BY_TYPE[type] || 'Udalost',
        label: String(session?.title || session?.name || session?.label || '').trim() || DEFAULT_EVENT_LABEL_BY_TYPE[type] || 'Udalost',
        time: formatEventTimeRange(startIso, endIso),
        dateKey: Number.isNaN(startDate.getTime()) ? '' : toDateKey(startDate),
        startAt: startIso,
        endAt: endIso,
        description: String(session?.description || session?.notes || '').trim(),
        fieldId,
        fieldName,
        selectedFieldParts,
      }
    }).filter((event) => event.dateKey)
  }, [plannerSessions, resolveFieldNameById])

  const monthEventSeedByDay = useMemo(() => {
    const seed = new Map()

    plannerEvents.forEach((event) => {
      const start = new Date(event.startAt)
      if (Number.isNaN(start.getTime())) return
      if (start.getFullYear() !== displayedMonthDate.getFullYear() || start.getMonth() !== displayedMonthDate.getMonth()) {
        return
      }

      const day = start.getDate()
      const existing = seed.get(day) || []
      seed.set(day, [...existing, event])
    })

    return seed
  }, [plannerEvents, displayedMonthDate])

  const dynamicCalendarCells = useMemo(
    () => buildMonthCells(displayedMonthDate, monthEventSeedByDay),
    [displayedMonthDate, monthEventSeedByDay]
  )

  const indicatorColorMap = useMemo(() => {
    const usedColors = new Set()
    let fallbackIndex = 0

    const assignColor = (metricCode) => {
      const normalizedCode = normalizeMetricCode(metricCode)
      const presetColor = EVIDENCE_PRESET_COLORS_BY_CODE[normalizedCode]
      if (presetColor && !usedColors.has(presetColor)) {
        usedColors.add(presetColor)
        return presetColor
      }

      while (usedColors.has(EVIDENCE_FALLBACK_COLORS[fallbackIndex % EVIDENCE_FALLBACK_COLORS.length])) {
        fallbackIndex += 1
      }

      const fallbackColor = EVIDENCE_FALLBACK_COLORS[fallbackIndex % EVIDENCE_FALLBACK_COLORS.length]
      fallbackIndex += 1
      usedColors.add(fallbackColor)
      return fallbackColor
    }

    const map = new Map()
    activeIndicatorCodes.forEach((code) => {
      map.set(code, assignColor(code))
    })
    return map
  }, [activeIndicatorCodes])

  const plannerColorStyle = useMemo(() => {
    const tj = indicatorColorMap.get('TJ') || EVIDENCE_PRESET_COLORS_BY_CODE.TJ
    const pz = indicatorColorMap.get('PZ') || EVIDENCE_PRESET_COLORS_BY_CODE.PZ
    const mz = indicatorColorMap.get('MZ') || EVIDENCE_PRESET_COLORS_BY_CODE.MZ
    const cup = indicatorColorMap.get('CUP') || EVIDENCE_PRESET_COLORS_BY_CODE.CUP
    const selectedIndicatorCode = String(eventForm.indicatorCode || 'TJ')
    const selectedAccent = indicatorColorMap.get(selectedIndicatorCode) || indicatorColorMap.get('TJ') || tj

    return {
      '--planner-color-tj': tj,
      '--planner-color-pz': pz,
      '--planner-color-mz': mz,
      '--planner-color-cup': cup,
      '--planner-selected-day-accent': selectedAccent,
      '--planner-selected-day-accent-soft': hexToRgba(selectedAccent, 0.22),
      '--planner-color-tj-border': hexToRgba(tj, 0.72),
      '--planner-color-tj-bg': hexToRgba(tj, 0.28),
      '--planner-color-tj-text': hexToRgba(tj, 0.98),
      '--planner-color-pz-border': hexToRgba(pz, 0.72),
      '--planner-color-pz-bg': hexToRgba(pz, 0.32),
      '--planner-color-pz-text': '#ffedd5',
      '--planner-color-mz-border': hexToRgba(mz, 0.74),
      '--planner-color-mz-bg': hexToRgba(mz, 0.34),
      '--planner-color-mz-text': '#fee2e2',
      '--planner-color-cup-border': hexToRgba(cup, 0.72),
      '--planner-color-cup-bg': hexToRgba(cup, 0.32),
      '--planner-color-cup-text': '#fce7f3'
    }
  }, [indicatorColorMap, eventForm.indicatorCode])

  useEffect(() => {
    let isMounted = true

    const loadTeams = async () => {
      try {
        const data = await api.getTeams()
        const teams = Array.isArray(data?.teams) ? data.teams : []

        const mapped = teams
          .map((team) => ({
            id: String(team?.id ?? '').trim(),
            label: String(team?.name || team?.ageGroup || '').trim()
          }))
          .filter((item) => item.id && item.label)

        const filters = [{ id: 'all', label: 'Všetky' }, ...mapped]
        if (isMounted) setTeamFilters(filters)
      } catch {
        if (isMounted) setTeamFilters([{ id: 'all', label: 'Všetky' }])
      }
    }

    loadTeams()

    return () => {
      isMounted = false
    }
  }, [])

  const loadActiveIndicators = useCallback(async () => {
    try {
      let resolvedClubId = ''
      try {
        const members = await api.getMyClubMembers()
        resolvedClubId = String(members?.clubId ?? '').trim()
      } catch {
        resolvedClubId = ''
      }

      if (!resolvedClubId) {
        try {
          const club = await api.getMyClub()
          resolvedClubId = String(club?.id ?? '').trim()
        } catch {
          resolvedClubId = ''
        }
      }

      let attendanceDisplayDraft = {}
      if (resolvedClubId) {
        try {
          const response = await api.getAttendanceDisplaySettings()
          attendanceDisplayDraft = response?.settings && typeof response.settings === 'object'
            ? response.settings
            : {}
        } catch {
          attendanceDisplayDraft = {}
        }
      }

      const response = await api.getMetrics({ context: 'attendance' })
      const metrics = Array.isArray(response?.metrics) ? response.metrics : []
      const enabledEvidenceMetricIds = getEnabledEvidenceMetricIds(metrics, attendanceDisplayDraft)

      const availableCodes = metrics
        .filter((metric) => metric?.isActive !== false)
        .filter((metric) => enabledEvidenceMetricIds.has(String(metric?.id ?? '').trim()))
        .map((metric) => normalizeMetricCode(toMetricShortLabel(metric)))
        .filter(Boolean)
      const uniqueAvailableCodes = [...new Set(availableCodes)]

      const activeCodes = metrics
        .filter((metric) => metric?.isActive !== false)
        .filter((metric) => enabledEvidenceMetricIds.has(String(metric?.id ?? '').trim()))
        .map((metric) => normalizeMetricCode(toMetricShortLabel(metric)))
        .filter(Boolean)

      const uniqueActiveCodes = [...new Set(activeCodes)]

      setAvailableIndicatorCodes(uniqueAvailableCodes)
      setActiveIndicatorCodes(uniqueActiveCodes)
    } catch {
      setAvailableIndicatorCodes([...DEFAULT_PLANNER_INDICATOR_CODES])
      setActiveIndicatorCodes([...DEFAULT_PLANNER_INDICATOR_CODES])
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadSafe = async () => {
      if (!isMounted) return
      await loadActiveIndicators()
    }

    const handleFocus = () => {
      loadSafe()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSafe()
      }
    }

    loadSafe()
    const intervalId = window.setInterval(loadSafe, 5000)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadActiveIndicators])

  useEffect(() => {
    const exists = teamFilters.some((item) => String(item.id) === String(activeFilter))
    if (!exists) setActiveFilter('all')
  }, [teamFilters, activeFilter])

  const teamSlotToFilterId = useMemo(() => {
    const dynamicTeamFilters = teamFilters.filter((item) => item.id !== 'all')
    return {
      first: String(dynamicTeamFilters[0]?.id || ''),
      second: String(dynamicTeamFilters[1]?.id || dynamicTeamFilters[0]?.id || '')
    }
  }, [teamFilters])

  const teamLabelById = useMemo(() => {
    const map = new Map()
    teamFilters
      .filter((item) => String(item?.id || '') !== 'all')
      .forEach((item) => {
        const id = String(item?.id || '').trim()
        if (!id) return
        map.set(id, String(item?.label || '').trim() || `Kategória ${id}`)
      })
    return map
  }, [teamFilters])

  useEffect(() => {
    const teamIds = teamFilters
      .filter((item) => item.id !== 'all')
      .map((item) => String(item.id || '').trim())
      .filter(Boolean)

    if (teamIds.length === 0) {
      setPlannerSessions([])
      return
    }

    const rangeStart = activeView === 'week'
      ? new Date(displayedWeekStartDate.getFullYear(), displayedWeekStartDate.getMonth(), displayedWeekStartDate.getDate())
      : new Date(displayedMonthDate.getFullYear(), displayedMonthDate.getMonth(), 1)

    const rangeEnd = activeView === 'week'
      ? new Date(displayedWeekStartDate.getFullYear(), displayedWeekStartDate.getMonth(), displayedWeekStartDate.getDate() + 6)
      : new Date(displayedMonthDate.getFullYear(), displayedMonthDate.getMonth() + 1, 0)

    const params = {
      start_date: toDateKey(rangeStart),
      end_date: toDateKey(rangeEnd)
    }

    let isMounted = true

    const loadSessions = async () => {
      const results = await Promise.allSettled(
        teamIds.map((teamId) => api.getTeamTrainingSessions(teamId, params))
      )

      if (!isMounted) return

      const merged = []
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return
        const sessions = Array.isArray(result.value?.sessions)
          ? result.value.sessions
          : (Array.isArray(result.value?.trainings) ? result.value.trainings : [])
        sessions.forEach((session) => {
          merged.push({ ...session, teamId: resolveSessionTeamId(session, teamIds[index]) })
        })
      })

      const deduped = []
      const seen = new Set()
      merged.forEach((session) => {
        const id = String(session?.id || '').trim()
        const sessionDateValue = session?.date
          || session?.training_date
          || session?.scheduled_date
          || session?.session_date
        const startToken = String(
          session?.startAt
          || session?.start_at
          || session?.startTime
          || session?.start_time
          || ''
        ).trim()
        const teamToken = resolveSessionTeamId(session)
        const typeToken = String(session?.sessionType || session?.session_type || session?.type || '').trim().toLowerCase()
        const dateToken = String(sessionDateValue || '').trim()
        const dedupeKey = id || `${dateToken}|${startToken}|${teamToken}|${typeToken}`

        if (!dedupeKey || seen.has(dedupeKey)) return

        seen.add(dedupeKey)
        deduped.push(session)
      })

      setPlannerSessions(deduped)
    }

    loadSessions().catch(() => {
      if (isMounted) setPlannerSessions([])
    })

    return () => {
      isMounted = false
    }
  }, [teamFilters, activeView, displayedWeekStartDate, displayedMonthDate])

  const visibleCells = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
    return dynamicCalendarCells.map((cell) => {
      if (!Array.isArray(cell.events) || cell.events.length === 0) return cell
      const events = cell.events.filter((event) => {
        const metricCode = EVENT_METRIC_CODE_BY_TYPE[String(event?.type || '')]
        if (metricCode && !activeIndicatorCodes.includes(metricCode)) return false

        const resolvedTeamId = String(teamSlotToFilterId[event.teamSlot] || event.teamId || '')
        const teamMatches = activeFilter === 'all' || resolvedTeamId === String(activeFilter)
        if (!teamMatches) return false

        if (!normalizedSearch) return true

        return String(event.label || '').toLowerCase().includes(normalizedSearch)
      })
      return { ...cell, events }
    })
  }, [searchTerm, activeFilter, teamSlotToFilterId, activeIndicatorCodes, dynamicCalendarCells])

  const visibleLegendItems = useMemo(() => {
    const classNameByCode = {
      TJ: 'training',
      PZ: 'match',
      MZ: 'cancelled',
      CUP: 'tournament'
    }

    return activeIndicatorCodes
      .map((code) => ({
        code,
        className: classNameByCode[code] || '',
        color: indicatorColorMap.get(code) || '#4a83e3'
      }))
  }, [activeIndicatorCodes, indicatorColorMap])

  const getEventCategoryLabel = useCallback((event) => {
    const teamId = String(event?.teamId || '').trim()
    if (teamId) {
      return teamLabelById.get(teamId) || `Kategória ${teamId}`
    }
    return 'Kategória'
  }, [teamLabelById])

  const getEventCapsuleLabel = useCallback((event) => {
    if (isClubRole) return getEventCategoryLabel(event)
    return String(event?.label || '').trim() || 'Udalosť'
  }, [getEventCategoryLabel, isClubRole])

  const getEventTooltip = useCallback((event) => {
    const lines = []
    const categoryLabel = getEventCategoryLabel(event)
    const eventLabel = String(event?.label || '').trim()
    const eventTime = String(event?.time || '').trim()
    const fieldLabel = String(event?.fieldName || '').trim()
    const description = String(event?.description || '').trim()

    lines.push(`Kategória: ${categoryLabel}`)
    if (eventLabel) lines.push(`Udalosť: ${eventLabel}`)
    if (eventTime) lines.push(`Čas: ${eventTime}`)
    if (fieldLabel) lines.push(`Ihrisko: ${fieldLabel}`)
    if (description) lines.push(`Popis: ${description}`)

    return lines.join('\n')
  }, [getEventCategoryLabel])

  const fieldBookingCells = useMemo(() => {
    const seed = new Map()
    plannerEvents
      .filter((event) => event.fieldId)
      .filter((event) => Array.isArray(event.selectedFieldParts) && event.selectedFieldParts.length > 0)
      .forEach((event) => {
        const start = new Date(event.startAt)
        if (Number.isNaN(start.getTime())) return
        if (start.getFullYear() !== displayedMonthDate.getFullYear() || start.getMonth() !== displayedMonthDate.getMonth()) {
          return
        }

        const day = start.getDate()
        const existing = seed.get(day) || []
        seed.set(day, [...existing, {
          ...event,
          type: 'field-booking',
          icon: EVENT_ICON_BY_TYPE[event.type] || EVENT_ICON_BY_TYPE['field-booking'],
          label: `${event.fieldName || 'Ihrisko'}: ${event.label}`,
        }])
      })

    for (const [day, events] of seed.entries()) {
      const filtered = events.filter((event) => {
        if (activeFilter !== 'all' && String(event.teamId) !== String(activeFilter)) return false
        const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
        if (!normalizedSearch) return true
        return [event.label, event.fieldName, event.time]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(normalizedSearch))
      })
      seed.set(day, filtered)
    }

    return buildMonthCells(displayedMonthDate, seed)
  }, [plannerEvents, displayedMonthDate, activeFilter, searchTerm])

  const fieldBookingWeekDays = useMemo(() => {
    return DAY_HEADERS.map((label, dayIndex) => {
      const date = new Date(displayedWeekStartDate.getFullYear(), displayedWeekStartDate.getMonth(), displayedWeekStartDate.getDate() + dayIndex)
      const dateKey = toDateKey(date)
      const dayId = String(label || '').slice(0, 3).toLowerCase()

      const events = plannerEvents
        .filter((event) => event.dateKey === dateKey && event.fieldId)
        .filter((event) => Array.isArray(event.selectedFieldParts) && event.selectedFieldParts.length > 0)
        .filter((event) => (activeFilter === 'all' ? true : String(event.teamId) === String(activeFilter)))
        .filter((event) => {
          const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
          if (!normalizedSearch) return true
          return [event.label, event.fieldName, event.time]
            .map((value) => String(value || '').toLowerCase())
            .some((value) => value.includes(normalizedSearch))
        })
        .map((event) => ({
          ...event,
          type: 'field-booking',
          icon: EVENT_ICON_BY_TYPE[event.type] || EVENT_ICON_BY_TYPE['field-booking'],
          fieldName: event.fieldName || 'Ihrisko',
        }))

      return {
        id: dayId,
        label,
        dateKey,
        events,
      }
    })
  }, [plannerEvents, displayedWeekStartDate, activeFilter, searchTerm])

  const visibleWeekTimeline = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()

    return DAY_HEADERS.map((label, dayIndex) => {
      const date = new Date(displayedWeekStartDate.getFullYear(), displayedWeekStartDate.getMonth(), displayedWeekStartDate.getDate() + dayIndex)
      const dateKey = toDateKey(date)
      const dayId = String(label || '').slice(0, 3).toLowerCase()

      const events = plannerEvents.filter((event) => {
        const metricCode = EVENT_METRIC_CODE_BY_TYPE[String(event.type || '')]
        if (metricCode && !activeIndicatorCodes.includes(metricCode)) return false

        if (event.dateKey !== dateKey) return false

        const teamMatches = activeFilter === 'all' || String(event.teamId || '') === String(activeFilter)
        if (!teamMatches) return false

        if (!normalizedSearch) return true

        return [event.label, event.category, event.time, event.fieldName]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(normalizedSearch))
      })

      return {
        id: dayId,
        label,
        dateKey,
        events
      }
    })
  }, [searchTerm, activeFilter, activeIndicatorCodes, displayedWeekStartDate, plannerEvents])

  const fieldOptions = useMemo(() => (
    (Array.isArray(clubFields) ? clubFields : [])
      .map((field, index) => {
        const rawId = String(field?.id ?? '').trim()
        const resolvedId = rawId || `fallback-${index + 1}`
        const name = String(field?.name || '').trim() || `Ihrisko ${index + 1}`
        const rawParts = Number(field?.partsTotal ?? field?.parts_total ?? 1)
        const partsTotal = Number.isFinite(rawParts) && rawParts > 0 ? Math.floor(rawParts) : 1
        const dimensions = String(field?.dimensions || '').trim()
        const parsedDimensions = parseFieldDimensions(dimensions)
        return { id: resolvedId, name, partsTotal, dimensions, parsedDimensions }
      })
  ), [clubFields])

  const selectedField = useMemo(
    () => fieldOptions.find((item) => item.id === eventForm.fieldId) || null,
    [fieldOptions, eventForm.fieldId]
  )

  const fieldPartsOptions = useMemo(() => {
    const total = selectedField?.partsTotal || 1
    return Array.from({ length: total + 1 }, (_, index) => String(index))
  }, [selectedField])

  const reservedFieldPartOwners = useMemo(() => {
    if (!selectedField) return new Map()

    const targetDates = eventForm.multiDateMode
      ? (Array.isArray(eventForm.selectedDates) ? eventForm.selectedDates : []).filter(Boolean)
      : [eventForm.date].filter(Boolean)
    if (targetDates.length === 0) return new Map()

    const targetStart = toMinutesFromHHmm(eventForm.timeFrom)
    const targetEndRaw = toMinutesFromHHmm(eventForm.timeTo)
    if (!Number.isFinite(targetStart) || !Number.isFinite(targetEndRaw)) return new Map()
    const targetEnd = targetEndRaw <= targetStart ? targetStart + 60 : targetEndRaw

    const currentTeamId = String(eventForm.teamId || '').trim()
    const ownersByPart = new Map()

    plannerEvents.forEach((event) => {
      if (String(event.fieldId || '') !== String(selectedField.id)) return
      if (!targetDates.includes(String(event.dateKey || ''))) return
      if (editingEventId && String(event.id || '') === String(editingEventId)) return

      const eventTeamId = String(event.teamId || '').trim()
      if (currentTeamId && eventTeamId && currentTeamId === eventTeamId) return
      const eventTeamLabel = teamLabelById.get(eventTeamId) || (eventTeamId ? `Kategória ${eventTeamId}` : 'Iná kategória')

      const [eventStartText = '', eventEndText = ''] = String(event.time || '').split(' - ')
      const eventStart = toMinutesFromHHmm(eventStartText)
      const eventEndRaw = toMinutesFromHHmm(eventEndText)
      if (!Number.isFinite(eventStart) || !Number.isFinite(eventEndRaw)) return
      const eventEnd = eventEndRaw <= eventStart ? eventStart + 60 : eventEndRaw

      if (!isTimeOverlap(targetStart, targetEnd, eventStart, eventEnd)) return

      const parts = Array.isArray(event.selectedFieldParts)
        ? event.selectedFieldParts.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 1)
        : []
      parts.forEach((part) => {
        const currentOwners = ownersByPart.get(part) || new Set()
        currentOwners.add(eventTeamLabel)
        ownersByPart.set(part, currentOwners)
      })
    })

    const normalized = new Map()
    ownersByPart.forEach((ownersSet, partIndex) => {
      normalized.set(partIndex, Array.from(ownersSet).sort((a, b) => a.localeCompare(b)))
    })

    return normalized
  }, [selectedField, eventForm.multiDateMode, eventForm.selectedDates, eventForm.date, eventForm.timeFrom, eventForm.timeTo, eventForm.teamId, plannerEvents, editingEventId, teamLabelById])

  const reservedFieldParts = useMemo(() => new Set(reservedFieldPartOwners.keys()), [reservedFieldPartOwners])

  const availableFieldPartIndices = useMemo(() => {
    const total = selectedField?.partsTotal || 1
    const values = []
    for (let part = 1; part <= total; part += 1) {
      if (!reservedFieldParts.has(part)) values.push(part)
    }
    return values
  }, [selectedField, reservedFieldParts])

  const isDateSelected = useCallback((dateKey) => {
    if (!dateKey) return false
    const selectedDates = Array.isArray(eventForm.selectedDates) ? eventForm.selectedDates : []
    if (selectedDates.includes(dateKey)) return true
    return String(eventForm.date || '') === String(dateKey)
  }, [eventForm.date, eventForm.selectedDates])

  const selectedFieldRatio = useMemo(() => {
    const ratio = Number(selectedField?.parsedDimensions?.ratio)
    if (!Number.isFinite(ratio) || ratio <= 0) return 1.6
    return Math.max(1.1, Math.min(2.4, ratio))
  }, [selectedField])

  const selectedFieldGridLayout = useMemo(
    () => getFieldGridLayout(selectedField?.partsTotal || 1),
    [selectedField]
  )

  const visualFieldPartOrder = useMemo(() => {
    const total = selectedField?.partsTotal || 1
    if (total === 4) return [1, 3, 2, 4]
    return Array.from({ length: total }, (_, index) => index + 1)
  }, [selectedField])

  useEffect(() => {
    if (!sidebarOpen) return
    setEventForm((prev) => {
      const next = { ...prev }
      if (!next.teamId && activeFilter !== 'all') {
        next.teamId = String(activeFilter)
      }
      if (!next.fieldId && fieldOptions.length > 0) {
        next.fieldId = fieldOptions[0].id
      }
      if (!next.fieldParts) {
        next.fieldParts = '0'
      }
      if (!Array.isArray(next.selectedFieldParts)) {
        next.selectedFieldParts = []
      }
      return next
    })
  }, [sidebarOpen, activeFilter, fieldOptions])

  useEffect(() => {
    if (!selectedField) return
    const maxParts = selectedField.partsTotal
    setEventForm((prev) => {
      const raw = Number(prev.fieldParts || '0')
      const allowedMax = availableFieldPartIndices.length
      const safeCount = Number.isFinite(raw) && raw >= 0 ? Math.min(Math.floor(raw), allowedMax) : 0

      const existing = Array.isArray(prev.selectedFieldParts)
        ? prev.selectedFieldParts
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 1 && value <= maxParts && !reservedFieldParts.has(value))
        : []

      let selected = [...new Set(existing)].sort((a, b) => a - b).slice(0, safeCount)
      if (selected.length < safeCount) {
        for (const part of availableFieldPartIndices) {
          if (selected.length >= safeCount) break
          if (!selected.includes(part)) selected.push(part)
        }
      }

      if (String(safeCount) === String(prev.fieldParts || '')
        && JSON.stringify(selected) === JSON.stringify(prev.selectedFieldParts || [])) {
        return prev
      }

      return {
        ...prev,
        fieldParts: String(safeCount),
        selectedFieldParts: selected
      }
    })
  }, [selectedField, reservedFieldParts, availableFieldPartIndices])

  const handleFieldPartsCountChange = useCallback((rawCount) => {
    const maxParts = availableFieldPartIndices.length
    const parsed = Number(rawCount)
    const safeCount = Number.isFinite(parsed) && parsed >= 0 ? Math.min(maxParts, Math.floor(parsed)) : 0

    setEventForm((prev) => {
      const existing = Array.isArray(prev.selectedFieldParts)
        ? prev.selectedFieldParts
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 1 && !reservedFieldParts.has(value))
        : []

      let selected = [...new Set(existing)].sort((a, b) => a - b).slice(0, safeCount)
      if (selected.length < safeCount) {
        for (const part of availableFieldPartIndices) {
          if (selected.length >= safeCount) break
          if (!selected.includes(part)) selected.push(part)
        }
      }

      return {
        ...prev,
        fieldParts: String(safeCount),
        selectedFieldParts: selected
      }
    })
  }, [availableFieldPartIndices, reservedFieldParts])

  const handleFieldPartToggle = useCallback((partIndex) => {
    if (reservedFieldParts.has(partIndex)) return
    const maxSelectable = selectedField?.partsTotal || 1

    setEventForm((prev) => {
      const current = Array.isArray(prev.selectedFieldParts)
        ? prev.selectedFieldParts
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
        : []

      const exists = current.includes(partIndex)
      if (exists) {
        const nextSelected = current.filter((value) => value !== partIndex).sort((a, b) => a - b)
        return {
          ...prev,
          selectedFieldParts: nextSelected,
          fieldParts: String(nextSelected.length)
        }
      }

      if (current.length >= maxSelectable) {
        return prev
      }

      const next = [...current, partIndex].sort((a, b) => a - b)
      return {
        ...prev,
        selectedFieldParts: next,
        fieldParts: String(next.length)
      }
    })
  }, [selectedField, reservedFieldParts])

  useEffect(() => {
    const firstAvailableCode = availableIndicatorCodes[0] || ''
    if (!firstAvailableCode) return

    setEventForm((prev) => {
      if (prev.indicatorCode) return prev
      return {
        ...prev,
        indicatorCode: firstAvailableCode,
        type: EVENT_TYPE_BY_METRIC_CODE[firstAvailableCode] || 'training'
      }
    })
  }, [availableIndicatorCodes])

  const handleIndicatorToggle = useCallback((code) => {
    setEventForm((prev) => ({
      ...prev,
      indicatorCode: code,
      type: EVENT_TYPE_BY_METRIC_CODE[code] || 'training'
    }))
  }, [])

  const handleTrainingGroupToggle = useCallback((groupName) => {
    const safeGroup = String(groupName || '').trim()
    if (!safeGroup) return

    setEventForm((prev) => {
      const current = Array.isArray(prev.selectedTrainingGroups)
        ? prev.selectedTrainingGroups.map((item) => String(item || '').trim()).filter(Boolean)
        : []

      const nextGroups = current.includes(safeGroup)
        ? current.filter((item) => item !== safeGroup)
        : [...current, safeGroup]

      return {
        ...prev,
        selectedTrainingGroups: nextGroups,
        label: nextGroups.join(', ')
      }
    })
  }, [])

  const handleMultiDateToggle = useCallback(() => {
    setEventForm((prev) => {
      const nextMode = !prev.multiDateMode
      if (!nextMode) {
        return {
          ...prev,
          multiDateMode: false,
          selectedDates: []
        }
      }

      const selectedDates = prev.date ? [prev.date] : prev.selectedDates
      return {
        ...prev,
        multiDateMode: true,
        selectedDates: [...new Set(selectedDates)]
      }
    })
  }, [])

  const handleCalendarDateClick = useCallback((dateKey) => {
    setEventForm((prev) => {
      if (!prev.multiDateMode) {
        return {
          ...prev,
          date: dateKey
        }
      }

      const current = Array.isArray(prev.selectedDates) ? prev.selectedDates : []
      const exists = current.includes(dateKey)
      const selectedDates = exists
        ? current.filter((item) => item !== dateKey)
        : [...current, dateKey]
      const sortedDates = [...selectedDates].sort((a, b) => a.localeCompare(b))

      return {
        ...prev,
        selectedDates: sortedDates,
        date: sortedDates[0] || prev.date
      }
    })
  }, [])

  const openPlannerTimePicker = useCallback((targetField) => {
    const safeTarget = targetField === 'timeTo' ? 'timeTo' : 'timeFrom'
    setPlannerTimeClockTarget(safeTarget)
    setIsPlannerTimeClockOpen(true)
  }, [])

  const closePlannerTimeClock = useCallback(() => {
    setIsPlannerTimeClockOpen(false)
  }, [])

  const openNativePicker = useCallback((event) => {
    const input = event?.currentTarget
    if (!input || typeof input.showPicker !== 'function') return
    try {
      input.showPicker()
    } catch {
      // Some browsers block showPicker without trusted user gesture.
    }
  }, [])

  const resetEventForm = useCallback(() => {
    setEditingEventId('')
    setEventForm({
      label: '',
      selectedTrainingGroups: [],
      type: 'training',
      indicatorCode: availableIndicatorCodes[0] || '',
      date: '',
      selectedDates: [],
      multiDateMode: false,
      timeFrom: '',
      timeTo: '',
      teamId: activeFilter !== 'all' ? String(activeFilter) : '',
      fieldId: fieldOptions[0]?.id || '',
      fieldParts: '0',
      selectedFieldParts: []
    })
  }, [availableIndicatorCodes, activeFilter, fieldOptions])

  const openEventForEditing = useCallback((event) => {
    const eventId = String(event?.id || '').trim()
    if (!eventId) return

    const startDate = new Date(event?.startAt)
    const dateKey = Number.isNaN(startDate.getTime()) ? String(event?.dateKey || '') : toDateKey(startDate)
    const startTime = String(event?.time || '').split(' - ')[0] || ''
    const endTime = String(event?.time || '').split(' - ')[1] || ''
    const selectedFieldParts = Array.isArray(event?.selectedFieldParts)
      ? event.selectedFieldParts
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1)
      : []

    const directFieldId = String(event?.fieldId || '').trim()
    const matchedField = fieldOptions.find((field) => (
      directFieldId
        ? String(field.id) === directFieldId
        : String(field.name || '').trim().toLowerCase() === String(event?.fieldName || '').trim().toLowerCase()
    ))
    const resolvedFieldId = String(matchedField?.id || directFieldId || fieldOptions[0]?.id || '')
    const maxParts = Number(matchedField?.partsTotal || fieldOptions.find((field) => String(field.id) === resolvedFieldId)?.partsTotal || 1)
    const clampedSelectedParts = selectedFieldParts
      .filter((value) => value <= maxParts)
      .slice(0, maxParts)
    const eventLabel = String(event?.label || '')
    const labelItems = eventLabel
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const trainingGroupValueSet = new Set(
      (Array.isArray(trainingDivisionGroupOptions) ? trainingDivisionGroupOptions : [])
        .map((option) => String(option?.value || '').trim())
        .filter(Boolean)
    )
    const selectedTrainingGroups = labelItems.filter((item) => trainingGroupValueSet.has(item))

    setEditingEventId(eventId)
    setSidebarOpen(true)
    setEventForm((prev) => ({
      ...prev,
      label: eventLabel,
      selectedTrainingGroups,
      type: String(event?.type || 'training'),
      indicatorCode: String(event?.metricCode || prev.indicatorCode || availableIndicatorCodes[0] || 'TJ'),
      date: dateKey,
      selectedDates: dateKey ? [dateKey] : [],
      multiDateMode: false,
      timeFrom: startTime,
      timeTo: endTime,
      teamId: String(event?.teamId || ''),
      fieldId: resolvedFieldId,
      fieldParts: String(clampedSelectedParts.length),
      selectedFieldParts: clampedSelectedParts
    }))
  }, [availableIndicatorCodes, fieldOptions])

  const plannerTitle = activeView === 'week' ? getWeekTitle(displayedWeekStartDate) : getMonthTitle(displayedMonthDate)
  const prevPeriodLabel = activeView === 'week' ? 'Predchádzajúci týždeň' : 'Predchádzajúci mesiac'
  const nextPeriodLabel = activeView === 'week' ? 'Nasledujúci týždeň' : 'Nasledujúci mesiac'

  const handlePrevPeriod = () => {
    if (activeView === 'week') {
      setDisplayedWeekStartDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7))
      return
    }

    setDisplayedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextPeriod = () => {
    if (activeView === 'week') {
      setDisplayedWeekStartDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7))
      return
    }

    setDisplayedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleEventFormSubmit = useCallback(async (e) => {
    e.preventDefault()

    const teamId = String(eventForm.teamId || '').trim()
    if (!teamId) {
      window.alert('Vyber kategoriu pre udalost.')
      return
    }

    const selectedDates = eventForm.multiDateMode
      ? (Array.isArray(eventForm.selectedDates) ? eventForm.selectedDates.filter(Boolean) : [])
      : [eventForm.date].filter(Boolean)

    const uniqueDates = [...new Set(selectedDates)]
    if (uniqueDates.length === 0) {
      window.alert('Vyber aspon jeden datum.')
      return
    }

    const selectedIndicatorCode = String(eventForm.indicatorCode || availableIndicatorCodes[0] || 'TJ')
    const plannerType = EVENT_TYPE_BY_METRIC_CODE[selectedIndicatorCode] || 'training'
    const sessionType = SESSION_TYPE_BY_METRIC_CODE[selectedIndicatorCode] || 'training'
    const selectedTrainingGroups = Array.isArray(eventForm.selectedTrainingGroups)
      ? [...new Set(eventForm.selectedTrainingGroups.map((item) => String(item || '').trim()).filter(Boolean))]
      : []
    const shouldUseTrainingGroupLabel = selectedIndicatorCode === 'TJ'
      && Array.isArray(trainingDivisionGroupOptions)
      && trainingDivisionGroupOptions.length > 0
    const resolvedEventLabel = shouldUseTrainingGroupLabel && selectedTrainingGroups.length > 0
      ? selectedTrainingGroups.join(', ')
      : String(eventForm.label || '').trim()
    const title = resolvedEventLabel || DEFAULT_EVENT_LABEL_BY_TYPE[plannerType] || 'Trening'

    const selectedFieldMeta = fieldOptions.find((field) => String(field.id) === String(eventForm.fieldId))
    const safeFieldParts = Array.isArray(eventForm.selectedFieldParts)
      ? eventForm.selectedFieldParts
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1)
      : []

    const createPayloads = uniqueDates.map((dateKey) => {
      const startIso = buildEventDateTimeIso(dateKey, eventForm.timeFrom, 9, 0)
      const endIso = buildEventDateTimeIso(dateKey, eventForm.timeTo, 10, 0)
      if (!startIso || !endIso) return null

      const startDate = new Date(startIso)
      const endDate = new Date(endIso)
      if (endDate <= startDate) {
        endDate.setHours(startDate.getHours() + 1)
      }

      return {
        title,
        session_type: sessionType,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        date: dateKey,
        start_time: eventForm.timeFrom || `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
        end_time: eventForm.timeTo || `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
        location: selectedFieldMeta?.name || '',
        recurrence_rule: JSON.stringify({
          indicatorCode: selectedIndicatorCode,
          fieldId: selectedFieldMeta?.id || '',
          fieldName: selectedFieldMeta?.name || '',
          selectedFieldParts: safeFieldParts,
        })
      }
    }).filter(Boolean)

    if (createPayloads.length === 0) {
      window.alert('Skontroluj datum a cas udalosti.')
      return
    }

    setIsSubmittingEvent(true)
    try {
      if (editingEventId) {
        const payload = createPayloads[0]
        await api.updateTeamTrainingSession(editingEventId, teamId, payload)

        setPlannerSessions((prev) => prev.map((session) => {
          if (String(session?.id || '') !== String(editingEventId)) return session
          return {
            ...session,
            teamId,
            team_id: teamId,
            title,
            date: payload.date,
            start_time: payload.start_time,
            end_time: payload.end_time,
            start_at: payload.start_at,
            end_at: payload.end_at,
            location: payload.location,
            recurrence_rule: payload.recurrence_rule,
            session_type: payload.session_type,
          }
        }))
      } else {
        for (const payload of createPayloads) {
          let created = false
          let lastError = null

          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await api.createTeamTrainingSession(teamId, payload)
              created = true
              break
            } catch (error) {
              lastError = error
              // Retry once for bulk-create requests that fail on the first pass.
              if (attempt === 0) {
                await new Promise((resolve) => setTimeout(resolve, 120))
              }
            }
          }

          if (!created) {
            const failedDate = String(payload?.date || '').trim()
            if (failedDate && lastError) {
              const wrappedError = new Error(`Nepodarilo sa uložiť udalosť pre dátum ${failedDate}: ${getApiErrorMessage(lastError)}`)
              wrappedError.cause = lastError
              throw wrappedError
            }
            throw lastError || new Error('Nepodarilo sa uložiť hromadnú udalosť')
          }
        }

        const rangeStart = activeView === 'week'
          ? new Date(displayedWeekStartDate.getFullYear(), displayedWeekStartDate.getMonth(), displayedWeekStartDate.getDate())
          : new Date(displayedMonthDate.getFullYear(), displayedMonthDate.getMonth(), 1)
        const rangeEnd = activeView === 'week'
          ? new Date(displayedWeekStartDate.getFullYear(), displayedWeekStartDate.getMonth(), displayedWeekStartDate.getDate() + 6)
          : new Date(displayedMonthDate.getFullYear(), displayedMonthDate.getMonth() + 1, 0)
        const refreshed = await api.getTeamTrainingSessions(teamId, {
          start_date: toDateKey(rangeStart),
          end_date: toDateKey(rangeEnd)
        })
        const refreshedSessions = Array.isArray(refreshed?.sessions)
          ? refreshed.sessions
          : (Array.isArray(refreshed?.trainings) ? refreshed.trainings : [])
        setPlannerSessions((prev) => {
          const others = prev.filter((session) => resolveSessionTeamId(session) !== teamId)
          return [...others, ...refreshedSessions.map((session) => ({ ...session, teamId: resolveSessionTeamId(session, teamId) }))]
        })
      }

      setSidebarOpen(false)
      resetEventForm()
    } catch (error) {
      window.alert(getApiErrorMessage(error))
    } finally {
      setIsSubmittingEvent(false)
    }
  }, [
    eventForm,
    availableIndicatorCodes,
    trainingDivisionGroupOptions,
    fieldOptions,
    activeView,
    displayedWeekStartDate,
    displayedMonthDate,
    activeFilter,
    editingEventId,
    resetEventForm,
  ])

  const shouldUseTrainingDivisionLabelSelect = String(eventForm.indicatorCode || '').trim().toUpperCase() === 'TJ'
    && Array.isArray(trainingDivisionGroupOptions)
    && trainingDivisionGroupOptions.length > 0

  const selectedTrainingGroups = Array.isArray(eventForm.selectedTrainingGroups)
    ? eventForm.selectedTrainingGroups.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  useEffect(() => {
    if (!shouldUseTrainingDivisionLabelSelect) return

    const validGroupSet = new Set(trainingDivisionGroupOptions.map((option) => String(option?.value || '').trim()).filter(Boolean))
    setEventForm((prev) => {
      const current = Array.isArray(prev.selectedTrainingGroups)
        ? prev.selectedTrainingGroups.map((item) => String(item || '').trim()).filter(Boolean)
        : []
      const filtered = current.filter((item) => validGroupSet.has(item))
      const nextLabel = filtered.join(', ')
      if (JSON.stringify(filtered) === JSON.stringify(current) && String(prev.label || '') === nextLabel) {
        return prev
      }

      return {
        ...prev,
        selectedTrainingGroups: filtered,
        label: nextLabel
      }
    })
  }, [shouldUseTrainingDivisionLabelSelect, trainingDivisionGroupOptions])

  const trainingGroupSummary = selectedTrainingGroups.length === 0
    ? 'Vyber skupiny tréningu'
    : (selectedTrainingGroups.length <= 2
      ? selectedTrainingGroups.join(', ')
      : `${selectedTrainingGroups.length} skupiny vybraté`)

  const handleDeleteEditingEvent = useCallback(async () => {
    if (!editingEventId) return

    const shouldDelete = window.confirm('Naozaj chceš odstrániť tento tréning?')
    if (!shouldDelete) return

    try {
      setIsSubmittingEvent(true)
      await api.deleteTeamTrainingSession(editingEventId, eventForm.teamId)
      setPlannerSessions((prev) => prev.filter((session) => String(session?.id || '') !== String(editingEventId)))
      setSidebarOpen(false)
      resetEventForm()
    } catch (error) {
      window.alert(getApiErrorMessage(error))
    } finally {
      setIsSubmittingEvent(false)
    }
  }, [editingEventId, eventForm.teamId, resetEventForm])

  return (
    <div className="planner-stitch-page" style={plannerColorStyle}>
      <div className="planner-stitch-page-header">
        <h1 className="planner-stitch-page-title">Tréningový plán</h1>
        <div className="planner-stitch-header-right">
          <div className="planner-stitch-search">
            <span className="material-icons-round" aria-hidden="true">search</span>
            <input
              type="text"
              placeholder="Hľadať udalosť..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Hľadať udalosť"
            />
          </div>

          <button
            type="button"
            className="planner-stitch-primary-btn"
            onClick={() => {
              resetEventForm()
              setSidebarOpen(true)
            }}
          >
            Pridať udalosť
          </button>
        </div>
      </div>
      <header className="planner-stitch-header">
        <div className="planner-stitch-header-left">
          <div className="planner-stitch-month-nav">
            <button type="button" className="planner-stitch-icon-btn" aria-label={prevPeriodLabel} onClick={handlePrevPeriod}>
              <span className="material-icons-round" aria-hidden="true">chevron_left</span>
            </button>
            <h2>{plannerTitle}</h2>
            <button type="button" className="planner-stitch-icon-btn" aria-label={nextPeriodLabel} onClick={handleNextPeriod}>
              <span className="material-icons-round" aria-hidden="true">chevron_right</span>
            </button>
          </div>

          <div className="planner-stitch-view-switch" role="group" aria-label="Prepínač pohľadu">
            <button
              type="button"
              className={activeView === 'month' ? 'active' : ''}
              onClick={() => setActiveView('month')}
            >
              Mesačný plán
            </button>
            <button
              type="button"
              className={activeView === 'week' ? 'active' : ''}
              onClick={() => setActiveView('week')}
            >
              Týždenný plán
            </button>
          </div>
        </div>

        <div className="planner-stitch-view-switch" role="group" aria-label="Prepínač režimu">
          <button
            type="button"
            className={activeMode === 'plan' ? 'active' : ''}
            onClick={() => setActiveMode('plan')}
          >
            Tréningový plán
          </button>
          <button
            type="button"
            className={activeMode === 'fields' ? 'active' : ''}
            onClick={() => setActiveMode('fields')}
          >
            Rozpis ihrísk
          </button>
        </div>
      </header>

      <div className="planner-stitch-filter-bar">
        {teamFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`planner-stitch-filter-chip ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}

        <div className="planner-stitch-divider" aria-hidden="true" />

        <div className="planner-stitch-legend">
          {visibleLegendItems.map((item) => (
            <span key={`legend-${item.code}`}><i className={item.className} style={{ background: item.color }} /> {item.code}</span>
          ))}
        </div>
      </div>

      <div className={`planner-stitch-body${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="planner-stitch-main">
      {activeMode === 'fields' ? (
        activeView === 'month' ? (
          <section className="planner-stitch-calendar-shell" aria-label="Mesačný rozpis ihrísk">
            <div className="planner-stitch-day-headers">
              {DAY_HEADERS.map((header, index) => (
                <div key={`fh-${header}`} className={index === 6 ? 'weekend' : ''}>{header}</div>
              ))}
            </div>
            <div className="planner-stitch-calendar-grid">
              {fieldBookingCells.map((cell) => (
                <article
                  key={cell.id}
                  className={`planner-stitch-day-cell ${cell.muted ? 'muted' : ''} ${cell.today ? 'today' : ''} ${isDateSelected(cell.dateKey) ? 'selected-date' : ''}`}
                  onClick={() => !cell.muted && handleCalendarDateClick(cell.dateKey)}
                >
                  <span className={`planner-stitch-day-number ${cell.weekend ? 'weekend' : ''}`}>{cell.day}</span>
                  <div className="planner-stitch-events">
                    {Array.isArray(cell.events) && cell.events.map((event, index) => (
                      <button
                        key={`${cell.id}-f-${index}`}
                        type="button"
                        className="planner-stitch-event field-booking"
                        title={getEventTooltip(event)}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          openEventForEditing(event)
                        }}
                      >
                        <span className="material-icons-round" aria-hidden="true">{event.icon}</span>
                        <span>{getEventCapsuleLabel(event)}</span>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="planner-stitch-week-shell" aria-label="Týždenný rozpis ihrísk">
            <div className="planner-stitch-day-headers">
              {DAY_HEADERS.map((header, index) => (
                <div key={`fwh-${header}`} className={index === 6 ? 'weekend' : ''}>{header}</div>
              ))}
            </div>
            <div className="planner-stitch-week-table">
              <div className="timeline-grid flex-1 gap-4">
                {fieldBookingWeekDays.map((day) => (
                  <div
                    key={day.id}
                    className={`planner-stitch-week-column ${isDateSelected(day.dateKey) ? 'selected-date' : ''}`}
                    onClick={() => handleCalendarDateClick(day.dateKey)}
                  >
                    <div className="planner-stitch-week-events-stack">
                      {day.events.length === 0 ? (
                        <div className="planner-stitch-week-empty">Bez rezervácií</div>
                      ) : (
                        day.events.map((event, index) => (
                          <article
                            key={`${day.id}-f-${index}`}
                            className="planner-stitch-week-card field-booking"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              openEventForEditing(event)
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(keyEvent) => {
                              if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                                keyEvent.preventDefault()
                                keyEvent.stopPropagation()
                                openEventForEditing(event)
                              }
                            }}
                          >
                            <div className="planner-stitch-week-card-head">
                              <span className="material-icons-round" aria-hidden="true">{event.icon}</span>
                              <span>{event.fieldName}</span>
                            </div>
                            <h4>{event.label}</h4>
                            <p>
                              <span className="material-icons-round" aria-hidden="true">schedule</span>
                              {event.time}
                            </p>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      ) : activeView === 'month' ? (
        <section className="planner-stitch-calendar-shell" aria-label="Mesačný kalendár">
          <div className="planner-stitch-day-headers">
            {DAY_HEADERS.map((header, index) => (
              <div key={header} className={index === 6 ? 'weekend' : ''}>{header}</div>
            ))}
          </div>

          <div className="planner-stitch-calendar-grid">
            {visibleCells.map((cell) => (
              <article
                key={cell.id}
                className={`planner-stitch-day-cell ${cell.muted ? 'muted' : ''} ${cell.today ? 'today' : ''} ${isDateSelected(cell.dateKey) ? 'selected-date' : ''}`}
                onClick={() => !cell.muted && handleCalendarDateClick(cell.dateKey)}
              >
                <span className={`planner-stitch-day-number ${cell.weekend ? 'weekend' : ''}`}>{cell.day}</span>

                <div className="planner-stitch-events">
                  {Array.isArray(cell.events) && cell.events.map((event, index) => (
                    <button
                      key={`${cell.id}-${event.label}-${index}`}
                      type="button"
                      className={`planner-stitch-event ${event.type}`}
                      title={getEventTooltip(event)}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        openEventForEditing(event)
                      }}
                    >
                      <span className="material-icons-round" aria-hidden="true">{event.icon}</span>
                      <span>{getEventCapsuleLabel(event)}</span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="planner-stitch-week-shell" aria-label="Týždenný plán">
          <div className="planner-stitch-day-headers">
            {DAY_HEADERS.map((header, index) => (
              <div key={`week-${header}`} className={index === 6 ? 'weekend' : ''}>{header}</div>
            ))}
          </div>

          <div className="planner-stitch-week-table">
            <div className="timeline-grid flex-1 gap-4">
              {visibleWeekTimeline.map((day) => (
                <div
                  key={day.id}
                  className={`planner-stitch-week-column ${isDateSelected(day.dateKey) ? 'selected-date' : ''}`}
                  onClick={() => handleCalendarDateClick(day.dateKey)}
                >
                  <div className="planner-stitch-week-events-stack">
                    {day.events.length === 0 ? (
                      <div className="planner-stitch-week-empty">Bez udalostí</div>
                    ) : (
                      day.events.map((event, index) => (
                        <article
                          key={`${day.id}-${event.label}-${index}`}
                          className={`planner-stitch-week-card ${event.type}`}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            openEventForEditing(event)
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(keyEvent) => {
                            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                              keyEvent.preventDefault()
                              keyEvent.stopPropagation()
                              openEventForEditing(event)
                            }
                          }}
                        >
                          <div className="planner-stitch-week-card-head">
                            <span className="material-icons-round" aria-hidden="true">{event.icon}</span>
                            <span>{event.category}</span>
                          </div>
                          <h4>{event.label}</h4>
                          <p>
                            <span className="material-icons-round" aria-hidden="true">schedule</span>
                            {event.time}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      </div>

      <aside ref={sidebarRef} className={`planner-stitch-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Nová udalosť">
        <div className="planner-stitch-sidebar-head">
          <h2>{editingEventId ? 'Upraviť udalosť' : 'Pridať udalosť'}</h2>
          <button
            type="button"
            className="planner-stitch-icon-btn"
            aria-label="Zavrieť"
            onClick={() => {
              setSidebarOpen(false)
              resetEventForm()
            }}
          >
            <span className="material-icons-round" aria-hidden="true">close</span>
          </button>
        </div>
        <form className="planner-stitch-event-form" onSubmit={handleEventFormSubmit}>
          <div className="planner-stitch-form-row">
            <label>Ukazovatele evidencie</label>
            <div className="planner-stitch-indicator-switches" role="group" aria-label="Zobrazené ukazovatele evidencie">
              {availableIndicatorCodes.map((code) => (
                <button
                  key={`indicator-${code}`}
                  type="button"
                  className={`planner-stitch-indicator-chip ${eventForm.indicatorCode === code ? 'active' : ''}`}
                  onClick={() => handleIndicatorToggle(code)}
                  style={{
                    '--chip-accent': indicatorColorMap.get(code) || '#4a83e3',
                    '--chip-accent-soft': hexToRgba(indicatorColorMap.get(code) || '#4a83e3', 0.22)
                  }}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div className="planner-stitch-form-row">
            <label>{shouldUseTrainingDivisionLabelSelect ? 'Názov udalosti' : 'Názov ukazovateľa'}</label>
            {shouldUseTrainingDivisionLabelSelect ? (
              <details className="planner-stitch-checkbox-dropdown">
                <summary>{trainingGroupSummary}</summary>
                <div className="planner-stitch-checkbox-dropdown-menu" role="group" aria-label="Skupiny tréningu">
                  {trainingDivisionGroupOptions.map((option) => {
                    const safeValue = String(option?.value || '').trim()
                    if (!safeValue) return null

                    return (
                      <label key={`training-division-group-${safeValue}`} className="planner-stitch-checkbox-option">
                        <input
                          type="checkbox"
                          checked={selectedTrainingGroups.includes(safeValue)}
                          onChange={() => handleTrainingGroupToggle(safeValue)}
                        />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </div>
              </details>
            ) : (
              <input
                type="text"
                placeholder="Napr. Tréning A..."
                value={eventForm.label}
                onChange={(e) => setEventForm((f) => ({ ...f, label: e.target.value, selectedTrainingGroups: [] }))}
              />
            )}
          </div>
          <div className="planner-stitch-form-row">
            <label>Dátum</label>
            <input
              type="date"
              value={eventForm.date}
              onClick={openNativePicker}
              onFocus={openNativePicker}
              onChange={(e) => {
                const nextDate = e.target.value
                setEventForm((f) => ({
                  ...f,
                  date: nextDate,
                  selectedDates: f.multiDateMode
                    ? [...new Set([...(Array.isArray(f.selectedDates) ? f.selectedDates : []), nextDate].filter(Boolean))].sort((a, b) => a.localeCompare(b))
                    : f.selectedDates
                }))
              }}
              required={!eventForm.multiDateMode}
            />
            <button type="button" className="planner-stitch-more-dates-btn" onClick={handleMultiDateToggle}>
              {eventForm.multiDateMode ? 'Ukončiť výber dátumov' : 'Viac dátumov'}
            </button>
            {eventForm.multiDateMode ? (
              <>
                <small className="planner-stitch-form-help">Klikaním na dni v kalendári vyberieš viac dátumov.</small>
                <div className="planner-stitch-selected-dates">
                  {(eventForm.selectedDates || []).length === 0 ? (
                    <span className="planner-stitch-selected-date-chip muted">Zatiaľ nič vybraté</span>
                  ) : (
                    eventForm.selectedDates.map((dateKey) => (
                      <span key={`selected-${dateKey}`} className="planner-stitch-selected-date-chip">{dateKey}</span>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="planner-stitch-form-row planner-stitch-form-row--half">
            <div>
              <label>Čas od</label>
              <input
                type="time"
                value={eventForm.timeFrom}
                readOnly
                onClick={() => openPlannerTimePicker('timeFrom')}
                onChange={(e) => setEventForm((f) => ({ ...f, timeFrom: e.target.value }))}
              />
            </div>
            <div>
              <label>Čas do</label>
              <input
                type="time"
                value={eventForm.timeTo}
                readOnly
                onClick={() => openPlannerTimePicker('timeTo')}
                onChange={(e) => setEventForm((f) => ({ ...f, timeTo: e.target.value }))}
              />
            </div>
          </div>

          <div className="planner-stitch-form-row">
            <label>Kategória</label>
            <select value={eventForm.teamId} onChange={(e) => setEventForm((f) => ({ ...f, teamId: e.target.value }))}>
              <option value="">Vyber kategóriu</option>
              {teamFilters.filter((t) => t.id !== 'all').map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="planner-stitch-form-row planner-stitch-form-row--half">
            <div>
              <label>Ihrisko</label>
              <select
                value={eventForm.fieldId}
                onChange={(e) => setEventForm((f) => ({ ...f, fieldId: e.target.value, fieldParts: '0', selectedFieldParts: [] }))}
                disabled={fieldOptions.length === 0}
              >
                {fieldOptions.length === 0 ? <option value="">Žiadne ihrisko</option> : null}
                {fieldOptions.map((field) => (
                  <option key={field.id} value={field.id}>{field.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Časti ihriska</label>
              <select value={eventForm.fieldParts} onChange={(e) => handleFieldPartsCountChange(e.target.value)}>
                {fieldPartsOptions.map((part) => (
                  <option
                    key={`part-${part}`}
                    value={part}
                    disabled={Number(part) > availableFieldPartIndices.length}
                  >
                    {part}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedField ? (
            <div className="planner-stitch-field-visualizer" aria-label="Vizualizácia rozdelenia ihriska">
              <p>
                Klikni na časti ihriska, ktoré chceš označiť.
                <span>{` Označené: ${(eventForm.selectedFieldParts || []).join(', ') || '-'}`}</span>
              </p>
              {selectedField.dimensions ? (
                <small className="planner-stitch-field-dimensions">Rozmery: {selectedField.dimensions}</small>
              ) : null}
              <div
                className="planner-stitch-field-pitch"
                style={{
                  '--parts-cols': selectedFieldGridLayout.cols,
                  '--parts-rows': selectedFieldGridLayout.rows,
                  '--field-ratio': selectedFieldRatio
                }}
              >
                {visualFieldPartOrder.map((partIndex) => {
                  const isActive = Array.isArray(eventForm.selectedFieldParts) && eventForm.selectedFieldParts.includes(partIndex)
                  const isReserved = reservedFieldParts.has(partIndex)
                  const reservedOwners = reservedFieldPartOwners.get(partIndex) || []
                  const reservedOwnerLabel = reservedOwners.join(', ')

                  return (
                    <button
                      key={`pitch-part-${partIndex}`}
                      type="button"
                      className={`planner-stitch-field-part ${isActive ? 'active' : ''} ${isReserved ? 'reserved' : ''}`}
                      onClick={() => handleFieldPartToggle(partIndex)}
                      disabled={isReserved}
                      title={isReserved
                        ? `Rezervované: ${reservedOwnerLabel || 'Iná kategória'} v rovnakom čase.`
                        : undefined}
                    >
                      <span>{partIndex}</span>
                      {isReserved && reservedOwnerLabel ? (
                        <small className="planner-stitch-field-part-owner">{reservedOwnerLabel}</small>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <div className="planner-stitch-field-legend" aria-label="Legenda stavu častí ihriska">
                <span className="planner-stitch-field-legend-item selected">
                  <i aria-hidden="true" /> Vybrané
                </span>
                <span className="planner-stitch-field-legend-item reserved">
                  <i aria-hidden="true" /> Obsadené inou kategóriou
                </span>
                <span className="planner-stitch-field-legend-item free">
                  <i aria-hidden="true" /> Voľné
                </span>
              </div>
            </div>
          ) : null}

          <div className="planner-stitch-form-actions">
            {editingEventId ? (
              <button
                type="button"
                className="planner-stitch-form-cancel"
                onClick={handleDeleteEditingEvent}
                disabled={isSubmittingEvent}
              >
                Odstrániť
              </button>
            ) : (
              <button
                type="button"
                className="planner-stitch-form-cancel"
                onClick={() => {
                  setSidebarOpen(false)
                  resetEventForm()
                }}
              >
                Zrušiť
              </button>
            )}
            <button type="submit" className="planner-stitch-primary-btn" disabled={isSubmittingEvent}>
              {isSubmittingEvent ? 'Ukladam...' : (editingEventId ? 'Uložiť zmeny' : 'Pridať')}
            </button>
          </div>
        </form>
      </aside>

      <TimeClockPickerModal
        isOpen={isPlannerTimeClockOpen}
        value={eventForm[plannerTimeClockTarget]}
        onClose={closePlannerTimeClock}
        onApply={(nextValue) => {
          setEventForm((prev) => ({
            ...prev,
            [plannerTimeClockTarget]: nextValue
          }))
        }}
        ariaLabel="Výber času"
      />
      </div>
    </div>
  )
}

export default Planner
