import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { EVIDENCE_FALLBACK_COLORS, EVIDENCE_PRESET_COLORS_BY_CODE } from '../constants/evidenceColors'
import TimeClockPickerModal from '../components/TimeClockPickerModal'
import './Evidence.css'

const monthNames = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December']
const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
const weekDays = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']
const restrictedRoles = new Set(['coach', 'assistant', 'private_coach', 'player'])

const MATCH_METRIC_CODES = new Set(['PZ', 'MZ', 'CUP'])
const HZ_TIME_SUM_CODES = new Set(['TJ', 'PZ', 'MZ', 'CUP'])
const METRIC_CODE_BY_SESSION_TYPE = {
  training: 'TJ',
  match: 'PZ',
  friendly_match: 'MZ',
  tournament: 'CUP'
}

const normalizeMetricCode = (code) => String(code || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')

const createEvidenceSessionId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const parseEvidenceEntryKey = (rawKey) => {
  const [categoryId = '', playerId = '', dateKey = '', metricId = '', sessionId = 'default'] = String(rawKey || '').split(':')
  return {
    categoryId: String(categoryId || ''),
    playerId: String(playerId || ''),
    dateKey: String(dateKey || ''),
    metricId: String(metricId || ''),
    sessionId: String(sessionId || 'default')
  }
}

const isAttendancePercentMetric = (metric) => {
  const metricType = String(metric?.type || '').toLowerCase()
  const metricId = String(metric?.id || '').toLowerCase()
  return metricType === 'percent' || metricId.includes('attendance')
}

const isHzMetric = (metric, metricCode) => normalizeMetricCode(metricCode || toMetricShortLabel(metric)) === 'HZ'

const CALENDAR_DAYS_METRIC_ID = 'default-calendar-days'
const CALENDAR_DAYS_DEFAULT_METRIC = {
  id: CALENDAR_DAYS_METRIC_ID,
  name: 'Kalendárne dni',
  shortName: 'KD',
  type: 'number',
  valueTypes: ['number'],
  mode: 'manual',
  isDefault: true,
  isActive: true,
  formula: []
}

const normalizeRole = (role) => (role === 'club_admin' ? 'club' : String(role || '').trim().toLowerCase())

const isCalendarDaysMetric = (metric) => {
  const metricId = String(metric?.id || '').trim().toLowerCase()
  const metricName = String(metric?.name || '').trim().toLowerCase()
  const metricShortName = String(metric?.shortName || '').trim().toLowerCase()

  return metricId === CALENDAR_DAYS_METRIC_ID
    || metricId.includes('calendar-days')
    || (metricShortName === 'kd' && metricName.includes('kalend'))
}

const dedupeCalendarDaysMetric = (metricsList) => {
  const source = Array.isArray(metricsList) ? metricsList : []
  let hasCalendarDays = false

  return source.filter((metric) => {
    if (!isCalendarDaysMetric(metric)) return true
    if (hasCalendarDays) return false
    hasCalendarDays = true
    return true
  })
}

const normalizeDraftObject = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return {}
  return rawValue
}

const resolveTopBlockCardIcon = (cardName) => {
  const normalized = String(cardName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalized) return 'dashboard'

  if (normalized.includes('kalendar')) return 'calendar_month'
  if (normalized.includes('evidencia')) return 'inventory_2'
  if (normalized.includes('hrac') || normalized.includes('tim') || normalized.includes('druzstvo')) return 'group'
  if (normalized.includes('dochadz')) return 'fact_check'
  if (normalized.includes('rizik')) return 'warning'
  if (normalized.includes('zataz') || normalized.includes('vykon') || normalized.includes('intenzit')) return 'monitoring'
  if (normalized.includes('percent') || normalized.includes('%')) return 'percent'
  if (normalized.includes('trening')) return 'fitness_center'
  if (normalized.includes('zapas')) return 'sports_soccer'
  return 'dashboard'
}

const resolveEvidenceDayBackground = (colors) => {
  const palette = Array.isArray(colors) ? colors.filter(Boolean) : []
  if (palette.length === 0) return { background: '', border: '' }
  if (palette.length === 1) {
    return {
      background: `${palette[0]}33`,
      border: palette[0]
    }
  }

  const step = 100 / palette.length
  const segments = palette.map((color, index) => {
    const from = Math.round(index * step)
    const to = Math.round((index + 1) * step)
    return `${color} ${from}% ${to}%`
  })

  return {
    background: `conic-gradient(from 220deg at 50% 50%, ${segments.join(', ')})`,
    border: palette[0]
  }
}

const getCappedDayInMonth = (year, monthIndex, requestedDay) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  return Math.max(1, Math.min(Number(requestedDay) || 1, daysInMonth))
}

const toMonthDateKey = (year, monthIndex, day) => {
  const month = String(monthIndex + 1).padStart(2, '0')
  const dayValue = String(day).padStart(2, '0')
  return `${year}-${month}-${dayValue}`
}

const getSessionDateKey = (session) => {
  const directDate = String(session?.date || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) return directDate

  // Legacy APIs often return DATETIME in `date` or snake_case/camelCase start fields.
  const candidateValues = [
    directDate,
    session?.startAt,
    session?.start_at,
    session?.startTime,
    session?.start_time
  ]

  const parsedStart = candidateValues.reduce((acc, value) => {
    if (acc) return acc
    const parsed = new Date(String(value || ''))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, null)

  if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
    const year = parsedStart.getFullYear()
    const month = String(parsedStart.getMonth() + 1).padStart(2, '0')
    const day = String(parsedStart.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return ''
}

const getSessionTeamId = (session) => String(
  session?.team_id
  ?? session?.teamId
  ?? session?.team?.id
  ?? ''
).trim()

const getSessionTeamName = (session) => String(
  session?.teamName
  ?? session?.team_name
  ?? session?.categoryName
  ?? session?.category_name
  ?? session?.team?.name
  ?? ''
).trim()

const getMetricCodeFromSession = (session) => {
  const rawType = String(
    session?.sessionType
      || session?.session_type
      || session?.recurrenceSessionType
      || session?.recurrence_session_type
      || session?.type
      || 'training'
  ).trim().toLowerCase()
  return METRIC_CODE_BY_SESSION_TYPE[rawType] || 'TJ'
}

const getSessionStartTimeLabel = (session) => {
  const direct = String(session?.startTime || session?.start_time || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(direct)) {
    const [h, m] = direct.split(':')
    return `${String(Math.max(0, Math.min(23, Number(h) || 0))).padStart(2, '0')}:${String(Math.max(0, Math.min(59, Number(m) || 0))).padStart(2, '0')}`
  }

  const candidateValues = [
    session?.startAt,
    session?.start_at,
    session?.date
  ]

  for (const value of candidateValues) {
    const parsed = new Date(String(value || ''))
    if (!Number.isNaN(parsed.getTime())) {
      return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
    }
  }

  return ''
}

const getSessionDurationMinutes = (session) => {
  const directMinutes = Number(session?.durationMinutes ?? session?.duration_minutes ?? session?.duration)
  if (Number.isFinite(directMinutes) && directMinutes > 0) {
    return Math.round(directMinutes)
  }

  const startCandidate = session?.startAt || session?.start_at
  const endCandidate = session?.endAt || session?.end_at
  const start = new Date(String(startCandidate || ''))
  const end = new Date(String(endCandidate || ''))

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) return null
  return diffMinutes
}

const normalizeAttendanceSeasons = (payload) => {
  const source = Array.isArray(payload?.seasons)
    ? payload.seasons
    : (Array.isArray(payload?.periods)
        ? payload.periods
        : (Array.isArray(payload?.attendanceSeasons)
            ? payload.attendanceSeasons
            : (Array.isArray(payload?.data) ? payload.data : [])))

  return source
    .map((item, index) => {
      const idValue = item?.id ?? item?.seasonId ?? item?.season_id ?? index
      const fromValue = item?.from ?? item?.from_date ?? item?.fromDate ?? ''
      const toValue = item?.to ?? item?.to_date ?? item?.toDate ?? ''

      return {
        id: String(idValue),
        name: String(item?.name || item?.title || 'Obdobie').trim(),
        from: String(fromValue || '').trim(),
        to: String(toValue || '').trim()
      }
    })
    .filter((item) => item.id && item.from && item.to)
}

const buildMonthToDateTrendSnapshot = ({
  evidenceEntriesDraft,
  selectedCategory,
  year,
  month,
  dayLimit,
  metricCodeById,
  configuredSourceCodesByMetricCode
}) => {
  const targetCategoryId = String(selectedCategory || '')
  const targetYear = Number(year)
  const targetMonth = Number(month)
  const safeDayLimit = Math.max(1, Number(dayLimit) || 1)

  const allEvidenceDays = new Set()
  const allEvidenceSessions = new Set()
  const metricEventCounts = new Map()
  const playerSessions = new Map()
  const playerMinutesByCode = new Map()

  Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
    const {
      categoryId,
      playerId,
      dateKey,
      metricId,
      sessionId
    } = parseEvidenceEntryKey(entryKey)

    if (!categoryId || !playerId || !dateKey || !metricId) return
    if (targetCategoryId !== 'all' && String(categoryId || '') !== targetCategoryId) return
    if (!value || typeof value !== 'object' || value.attended === false) return

    const matchedDate = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!matchedDate) return

    const entryYear = Number(matchedDate[1])
    const entryMonth = Number(matchedDate[2])
    const entryDay = Number(matchedDate[3])
    if (entryYear !== targetYear || entryMonth !== targetMonth || entryDay > safeDayLimit) return

    const normalizedSessionId = String(sessionId || 'default')
    const metricCode = normalizeMetricCode(metricCodeById.get(String(metricId || '')) || '')
    const sessionToken = `${String(categoryId || '')}:${String(dateKey || '')}:${normalizedSessionId}`
    const metricEventToken = `${String(categoryId || '')}:${String(dateKey || '')}:${metricCode}:${normalizedSessionId}`

    allEvidenceDays.add(String(dateKey || ''))
    allEvidenceSessions.add(sessionToken)

    if (!playerSessions.has(String(playerId || ''))) {
      playerSessions.set(String(playerId || ''), new Set())
    }
    playerSessions.get(String(playerId || '')).add(sessionToken)

    if (!metricEventCounts.has(metricCode)) {
      metricEventCounts.set(metricCode, new Set())
    }
    metricEventCounts.get(metricCode).add(metricEventToken)

    const minutes = Number(String(value.minutes || '').replace(/[^\d]/g, '')) || 0
    if (HZ_TIME_SUM_CODES.has(metricCode)) {
      if (!playerMinutesByCode.has(String(playerId || ''))) {
        playerMinutesByCode.set(String(playerId || ''), new Map())
      }
      const playerMinutesMap = playerMinutesByCode.get(String(playerId || ''))
      playerMinutesMap.set(metricCode, Number(playerMinutesMap.get(metricCode) || 0) + minutes)
    }
  })

  const configuredPoczCodes = Array.isArray(configuredSourceCodesByMetricCode?.POCZ)
    ? configuredSourceCodesByMetricCode.POCZ
    : [...MATCH_METRIC_CODES]
  const configuredHzCodes = Array.isArray(configuredSourceCodesByMetricCode?.HZ)
    ? configuredSourceCodesByMetricCode.HZ
    : [...HZ_TIME_SUM_CODES]

  const getGlobalMetricEventCount = (metricCode) => {
    const normalizedCode = normalizeMetricCode(metricCode)
    return Number(metricEventCounts.get(normalizedCode)?.size || 0)
  }

  const getGlobalPoczEventCount = () => {
    const eventTokens = new Set()
    configuredPoczCodes.forEach((code) => {
      const normalizedCode = normalizeMetricCode(code)
      const tokens = metricEventCounts.get(normalizedCode)
      if (!tokens) return
      tokens.forEach((token) => eventTokens.add(token))
    })
    return eventTokens.size
  }

  const getGlobalHzMinutes = () => {
    let total = 0
    playerMinutesByCode.forEach((playerMap) => {
      configuredHzCodes.forEach((code) => {
        total += Number(playerMap.get(normalizeMetricCode(code)) || 0)
      })
    })
    return total
  }

  const getPlayerSessionCount = (playerId) => playerSessions.get(String(playerId || ''))?.size || 0

  return {
    dayLimit: safeDayLimit,
    totalDzDays: allEvidenceDays.size,
    totalSessionCount: allEvidenceSessions.size,
    getGlobalMetricEventCount,
    getGlobalPoczEventCount,
    getGlobalHzMinutes,
    getPlayerSessionCount
  }
}

const applyStoredMetricOrder = (metricsList, clubId) => {
  const source = Array.isArray(metricsList) ? metricsList : []
  return source.length <= 1 ? source : [...source]
}

const readCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const getIdValue = (item) => String(item?.userId ?? item?.id ?? '').trim()

const hashNumber = (source) => {
  const text = String(source || '')
  if (!text) return 0
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const toPlayerName = (player) => {
  const composed = `${String(player?.firstName || '').trim()} ${String(player?.lastName || '').trim()}`.trim()
  return composed || String(player?.displayName || player?.name || 'Neznámy hráč')
}

const toCategoryList = (player) => Array.isArray(player?.categories)
  ? player.categories
      .map((category) => ({
        id: String(category?.id ?? category?.teamId ?? ''),
        name: String(category?.name || category?.ageGroup || '').trim()
      }))
      .filter((category) => category.id || category.name)
  : []

const toPlayerAvatar = (player) => {
  const avatar = String(player?.photo ?? player?.photoUrl ?? player?.avatar ?? '').trim()
  return avatar
}

const toNameInitials = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'H'
  if (parts.length === 1) return String(parts[0][0] || '').toUpperCase()
  return `${String(parts[0][0] || '').toUpperCase()}${String(parts[1][0] || '').toUpperCase()}`
}

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

const normalizeComparableText = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const isGenericTopCardName = (value) => /^karta\s*\d*$/i.test(String(value || '').trim())

const buildSingleMetricMap = (metricIds, selectedMetricId) => {
  const selected = String(selectedMetricId || '').trim()
  return (Array.isArray(metricIds) ? metricIds : []).reduce((acc, metricId) => {
    acc[metricId] = Boolean(selected) && metricId === selected
    return acc
  }, {})
}

const isEnabledMetricFlag = (value) => (
  value === true
  || value === 'true'
  || value === 1
  || value === '1'
)

const resolveMetricIdFromRowName = (rowName, metricsList) => {
  const normalized = normalizeComparableText(rowName)
  if (!normalized) return ''

  const aliases = [
    { metricId: 'default-calendar-days', tests: ['kalendarne dni', 'kalendar'] },
    { metricId: 'default-load-days', tests: ['dni zataze', 'zataz'] },
    { metricId: 'default-trainings-count', tests: ['treningovych jednotiek', 'pocet treningov', 'trening'] },
    { metricId: 'default-matches-count', tests: ['pocet zapasov', 'zapasy', 'zapas'] },
    { metricId: 'default-attendance', tests: ['dochadzka', 'dochadzka %'] },
  ]

  const aliasMatch = aliases.find((entry) => entry.tests.some((token) => normalized.includes(token)))
  if (aliasMatch) {
    const exists = (Array.isArray(metricsList) ? metricsList : []).some((metric) => String(metric?.id || '').trim() === aliasMatch.metricId)
    if (exists) return aliasMatch.metricId
  }

  const byName = (Array.isArray(metricsList) ? metricsList : []).find((metric) => {
    const metricName = normalizeComparableText(metric?.name)
    const metricShortName = normalizeComparableText(metric?.shortName)
    return normalized && (metricName === normalized || metricShortName === normalized)
  })

  return String(byName?.id || '').trim()
}

const normalizeAttendanceDisplayDraft = (metricsList, rawDraft) => {
  const baseDraft = (rawDraft && typeof rawDraft === 'object') ? rawDraft : {}
  const sourceMetricsList = Array.isArray(metricsList) ? metricsList : []
  const metricIds = (Array.isArray(metricsList) ? metricsList : [])
    .map((metric) => String(metric?.id ?? '').trim())
    .filter(Boolean)
  const fromNewModel = Array.isArray(baseDraft?.topBlockRows)
    || (baseDraft?.tableColumns && typeof baseDraft.tableColumns === 'object')
    || (baseDraft?.evidenceColumns && typeof baseDraft.evidenceColumns === 'object')
  const hasLegacyMetricRows = metricIds.some((metricId) => baseDraft[metricId] && typeof baseDraft[metricId] === 'object')

  const tableColumns = metricIds.reduce((acc, metricId) => {
    if (fromNewModel) {
      const source = (baseDraft.tableColumns && typeof baseDraft.tableColumns === 'object') ? baseDraft.tableColumns : {}
      acc[metricId] = source[metricId] !== false
    } else if (hasLegacyMetricRows) {
      const source = (baseDraft[metricId] && typeof baseDraft[metricId] === 'object') ? baseDraft[metricId] : {}
      acc[metricId] = source.rosterTable !== false
    } else {
      const source = (baseDraft.rosterTable && typeof baseDraft.rosterTable === 'object') ? baseDraft.rosterTable : {}
      acc[metricId] = source[metricId] !== false
    }
    return acc
  }, {})

  const evidenceColumns = metricIds.reduce((acc, metricId) => {
    const source = (baseDraft.evidenceColumns && typeof baseDraft.evidenceColumns === 'object') ? baseDraft.evidenceColumns : {}
    acc[metricId] = source[metricId] !== false
    return acc
  }, {})

  let topBlockRows = []

  if (fromNewModel) {
    topBlockRows = (Array.isArray(baseDraft.topBlockRows) ? baseDraft.topBlockRows : []).map((row, index) => {
      const sourceMetrics = (row?.metrics && typeof row.metrics === 'object') ? row.metrics : {}
      const hasExplicitMetricMap = Object.keys(sourceMetrics).length > 0
      const explicitMetricIds = new Set(
        (Array.isArray(row?.metricIds) ? row.metricIds : [row?.metricId])
          .map((metricId) => String(metricId || '').trim())
          .filter(Boolean)
      )
      const rowName = String(row?.name || '').trim()
      const metricIdMatchedByName = resolveMetricIdFromRowName(rowName, sourceMetricsList)
      const fallbackMetricId = String(metricIds[index] || metricIds[0] || '').trim()
      const resolvedSingleMetricId = metricIdMatchedByName || fallbackMetricId
      const explicitKnownMetricIds = metricIds.filter((metricId) => Object.prototype.hasOwnProperty.call(sourceMetrics, metricId))
      const explicitTrueCount = explicitKnownMetricIds.filter((metricId) => isEnabledMetricFlag(sourceMetrics[metricId])).length
      const shouldRepairAllTrueRow = hasExplicitMetricMap
        && (Boolean(metricIdMatchedByName) || isGenericTopCardName(rowName))
        && explicitKnownMetricIds.length === metricIds.length
        && explicitTrueCount > 1

      return {
        id: String(row?.id || `top-row-${index + 1}`),
        name: String(row?.name || `Karta ${index + 1}`),
        metrics: metricIds.reduce((acc, metricId) => {
          if (hasExplicitMetricMap && !shouldRepairAllTrueRow) {
            acc[metricId] = isEnabledMetricFlag(sourceMetrics[metricId])
          } else if (explicitMetricIds.size > 0) {
            acc[metricId] = explicitMetricIds.has(metricId)
          } else if (resolvedSingleMetricId) {
            acc[metricId] = metricId === resolvedSingleMetricId
          } else {
            acc[metricId] = false
          }
          return acc
        }, {})
      }
    })
  } else {
    const legacyStatsMap = metricIds.reduce((acc, metricId) => {
      if (hasLegacyMetricRows) {
        const source = (baseDraft[metricId] && typeof baseDraft[metricId] === 'object') ? baseDraft[metricId] : {}
        acc[metricId] = source.statsOverviewCard !== false
      } else {
        const source = (baseDraft.statsOverviewCard && typeof baseDraft.statsOverviewCard === 'object') ? baseDraft.statsOverviewCard : {}
        acc[metricId] = source[metricId] !== false
      }
      return acc
    }, {})
    const enabledMetricIds = metricIds.filter((metricId) => legacyStatsMap[metricId] === true)
    const baseMetricIds = enabledMetricIds.length > 0 ? enabledMetricIds : metricIds
    topBlockRows = baseMetricIds.map((metricId, index) => {
      const metric = sourceMetricsList.find((item) => String(item?.id || '').trim() === metricId)
      return {
        id: `top-row-${index + 1}`,
        name: String(metric?.name || `Karta ${index + 1}`),
        metrics: buildSingleMetricMap(metricIds, metricId)
      }
    })
  }

  if (topBlockRows.length === 0) {
    topBlockRows = metricIds.map((metricId, index) => {
      const metric = sourceMetricsList.find((item) => String(item?.id || '').trim() === metricId)
      return {
        id: `top-row-${index + 1}`,
        name: String(metric?.name || `Karta ${index + 1}`),
        metrics: buildSingleMetricMap(metricIds, metricId)
      }
    })
  }

  const rowMetricIds = topBlockRows.map((row) => {
    const sourceMetrics = row?.metrics && typeof row.metrics === 'object' ? row.metrics : {}
    const selectedMetricIds = metricIds.filter((metricId) => sourceMetrics[metricId] === true)
    return selectedMetricIds.length === 1 ? selectedMetricIds[0] : ''
  })

  const canAlignRowOrder = (
    rowMetricIds.length > 1
    && rowMetricIds.some(Boolean)
    && new Set(rowMetricIds.filter(Boolean)).size === rowMetricIds.filter(Boolean).length
  )

  if (canAlignRowOrder) {
    const orderMap = new Map(metricIds.map((metricId, index) => [metricId, index]))
    topBlockRows = [...topBlockRows]
      .map((row, index) => ({ row, metricId: rowMetricIds[index] }))
      .sort((a, b) => {
        const aIndex = orderMap.has(a.metricId) ? orderMap.get(a.metricId) : Number.MAX_SAFE_INTEGER
        const bIndex = orderMap.has(b.metricId) ? orderMap.get(b.metricId) : Number.MAX_SAFE_INTEGER
        return aIndex - bIndex
      })
      .map((item) => item.row)
  }

  return {
    topBlockRows,
    tableColumns,
    evidenceColumns
  }
}

const buildRosterRows = (players) => (Array.isArray(players) ? players : []).map((player, index) => {
  const playerId = getIdValue(player) || `player-${index}`
  const base = hashNumber(playerId)
  const categories = toCategoryList(player)
  const evidenceMonth = base % 12
  const evidenceDay = 1 + (base % 28)
  return {
    id: playerId,
    name: toPlayerName(player),
    avatarUrl: toPlayerAvatar(player),
    categories,
    primaryCategory: categories[0]?.name || 'Nezaradený',
    attendanceRate: 72 + (base % 27),
    evidenceCount: 8 + (base % 33),
    performance: 55 + (base % 45),
    evidenceMonth,
    evidenceDay
  }
})

const parseDayMonth = (value) => {
  const matched = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!matched) return null
  const day = Number(matched[1])
  const month = Number(matched[2])
  if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null
  }
  return { day, month }
}

const ensureCalendarDaysMetric = (metricsList) => {
  const source = dedupeCalendarDaysMetric(metricsList)
  const exists = source.some((metric) => isCalendarDaysMetric(metric))
  if (exists) return source
  return [...source, { ...CALENDAR_DAYS_DEFAULT_METRIC }]
}

const createSafeDate = (year, month, day) => {
  const daysInMonth = new Date(year, month, 0).getDate()
  const safeDay = Math.max(1, Math.min(day, daysInMonth))
  return new Date(year, month - 1, safeDay)
}

const getTimelineDaysCount = (selectedTimeline, attendancePeriods, calendarDate) => {
  const monthMatch = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
  if (monthMatch) {
    const monthIndex = Math.max(0, Math.min(11, Number(monthMatch[1])))
    return new Date(calendarDate.getFullYear(), monthIndex + 1, 0).getDate()
  }

  const selectedSeasonId = String(selectedTimeline || '').startsWith('season-')
    ? String(selectedTimeline || '').slice(7)
    : null
  if (selectedSeasonId) {
    const season = (Array.isArray(attendancePeriods) ? attendancePeriods : []).find((item) => String(item?.id ?? '') === selectedSeasonId)
    const seasonFrom = season ? parseDayMonth(season.from) : null
    const seasonTo = season ? parseDayMonth(season.to) : null

    if (seasonFrom && seasonTo) {
      const baseYear = Number(calendarDate.getFullYear()) || new Date().getFullYear()
      const startDate = createSafeDate(baseYear, seasonFrom.month, seasonFrom.day)
      const wrapsYear = (seasonTo.month < seasonFrom.month) || (seasonTo.month === seasonFrom.month && seasonTo.day < seasonFrom.day)
      const endDate = createSafeDate(wrapsYear ? baseYear + 1 : baseYear, seasonTo.month, seasonTo.day)
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
      return Math.max(0, diffDays)
    }
  }

  return new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate()
}

const compareMonthDay = (left, right) => {
  if (left.month !== right.month) return left.month - right.month
  return left.day - right.day
}

const isMonthDayInRange = (point, from, to) => {
  if (!point || !from || !to) return true
  const directRange = compareMonthDay(from, to) <= 0
  if (directRange) {
    return compareMonthDay(point, from) >= 0 && compareMonthDay(point, to) <= 0
  }

  return compareMonthDay(point, from) >= 0 || compareMonthDay(point, to) <= 0
}

const getCalendarCells = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells = []
  for (let index = 0; index < 42; index += 1) {
    if (index < startWeekday) {
      cells.push({ day: prevMonthDays - startWeekday + index + 1, muted: true, key: `prev-${index}` })
    } else if (index >= startWeekday + daysInMonth) {
      cells.push({ day: index - (startWeekday + daysInMonth) + 1, muted: true, key: `next-${index}` })
    } else {
      const day = index - startWeekday + 1
      cells.push({ day, muted: false, key: `cur-${day}` })
    }
  }

  return cells
}

const mockRoster = [
  { id: 'm1', name: 'J. Novák', categories: [{ id: '1', name: 'U9' }] },
  { id: 'm2', name: 'L. Kováč', categories: [{ id: '2', name: 'U11' }] },
  { id: 'm3', name: 'P. Bielik', categories: [{ id: '1', name: 'U9' }, { id: '3', name: 'U13' }] }
]

function Evidence() {
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState({ trainers: [], players: [] })
  const [attendanceMetrics, setAttendanceMetrics] = useState([])
  const [clubId, setClubId] = useState(null)
  const [attendancePeriods, setAttendancePeriods] = useState([])
  const [attendanceDisplayDraft, setAttendanceDisplayDraft] = useState({})
  const [attendanceDisplayLoaded, setAttendanceDisplayLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [evidenceCategoryDraft, setEvidenceCategoryDraft] = useState('')
  const [isEvidenceMode, setIsEvidenceMode] = useState(false)
  const [activeEvidenceSessionId, setActiveEvidenceSessionId] = useState('default')
  const [evidenceEntriesDraft, setEvidenceEntriesDraft] = useState({})
  const [evidenceSessionMetaDraft, setEvidenceSessionMetaDraft] = useState({})
  const [evidenceMetricSwitches, setEvidenceMetricSwitches] = useState({})
  const [evidenceTrainingTime, setEvidenceTrainingTime] = useState('')
  const [evidenceFormBaselineSignature, setEvidenceFormBaselineSignature] = useState('')
  const [isEvidenceEditUnlocked, setIsEvidenceEditUnlocked] = useState(false)
  const [isTrainingTimeClockOpen, setIsTrainingTimeClockOpen] = useState(false)
  const [evidenceSessionTime, setEvidenceSessionTime] = useState('')
  const [evidenceSaveNotice, setEvidenceSaveNotice] = useState('')
  const [evidenceTableMode, setEvidenceTableMode] = useState('attendance')
  const [evidenceConfirmDialog, setEvidenceConfirmDialog] = useState({
    open: false,
    type: null,
    title: '',
    message: '',
    confirmLabel: 'Potvrdiť'
  })
  const [selectedTimeline, setSelectedTimeline] = useState(() => `month-${new Date().getMonth()}`)
  const [rosterSort, setRosterSort] = useState({ key: null, direction: 'desc' })
  const [plannedSessions, setPlannedSessions] = useState([])
  const monthsScrollRef = useRef(null)
  const monthsWrapRef = useRef(null)
  const evidenceDraftHydratedRef = useRef(false)
  const evidenceDraftSaveTimeoutRef = useRef(null)
  const lastEvidenceDraftSignatureRef = useRef('')

  const currentUser = useMemo(() => readCurrentUser(), [])
  const currentRole = normalizeRole(currentUser?.role)
  const currentUserId = String(currentUser?.id ?? currentUser?.userId ?? '').trim()

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        let resolvedClubId = null
        const [teamsResult, membersResult, metricsResult] = await Promise.allSettled([
          api.getTeams(),
          api.getMyClubMembers(),
          api.getMetrics({ context: 'attendance' })
        ])

        if (teamsResult.status === 'fulfilled') {
          setTeams(Array.isArray(teamsResult.value?.teams) ? teamsResult.value.teams : [])
        } else {
          setTeams([])
        }

        if (membersResult.status === 'fulfilled') {
          const nextClubId = membersResult.value?.clubId ?? null
          resolvedClubId = nextClubId
          setClubId(nextClubId)
          setMembers({
            trainers: Array.isArray(membersResult.value?.trainers) ? membersResult.value.trainers : [],
            players: Array.isArray(membersResult.value?.players) ? membersResult.value.players : []
          })
        } else {
          setClubId(null)
          setMembers({ trainers: [], players: [] })
        }

        if (metricsResult.status === 'fulfilled') {
          const loadedMetrics = Array.isArray(metricsResult.value?.metrics) ? metricsResult.value.metrics : []
          const prepared = ensureCalendarDaysMetric(dedupeCalendarDaysMetric(loadedMetrics))
          setAttendanceMetrics(applyStoredMetricOrder(prepared, resolvedClubId))
        } else {
          setAttendanceMetrics(applyStoredMetricOrder(ensureCalendarDaysMetric([]), resolvedClubId))
        }

        if (!membersResult.value?.clubId) {
          const clubResult = await Promise.allSettled([api.getMyClub()])
          if (clubResult[0]?.status === 'fulfilled' && clubResult[0]?.value?.id) {
            setClubId(clubResult[0].value.id)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (!clubId) return
    setAttendanceMetrics((prev) => applyStoredMetricOrder(prev, clubId))
  }, [clubId])

  const roleScopedCategoryIds = useMemo(() => {
    if (!restrictedRoles.has(currentRole)) return null

    if ((currentRole === 'coach' || currentRole === 'assistant' || currentRole === 'private_coach')) {
      const trainer = (members.trainers || []).find((item) => getIdValue(item) === currentUserId)
      return new Set((Array.isArray(trainer?.categories) ? trainer.categories : []).map((category) => String(category?.id ?? '')).filter(Boolean))
    }

    if (currentRole === 'player') {
      const player = (members.players || []).find((item) => getIdValue(item) === currentUserId)
      return new Set((Array.isArray(player?.categories) ? player.categories : []).map((category) => String(category?.id ?? '')).filter(Boolean))
    }

    return null
  }, [currentRole, currentUserId, members.players, members.trainers])

  const visibleTeams = useMemo(() => {
    const allTeams = Array.isArray(teams) ? teams : []
    if (!roleScopedCategoryIds) return allTeams
    return allTeams.filter((team) => roleScopedCategoryIds.has(String(team?.id ?? '')))
  }, [teams, roleScopedCategoryIds])

  useEffect(() => {
    const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)
    const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0)
    const startDate = toMonthDateKey(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate())
    const endDate = toMonthDateKey(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate())

    const teamIds = (selectedCategory === 'all'
      ? visibleTeams.map((team) => String(team?.id || '').trim())
      : [String(selectedCategory || '').trim()]
    ).filter(Boolean)

    if (teamIds.length === 0) {
      setPlannedSessions([])
      return
    }

    let isMounted = true

    const loadPlannedSessions = async () => {
      const merged = []
      const mergedKeys = new Set()
      const addMergedSession = (session) => {
        if (!session || typeof session !== 'object') return

        const id = String(session?.id || '').trim()
        const dateKey = getSessionDateKey(session)
        const startToken = String(session?.startAt || session?.start_at || session?.startTime || session?.start_time || '').trim()
        const teamToken = getSessionTeamId(session)
        const typeToken = String(session?.sessionType || session?.session_type || session?.type || '').trim().toLowerCase()
        const key = id || `${dateKey}|${startToken}|${teamToken}|${typeToken}`
        if (!key || mergedKeys.has(key)) return

        mergedKeys.add(key)
        merged.push(session)
      }

      const responses = await Promise.allSettled(teamIds.map((teamId) => api.getTeamTrainingSessions(teamId, {
        start_date: startDate,
        end_date: endDate
      })))

      if (!isMounted) return

      responses.forEach((result) => {
        if (result.status !== 'fulfilled') return
        const sessions = Array.isArray(result.value?.sessions)
          ? result.value.sessions
          : (Array.isArray(result.value?.trainings) ? result.value.trainings : [])
        sessions.forEach((session) => addMergedSession(session))
      })

      setPlannedSessions(merged)
    }

    loadPlannedSessions().catch(() => {
      if (isMounted) setPlannedSessions([])
    })

    return () => {
      isMounted = false
    }
  }, [calendarDate, selectedCategory, visibleTeams])

  const rosterSource = useMemo(() => {
    const rows = buildRosterRows(members.players)
    if (rows.length > 0) return rows
    return currentRole === 'club' || currentRole === 'admin' ? buildRosterRows(mockRoster) : []
  }, [members.players, currentRole])

  const filteredRoster = useMemo(() => {
    const lowerQuery = String(query || '').trim().toLowerCase()
    const roleFilterActive = Boolean(roleScopedCategoryIds)
    const monthMatch = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
    const selectedMonthIndex = monthMatch ? Number(monthMatch[1]) : null
    const selectedSeasonId = String(selectedTimeline || '').startsWith('season-')
      ? String(selectedTimeline || '').slice(7)
      : null
    const selectedSeason = selectedSeasonId
      ? (Array.isArray(attendancePeriods) ? attendancePeriods : []).find((item) => String(item?.id ?? '') === selectedSeasonId)
      : null
    const seasonFrom = selectedSeason ? parseDayMonth(selectedSeason.from) : null
    const seasonTo = selectedSeason ? parseDayMonth(selectedSeason.to) : null

    return rosterSource.filter((row) => {
      const categoryIds = row.categories.map((category) => String(category.id || '')).filter(Boolean)
      const hasAllowedCategory = !roleFilterActive || categoryIds.some((id) => roleScopedCategoryIds.has(id))
      if (!hasAllowedCategory) return false

      const categoryMatch = selectedCategory === 'all' || categoryIds.includes(String(selectedCategory))
      if (!categoryMatch) return false

      if (Number.isInteger(selectedMonthIndex) && row.evidenceMonth !== selectedMonthIndex) {
        return false
      }

      if (selectedSeason) {
        const rowPoint = { day: row.evidenceDay, month: row.evidenceMonth + 1 }
        if (!isMonthDayInRange(rowPoint, seasonFrom, seasonTo)) {
          return false
        }
      }

      if (!lowerQuery) return true
      return row.name.toLowerCase().includes(lowerQuery) || row.primaryCategory.toLowerCase().includes(lowerQuery)
    })
  }, [query, roleScopedCategoryIds, rosterSource, selectedCategory, selectedTimeline, attendancePeriods])

  const listEligibleRoster = useMemo(() => {
    const lowerQuery = String(query || '').trim().toLowerCase()
    const roleFilterActive = Boolean(roleScopedCategoryIds)

    return rosterSource.filter((row) => {
      const categoryIds = row.categories.map((category) => String(category.id || '')).filter(Boolean)
      const hasAllowedCategory = !roleFilterActive || categoryIds.some((id) => roleScopedCategoryIds.has(id))
      if (!hasAllowedCategory) return false

      const categoryMatch = selectedCategory === 'all' || categoryIds.includes(String(selectedCategory))
      if (!categoryMatch) return false

      if (!lowerQuery) return true
      return row.name.toLowerCase().includes(lowerQuery) || row.primaryCategory.toLowerCase().includes(lowerQuery)
    })
  }, [query, roleScopedCategoryIds, rosterSource, selectedCategory])

  const activeMetricColumns = useMemo(() => (
    (Array.isArray(attendanceMetrics) ? attendanceMetrics : []).filter((metric) => metric?.isActive !== false)
  ), [attendanceMetrics])

  const normalizedDisplayDraft = useMemo(
    () => normalizeAttendanceDisplayDraft(attendanceMetrics, attendanceDisplayDraft),
    [attendanceDisplayDraft, attendanceMetrics]
  )

  const topBlockRows = Array.isArray(normalizedDisplayDraft?.topBlockRows) ? normalizedDisplayDraft.topBlockRows : []
  const tableColumnsMap = (normalizedDisplayDraft?.tableColumns && typeof normalizedDisplayDraft.tableColumns === 'object')
    ? normalizedDisplayDraft.tableColumns
    : {}
  const evidenceColumnsMap = (normalizedDisplayDraft?.evidenceColumns && typeof normalizedDisplayDraft.evidenceColumns === 'object')
    ? normalizedDisplayDraft.evidenceColumns
    : {}

  const metricsForRosterTable = useMemo(
    () => activeMetricColumns.filter((metric) => tableColumnsMap[String(metric?.id)] !== false),
    [activeMetricColumns, tableColumnsMap]
  )

  const metricsForEvidenceTable = useMemo(
    () => activeMetricColumns.filter((metric) => evidenceColumnsMap[String(metric?.id)] !== false),
    [activeMetricColumns, evidenceColumnsMap]
  )

  useEffect(() => {
    setEvidenceMetricSwitches((prev) => {
      const metricIds = metricsForEvidenceTable
        .map((metric) => String(metric?.id || ''))
        .filter(Boolean)

      if (metricIds.length === 0) return {}

      const activeMetricId = metricIds.find((metricId) => prev?.[metricId] === true) || metricIds[0]
      const next = metricIds.reduce((acc, metricId) => {
        acc[metricId] = metricId === activeMetricId
        return acc
      }, {})

      return next
    })
  }, [metricsForEvidenceTable])

  const shouldShowCategoryColumn = !isEvidenceMode && selectedCategory === 'all'

  const rosterGridTemplateColumns = useMemo(() => {
    if (isEvidenceMode) {
      return ['1.6fr', '1.15fr', '0.95fr', '1.7fr', '0.7fr'].join(' ')
    }

    const columns = ['1.6fr']
    if (shouldShowCategoryColumn) {
      columns.push('0.85fr')
    }
    const metricCount = Math.max(0, metricsForRosterTable.length)
    for (let index = 0; index < metricCount; index += 1) {
      columns.push('0.75fr')
    }
    return columns.join(' ')
  }, [isEvidenceMode, metricsForRosterTable.length, shouldShowCategoryColumn])

  const metricsForRosterTableMap = useMemo(() => {
    return new Map(metricsForRosterTable.map((metric) => [String(metric?.id ?? ''), metric]))
  }, [metricsForRosterTable])

  const metricCodeById = useMemo(() => {
    return new Map((Array.isArray(attendanceMetrics) ? attendanceMetrics : []).map((metric) => {
      const metricId = String(metric?.id || '')
      const metricCode = normalizeMetricCode(toMetricShortLabel(metric))
      return [metricId, metricCode]
    }))
  }, [attendanceMetrics])

  const configuredSourceCodesByMetricCode = useMemo(() => {
    const metricsList = Array.isArray(attendanceMetrics) ? attendanceMetrics : []

    const extractSourceCodes = (targetCode, fallbackCodes) => {
      const targetMetric = metricsList.find((metric) => normalizeMetricCode(toMetricShortLabel(metric)) === targetCode)
      if (!targetMetric) return [...fallbackCodes]

      const formulaNodes = Array.isArray(targetMetric?.formula) ? targetMetric.formula : []
      const codes = formulaNodes
        .filter((node) => String(node?.type || '').toLowerCase() === 'variable')
        .map((node) => metricCodeById.get(String(node?.metricId || '')) || '')
        .map((code) => normalizeMetricCode(code))
        .filter(Boolean)

      return codes.length > 0 ? Array.from(new Set(codes)) : [...fallbackCodes]
    }

    return {
      POCZ: extractSourceCodes('POCZ', MATCH_METRIC_CODES),
      HZ: extractSourceCodes('HZ', HZ_TIME_SUM_CODES)
    }
  }, [attendanceMetrics, metricCodeById])

  const evidenceAggregate = useMemo(() => {
    const selectedCategoryId = String(selectedCategory || '')
    const selectedSeasonId = String(selectedTimeline || '').startsWith('season-')
      ? String(selectedTimeline || '').slice(7)
      : null
    const selectedSeason = selectedSeasonId
      ? (Array.isArray(attendancePeriods) ? attendancePeriods : []).find((item) => String(item?.id ?? '') === selectedSeasonId)
      : null
    const seasonFrom = selectedSeason ? parseDayMonth(selectedSeason.from) : null
    const seasonTo = selectedSeason ? parseDayMonth(selectedSeason.to) : null
    const monthMatch = String(selectedTimeline || '').match(/^month-(\d{1,2})$/)
    const selectedMonthIndex = monthMatch ? Number(monthMatch[1]) : null

    const isDateKeyInTimeline = (dateKey) => {
      const matched = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!matched) return false
      const year = Number(matched[1])
      const month = Number(matched[2])
      const day = Number(matched[3])
      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false

      if (Number.isInteger(selectedMonthIndex)) {
        return year === calendarDate.getFullYear() && month === (selectedMonthIndex + 1)
      }

      if (selectedSeason && seasonFrom && seasonTo) {
        return isMonthDayInRange({ day, month }, seasonFrom, seasonTo)
      }

      return year === calendarDate.getFullYear() && month === (calendarDate.getMonth() + 1)
    }

    const allEvidenceDays = new Set()
    const allEvidenceSessions = new Set()
    const sessionsByCategory = new Map()
    const playerDays = new Map()
    const playerSessions = new Map()
    const playerSessionsByCategory = new Map()
    const metricCounts = new Map()
    const metricEventCounts = new Map()
    const playerMetricCounts = new Map()
    const playerMinutesByCode = new Map()

    Object.entries(evidenceEntriesDraft || {}).forEach(([key, value]) => {
      const {
        categoryId,
        playerId,
        dateKey,
        metricId,
        sessionId
      } = parseEvidenceEntryKey(key)
      if (!categoryId || !playerId || !dateKey || !metricId) return
      if (selectedCategoryId !== 'all' && String(categoryId) !== selectedCategoryId) return
      if (!isDateKeyInTimeline(dateKey)) return
      if (!value || typeof value !== 'object' || value.attended === false) return

      const metricCode = metricCodeById.get(String(metricId || '')) || ''
      const dayToken = dateKey
      const normalizedSessionId = String(sessionId || 'default')
      const sessionToken = `${String(categoryId || '')}:${String(dateKey || '')}:${normalizedSessionId}`
      const metricEventToken = `${String(categoryId || '')}:${String(dateKey || '')}:${metricCode}:${normalizedSessionId}`

      allEvidenceDays.add(dayToken)
      allEvidenceSessions.add(sessionToken)

      if (!sessionsByCategory.has(String(categoryId || ''))) {
        sessionsByCategory.set(String(categoryId || ''), new Set())
      }
      sessionsByCategory.get(String(categoryId || '')).add(sessionToken)

      if (!playerDays.has(playerId)) playerDays.set(playerId, new Set())
      playerDays.get(playerId).add(dayToken)

      if (!playerSessions.has(playerId)) playerSessions.set(playerId, new Set())
      playerSessions.get(playerId).add(sessionToken)

      if (!playerSessionsByCategory.has(playerId)) playerSessionsByCategory.set(playerId, new Map())
      const perCategorySessions = playerSessionsByCategory.get(playerId)
      const safeCategoryId = String(categoryId || '')
      if (!perCategorySessions.has(safeCategoryId)) perCategorySessions.set(safeCategoryId, new Set())
      perCategorySessions.get(safeCategoryId).add(sessionToken)

      const incrementCount = (targetMap, keyCode, amount = 1) => {
        if (!keyCode) return
        targetMap.set(keyCode, Number(targetMap.get(keyCode) || 0) + amount)
      }

      const addEventToken = (targetMap, keyCode, eventToken) => {
        if (!keyCode || !eventToken) return
        if (!targetMap.has(keyCode)) targetMap.set(keyCode, new Set())
        targetMap.get(keyCode).add(eventToken)
      }

      incrementCount(metricCounts, metricCode, 1)
      addEventToken(metricEventCounts, metricCode, metricEventToken)

      if (!playerMetricCounts.has(playerId)) playerMetricCounts.set(playerId, new Map())
      const playerMetricCountMap = playerMetricCounts.get(playerId)
      incrementCount(playerMetricCountMap, metricCode, 1)

      const minutes = Number(String(value.minutes || '').replace(/[^\d]/g, '')) || 0
      if (HZ_TIME_SUM_CODES.has(metricCode)) {
        if (!playerMinutesByCode.has(playerId)) playerMinutesByCode.set(playerId, new Map())
        const playerMinutesMap = playerMinutesByCode.get(playerId)
        incrementCount(playerMinutesMap, metricCode, minutes)
      }
    })

    const configuredPoczCodes = configuredSourceCodesByMetricCode.POCZ || [...MATCH_METRIC_CODES]
    const configuredHzCodes = configuredSourceCodesByMetricCode.HZ || [...HZ_TIME_SUM_CODES]

    const sumFromMapByCodes = (targetMap, sourceCodes) => {
      const codes = Array.isArray(sourceCodes) ? sourceCodes : []
      return codes.reduce((sum, code) => sum + Number(targetMap.get(normalizeMetricCode(code)) || 0), 0)
    }

    const getGlobalMetricCount = (metricCode) => Number(metricCounts.get(metricCode) || 0)
    const getGlobalMetricEventCount = (metricCode) => {
      const normalizedCode = normalizeMetricCode(metricCode)
      return Number(metricEventCounts.get(normalizedCode)?.size || 0)
    }
    const getPlayerMetricCount = (playerId, metricCode) => {
      const metricMap = playerMetricCounts.get(String(playerId || ''))
      if (!metricMap) return 0
      return Number(metricMap.get(metricCode) || 0)
    }

    const getGlobalMinutes = (metricCode) => {
      let total = 0
      playerMinutesByCode.forEach((playerMap) => {
        total += Number(playerMap.get(normalizeMetricCode(metricCode)) || 0)
      })
      return total
    }

    const getPlayerMinutes = (playerId, metricCode = 'HZ') => {
      const playerMap = playerMinutesByCode.get(String(playerId || ''))
      if (!playerMap) return 0
      return Number(playerMap.get(normalizeMetricCode(metricCode)) || 0)
    }

    const getGlobalPoczCount = () => sumFromMapByCodes(metricCounts, configuredPoczCodes)
    const getPlayerPoczCount = (playerId) => {
      const metricMap = playerMetricCounts.get(String(playerId || ''))
      if (!metricMap) return 0
      return sumFromMapByCodes(metricMap, configuredPoczCodes)
    }

    const getGlobalHzMinutes = () => {
      let total = 0
      playerMinutesByCode.forEach((playerMap) => {
        total += sumFromMapByCodes(playerMap, configuredHzCodes)
      })
      return total
    }

    const getPlayerHzMinutes = (playerId) => {
      const playerMap = playerMinutesByCode.get(String(playerId || ''))
      if (!playerMap) return 0
      return sumFromMapByCodes(playerMap, configuredHzCodes)
    }

    const getGlobalPoczEventCount = () => {
      const eventTokens = new Set()
      configuredPoczCodes.forEach((code) => {
        const normalizedCode = normalizeMetricCode(code)
        const tokens = metricEventCounts.get(normalizedCode)
        if (!tokens) return
        tokens.forEach((token) => eventTokens.add(token))
      })
      return eventTokens.size
    }

    return {
      totalDzDays: allEvidenceDays.size,
      totalSessionCount: allEvidenceSessions.size,
      getTotalSessionCountForCategory: (categoryId) => sessionsByCategory.get(String(categoryId || ''))?.size || 0,
      getGlobalMetricCount,
      getGlobalMetricEventCount,
      getPlayerDzDays: (playerId) => playerDays.get(String(playerId || ''))?.size || 0,
      getPlayerSessionCount: (playerId) => playerSessions.get(String(playerId || ''))?.size || 0,
      getPlayerSessionCountForCategory: (playerId, categoryId) => (
        playerSessionsByCategory.get(String(playerId || ''))?.get(String(categoryId || ''))?.size || 0
      ),
      getPlayerMetricCount,
      getGlobalMinutes,
      getPlayerMinutes,
      getGlobalPoczCount,
      getGlobalPoczEventCount,
      getPlayerPoczCount,
      getGlobalHzMinutes,
      getPlayerHzMinutes
    }
  }, [
    evidenceEntriesDraft,
    selectedCategory,
    selectedTimeline,
    attendancePeriods,
    calendarDate,
    metricCodeById,
    configuredSourceCodesByMetricCode
  ])

  const toggleRosterSort = (nextKey) => {
    setRosterSort((prev) => {
      if (prev.key === nextKey) {
        return {
          key: nextKey,
          direction: prev.direction === 'desc' ? 'asc' : 'desc'
        }
      }
      return { key: nextKey, direction: 'desc' }
    })
  }

  const getSortIndicator = (columnKey) => {
    if (rosterSort.key !== columnKey) return null
    return rosterSort.direction === 'desc' ? '▼' : '▲'
  }

  const getEvidenceEntryKey = (categoryId, playerId, dateKey, metricId, sessionId = activeEvidenceSessionId) => (
    `${String(categoryId || '')}:${String(playerId || '')}:${String(dateKey || '')}:${String(metricId || '')}:${String(sessionId || 'default')}`
  )

  const getLegacyEvidenceEntryKey = (categoryId, playerId, dateKey, metricId) => (
    `${String(categoryId || '')}:${String(playerId || '')}:${String(dateKey || '')}:${String(metricId || '')}`
  )

  const getEvidenceSessionMetaKey = (categoryId, dateKey, sessionId = activeEvidenceSessionId) => (
    `${String(categoryId || '')}:${String(dateKey || '')}:${String(sessionId || 'default')}`
  )

  const getEvidenceEntryFromDraft = (draft, categoryId, playerId, dateKey, metricId, sessionId = activeEvidenceSessionId) => {
    const safeDraft = (draft && typeof draft === 'object') ? draft : {}
    const sessionKey = getEvidenceEntryKey(categoryId, playerId, dateKey, metricId, sessionId)
    const fromSession = safeDraft[sessionKey]
    if (fromSession && typeof fromSession === 'object') return fromSession

    if (String(sessionId || 'default') === 'default') {
      const legacyKey = getLegacyEvidenceEntryKey(categoryId, playerId, dateKey, metricId)
      const fromLegacy = safeDraft[legacyKey]
      if (fromLegacy && typeof fromLegacy === 'object') return fromLegacy
    }

    return null
  }

  const resolveEvidenceStorageKey = (categoryId, playerId, dateKey, metricId, sessionId = activeEvidenceSessionId) => {
    const sessionKey = getEvidenceEntryKey(categoryId, playerId, dateKey, metricId, sessionId)
    const normalizedSessionId = String(sessionId || 'default')
    if (normalizedSessionId !== 'default') return sessionKey

    const legacyKey = getLegacyEvidenceEntryKey(categoryId, playerId, dateKey, metricId)
    if (Object.prototype.hasOwnProperty.call(evidenceEntriesDraft || {}, legacyKey)) {
      return legacyKey
    }

    return sessionKey
  }

  const getMetricRawValue = (row, metric) => {
    const metricCode = normalizeMetricCode(toMetricShortLabel(metric))
    const isAttendancePercent = isAttendancePercentMetric(metric) || metricCode === '%'

    if (isCalendarDaysMetric(metric)) {
      return getTimelineDaysCount(selectedTimeline, attendancePeriods, calendarDate)
    }

    if (isAttendancePercent) {
      const isAllCategoriesView = String(selectedCategory || '') === 'all'
      const primaryCategoryId = (Array.isArray(row?.categories) ? row.categories : [])
        .find((category) => String(category?.name || '').trim() === String(row?.primaryCategory || '').trim())?.id
      const rowCategoryId = isAllCategoriesView
        ? String(primaryCategoryId || row?.categories?.[0]?.id || '')
        : String(selectedCategory || '')
      const totalSessionCount = rowCategoryId
        ? Number(evidenceAggregate.getTotalSessionCountForCategory(rowCategoryId) || 0)
        : Number(evidenceAggregate.totalSessionCount || 0)
      if (totalSessionCount <= 0) return 0
      const playerSessionCount = isAllCategoriesView
        ? evidenceAggregate.getPlayerSessionCount(row.id)
        : (rowCategoryId
            ? evidenceAggregate.getPlayerSessionCountForCategory(row.id, rowCategoryId)
            : evidenceAggregate.getPlayerSessionCount(row.id))
      const percent = Math.round((playerSessionCount / totalSessionCount) * 100)
      return Math.max(0, percent)
    }

    if (metricCode === 'DZ') {
      return evidenceAggregate.getPlayerDzDays(row.id)
    }

    if (metricCode === 'POCZ') {
      return evidenceAggregate.getPlayerPoczCount(row.id)
    }

    if (isHzMetric(metric, metricCode)) {
      return evidenceAggregate.getPlayerHzMinutes(row.id)
    }

    return evidenceAggregate.getPlayerMetricCount(row.id, metricCode)
  }

  const getMetricCellValue = (row, metric) => {
    const metricCode = normalizeMetricCode(toMetricShortLabel(metric))
    const rawValue = getMetricRawValue(row, metric)

    if (isCalendarDaysMetric(metric)) return String(rawValue)
    if (isAttendancePercentMetric(metric)) return `${rawValue}%`
    if (isHzMetric(metric, metricCode)) return `${rawValue} min`
    return String(rawValue)
  }

  const sortedRoster = useMemo(() => {
    if (!rosterSort.key) return listEligibleRoster

    const multiplier = rosterSort.direction === 'asc' ? 1 : -1
    return [...listEligibleRoster].sort((left, right) => {
      if (rosterSort.key === 'name') {
        return multiplier * String(left.name || '').localeCompare(String(right.name || ''), 'sk', { sensitivity: 'base' })
      }

      if (rosterSort.key === 'category') {
        return multiplier * String(left.primaryCategory || '').localeCompare(String(right.primaryCategory || ''), 'sk', { sensitivity: 'base' })
      }

      if (rosterSort.key.startsWith('metric:')) {
        const metricId = rosterSort.key.slice(7)
        const metric = metricsForRosterTableMap.get(metricId)
        if (!metric) return 0

        const leftValue = getMetricRawValue(left, metric)
        const rightValue = getMetricRawValue(right, metric)
        return multiplier * (leftValue - rightValue)
      }

      return 0
    })
  }, [listEligibleRoster, rosterSort, metricsForRosterTableMap, selectedTimeline, attendancePeriods, calendarDate, evidenceAggregate])

  const displayedRoster = useMemo(() => {
    if (selectedCategory === 'all') {
      return sortedRoster.slice(0, 20)
    }
    return sortedRoster
  }, [sortedRoster, selectedCategory])

  useEffect(() => {
    if (selectedCategory === 'all') return
    const categoryExists = visibleTeams.some((team) => String(team?.id ?? '') === String(selectedCategory))
    if (!categoryExists) {
      setSelectedCategory('all')
      setIsEvidenceMode(false)
    }
  }, [selectedCategory, visibleTeams])

  useEffect(() => {
    if (selectedCategory !== 'all') return
    setEvidenceCategoryDraft((prev) => {
      const prevValue = String(prev || '')
      const exists = visibleTeams.some((team) => String(team?.id ?? '') === prevValue)
      if (exists) return prevValue
      return ''
    })
  }, [selectedCategory, visibleTeams])

  useEffect(() => {
    let isMounted = true

    const loadAttendancePeriods = async () => {
      try {
        const response = await api.getAttendanceSeasons()
        if (!isMounted) return

        const remoteSeasons = normalizeAttendanceSeasons(response)
        setAttendancePeriods(remoteSeasons)
      } catch {
        if (!isMounted) return
        setAttendancePeriods([])
      }
    }

    loadAttendancePeriods()

    return () => {
      isMounted = false
    }
  }, [clubId])

  useEffect(() => {
    if (!clubId) {
      setAttendanceDisplayDraft({})
      setAttendanceDisplayLoaded(false)
      return
    }

    setAttendanceDisplayLoaded(false)

    const loadAttendanceDisplayDraft = async () => {
      try {
        const response = await api.getAttendanceDisplaySettings()
        const remoteDraft = response?.settings && typeof response.settings === 'object' ? response.settings : {}
        setAttendanceDisplayDraft(remoteDraft)
      } catch {
        setAttendanceDisplayDraft({})
      } finally {
        setAttendanceDisplayLoaded(true)
      }
    }

    loadAttendanceDisplayDraft()
  }, [clubId])

  useEffect(() => {
    if (!clubId || !attendanceDisplayLoaded) return
    const normalized = normalizeAttendanceDisplayDraft(attendanceMetrics, attendanceDisplayDraft)
    const prevSignature = JSON.stringify(attendanceDisplayDraft || {})
    const nextSignature = JSON.stringify(normalized || {})
    if (prevSignature === nextSignature) return

    setAttendanceDisplayDraft(normalized)
  }, [clubId, attendanceDisplayLoaded, attendanceMetrics, attendanceDisplayDraft])

  useEffect(() => {
    if (!clubId) {
      evidenceDraftHydratedRef.current = false
      lastEvidenceDraftSignatureRef.current = ''
      setEvidenceEntriesDraft({})
      setEvidenceSessionMetaDraft({})
      return
    }

    let isMounted = true
    evidenceDraftHydratedRef.current = false

    const loadEvidenceDraft = async () => {
      try {
        const club = await api.getMyClub()
        if (!isMounted) return

        const loadedEntries = normalizeDraftObject(club?.evidenceEntries)
        const loadedSessionMeta = normalizeDraftObject(club?.evidenceSessionMeta)

        setEvidenceEntriesDraft(loadedEntries)
        setEvidenceSessionMetaDraft(loadedSessionMeta)
        lastEvidenceDraftSignatureRef.current = JSON.stringify({
          evidenceEntries: loadedEntries,
          evidenceSessionMeta: loadedSessionMeta
        })
      } catch {
        if (!isMounted) return
        setEvidenceEntriesDraft({})
        setEvidenceSessionMetaDraft({})
        lastEvidenceDraftSignatureRef.current = JSON.stringify({
          evidenceEntries: {},
          evidenceSessionMeta: {}
        })
      } finally {
        evidenceDraftHydratedRef.current = true
      }
    }

    loadEvidenceDraft()

    return () => {
      isMounted = false
    }
  }, [clubId])

  useEffect(() => {
    if (!clubId || !evidenceDraftHydratedRef.current) return

    const evidenceEntries = normalizeDraftObject(evidenceEntriesDraft)
    const evidenceSessionMeta = normalizeDraftObject(evidenceSessionMetaDraft)
    const signature = JSON.stringify({ evidenceEntries, evidenceSessionMeta })
    if (signature === lastEvidenceDraftSignatureRef.current) return

    if (evidenceDraftSaveTimeoutRef.current) {
      window.clearTimeout(evidenceDraftSaveTimeoutRef.current)
    }

    evidenceDraftSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await api.updateMyClub({ evidenceEntries, evidenceSessionMeta })
        lastEvidenceDraftSignatureRef.current = signature
      } catch {
        // Ignore transient network errors; user data remains in memory and next change retries save.
      }
    }, 700)

    return () => {
      if (evidenceDraftSaveTimeoutRef.current) {
        window.clearTimeout(evidenceDraftSaveTimeoutRef.current)
      }
    }
  }, [clubId, evidenceEntriesDraft, evidenceSessionMetaDraft])

  useEffect(() => {
    if (!evidenceSaveNotice) return undefined
    const timeoutId = window.setTimeout(() => {
      setEvidenceSaveNotice('')
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [evidenceSaveNotice])

  const resolveMetricSummary = (metric) => {
    const label = String(metric?.shortName || '').trim() || String(metric?.name || 'Ukazovateľ')
    const metricCode = normalizeMetricCode(toMetricShortLabel(metric))
    const summaryRoster = displayedRoster

    let value = '0'

    if (isCalendarDaysMetric(metric)) {
      value = String(getTimelineDaysCount(selectedTimeline, attendancePeriods, calendarDate))
    } else if (isAttendancePercentMetric(metric)) {
      const average = summaryRoster.length === 0
        ? 0
        : Math.round(summaryRoster.reduce((sum, row) => sum + Number(getMetricRawValue(row, metric) || 0), 0) / summaryRoster.length)
      value = `${average}%`
    } else if (metricCode === 'DZ') {
      value = String(evidenceAggregate.totalDzDays)
    } else if (metricCode === 'POCZ') {
      value = String(evidenceAggregate.getGlobalPoczEventCount())
    } else if (isHzMetric(metric, metricCode)) {
      value = `${evidenceAggregate.getGlobalHzMinutes()} min`
    } else {
      value = String(evidenceAggregate.getGlobalMetricEventCount(metricCode))
    }

    return {
      id: String(metric?.id || label),
      label,
      value
    }
  }

  const topCardTrendContext = useMemo(() => {
    const currentYear = calendarDate.getFullYear()
    const currentMonthIndex = calendarDate.getMonth()
    const selectedDayOfMonth = Math.max(1, Number(selectedDay) || 1)

    const previousDate = new Date(currentYear, currentMonthIndex - 1, 1)
    const previousYear = previousDate.getFullYear()
    const previousMonthIndex = previousDate.getMonth()

    const currentDayLimit = getCappedDayInMonth(currentYear, currentMonthIndex, selectedDayOfMonth)
    const previousDayLimit = getCappedDayInMonth(previousYear, previousMonthIndex, selectedDayOfMonth)

    const currentSnapshot = buildMonthToDateTrendSnapshot({
      evidenceEntriesDraft,
      selectedCategory,
      year: currentYear,
      month: currentMonthIndex + 1,
      dayLimit: currentDayLimit,
      metricCodeById,
      configuredSourceCodesByMetricCode
    })

    const previousSnapshot = buildMonthToDateTrendSnapshot({
      evidenceEntriesDraft,
      selectedCategory,
      year: previousYear,
      month: previousMonthIndex + 1,
      dayLimit: previousDayLimit,
      metricCodeById,
      configuredSourceCodesByMetricCode
    })

    const getTrendComparableValue = (metric, snapshot) => {
      const metricCode = normalizeMetricCode(toMetricShortLabel(metric))
      if (isCalendarDaysMetric(metric)) return Number(snapshot.dayLimit || 0)

      if (isAttendancePercentMetric(metric)) {
        const totalSessionCount = Number(snapshot.totalSessionCount || 0)
        if (totalSessionCount <= 0 || displayedRoster.length === 0) return 0

        const average = Math.round(
          displayedRoster.reduce((sum, row) => {
            const playerSessionCount = Number(snapshot.getPlayerSessionCount(row.id) || 0)
            const percent = Math.round((playerSessionCount / totalSessionCount) * 100)
            return sum + Math.max(0, Math.min(100, percent))
          }, 0) / displayedRoster.length
        )
        return Number(average || 0)
      }

      if (metricCode === 'DZ') return Number(snapshot.totalDzDays || 0)
      if (metricCode === 'POCZ') return Number(snapshot.getGlobalPoczEventCount() || 0)
      if (isHzMetric(metric, metricCode)) return Number(snapshot.getGlobalHzMinutes() || 0)
      return Number(snapshot.getGlobalMetricEventCount(metricCode) || 0)
    }

    const resolveMetricTrend = (metric) => {
      if (isCalendarDaysMetric(metric)) {
        return { label: `${currentDayLimit}.deň`, direction: 'day' }
      }

      const currentValue = getTrendComparableValue(metric, currentSnapshot)
      const previousValue = getTrendComparableValue(metric, previousSnapshot)

      let percentDelta = 0
      if (previousValue > 0) {
        percentDelta = Math.round(((currentValue - previousValue) / previousValue) * 100)
      } else if (currentValue > 0) {
        percentDelta = 100
      }

      if (percentDelta > 0) {
        return { label: `+${percentDelta}%`, direction: 'up' }
      }
      if (percentDelta < 0) {
        return { label: `${percentDelta}%`, direction: 'down' }
      }
      return { label: '0%', direction: 'flat' }
    }

    return { resolveMetricTrend }
  }, [
    calendarDate,
    selectedDay,
    evidenceEntriesDraft,
    selectedCategory,
    metricCodeById,
    configuredSourceCodesByMetricCode,
    displayedRoster
  ])

  const topMetricCards = useMemo(() => {
    return topBlockRows.map((row, index) => {
      const selectedMetricDefs = activeMetricColumns
        .filter((metric) => row?.metrics?.[String(metric?.id)] === true)

      const selectedMetrics = selectedMetricDefs
        .map((metric) => resolveMetricSummary(metric))

      const primaryMetric = selectedMetricDefs[0] || null
      const trend = primaryMetric
        ? topCardTrendContext.resolveMetricTrend(primaryMetric)
        : { label: '0%', direction: 'flat' }

      return {
        id: String(row?.id || `top-row-${index + 1}`),
        name: String(row?.name || `Karta ${index + 1}`),
        metrics: selectedMetrics,
        trendLabel: trend.label,
        trendDirection: trend.direction
      }
    })
  }, [
    activeMetricColumns,
    displayedRoster,
    topBlockRows,
    selectedTimeline,
    attendancePeriods,
    calendarDate,
    evidenceAggregate,
    topCardTrendContext
  ])

  const calendarCells = useMemo(() => getCalendarCells(calendarDate), [calendarDate])

  const evidenceMetricColorMap = useMemo(() => {
    const usedColors = new Set()
    let fallbackIndex = 0

    const assignColor = (metricCode) => {
      const normalizedCode = String(metricCode || '').trim().toUpperCase()
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

    return new Map(metricsForEvidenceTable.map((metric) => {
      const metricId = String(metric?.id || '')
      const metricCode = String(toMetricShortLabel(metric) || '').trim().toUpperCase()
      return [metricId, assignColor(metricCode)]
    }))
  }, [metricsForEvidenceTable])

  const evidenceCalendarLegendItems = useMemo(() => {
    return metricsForEvidenceTable.map((metric) => {
      const metricId = String(metric?.id || '')
      return {
        id: metricId,
        label: String(toMetricShortLabel(metric) || '-').toUpperCase(),
        color: evidenceMetricColorMap.get(metricId) || '#4a83e3'
      }
    })
  }, [metricsForEvidenceTable, evidenceMetricColorMap])

  const evidenceDayVisualsInCalendarMonth = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth() + 1
    const targetPrefix = `${year}-${String(month).padStart(2, '0')}-`
    const selectedCategoryId = String(selectedCategory || '')
    const dayMarkers = new Map()

    Object.entries(evidenceEntriesDraft || {}).forEach(([key, value]) => {
      const {
        categoryId,
        dateKey,
        metricId
      } = parseEvidenceEntryKey(key)
      if (!dateKey || !String(dateKey).startsWith(targetPrefix)) return

      if (selectedCategoryId !== 'all' && String(categoryId || '') !== selectedCategoryId) return

      if (!value || typeof value !== 'object' || value.attended === false) return

      const matchedDay = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!matchedDay) return
      const dayNumber = Number(matchedDay[3])
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return

      const metricCode = metricCodeById.get(String(metricId || '')) || ''
      const metricColor = evidenceMetricColorMap.get(String(metricId || '')) || EVIDENCE_PRESET_COLORS_BY_CODE[String(metricCode || '').toUpperCase()] || '#4a83e3'
      const existing = dayMarkers.get(dayNumber) || new Set()
      existing.add(metricColor)
      dayMarkers.set(dayNumber, existing)
    })

    const dayVisuals = new Map()
    dayMarkers.forEach((colorsSet, dayNumber) => {
      const colors = Array.from(colorsSet)
      const visual = resolveEvidenceDayBackground(colors)
      dayVisuals.set(dayNumber, visual)
    })

    return dayVisuals
  }, [calendarDate, evidenceEntriesDraft, selectedCategory, metricCodeById, evidenceMetricColorMap])

  const plannedDayBorderByDay = useMemo(() => {
    const year = calendarDate.getFullYear()
    const monthIndex = calendarDate.getMonth()
    const targetPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
    const selectedCategoryId = String(selectedCategory || '')
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const evidenceDatesWithAttendance = new Set()
    Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
      if (!value || typeof value !== 'object' || value.attended === false) return

      const parsed = parseEvidenceEntryKey(entryKey)
      const parsedDateKey = String(parsed?.dateKey || '')
      if (!parsedDateKey || !parsedDateKey.startsWith(targetPrefix)) return

      if (selectedCategoryId !== 'all' && String(parsed?.categoryId || '') !== selectedCategoryId) return

      evidenceDatesWithAttendance.add(parsedDateKey)
    })

    const dayColorsMap = new Map()
    ;(Array.isArray(plannedSessions) ? plannedSessions : []).forEach((session) => {
      const dateKey = getSessionDateKey(session)
      if (!dateKey || !dateKey.startsWith(targetPrefix)) return
      const sessionTeamId = getSessionTeamId(session)
      if (selectedCategoryId !== 'all' && sessionTeamId !== selectedCategoryId) return

      const shouldHidePlannedForEvidenceDay = String(dateKey) <= todayKey
        && evidenceDatesWithAttendance.has(String(dateKey))
      if (shouldHidePlannedForEvidenceDay) return

      const day = Number(String(dateKey).slice(-2))
      if (!Number.isInteger(day) || day < 1 || day > 31) return

      const metricCode = getMetricCodeFromSession(session)
      const color = EVIDENCE_PRESET_COLORS_BY_CODE[String(metricCode || '').toUpperCase()] || '#4a83e3'

      const existing = dayColorsMap.get(day) || new Set()
      existing.add(color)
      dayColorsMap.set(day, existing)
    })

    const result = new Map()
    dayColorsMap.forEach((colorsSet, day) => {
      const colors = Array.from(colorsSet)
      if (colors.length === 1) {
        result.set(day, colors[0])
        return
      }

      const step = 100 / colors.length
      const segments = colors.map((color, index) => {
        const from = Math.round(index * step)
        const to = Math.round((index + 1) * step)
        return `${color} ${from}% ${to}%`
      })
      result.set(day, `linear-gradient(90deg, ${segments.join(', ')})`)
    })

    return result
  }, [calendarDate, plannedSessions, evidenceEntriesDraft, selectedCategory])

  const calendarDayTooltipByDay = useMemo(() => {
    const year = calendarDate.getFullYear()
    const monthIndex = calendarDate.getMonth()
    const targetPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
    const selectedCategoryId = String(selectedCategory || '')
    const teamNameById = new Map(
      (Array.isArray(visibleTeams) ? visibleTeams : []).map((team) => [String(team?.id ?? ''), String(team?.name || '').trim()])
    )

    const rowsByDay = new Map()
    const appendRow = (day, row) => {
      if (!Number.isInteger(day) || day < 1 || day > 31) return
      const text = String(row || '').trim()
      if (!text) return
      const existing = rowsByDay.get(day) || []
      existing.push(text)
      rowsByDay.set(day, existing)
    }

    ;(Array.isArray(plannedSessions) ? plannedSessions : []).forEach((session) => {
      const dateKey = getSessionDateKey(session)
      if (!dateKey || !dateKey.startsWith(targetPrefix)) return
      const sessionTeamId = getSessionTeamId(session)
      if (selectedCategoryId !== 'all' && sessionTeamId !== selectedCategoryId) return

      const day = Number(String(dateKey).slice(-2))
      const teamId = getSessionTeamId(session)
      const teamName = teamNameById.get(teamId)
        || getSessionTeamName(session)
        || 'Kategória'
      const metricCode = getMetricCodeFromSession(session)
      const title = String(session?.title || session?.name || session?.label || 'Udalosť').trim()
      const time = getSessionStartTimeLabel(session)
      const duration = getSessionDurationMinutes(session)

      appendRow(
        day,
        `${teamName} ${metricCode} ${title}${time ? ` o ${time}` : ''}${duration ? ` - ${duration} min` : ''}`
      )
    })

    const evidenceAggregates = new Map()
    Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
      if (!value || typeof value !== 'object') return

      const parsed = parseEvidenceEntryKey(entryKey)
      const categoryId = String(parsed?.categoryId || '')
      const dateKey = String(parsed?.dateKey || '')
      const sessionId = String(parsed?.sessionId || 'default')
      const metricId = String(parsed?.metricId || '')

      if (!categoryId || !dateKey || !metricId) return
      if (!dateKey.startsWith(targetPrefix)) return
      if (selectedCategoryId !== 'all' && categoryId !== selectedCategoryId) return

      const aggregateKey = `${categoryId}:${dateKey}:${sessionId}:${metricId}`
      const previous = evidenceAggregates.get(aggregateKey) || {
        categoryId,
        dateKey,
        sessionId,
        metricId,
        total: 0,
        attended: 0,
        minutes: []
      }

      previous.total += 1
      if (value.attended !== false) {
        previous.attended += 1
        const parsedMinutes = Number(String(value.minutes || '').replace(/[^\d]/g, ''))
        if (Number.isFinite(parsedMinutes) && parsedMinutes > 0) {
          previous.minutes.push(parsedMinutes)
        }
      }

      evidenceAggregates.set(aggregateKey, previous)
    })

    evidenceAggregates.forEach((aggregate) => {
      const day = Number(String(aggregate.dateKey).slice(-2))
      const metricCode = normalizeMetricCode(metricCodeById.get(String(aggregate.metricId || '')) || 'TJ') || 'TJ'
      const teamName = teamNameById.get(String(aggregate.categoryId || '')) || 'Kategória'
      const attendancePercent = aggregate.total > 0
        ? Math.round((aggregate.attended / aggregate.total) * 100)
        : 0
      const avgMinutes = aggregate.minutes.length > 0
        ? Math.round(aggregate.minutes.reduce((sum, value) => sum + value, 0) / aggregate.minutes.length)
        : null
      const metaKey = `${String(aggregate.categoryId || '')}:${String(aggregate.dateKey || '')}:${String(aggregate.sessionId || 'default')}`
      const trainingTime = String(evidenceSessionMetaDraft?.[metaKey]?.trainingTime || '').trim()

      appendRow(
        day,
        `${teamName} ${metricCode} Evidencia${trainingTime ? ` o ${trainingTime}` : ''}${avgMinutes ? ` - ${avgMinutes} min` : ''} účasť ${attendancePercent}%`
      )
    })

    return rowsByDay
  }, [calendarDate, selectedCategory, visibleTeams, plannedSessions, evidenceEntriesDraft, evidenceSessionMetaDraft, metricCodeById])

  const selectedCalendarDate = useMemo(() => {
    const year = calendarDate.getFullYear()
    const monthIndex = calendarDate.getMonth()
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const safeDay = Math.max(1, Math.min(Number(selectedDay) || 1, daysInMonth))
    return new Date(year, monthIndex, safeDay)
  }, [calendarDate, selectedDay])

  const selectedCalendarDateLabel = useMemo(() => {
    return selectedCalendarDate.toLocaleDateString('sk-SK')
  }, [selectedCalendarDate])

  const selectedCalendarDateKey = useMemo(() => {
    const year = selectedCalendarDate.getFullYear()
    const month = String(selectedCalendarDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedCalendarDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [selectedCalendarDate])

  const buildDateKeyFromDay = (day) => {
    const year = calendarDate.getFullYear()
    const month = String(calendarDate.getMonth() + 1).padStart(2, '0')
    const dayPart = String(day).padStart(2, '0')
    return `${year}-${month}-${dayPart}`
  }

  const findEvidenceSessionIdForDate = (dateKey, categoryId) => {
    const targetCategoryId = String(categoryId || '')
    const sessionCounts = new Map()
    const sessionAttendedCounts = new Map()

    Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
      const parsed = parseEvidenceEntryKey(entryKey)
      if (!parsed.categoryId || !parsed.dateKey) return
      if (parsed.categoryId !== targetCategoryId) return
      if (parsed.dateKey !== String(dateKey || '')) return
      if (!value || typeof value !== 'object') return

      const sessionId = parsed.sessionId || 'default'
      sessionCounts.set(sessionId, Number(sessionCounts.get(sessionId) || 0) + 1)
      if (value.attended !== false) {
        sessionAttendedCounts.set(sessionId, Number(sessionAttendedCounts.get(sessionId) || 0) + 1)
      }
    })

    if (sessionCounts.size === 0) return ''

    const sorted = [...sessionCounts.entries()].sort((left, right) => {
      const rightAttended = Number(sessionAttendedCounts.get(right[0]) || 0)
      const leftAttended = Number(sessionAttendedCounts.get(left[0]) || 0)
      if (rightAttended !== leftAttended) return rightAttended - leftAttended
      if (right[1] !== left[1]) return right[1] - left[1]
      return String(right[0]).localeCompare(String(left[0]))
    })

    return String(sorted[0]?.[0] || '')
  }

  const resolveTopMetricIdForSession = (dateKey, categoryId, sessionId) => {
    const targetCategoryId = String(categoryId || '')
    const targetSessionId = String(sessionId || 'default')
    const metricCounts = new Map()

    Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
      const parsed = parseEvidenceEntryKey(entryKey)
      if (!parsed.categoryId || !parsed.dateKey || !parsed.metricId) return
      if (parsed.categoryId !== targetCategoryId) return
      if (parsed.dateKey !== String(dateKey || '')) return
      if (String(parsed.sessionId || 'default') !== targetSessionId) return
      if (!value || typeof value !== 'object' || value.attended === false) return

      const metricId = String(parsed.metricId || '')
      metricCounts.set(metricId, Number(metricCounts.get(metricId) || 0) + 1)
    })

    if (metricCounts.size === 0) return ''
    const sorted = [...metricCounts.entries()].sort((left, right) => right[1] - left[1])
    return String(sorted[0]?.[0] || '')
  }

  const resolveTopVisibleMetricIdForSession = (dateKey, categoryId, sessionId) => {
    const targetCategoryId = String(categoryId || '')
    const targetSessionId = String(sessionId || 'default')
    const visibleMetricIds = new Set(metricsForEvidenceTable.map((metric) => String(metric?.id || '')).filter(Boolean))
    const metricCounts = new Map()

    Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
      const parsed = parseEvidenceEntryKey(entryKey)
      if (!parsed.categoryId || !parsed.dateKey || !parsed.metricId) return
      if (parsed.categoryId !== targetCategoryId) return
      if (parsed.dateKey !== String(dateKey || '')) return
      if (String(parsed.sessionId || 'default') !== targetSessionId) return
      if (!visibleMetricIds.has(String(parsed.metricId || ''))) return
      if (!value || typeof value !== 'object' || value.attended === false) return

      const metricId = String(parsed.metricId || '')
      metricCounts.set(metricId, Number(metricCounts.get(metricId) || 0) + 1)
    })

    if (metricCounts.size === 0) return ''
    const sorted = [...metricCounts.entries()].sort((left, right) => right[1] - left[1])
    return String(sorted[0]?.[0] || '')
  }

  const getEvidenceInfoForDateKey = (dateKey) => {
    const categoryCounts = new Map()
    const metricCountsByCategory = new Map()

    Object.entries(evidenceEntriesDraft || {}).forEach(([key, value]) => {
      const { categoryId, dateKey: entryDateKey, metricId } = parseEvidenceEntryKey(key)
      if (!categoryId || !entryDateKey || !metricId) return
      if (entryDateKey !== dateKey) return
      if (!value || typeof value !== 'object' || value.attended === false) return

      categoryCounts.set(categoryId, (categoryCounts.get(categoryId) || 0) + 1)

      if (!metricCountsByCategory.has(categoryId)) {
        metricCountsByCategory.set(categoryId, new Map())
      }
      const metricCounts = metricCountsByCategory.get(categoryId)
      metricCounts.set(metricId, (metricCounts.get(metricId) || 0) + 1)
    })

    if (categoryCounts.size === 0) {
      return {
        hasEvidence: false,
        topCategoryId: '',
        resolveTopMetricId: () => ''
      }
    }

    const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])
    const topCategoryId = String(sortedCategories[0]?.[0] || '')

    const resolveTopMetricId = (categoryId) => {
      const metricCounts = metricCountsByCategory.get(String(categoryId || ''))
      if (!metricCounts || metricCounts.size === 0) return ''
      const sortedMetrics = [...metricCounts.entries()].sort((a, b) => b[1] - a[1])
      return String(sortedMetrics[0]?.[0] || '')
    }

    return {
      hasEvidence: true,
      topCategoryId,
      resolveTopMetricId
    }
  }

  const activeEvidenceMetric = useMemo(() => {
    return metricsForEvidenceTable.find((metric) => evidenceMetricSwitches[String(metric?.id || '')] !== false) || null
  }, [metricsForEvidenceTable, evidenceMetricSwitches])

  const activeEvidenceMetricId = String(activeEvidenceMetric?.id || '')
  const activeEvidenceMetricLabel = activeEvidenceMetric ? toMetricShortLabel(activeEvidenceMetric) : '-'

  const getEvidenceEntry = (playerId, metricId = activeEvidenceMetricId) => {
    if (!resolvedEvidenceCategoryId || !metricId) return null
    const source = getEvidenceEntryFromDraft(
      evidenceEntriesDraft,
      resolvedEvidenceCategoryId,
      playerId,
      selectedCalendarDateKey,
      metricId,
      activeEvidenceSessionId
    )
    if (!source || typeof source !== 'object') {
      return { attended: true, minutes: '' }
    }
    return {
      attended: source.attended !== false,
      minutes: String(source.minutes || '')
    }
  }

  const showEvidenceCategoryPicker = selectedCategory === 'all'
  const resolvedEvidenceCategoryId = showEvidenceCategoryPicker
    ? String(evidenceCategoryDraft || '')
    : String(selectedCategory || '')

  const evidenceSessionsForSelectedDate = useMemo(() => {
    const sessionStats = new Map()
    const targetCategoryId = String(resolvedEvidenceCategoryId || '')
    const targetDateKey = String(selectedCalendarDateKey || '')

    if (targetCategoryId && targetDateKey) {
      Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
        const parsed = parseEvidenceEntryKey(entryKey)
        if (String(parsed.categoryId || '') !== targetCategoryId) return
        if (String(parsed.dateKey || '') !== targetDateKey) return
        if (!value || typeof value !== 'object') return

        const sessionId = String(parsed.sessionId || 'default')
        const prev = sessionStats.get(sessionId) || { total: 0, attended: 0 }
        sessionStats.set(sessionId, {
          total: prev.total + 1,
          attended: prev.attended + (value.attended !== false ? 1 : 0)
        })
      })
    }

    if (isEvidenceMode && activeEvidenceSessionId) {
      const activeId = String(activeEvidenceSessionId)
      if (!sessionStats.has(activeId)) {
        sessionStats.set(activeId, { total: 0, attended: 0 })
      }
    }

    return [...sessionStats.entries()]
      .sort((left, right) => {
        if (right[1].attended !== left[1].attended) return right[1].attended - left[1].attended
        if (right[1].total !== left[1].total) return right[1].total - left[1].total
        return String(right[0]).localeCompare(String(left[0]))
      })
      .map(([sessionId]) => String(sessionId))
  }, [
    evidenceEntriesDraft,
    resolvedEvidenceCategoryId,
    selectedCalendarDateKey,
    isEvidenceMode,
    activeEvidenceSessionId
  ])

  const activeEvidenceSessionIndex = useMemo(() => {
    const activeId = String(activeEvidenceSessionId || '')
    return evidenceSessionsForSelectedDate.findIndex((sessionId) => String(sessionId) === activeId)
  }, [evidenceSessionsForSelectedDate, activeEvidenceSessionId])

  const canSwitchEvidenceSession = evidenceSessionsForSelectedDate.length > 1

  const evidenceRecordProgressForSelectedDate = useMemo(() => {
    const targetCategoryId = String(resolvedEvidenceCategoryId || '')
    const targetDateKey = String(selectedCalendarDateKey || '')
    const metricOrder = new Map(
      metricsForEvidenceTable
        .map((metric, index) => [String(metric?.id || ''), index])
        .filter(([metricId]) => Boolean(metricId))
    )

    const recordsMap = new Map()

    if (targetCategoryId && targetDateKey) {
      Object.entries(evidenceEntriesDraft || {}).forEach(([entryKey, value]) => {
        const parsed = parseEvidenceEntryKey(entryKey)
        if (String(parsed.categoryId || '') !== targetCategoryId) return
        if (String(parsed.dateKey || '') !== targetDateKey) return
        if (!value || typeof value !== 'object' || value.attended === false) return

        const sessionId = String(parsed.sessionId || 'default')
        const metricId = String(parsed.metricId || '')
        if (!metricId) return

        const recordKey = `${sessionId}::${metricId}`
        const prev = recordsMap.get(recordKey) || {
          sessionId,
          metricId,
          total: 0,
          attended: 0
        }

        recordsMap.set(recordKey, {
          ...prev,
          total: prev.total + 1,
          attended: prev.attended + 1
        })
      })
    }

    if (isEvidenceMode && activeEvidenceSessionId && activeEvidenceMetricId) {
      const activeRecordKey = `${String(activeEvidenceSessionId)}::${String(activeEvidenceMetricId)}`
      if (!recordsMap.has(activeRecordKey)) {
        recordsMap.set(activeRecordKey, {
          sessionId: String(activeEvidenceSessionId),
          metricId: String(activeEvidenceMetricId),
          total: 0,
          attended: 0
        })
      }
    }

    const records = [...recordsMap.values()].sort((left, right) => {
      if (right.attended !== left.attended) return right.attended - left.attended
      if (right.total !== left.total) return right.total - left.total
      const leftMetricOrder = metricOrder.get(String(left.metricId))
      const rightMetricOrder = metricOrder.get(String(right.metricId))
      if (leftMetricOrder !== undefined && rightMetricOrder !== undefined && leftMetricOrder !== rightMetricOrder) {
        return leftMetricOrder - rightMetricOrder
      }
      if (leftMetricOrder !== undefined && rightMetricOrder === undefined) return -1
      if (leftMetricOrder === undefined && rightMetricOrder !== undefined) return 1
      if (String(left.sessionId) !== String(right.sessionId)) {
        return String(right.sessionId).localeCompare(String(left.sessionId))
      }
      return String(left.metricId).localeCompare(String(right.metricId))
    })

    const activeKey = `${String(activeEvidenceSessionId || '')}::${String(activeEvidenceMetricId || '')}`
    const activeIndex = records.findIndex((item) => `${String(item.sessionId)}::${String(item.metricId)}` === activeKey)

    return {
      total: records.length,
      index: activeIndex,
      records
    }
  }, [
    evidenceEntriesDraft,
    resolvedEvidenceCategoryId,
    selectedCalendarDateKey,
    isEvidenceMode,
    activeEvidenceSessionId,
    activeEvidenceMetricId,
    metricsForEvidenceTable
  ])

  const activeEvidenceRecordTooltip = useMemo(() => {
    const records = Array.isArray(evidenceRecordProgressForSelectedDate.records)
      ? evidenceRecordProgressForSelectedDate.records
      : []
    if (records.length === 0) return ''

    const activeIndex = evidenceRecordProgressForSelectedDate.index >= 0
      ? evidenceRecordProgressForSelectedDate.index
      : 0
    const activeRecord = records[activeIndex]
    if (!activeRecord) return ''

    const metricId = String(activeRecord.metricId || '')
    const matchedMetric = metricsForEvidenceTable.find((metric) => String(metric?.id || '') === metricId)
    const metricLabel = matchedMetric ? toMetricShortLabel(matchedMetric) : metricId
    const position = `${Math.max(1, activeIndex + 1)}/${records.length}`

    return metricLabel
      ? `Evidencia ${position}: ${metricLabel}`
      : `Evidencia ${position}`
  }, [evidenceRecordProgressForSelectedDate, metricsForEvidenceTable])

  const evidenceTableTitle = useMemo(() => {
    if (!isEvidenceMode) return 'Dochádzka hráčov'
    if (evidenceTableMode === 'day-view') return 'Zobrazenie evidencie v danom dni'
    return 'Nová evidencia hráčov'
  }, [isEvidenceMode, evidenceTableMode])

  const switchEvidenceSession = (direction) => {
    if (!isEvidenceMode) return
    const safeDirection = Number(direction) || 0
    if (safeDirection === 0) return

    const records = Array.isArray(evidenceRecordProgressForSelectedDate.records)
      ? evidenceRecordProgressForSelectedDate.records
      : []
    if (records.length <= 1) return

    const currentIndex = evidenceRecordProgressForSelectedDate.index >= 0
      ? evidenceRecordProgressForSelectedDate.index
      : 0
    const nextIndex = currentIndex + safeDirection
    if (nextIndex < 0 || nextIndex >= records.length) return

    const nextRecord = records[nextIndex]
    const nextSessionId = String(nextRecord?.sessionId || '')
    const nextMetricId = String(nextRecord?.metricId || '')
    if (!nextSessionId || !nextMetricId) return

    if (nextMetricId) {
      setEvidenceMetricSwitches(() => {
        const next = {}
        metricsForEvidenceTable.forEach((metric) => {
          const metricId = String(metric?.id || '')
          if (!metricId) return
          next[metricId] = metricId === nextMetricId
        })
        return next
      })
    }

    setActiveEvidenceSessionId(nextSessionId)
    setIsEvidenceEditUnlocked(false)
    setEvidenceSaveNotice('')
  }

  const updateTrainingTimeForActiveSession = (timeValue) => {
    if (!requestEvidenceEditUnlock()) return false

    const normalized = String(timeValue || '').trim()
    setEvidenceTrainingTime(normalized)

    if (!resolvedEvidenceCategoryId || !selectedCalendarDateKey || !activeEvidenceSessionId) return true
    const metaKey = getEvidenceSessionMetaKey(resolvedEvidenceCategoryId, selectedCalendarDateKey, activeEvidenceSessionId)
    setEvidenceSessionMetaDraft((prev) => ({
      ...(prev && typeof prev === 'object' ? prev : {}),
      [metaKey]: {
        ...((prev?.[metaKey] && typeof prev[metaKey] === 'object') ? prev[metaKey] : {}),
        trainingTime: normalized
      }
    }))

    return true
  }

  const buildEvidenceFormSignature = ({
    entriesDraft = evidenceEntriesDraft,
    sessionMetaDraft = evidenceSessionMetaDraft,
    categoryId = resolvedEvidenceCategoryId,
    dateKey = selectedCalendarDateKey,
    sessionId = activeEvidenceSessionId
  } = {}) => {
    const safeCategoryId = String(categoryId || '')
    const safeDateKey = String(dateKey || '')
    const safeSessionId = String(sessionId || '')
    if (!safeCategoryId || !safeDateKey || !safeSessionId) return ''

    const metaKey = getEvidenceSessionMetaKey(safeCategoryId, safeDateKey, safeSessionId)
    const trainingTime = String(sessionMetaDraft?.[metaKey]?.trainingTime || '')
    const metricIds = metricsForEvidenceTable.map((metric) => String(metric?.id || '')).filter(Boolean)

    const rowsSignature = displayedRoster.map((row) => {
      const playerId = String(row?.id || '')
      const metricSignature = metricIds.map((metricId) => {
        const entry = getEvidenceEntryFromDraft(entriesDraft, safeCategoryId, playerId, safeDateKey, metricId, safeSessionId)
        const attended = entry ? entry.attended !== false : true
        const minutes = entry ? String(entry.minutes || '') : ''
        return `${metricId}|${attended ? 1 : 0}|${minutes}`
      }).join(';')
      return `${playerId}=[${metricSignature}]`
    }).join('#')

    return `${trainingTime}::${rowsSignature}`
  }

  const currentEvidenceFormSignature = useMemo(() => {
    if (!isEvidenceMode) return ''
    return buildEvidenceFormSignature()
  }, [
    isEvidenceMode,
    evidenceEntriesDraft,
    evidenceSessionMetaDraft,
    resolvedEvidenceCategoryId,
    selectedCalendarDateKey,
    activeEvidenceSessionId,
    displayedRoster,
    metricsForEvidenceTable
  ])

  const hasEvidenceFormChanges = Boolean(isEvidenceMode)
    && Boolean(evidenceFormBaselineSignature)
    && currentEvidenceFormSignature !== evidenceFormBaselineSignature

  const closeEvidenceConfirmDialog = () => {
    setEvidenceConfirmDialog({
      open: false,
      type: null,
      title: '',
      message: '',
      confirmLabel: 'Potvrdiť'
    })
  }

  const performRemoveEvidenceSession = () => {
    if (!resolvedEvidenceCategoryId || !selectedCalendarDateKey || !activeEvidenceSessionId || !activeEvidenceMetricId) return

    const targetCategoryId = String(resolvedEvidenceCategoryId)
    const targetDateKey = String(selectedCalendarDateKey)
    const targetSessionId = String(activeEvidenceSessionId)
    const targetMetricId = String(activeEvidenceMetricId)

    setEvidenceEntriesDraft((prev) => {
      const next = { ...(prev && typeof prev === 'object' ? prev : {}) }
      Object.keys(next).forEach((entryKey) => {
        const parsed = parseEvidenceEntryKey(entryKey)
        if (String(parsed.categoryId || '') !== targetCategoryId) return
        if (String(parsed.dateKey || '') !== targetDateKey) return
        if (String(parsed.sessionId || 'default') !== targetSessionId) return
        if (String(parsed.metricId || '') !== targetMetricId) return
        delete next[entryKey]
      })
      return next
    })

    const removedRecordKey = `${targetSessionId}::${targetMetricId}`
    const remainingRecords = (Array.isArray(evidenceRecordProgressForSelectedDate.records)
      ? evidenceRecordProgressForSelectedDate.records
      : []).filter((record) => {
      const recordKey = `${String(record?.sessionId || '')}::${String(record?.metricId || '')}`
      return recordKey !== removedRecordKey
    })

    const stillHasRecordsInSession = remainingRecords.some((record) => String(record?.sessionId || '') === targetSessionId)
    if (!stillHasRecordsInSession) {
      const metaKey = getEvidenceSessionMetaKey(targetCategoryId, targetDateKey, targetSessionId)
      setEvidenceSessionMetaDraft((prev) => {
        const next = { ...(prev && typeof prev === 'object' ? prev : {}) }
        delete next[metaKey]
        return next
      })
    }

    setIsEvidenceEditUnlocked(false)
    setSelectedCategory(targetCategoryId)
    setEvidenceCategoryDraft(targetCategoryId)
    setActiveEvidenceSessionId('default')
    setEvidenceTrainingTime('')
    setEvidenceSaveNotice('Evidencia odstránená')
    setIsEvidenceMode(false)
  }

  const handleEvidenceConfirmAccept = () => {
    const dialogType = String(evidenceConfirmDialog.type || '')

    setEvidenceConfirmDialog({
      open: false,
      type: null,
      title: '',
      message: '',
      confirmLabel: 'Potvrdiť'
    })

    if (dialogType === 'remove-session') {
      performRemoveEvidenceSession()
    }
  }

  const requestEvidenceEditUnlock = () => {
    if (isEvidenceEditUnlocked) return true
    setIsEvidenceEditUnlocked(true)
    return true
  }

  useEffect(() => {
    if (!isEvidenceMode) {
      setEvidenceFormBaselineSignature('')
      setIsEvidenceEditUnlocked(false)
      setEvidenceTableMode('attendance')
      return
    }

    setEvidenceFormBaselineSignature(buildEvidenceFormSignature())
    setIsEvidenceEditUnlocked(false)
  }, [
    isEvidenceMode,
    resolvedEvidenceCategoryId,
    selectedCalendarDateKey,
    activeEvidenceSessionId,
    displayedRoster,
    metricsForEvidenceTable
  ])

  useEffect(() => {
    if (!isEvidenceMode) return
    if (!resolvedEvidenceCategoryId || !selectedCalendarDateKey || !activeEvidenceSessionId) {
      setEvidenceTrainingTime('')
      return
    }

    const metaKey = getEvidenceSessionMetaKey(resolvedEvidenceCategoryId, selectedCalendarDateKey, activeEvidenceSessionId)
    const nextTrainingTime = String(evidenceSessionMetaDraft?.[metaKey]?.trainingTime || '')
    setEvidenceTrainingTime(nextTrainingTime)
  }, [
    isEvidenceMode,
    resolvedEvidenceCategoryId,
    selectedCalendarDateKey,
    activeEvidenceSessionId,
    evidenceSessionMetaDraft
  ])

  const handleEvidenceAction = () => {
    const nextSessionId = createEvidenceSessionId()

    if (showEvidenceCategoryPicker) {
      if (!resolvedEvidenceCategoryId) return
      setActiveEvidenceSessionId(nextSessionId)
      setIsEvidenceEditUnlocked(false)
      setSelectedCategory(resolvedEvidenceCategoryId)
      setEvidenceTableMode('new')
      setIsEvidenceMode(true)
      return
    }

    setActiveEvidenceSessionId(nextSessionId)
    setIsEvidenceEditUnlocked(false)
    setEvidenceTableMode('new')
    setIsEvidenceMode(true)
    setEvidenceSaveNotice('')
  }

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId)
    setActiveEvidenceSessionId('default')
    setIsEvidenceEditUnlocked(false)
    setIsEvidenceMode(false)
    setEvidenceSaveNotice('')
  }

  const handleCalendarDayClick = (day) => {
    setSelectedDay(day)

    const targetDateKey = buildDateKeyFromDay(day)
    const dayInfo = getEvidenceInfoForDateKey(targetDateKey)
    if (!dayInfo.hasEvidence) return

    let targetCategoryId = ''
    const currentCategoryId = String(selectedCategory || '')
    if (currentCategoryId && currentCategoryId !== 'all') {
      const currentCategoryTopMetric = dayInfo.resolveTopMetricId(currentCategoryId)
      if (currentCategoryTopMetric) {
        targetCategoryId = currentCategoryId
      }
    }

    if (!targetCategoryId) {
      targetCategoryId = String(dayInfo.topCategoryId || '')
    }

    if (!targetCategoryId) return

    if (currentCategoryId === 'all') {
      setEvidenceCategoryDraft(targetCategoryId)
    }
    setSelectedCategory(targetCategoryId)

    const targetSessionId = findEvidenceSessionIdForDate(targetDateKey, targetCategoryId)
    if (!targetSessionId) return

    setActiveEvidenceSessionId(targetSessionId)
    setIsEvidenceEditUnlocked(false)

    const targetMetricId = resolveTopVisibleMetricIdForSession(targetDateKey, targetCategoryId, targetSessionId)
      || resolveTopMetricIdForSession(targetDateKey, targetCategoryId, targetSessionId)
      || dayInfo.resolveTopMetricId(targetCategoryId)
    if (targetMetricId) {
      setEvidenceMetricSwitches(() => {
        const next = {}
        metricsForEvidenceTable.forEach((item) => {
          const metricId = String(item?.id || '')
          if (!metricId) return
          next[metricId] = metricId === targetMetricId
        })
        return next
      })
    }

    setEvidenceSaveNotice('')
    setEvidenceTableMode('day-view')
    setIsEvidenceMode(true)
  }

  const shiftSelectedCalendarDay = (deltaDays) => {
    const safeDelta = Number(deltaDays) || 0
    if (safeDelta === 0) return

    const nextDate = new Date(selectedCalendarDate)
    nextDate.setDate(nextDate.getDate() + safeDelta)

    setCalendarDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
    setSelectedDay(nextDate.getDate())
    setEvidenceSaveNotice('')
  }

  const openTrainingTimePicker = () => {
    setIsTrainingTimeClockOpen(true)
  }

  const closeTrainingTimeClock = () => {
    setIsTrainingTimeClockOpen(false)
  }

  const updateEvidenceMinutes = (playerId, rawValue, metricId = activeEvidenceMetricId) => {
    if (!resolvedEvidenceCategoryId || !metricId) return
    if (!requestEvidenceEditUnlock()) return

    const key = resolveEvidenceStorageKey(resolvedEvidenceCategoryId, playerId, selectedCalendarDateKey, metricId)
    const normalized = String(rawValue || '').replace(/[^\d]/g, '').slice(0, 3)
    setEvidenceEntriesDraft((prev) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] && typeof prev[key] === 'object' ? prev[key] : {}),
        attended: prev?.[key]?.attended !== false,
        minutes: normalized
      }
    }))
  }

  const updateEvidenceAttendance = (playerId, attended, metricId = activeEvidenceMetricId) => {
    if (!resolvedEvidenceCategoryId || !metricId) return
    if (!requestEvidenceEditUnlock()) return

    const key = resolveEvidenceStorageKey(resolvedEvidenceCategoryId, playerId, selectedCalendarDateKey, metricId)
    setEvidenceEntriesDraft((prev) => {
      const previous = (prev?.[key] && typeof prev[key] === 'object') ? prev[key] : {}
      const nextMinutes = attended
        ? (String(previous.minutes || '').trim() || String(evidenceSessionTime || '').trim())
        : ''

      return {
        ...prev,
        [key]: {
          ...previous,
          attended,
          minutes: String(nextMinutes || '').replace(/[^\d]/g, '').slice(0, 3)
        }
      }
    })
  }

  const applySessionTimeToRoster = (minutesValue, metricId = activeEvidenceMetricId) => {
    if (!resolvedEvidenceCategoryId || !metricId) return
    if (!requestEvidenceEditUnlock()) return

    const normalizedMinutes = String(minutesValue || '').replace(/[^\d]/g, '').slice(0, 3)
    setEvidenceEntriesDraft((prev) => {
      const next = { ...prev }

      displayedRoster.forEach((row) => {
        const key = resolveEvidenceStorageKey(resolvedEvidenceCategoryId, row.id, selectedCalendarDateKey, metricId)
        const previous = (prev?.[key] && typeof prev[key] === 'object') ? prev[key] : {}
        const attended = previous.attended !== false
        if (!attended) return

        next[key] = {
          ...previous,
          attended: true,
          minutes: normalizedMinutes
        }
      })

      return next
    })
  }

  const handleRemoveEvidenceSession = () => {
    if (!resolvedEvidenceCategoryId || !selectedCalendarDateKey || !activeEvidenceSessionId) return

    setEvidenceConfirmDialog({
      open: true,
      type: 'remove-session',
      title: 'Odstránenie evidencie',
      message: 'Naozaj chceš odstrániť celú evidenciu tohto záznamu? Túto akciu nie je možné vrátiť späť.',
      confirmLabel: 'Odstrániť'
    })
  }

  const handleSaveEvidence = () => {
    if (!resolvedEvidenceCategoryId || !activeEvidenceMetricId) return

    let savedPlayersCount = 0

    displayedRoster.forEach((row) => {
      const entry = getEvidenceEntry(row.id, activeEvidenceMetricId)
      if (!entry || entry.attended === false) return

      savedPlayersCount += 1
    })

    if (savedPlayersCount <= 0) {
      const targetCategoryId = String(resolvedEvidenceCategoryId)
      const targetDateKey = String(selectedCalendarDateKey)
      const targetSessionId = String(activeEvidenceSessionId)
      const targetMetricId = String(activeEvidenceMetricId)

      setEvidenceEntriesDraft((prev) => {
        const next = { ...(prev && typeof prev === 'object' ? prev : {}) }
        Object.keys(next).forEach((entryKey) => {
          const parsed = parseEvidenceEntryKey(entryKey)
          if (String(parsed.categoryId || '') !== targetCategoryId) return
          if (String(parsed.dateKey || '') !== targetDateKey) return
          if (String(parsed.sessionId || 'default') !== targetSessionId) return
          if (String(parsed.metricId || '') !== targetMetricId) return
          delete next[entryKey]
        })
        return next
      })

      const removedRecordKey = `${targetSessionId}::${targetMetricId}`
      const remainingRecords = (Array.isArray(evidenceRecordProgressForSelectedDate.records)
        ? evidenceRecordProgressForSelectedDate.records
        : []).filter((record) => {
        const recordKey = `${String(record?.sessionId || '')}::${String(record?.metricId || '')}`
        return recordKey !== removedRecordKey
      })

      const stillHasRecordsInSession = remainingRecords.some((record) => String(record?.sessionId || '') === targetSessionId)
      if (!stillHasRecordsInSession) {
        const metaKey = getEvidenceSessionMetaKey(targetCategoryId, targetDateKey, targetSessionId)
        setEvidenceSessionMetaDraft((prev) => {
          const next = { ...(prev && typeof prev === 'object' ? prev : {}) }
          delete next[metaKey]
          return next
        })
      }

      if (remainingRecords.length > 0) {
        const nextRecord = remainingRecords[0]
        const nextSessionId = String(nextRecord?.sessionId || '')
        const nextMetricId = String(nextRecord?.metricId || '')

        if (nextMetricId) {
          setEvidenceMetricSwitches(() => {
            const next = {}
            metricsForEvidenceTable.forEach((metric) => {
              const metricId = String(metric?.id || '')
              if (!metricId) return
              next[metricId] = metricId === nextMetricId
            })
            return next
          })
        }

        if (nextSessionId) {
          setActiveEvidenceSessionId(nextSessionId)
        }
      } else {
        setEvidenceTrainingTime('')
        setIsEvidenceMode(false)
      }

      setIsEvidenceEditUnlocked(false)
      setEvidenceSaveNotice('Evidencia bola automaticky odstránená (žiadny hráč nemal záznam)')
      return
    }

    const trainingTimeLabel = String(evidenceTrainingTime || '').trim() || '--:--'
    setEvidenceSaveNotice(`Evidencia uložená (${activeEvidenceMetricLabel}): ${savedPlayersCount} hráčov, čas tréningu: ${trainingTimeLabel}`)
    setIsEvidenceMode(false)
  }

  const monthTimelineButtons = useMemo(() => (
    monthNames.map((monthName, index) => ({
      id: `month-${index}`,
      type: 'month',
      label: monthShortNames[index] || monthName,
      fullLabel: monthName,
      monthIndex: index
    }))
  ), [])

  const periodTimelineButtons = useMemo(() => (
    (Array.isArray(attendancePeriods) ? attendancePeriods : []).map((period) => ({
      id: `season-${period.id}`,
      type: 'season',
      label: String(period?.name || 'Obdobie'),
      from: String(period?.from || ''),
      to: String(period?.to || '')
    }))
  ), [attendancePeriods])

  const selectMonthByIndex = (monthIndex) => {
    if (!Number.isInteger(monthIndex)) return
    const normalizedMonth = Math.max(0, Math.min(11, monthIndex))
    setSelectedTimeline(`month-${normalizedMonth}`)
    setCalendarDate((prev) => new Date(prev.getFullYear(), normalizedMonth, 1))
  }

  const moveCalendarMonth = (delta) => {
    setCalendarDate((prev) => {
      const nextDate = new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      setSelectedTimeline(`month-${nextDate.getMonth()}`)
      return nextDate
    })
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
    const monthsRow = monthsScrollRef.current?.querySelector('.evidence-months-row')
    const firstMonthButton = monthsRow?.querySelector('.evidence-month-btn')
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
    const startLeft = container.scrollLeft
    const targetLeft = startLeft + (direction * oneMonthOffset)
    const durationMs = 230
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      container.scrollLeft = targetLeft
      return
    }

    const easeInOut = (value) => (value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2)
    const startTime = performance.now()

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)
      const eased = easeInOut(progress)
      container.scrollLeft = startLeft + ((targetLeft - startLeft) * eased)
      if (progress < 1) {
        window.requestAnimationFrame(tick)
      }
    }

    window.requestAnimationFrame(tick)
  }

  useEffect(() => {
    const selectedSeasonId = String(selectedTimeline || '').startsWith('season-')
      ? String(selectedTimeline || '').slice(7)
      : null

    if (!selectedSeasonId) return

    const exists = periodTimelineButtons.some((item) => String(item.id) === `season-${selectedSeasonId}`)
    if (!exists) {
      setSelectedTimeline(`month-${calendarDate.getMonth()}`)
    }
  }, [selectedTimeline, periodTimelineButtons, calendarDate])

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

  const escapePrintHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const handlePrintAttendanceTable = () => {
    const selectedCategoryName = selectedCategory === 'all'
      ? 'Všetky kategórie'
      : String(visibleTeams.find((team) => String(team?.id) === String(selectedCategory))?.name || 'Vybraná kategória')

    const columns = [
      'Hráč',
      ...(shouldShowCategoryColumn ? ['Kategória'] : []),
      ...metricsForRosterTable.map((metric) => String(toMetricShortLabel(metric) || 'Ukazovateľ'))
    ]

    const rows = displayedRoster.map((row) => ([
      String(row?.name || ''),
      ...(shouldShowCategoryColumn ? [String(row?.primaryCategory || '')] : []),
      ...metricsForRosterTable.map((metric) => String(getMetricCellValue(row, metric) || ''))
    ]))

    const generatedAt = new Date().toLocaleString('sk-SK')
    const tableHeaderHtml = columns.map((column) => `<th>${escapePrintHtml(column)}</th>`).join('')
    const tableRowsHtml = rows.length > 0
      ? rows
          .map((cells) => `<tr>${cells.map((cell) => `<td>${escapePrintHtml(cell)}</td>`).join('')}</tr>`)
          .join('')
      : `<tr><td colspan="${columns.length}">Žiadne údaje na tlač</td></tr>`

    const printHtml = `
      <!doctype html>
      <html lang="sk">
      <head>
        <meta charset="utf-8" />
        <title>Dochádzka hráčov - ${escapePrintHtml(selectedCategoryName)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          .meta { margin: 0 0 16px; color: #475569; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; word-break: break-word; }
          th { background: #e2e8f0; text-align: left; }
          tr:nth-child(even) td { background: #f8fafc; }
          @media print { body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <h1>Dochádzka hráčov</h1>
        <p class="meta">Kategória: ${escapePrintHtml(selectedCategoryName)} · Vygenerované: ${escapePrintHtml(generatedAt)}</p>
        <table>
          <thead><tr>${tableHeaderHtml}</tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </body>
      </html>
    `

    try {
      const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' })
      const printUrl = URL.createObjectURL(blob)
      const printWindow = window.open(printUrl, '_blank', 'width=1100,height=800')

      if (!printWindow) {
        URL.revokeObjectURL(printUrl)
        setEvidenceSaveNotice('Nepodarilo sa otvoriť okno pre tlač')
        return
      }

      const revokeUrl = () => {
        window.setTimeout(() => {
          URL.revokeObjectURL(printUrl)
        }, 30000)
      }

      printWindow.addEventListener('load', () => {
        printWindow.focus()
        printWindow.print()
      }, { once: true })
      revokeUrl()
    } catch {
      setEvidenceSaveNotice('Nepodarilo sa pripraviť tlač')
    }
  }

  return (
    <div className="evidence-dashboard">
      <div className="page-header evidence-page-header">
        <div>
          <h2>Evidencia dochádzky</h2>
          <p>Prehľad účasti a výkonu hráčov podľa kategórií.</p>
        </div>
        <div className="evidence-header-actions">
          <div className="evidence-search">
            <span className="material-icons-round" aria-hidden="true">search</span>
            <input
              type="text"
              placeholder="Hľadať hráča alebo kategóriu"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button type="button" className="btn evidence-export-btn" onClick={handlePrintAttendanceTable}>
            Vytlačiť dochádzku
          </button>
        </div>
      </div>

      <div className="evidence-stats-grid" style={{ '--stats-columns': Math.max(1, topMetricCards.length) }}>
        {topMetricCards.map((card) => (
          <div key={`metric-card-${card.id}`} className="card evidence-stat-card">
            <div className="evidence-stat-head">
              <span className="material-icons-round" aria-hidden="true">{resolveTopBlockCardIcon(card.name)}</span>
              <small className={card.trendDirection}>{card.trendLabel}</small>
            </div>
            <p>{card.name}</p>
            {card.metrics.length === 0 ? (
              <strong>Bez ukazovateľov</strong>
            ) : (
              <div className="evidence-stat-metrics-list">
                {card.metrics.map((item) => (
                  <div
                    key={`${card.id}-${item.id}`}
                    className="evidence-stat-metric-row"
                    aria-label={String(item.label || '')}
                    title={String(item.label || '')}
                  >
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="evidence-timeline-stack" role="group" aria-label="Mesiace a obdobia dochádzky">
        <div className="evidence-timeline-row">
          <div className="evidence-months-wrap" ref={monthsWrapRef}>
            <button
              type="button"
              className="evidence-month-nav"
              onClick={() => scrollMonths(-1)}
              aria-label="Posunúť mesiace doľava"
            >
              <span className="material-icons-round" aria-hidden="true">chevron_left</span>
            </button>

            <div className="evidence-months-viewport" ref={monthsScrollRef}>
              <div className="evidence-months-row">
                {monthTimelineButtons.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`card evidence-timeline-btn evidence-month-btn ${selectedTimeline === item.id ? 'active' : ''}`}
                    onClick={() => handleTimelineSelect(item)}
                    title={item.fullLabel}
                  >
                    <span className="evidence-timeline-btn-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="evidence-month-nav"
              onClick={() => scrollMonths(1)}
              aria-label="Posunúť mesiace doprava"
            >
              <span className="material-icons-round" aria-hidden="true">chevron_right</span>
            </button>
          </div>

          {periodTimelineButtons.length > 0 ? (
            <div className="evidence-periods-fixed">
              {periodTimelineButtons.length > 3 ? (
                <div className="evidence-period-select-wrap">
                  <select
                    className="evidence-period-select"
                    value={String(selectedTimeline || '').startsWith('season-') ? selectedTimeline : ''}
                    onChange={(event) => {
                      const nextValue = String(event.target.value || '')
                      const nextPeriod = periodTimelineButtons.find((item) => item.id === nextValue)
                      if (nextPeriod) {
                        handleTimelineSelect(nextPeriod)
                      }
                    }}
                  >
                    <option value="">Vyber obdobie</option>
                    {periodTimelineButtons.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                periodTimelineButtons.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`card evidence-timeline-btn evidence-month-btn evidence-period-btn ${selectedTimeline === item.id ? 'active' : ''}`}
                    onClick={() => handleTimelineSelect(item)}
                  >
                    <span className="evidence-timeline-btn-label">{item.label}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="evidence-main-grid">
        <div className="card evidence-panel">
          <div className="evidence-panel-head evidence-roster-panel-head">
            <h3>{evidenceTableTitle}</h3>
            <div className="evidence-table-head-actions">
              <span>{displayedRoster.length} položiek</span>
              {isEvidenceMode && evidenceRecordProgressForSelectedDate.total > 0 ? (
                <span className="evidence-session-switch" aria-label="Prepínanie evidencií dňa">
                  {evidenceRecordProgressForSelectedDate.total > 1 ? (
                    <button
                      type="button"
                      className="evidence-session-switch-btn"
                      onClick={() => switchEvidenceSession(-1)}
                      disabled={evidenceRecordProgressForSelectedDate.index <= 0}
                      aria-label="Predchádzajúca evidencia"
                    >
                      <span className="material-icons-round" aria-hidden="true">chevron_left</span>
                    </button>
                  ) : null}
                  <span className="evidence-session-switch-label">
                    <span title={activeEvidenceRecordTooltip}>
                      {Math.max(1, evidenceRecordProgressForSelectedDate.index + 1)}/{evidenceRecordProgressForSelectedDate.total}
                    </span>
                  </span>
                  {evidenceRecordProgressForSelectedDate.total > 1 ? (
                    <button
                      type="button"
                      className="evidence-session-switch-btn"
                      onClick={() => switchEvidenceSession(1)}
                      disabled={evidenceRecordProgressForSelectedDate.index >= (evidenceRecordProgressForSelectedDate.total - 1)}
                      aria-label="Nasledujúca evidencia"
                    >
                      <span className="material-icons-round" aria-hidden="true">chevron_right</span>
                    </button>
                  ) : null}
                </span>
              ) : null}
              {isEvidenceMode ? (
                <button
                  type="button"
                  className="evidence-close-btn"
                  onClick={() => setIsEvidenceMode(false)}
                  aria-label="Zavrieť tabuľku evidencie"
                >
                  <span className="material-icons-round" aria-hidden="true">close</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="evidence-category-chips">
            <button
              type="button"
              className={`evidence-category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleCategorySelect('all')}
            >
              Všetky
            </button>
            {visibleTeams.map((team) => (
              <button
                key={`team-chip-${team.id}`}
                type="button"
                className={`evidence-category-chip ${String(selectedCategory) === String(team.id) ? 'active' : ''}`}
                onClick={() => handleCategorySelect(String(team.id))}
              >
                {team.name}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="manager-empty-text">Načítavam dáta...</p>
          ) : displayedRoster.length === 0 ? (
            <p className="manager-empty-text">Pre zvolený filter nie sú dostupní hráči.</p>
          ) : (
            <>
              {evidenceSaveNotice ? <p className="evidence-save-notice">{evidenceSaveNotice}</p> : null}
              <div className="evidence-roster-table-wrap">
                <div className="evidence-roster-table-head" style={{ gridTemplateColumns: rosterGridTemplateColumns }}>
                {isEvidenceMode ? (
                  <span>Hráč</span>
                ) : (
                  <button
                    type="button"
                    className={`evidence-roster-sort-btn ${rosterSort.key === 'name' ? 'active' : ''}`}
                    onClick={() => toggleRosterSort('name')}
                  >
                    <span>Hráč</span>
                    {getSortIndicator('name') ? <span className="evidence-sort-indicator">{getSortIndicator('name')}</span> : null}
                  </button>
                )}

                {isEvidenceMode ? (
                  <span className="evidence-date-col evidence-date-control-col">
                    <span className="evidence-date-inline-nav">
                      <button
                        type="button"
                        className="evidence-date-shift-btn"
                        onClick={() => shiftSelectedCalendarDay(-1)}
                        aria-label="Predchádzajúci deň"
                      >
                        <span className="material-icons-round" aria-hidden="true">chevron_left</span>
                      </button>
                      <span className="evidence-date-value">{selectedCalendarDateLabel}</span>
                      <button
                        type="button"
                        className="evidence-date-shift-btn"
                        onClick={() => shiftSelectedCalendarDay(1)}
                        aria-label="Nasledujúci deň"
                      >
                        <span className="material-icons-round" aria-hidden="true">chevron_right</span>
                      </button>
                    </span>
                  </span>
                ) : null}

                {isEvidenceMode ? (
                  <span className="evidence-time-col evidence-time-head-col">
                    <button
                      type="button"
                      className="evidence-training-time-btn"
                      onClick={openTrainingTimePicker}
                      aria-label="Nastaviť čas tréningu"
                    >
                      <span className="material-icons-round" aria-hidden="true">schedule</span>
                      <span>{evidenceTrainingTime || 'Čas'}</span>
                    </button>
                  </span>
                ) : null}

                {isEvidenceMode
                  ? (
                    <span className="evidence-metric-col evidence-metric-head-toggle">
                      <span className="evidence-metric-toggle-group">
                        {metricsForEvidenceTable.map((metric) => (
                          <button
                            key={`metric-head-evidence-${metric.id}`}
                            type="button"
                            className={`evidence-metric-toggle-btn ${evidenceMetricSwitches[String(metric?.id || '')] !== false ? 'active' : ''}`}
                            aria-label={`Prepínač ukazovateľa ${toMetricShortLabel(metric)}`}
                            onClick={() => {
                              const metricId = String(metric?.id || '')
                              if (!metricId) return
                              const next = {}
                              metricsForEvidenceTable.forEach((item) => {
                                const itemId = String(item?.id || '')
                                if (!itemId) return
                                next[itemId] = itemId === metricId
                              })
                              setEvidenceMetricSwitches(next)
                            }}
                          >
                            {toMetricShortLabel(metric)}
                          </button>
                        ))}
                      </span>
                    </span>
                  )
                  : (
                    <>
                      {shouldShowCategoryColumn ? (
                        <button
                          type="button"
                          className={`evidence-roster-sort-btn evidence-category-col ${rosterSort.key === 'category' ? 'active' : ''}`}
                          onClick={() => toggleRosterSort('category')}
                        >
                          <span>Kategória</span>
                          {getSortIndicator('category') ? <span className="evidence-sort-indicator">{getSortIndicator('category')}</span> : null}
                        </button>
                      ) : null}
                      {metricsForRosterTable.map((metric) => (
                        <button
                          key={`metric-head-${metric.id}`}
                          type="button"
                          className={`evidence-roster-sort-btn evidence-metric-col ${rosterSort.key === `metric:${metric.id}` ? 'active' : ''}`}
                          onClick={() => toggleRosterSort(`metric:${metric.id}`)}
                        >
                          <span>{toMetricShortLabel(metric)}</span>
                          {getSortIndicator(`metric:${metric.id}`) ? <span className="evidence-sort-indicator">{getSortIndicator(`metric:${metric.id}`)}</span> : null}
                        </button>
                      ))}
                    </>
                  )}

                {isEvidenceMode ? (
                  <span className="evidence-metric-col evidence-min-head">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="evidence-time-input"
                      value={evidenceSessionTime}
                      onChange={(event) => {
                        const nextMinutes = String(event.target.value || '').replace(/[^\d]/g, '').slice(0, 3)
                        setEvidenceSessionTime(nextMinutes)
                        applySessionTimeToRoster(nextMinutes)
                      }}
                      aria-label="Minúty evidencie"
                      placeholder="min"
                    />
                    <span>Min</span>
                  </span>
                ) : null}
                </div>
                {displayedRoster.map((row) => (
                  <div key={row.id} className="evidence-roster-table-row" style={{ gridTemplateColumns: rosterGridTemplateColumns }}>
                  <span className="evidence-player-cell">
                    <span className="evidence-player-avatar" aria-hidden="true">
                      {row.avatarUrl
                        ? <img src={row.avatarUrl} alt="" />
                        : <span>{toNameInitials(row.name)}</span>}
                    </span>
                    <span>{row.name}</span>
                  </span>
                  {isEvidenceMode ? <span className="evidence-date-col">{selectedCalendarDateLabel}</span> : null}
                  {isEvidenceMode ? <span className="evidence-time-col evidence-time-row-value">{evidenceTrainingTime || '--:--'}</span> : null}
                  {isEvidenceMode
                    ? (
                      <span className="evidence-metric-col evidence-empty-metric-cell" aria-label="Prázdna hodnota pre ukazovateľ">
                        {activeEvidenceMetricLabel}
                      </span>
                    )
                    : (
                      <>
                        {shouldShowCategoryColumn ? <span className="evidence-category-col">{row.primaryCategory}</span> : null}
                        {metricsForRosterTable.map((metric) => (
                          <span key={`metric-cell-${row.id}-${metric.id}`} className="evidence-metric-col">{getMetricCellValue(row, metric)}</span>
                        ))}
                      </>
                    )}
                  {isEvidenceMode ? (
                    <span className="evidence-metric-col">
                      <span className="evidence-minutes-cell-wrap">
                        <label className="evidence-row-switch" aria-label={`Účasť hráča ${row.name}`}>
                          <input
                            type="checkbox"
                            checked={getEvidenceEntry(row.id)?.attended !== false}
                            onChange={(event) => updateEvidenceAttendance(row.id, event.target.checked)}
                          />
                          <span className="evidence-row-switch-slider" />
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="evidence-minutes-input"
                          value={getEvidenceEntry(row.id)?.minutes || ''}
                          onChange={(event) => updateEvidenceMinutes(row.id, event.target.value)}
                          placeholder="min"
                          disabled={getEvidenceEntry(row.id)?.attended === false}
                        />
                      </span>
                    </span>
                  ) : null}
                  </div>
                ))}

                {isEvidenceMode ? (
                  <div className="evidence-save-row">
                    <button
                      type="button"
                      className="btn evidence-save-btn"
                      onClick={handleSaveEvidence}
                      disabled={!activeEvidenceMetricId}
                    >
                      Uložiť evidenciu
                    </button>
                    <button
                      type="button"
                      className="btn evidence-remove-btn"
                      onClick={handleRemoveEvidenceSession}
                    >
                      Odstrániť evidenciu
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="evidence-side-stack">
          <div className="card evidence-panel">
            <div className="evidence-panel-head">
              <h3>Kalendár dochádzky</h3>
              <span>{monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}</span>
            </div>

            <div className="evidence-calendar-controls">
              <button
                type="button"
                className="evidence-icon-btn"
                onClick={() => moveCalendarMonth(-1)}
                aria-label="Predchádzajúci mesiac"
              >
                <span className="material-icons-round" aria-hidden="true">chevron_left</span>
              </button>
              <button
                type="button"
                className="evidence-icon-btn"
                onClick={() => moveCalendarMonth(1)}
                aria-label="Nasledujúci mesiac"
              >
                <span className="material-icons-round" aria-hidden="true">chevron_right</span>
              </button>
            </div>

            <div className="evidence-calendar-weekdays">
              {weekDays.map((weekDay) => (
                <span key={`weekday-${weekDay}`}>{weekDay}</span>
              ))}
            </div>
            <div className="evidence-calendar-grid">
              {calendarCells.map((cell) => (
                (() => {
                  const dayVisual = !cell.muted ? evidenceDayVisualsInCalendarMonth.get(cell.day) : null
                  const plannedBorder = !cell.muted ? plannedDayBorderByDay.get(cell.day) : null
                  const tooltipRows = !cell.muted ? (calendarDayTooltipByDay.get(cell.day) || []) : []
                  return (
                <button
                  key={cell.key}
                  type="button"
                  className={`evidence-calendar-day ${cell.muted ? 'muted' : ''} ${!cell.muted && dayVisual ? 'has-evidence' : ''} ${!cell.muted && plannedBorder ? 'has-planned' : ''} ${!cell.muted && dayVisual && String(selectedCategory || '') === 'all' ? 'disabled-open' : ''} ${!cell.muted && selectedDay === cell.day ? 'active' : ''}`}
                  style={{
                    ...(dayVisual ? { '--evidence-day-bg': dayVisual.background, '--evidence-day-border': dayVisual.border } : {}),
                    ...(plannedBorder ? { '--evidence-planned-border': plannedBorder } : {})
                  }}
                  title={!cell.muted && dayVisual
                    ? (String(selectedCategory || '') === 'all'
                        ? 'Pre otvorenie evidencie vyber konkrétnu kategóriu'
                        : 'Klikni pre otvorenie evidencie')
                    : undefined}
                  onClick={() => {
                    if (cell.muted) return
                    handleCalendarDayClick(cell.day)
                  }}
                >
                  <span className="evidence-calendar-day-number">{cell.day}</span>
                  {tooltipRows.length > 0 ? (
                    <div className="evidence-calendar-day-tooltip" role="tooltip" aria-hidden="true">
                      {tooltipRows.slice(0, 6).map((row, index) => (
                        <div key={`tooltip-${cell.key}-${index}`} className="evidence-calendar-day-tooltip-row">{row}</div>
                      ))}
                      {tooltipRows.length > 6 ? (
                        <div className="evidence-calendar-day-tooltip-more">+{tooltipRows.length - 6} ďalšie</div>
                      ) : null}
                    </div>
                  ) : null}
                </button>
                  )
                })()
              ))}
            </div>

            <div className="evidence-calendar-legend" aria-label="Legenda kalendára dochádzky">
              {evidenceCalendarLegendItems.map((item) => (
                <span key={`legend-${item.id}`} className="evidence-calendar-legend-item">
                  <span className="evidence-calendar-legend-dot" style={{ '--legend-color': item.color }} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="card evidence-panel">
            <div className="evidence-panel-head">
              <h3>Sprav evidenciu</h3>
              <span>{selectedCalendarDateLabel}</span>
            </div>

            <div className={`evidence-manage-controls ${showEvidenceCategoryPicker ? '' : 'single'}`}>
              {showEvidenceCategoryPicker ? (
                <select
                  className="evidence-manage-select"
                  value={resolvedEvidenceCategoryId}
                  onChange={(event) => {
                    const nextCategoryId = String(event.target.value || '')
                    setEvidenceCategoryDraft(nextCategoryId)
                    if (!nextCategoryId) {
                      setSelectedCategory('all')
                      setIsEvidenceMode(false)
                      return
                    }
                    setSelectedCategory(nextCategoryId)
                    setIsEvidenceMode(false)
                  }}
                >
                  <option value="">Vyber kategóriu</option>
                  {visibleTeams.map((team) => (
                    <option key={`evidence-manage-team-${team.id}`} value={String(team.id)}>
                      {team.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                className={`btn evidence-manage-btn ${showEvidenceCategoryPicker ? '' : 'full'}`}
                onClick={handleEvidenceAction}
                disabled={!resolvedEvidenceCategoryId}
              >
                Nová evidencia
              </button>
            </div>
          </div>
        </div>
      </div>

      {evidenceConfirmDialog.open ? (
        <div className="evidence-confirm-modal-overlay" role="dialog" aria-modal="true" aria-label="Potvrdenie akcie evidencie">
          <div className="evidence-confirm-modal-card">
            <h3>{evidenceConfirmDialog.title}</h3>
            <p>{evidenceConfirmDialog.message}</p>

            <div className="evidence-confirm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeEvidenceConfirmDialog}
                disabled={loading}
              >
                Zrušiť
              </button>
              <button
                type="button"
                className={`manager-add-btn ${String(evidenceConfirmDialog.type || '') === 'remove-session' ? 'category-form-toggle-cancel' : ''}`.trim()}
                onClick={handleEvidenceConfirmAccept}
                disabled={loading}
              >
                {evidenceConfirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TimeClockPickerModal
        isOpen={isTrainingTimeClockOpen}
        value={evidenceTrainingTime}
        onClose={closeTrainingTimeClock}
        onApply={(nextValue) => updateTrainingTimeForActiveSession(nextValue)}
        ariaLabel="Výber času tréningu"
      />
    </div>
  )
}

export default Evidence
