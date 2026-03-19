import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import './MyClub.css'

const MEDIA_API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '')

const resolveMediaUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw
  }
  if (raw.startsWith('/')) {
    return `${MEDIA_API_ORIGIN}${raw}`
  }
  return `${MEDIA_API_ORIGIN}/${raw}`
}

const extractYoutubeVideoId = (urlValue) => {
  const raw = String(urlValue || '').trim()
  if (!raw) return ''

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()

    if (host === 'youtu.be') {
      return String(parsed.pathname || '').replace(/^\//, '').trim()
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const watchId = parsed.searchParams.get('v')
      if (watchId) return String(watchId).trim()

      const pathParts = String(parsed.pathname || '').split('/').filter(Boolean)
      const embedIndex = pathParts.findIndex((item) => item === 'embed' || item === 'shorts' || item === 'live')
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) {
        return String(pathParts[embedIndex + 1]).trim()
      }
    }
  } catch {
    return ''
  }

  return ''
}

const getYoutubeThumbnailUrl = (videoId) => {
  const resolvedId = String(videoId || '').trim()
  if (!resolvedId) return ''
  return `https://img.youtube.com/vi/${resolvedId}/hqdefault.jpg`
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Nepodarilo sa nacitat subor.'))
  reader.readAsDataURL(file)
})

const PERMISSION_LABELS = {
  'club.manage': 'Prístup k správe klubu',
  'members.manage': 'Správa členov klubu',
  'reports.view': 'Prehľad reportov',
  'categories.manage': 'Správa kategórií',
  'exercises.manage': 'Správa cvičení',
  'trainings.manage': 'Správa tréningov',
  'planner.manage': 'Správa plánovača',
  'attendance.manage': 'Správa dochádzky',
  'fields.manage': 'Správa ihrísk',
  'coaches.manage': 'Správa trénerov',
  'assistants.manage': 'Správa asistentov',
  'players.manage': 'Správa hráčov',
  'virtualPlayers.manage': 'Správa virtuálnych hráčov',
  'invites.manage': 'Správa pozvánok',
  'fees.manage': 'Správa poplatkov',
  'communication.manage': 'Správa komunikácie',
  'privateDevelopment.manage': 'Správa súkromného rozvoja',
  'profile.manage': 'Správa profilu'
}

const PERMISSION_ACTION_LABELS = {
  manage: 'Spravovanie',
  view: 'Zobrazenie',
  create: 'Vytvorenie',
  update: 'Úprava',
  edit: 'Úprava',
  delete: 'Odstránenie',
  remove: 'Odobratie',
  assign: 'Priradenie',
  read: 'Zobrazenie',
  write: 'Úprava'
}

const PERMISSION_TOKEN_LABELS = {
  club: 'klubu',
  clubs: 'klubov',
  member: 'člena',
  members: 'členov',
  team: 'kategórie',
  teams: 'kategórií',
  training: 'tréningu',
  trainings: 'tréningov',
  planner: 'plánovača',
  planners: 'plánovačov',
  attendance: 'dochádzky',
  field: 'ihriska',
  fields: 'ihrísk',
  match: 'zápasu',
  matches: 'zápasov',
  evaluation: 'hodnotenia',
  evaluations: 'hodnotení',
  media: 'médií',
  user: 'používateľa',
  users: 'používateľov',
  permission: 'oprávnenia',
  permissions: 'oprávnení'
}

const VISIBLE_SECTION_OPTIONS = [
  { key: 'categories', label: 'Kategórie' },
  { key: 'coaches', label: 'Tréneri' },
  { key: 'players', label: 'Hráči' },
  { key: 'attendance', label: 'Dochádzka' },
  { key: 'planner', label: 'Plánovač' },
  { key: 'matches', label: 'Zápasy' },
  { key: 'trainings', label: 'Tréningy' },
  { key: 'exercises', label: 'Cvičenia' },
  { key: 'tests', label: 'Testy' },
  { key: 'membershipFees', label: 'Členské poplatky' },
  { key: 'communication', label: 'Komunikácia' }
]

const DEFAULT_VISIBLE_SECTIONS_BY_ROLE = {
  club: ['categories', 'coaches', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'membershipFees', 'communication'],
  coach: ['categories', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'communication'],
  parent: ['attendance', 'matches', 'trainings', 'tests', 'membershipFees', 'communication'],
  player: ['attendance', 'matches', 'trainings', 'tests']
}

const SETTINGS_ROLES = [
  { key: 'club', label: 'Klub' },
  { key: 'coach', label: 'Tréner' },
  { key: 'parent', label: 'Rodič' },
  { key: 'player', label: 'Hráč' }
]

const METRIC_TYPE_OPTIONS = [
  { value: 'number', label: 'Číslo', icon: 'pin' },
  { value: 'minutes', label: 'Minúty', icon: 'schedule' },
  { value: 'percent', label: 'Percentá', icon: 'percent' },
  { value: 'boolean', label: 'Áno/Nie', icon: 'toggle_on' }
]

const METRIC_MODE_OPTIONS = [
  { value: 'manual', label: 'Manuálne zadávanie' },
  { value: 'formula', label: 'Vzorec (auto-výpočet)' }
]

const FORMULA_OPERATOR_OPTIONS = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' },
  { value: '(', label: '(' },
  { value: ')', label: ')' }
]

const FORMULA_DIGIT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const EXERCISE_PLAYERS_COUNT_OPTIONS = Array.from({ length: 20 }, (_, index) => String(index + 1))

const normalizeExercisePlayersCount = (value) => {
  const toList = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim())

  const normalized = toList
    .map((item) => Number.parseInt(String(item || '').trim(), 10))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 20)
    .map((item) => String(item))

  return Array.from(new Set(normalized)).sort((a, b) => Number(a) - Number(b))
}

const formatExercisePlayersCount = (value) => {
  const normalized = normalizeExercisePlayersCount(value)
  return normalized.length > 0 ? normalized.join(', ') : ''
}

const normalizeExerciseRating = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 0
}

const normalizeExerciseFavorite = (value) => value === true || String(value || '').trim().toLowerCase() === 'true'

const createDefaultFieldDraft = () => ({
  name: '',
  surfaceType: '',
  dimensions: '',
  partsTotal: ''
})

const SPORT_FIELD_TYPE_FALLBACKS = {
  football: [
    { key: 'natural_grass', label: 'Prírodná tráva' },
    { key: 'artificial_grass', label: 'Umelá tráva' },
    { key: 'multifunctional_field', label: 'Multifunkčné ihrisko' },
    { key: 'indoor_hall', label: 'Hala' }
  ],
  hockey: [
    { key: 'ice_rink', label: 'Ľadová plocha' },
    { key: 'inline_surface', label: 'Inline plocha' },
    { key: 'multifunctional_field', label: 'Multifunkčné ihrisko' },
    { key: 'indoor_hall', label: 'Hala' }
  ],
  basketball: [
    { key: 'indoor_hall', label: 'Hala' },
    { key: 'outdoor_court', label: 'Vonkajšie ihrisko' },
    { key: 'multifunctional_field', label: 'Multifunkčné ihrisko' }
  ],
  handball: [
    { key: 'indoor_hall', label: 'Hala' },
    { key: 'outdoor_court', label: 'Vonkajšie ihrisko' },
    { key: 'multifunctional_field', label: 'Multifunkčné ihrisko' }
  ],
  volleyball: [
    { key: 'indoor_hall', label: 'Hala' },
    { key: 'outdoor_court', label: 'Vonkajšie ihrisko' },
    { key: 'sand_court', label: 'Pieskové ihrisko' }
  ],
  tennis: [
    { key: 'clay_court', label: 'Antuka' },
    { key: 'hard_court', label: 'Tvrdý povrch' },
    { key: 'grass_court', label: 'Tráva' },
    { key: 'indoor_hall', label: 'Hala' }
  ]
}

const normalizeSportKey = (value) => String(value || '').trim().toLowerCase()

const getFallbackFieldTypes = (sport) => SPORT_FIELD_TYPE_FALLBACKS[normalizeSportKey(sport)] || []

const normalizeClubField = (field) => {
  const rawParts = Number(field?.partsTotal)
  return {
    id: String(field?.id || '').trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(field?.name || '').trim(),
    surfaceType: String(field?.surfaceType || '').trim(),
    dimensions: String(field?.dimensions || '').trim(),
    partsTotal: Number.isInteger(rawParts) && rawParts > 0 ? rawParts : null,
    createdAt: field?.createdAt || new Date().toISOString()
  }
}

const getLiteralRawValue = (node) => String(node?.raw ?? node?.value ?? '').trim()

const FORMULA_FUNCTION_OPTIONS = [
  { value: 'SUM', label: 'SUM()' },
  { value: 'AVG', label: 'AVG()' },
  { value: 'MIN', label: 'MIN()' },
  { value: 'MAX', label: 'MAX()' }
]

const CALENDAR_DAYS_METRIC_ID = 'default-calendar-days'

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

const DEFAULT_ATTENDANCE_METRICS = [
  { id: 'default-trainings-count', name: 'Počet tréningov', shortName: '', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-matches-count', name: 'Počet zápasov', shortName: '', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  {
    id: 'default-load-days',
    name: 'Dni záťaže',
    shortName: '',
    type: 'number',
    valueTypes: ['number'],
    mode: 'formula',
    isDefault: true,
    isActive: true,
    formula: [
      { type: 'variable', metricId: 'default-trainings-count' },
      { type: 'operator', op: '+' },
      { type: 'variable', metricId: 'default-matches-count' }
    ]
  },
  { id: 'default-calendar-days', name: 'Kalendárne dni', shortName: 'KD', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-game-load', name: 'Herná záťaž (minúty)', shortName: '', type: 'minutes', valueTypes: ['minutes'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-attendance', name: 'Dochádzka %', shortName: '', type: 'percent', valueTypes: ['percent'], mode: 'manual', isDefault: true, isActive: true, formula: [] }
]

const cloneAttendanceMetric = (metric) => ({
  ...metric,
  valueTypes: Array.isArray(metric?.valueTypes) ? [...metric.valueTypes] : [],
  formula: Array.isArray(metric?.formula) ? metric.formula.map((node) => ({ ...node })) : []
})

const createDefaultAttendanceMetrics = () => DEFAULT_ATTENDANCE_METRICS.map((metric) => cloneAttendanceMetric(metric))

const ensureCalendarDaysMetric = (metricsList) => {
  const source = dedupeCalendarDaysMetric(metricsList)
  const hasCalendarDays = source.some((metric) => isCalendarDaysMetric(metric))
  if (hasCalendarDays) return source
  const calendarDefault = DEFAULT_ATTENDANCE_METRICS.find((metric) => String(metric?.id || '').trim() === CALENDAR_DAYS_METRIC_ID)
  if (!calendarDefault) return source
  return [...source, cloneAttendanceMetric(calendarDefault)]
}

const buildDefaultTopBlockRow = (metricIds, index = 0, name = '') => ({
  id: `top-block-row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  name: String(name || '').trim() || `Karta ${index + 1}`,
  metrics: (Array.isArray(metricIds) ? metricIds : []).reduce((acc, metricId) => {
    acc[metricId] = true
    return acc
  }, {})
})

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
    .map((metric) => String(metric?.id || '').trim())
    .filter(Boolean)

  const fromNewModel = Array.isArray(baseDraft?.topBlockRows)
    || (baseDraft?.tableColumns && typeof baseDraft.tableColumns === 'object')
    || (baseDraft?.evidenceColumns && typeof baseDraft.evidenceColumns === 'object')
  const hasLegacyMetricRows = metricIds.some((metricId) => baseDraft[metricId] && typeof baseDraft[metricId] === 'object')

  const normalizedTableColumns = metricIds.reduce((acc, metricId) => {
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

  const normalizedEvidenceColumns = metricIds.reduce((acc, metricId) => {
    const source = (baseDraft.evidenceColumns && typeof baseDraft.evidenceColumns === 'object') ? baseDraft.evidenceColumns : {}
    acc[metricId] = source[metricId] !== false
    return acc
  }, {})

  let normalizedTopRows = []

  if (fromNewModel) {
    normalizedTopRows = (Array.isArray(baseDraft.topBlockRows) ? baseDraft.topBlockRows : [])
      .map((row, index) => {
        const rowName = String(row?.name || '').trim()
        const rowId = String(row?.id || '').trim() || `top-row-${Date.now()}-${index}`
        const sourceMetrics = (row?.metrics && typeof row.metrics === 'object') ? row.metrics : {}
        const hasExplicitMetricMap = Object.keys(sourceMetrics).length > 0
        const explicitMetricIds = new Set(
          (Array.isArray(row?.metricIds) ? row.metricIds : [row?.metricId])
            .map((metricId) => String(metricId || '').trim())
            .filter(Boolean)
        )
        const metricIdMatchedByName = resolveMetricIdFromRowName(rowName, sourceMetricsList)
        const fallbackMetricId = String(metricIds[index] || metricIds[0] || '').trim()
        const resolvedSingleMetricId = metricIdMatchedByName || fallbackMetricId
        const explicitKnownMetricIds = metricIds.filter((metricId) => Object.prototype.hasOwnProperty.call(sourceMetrics, metricId))
        const explicitTrueCount = explicitKnownMetricIds.filter((metricId) => isEnabledMetricFlag(sourceMetrics[metricId])).length
        const shouldRepairAllTrueRow = hasExplicitMetricMap
          && (Boolean(metricIdMatchedByName) || isGenericTopCardName(rowName))
          && explicitKnownMetricIds.length === metricIds.length
          && explicitTrueCount > 1

        const metricsMap = metricIds.reduce((acc, metricId) => {
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
        return {
          id: rowId,
          name: rowName || `Karta ${index + 1}`,
          metrics: metricsMap
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

    normalizedTopRows = baseMetricIds.map((metricId, index) => {
      const metric = sourceMetricsList.find((item) => String(item?.id || '').trim() === metricId)
      return {
        id: `top-row-${index + 1}`,
        name: String(metric?.name || `Karta ${index + 1}`),
        metrics: buildSingleMetricMap(metricIds, metricId)
      }
    })
  }

  if (normalizedTopRows.length === 0) {
    normalizedTopRows = metricIds.map((metricId, index) => {
      const metric = sourceMetricsList.find((item) => String(item?.id || '').trim() === metricId)
      return {
        id: `top-row-${index + 1}`,
        name: String(metric?.name || `Karta ${index + 1}`),
        metrics: buildSingleMetricMap(metricIds, metricId)
      }
    })
  }

  return {
    topBlockRows: normalizedTopRows,
    tableColumns: normalizedTableColumns,
    evidenceColumns: normalizedEvidenceColumns
  }
}

const normalizeMetricValueTypes = (metric) => {
  const allowed = new Set(METRIC_TYPE_OPTIONS.map((item) => item.value))
  const source = Array.isArray(metric?.valueTypes)
    ? metric.valueTypes
    : (Array.isArray(metric?.types) ? metric.types : [metric?.type])

  const normalized = [...new Set(source.map((item) => String(item || '').trim()).filter((item) => allowed.has(item)))]
  return normalized.length > 0 ? normalized : ['number']
}

const getPrimaryMetricType = (metric) => normalizeMetricValueTypes(metric)[0] || 'number'

const normalizeMetric = (metric) => {
  const valueTypes = normalizeMetricValueTypes(metric)
  const type = valueTypes[0]
  const mode = METRIC_MODE_OPTIONS.some((item) => item.value === metric?.mode) ? metric.mode : 'manual'
  return {
    id: metric?.id || `metric-${Date.now()}`,
    name: String(metric?.name || '').trim(),
    shortName: String(metric?.shortName || '').trim(),
    type,
    valueTypes,
    mode,
    isDefault: Boolean(metric?.isDefault),
    isActive: metric?.isActive !== false,
    formula: Array.isArray(metric?.formula) ? metric.formula : []
  }
}

const getMetricTypeMeta = (type) => METRIC_TYPE_OPTIONS.find((item) => item.value === type) || METRIC_TYPE_OPTIONS[0]

const getMetricIconText = (metric) => {
  const raw = String(metric?.shortName || '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '')
}

const getMetricIconFontClass = (text) => {
  const length = String(text || '').length
  if (length >= 8) return 'metrics-icon-font-xs'
  if (length >= 6) return 'metrics-icon-font-sm'
  if (length >= 4) return 'metrics-icon-font-md'
  return 'metrics-icon-font-lg'
}

const getMetricSampleValue = (metric) => {
  const primaryType = getPrimaryMetricType(metric)
  if (primaryType === 'boolean') return 1
  if (primaryType === 'minutes') return 60
  if (primaryType === 'percent') return 75
  return 10
}

const collectFormulaDependencies = (nodes, accumulator = new Set()) => {
  if (!Array.isArray(nodes)) return accumulator

  nodes.forEach((node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'variable' && node.metricId) {
      accumulator.add(String(node.metricId))
      return
    }

    if (node.type === 'function' && Array.isArray(node.args)) {
      collectFormulaDependencies(node.args, accumulator)
    }
  })

  return accumulator
}

const evaluateFormulaNodes = (nodes, metricsById) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { value: null, errors: ['Vzorec je prázdny.'] }
  }

  const resolveNodeValue = (node) => {
    if (!node || typeof node !== 'object') return { ok: false, error: 'Neplatný prvok vo vzorci.' }

    if (node.type === 'literal') {
      const value = Number(node.value)
      if (!Number.isFinite(value)) return { ok: false, error: 'Vzorec obsahuje neplatnú číselnú hodnotu.' }
      return { ok: true, value }
    }

    if (node.type === 'variable') {
      const metric = metricsById.get(String(node.metricId))
      if (!metric) return { ok: false, error: 'Vzorec obsahuje neexistujúcu premennú.' }
      return { ok: true, value: Number(getMetricSampleValue(metric)) || 0 }
    }

    if (node.type === 'function') {
      const args = Array.isArray(node.args) ? node.args : []
      if (args.length === 0) return { ok: false, error: 'Funkcia musí obsahovať aspoň jeden argument.' }
      const resolvedArgs = []

      for (const arg of args) {
        const resolved = resolveNodeValue(arg)
        if (!resolved.ok) return resolved
        resolvedArgs.push(Number(resolved.value) || 0)
      }

      if (node.fn === 'SUM') return { ok: true, value: resolvedArgs.reduce((sum, value) => sum + value, 0) }
      if (node.fn === 'AVG') return { ok: true, value: resolvedArgs.reduce((sum, value) => sum + value, 0) / resolvedArgs.length }
      if (node.fn === 'MIN') return { ok: true, value: Math.min(...resolvedArgs) }
      if (node.fn === 'MAX') return { ok: true, value: Math.max(...resolvedArgs) }

      return { ok: false, error: 'Neznáma funkcia vo vzorci.' }
    }

    return { ok: false, error: 'Vzorec obsahuje neplatný prvok.' }
  }

  const tokens = []

  for (const node of nodes) {
    if (node?.type === 'operator') {
      tokens.push(String(node.op || ''))
      continue
    }

    const resolved = resolveNodeValue(node)
    if (!resolved.ok) return { value: null, errors: [resolved.error] }
    tokens.push(Number(resolved.value) || 0)
  }

  const numericTokenCount = tokens.filter((token) => typeof token === 'number').length
  if (numericTokenCount === 0) {
    return { value: null, errors: ['Vzorec musí obsahovať aspoň jednu premennú.'] }
  }

  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 }
  const operatorStack = []
  const outputQueue = []

  for (const token of tokens) {
    if (typeof token === 'number') {
      outputQueue.push(token)
      continue
    }

    if (token === '(') {
      operatorStack.push(token)
      continue
    }

    if (token === ')') {
      let foundLeftParen = false
      while (operatorStack.length > 0) {
        const op = operatorStack.pop()
        if (op === '(') {
          foundLeftParen = true
          break
        }
        outputQueue.push(op)
      }

      if (!foundLeftParen) {
        return { value: null, errors: ['Vzorec obsahuje nevyvážené zátvorky.'] }
      }
      continue
    }

    if (!Object.prototype.hasOwnProperty.call(precedence, token)) {
      return { value: null, errors: ['Vzorec obsahuje nepodporovaný operátor.'] }
    }

    while (operatorStack.length > 0) {
      const top = operatorStack[operatorStack.length - 1]
      if (!Object.prototype.hasOwnProperty.call(precedence, top)) break
      if (precedence[top] >= precedence[token]) {
        outputQueue.push(operatorStack.pop())
      } else {
        break
      }
    }

    operatorStack.push(token)
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop()
    if (op === '(' || op === ')') {
      return { value: null, errors: ['Vzorec obsahuje nevyvážené zátvorky.'] }
    }
    outputQueue.push(op)
  }

  const valueStack = []
  for (const token of outputQueue) {
    if (typeof token === 'number') {
      valueStack.push(token)
      continue
    }

    if (valueStack.length < 2) {
      return { value: null, errors: ['Vzorec má neplatné poradie operátorov a premenných.'] }
    }

    const rightValue = valueStack.pop()
    const leftValue = valueStack.pop()
    let resultValue = null

    if (token === '+') resultValue = leftValue + rightValue
    else if (token === '-') resultValue = leftValue - rightValue
    else if (token === '*') resultValue = leftValue * rightValue
    else if (token === '/') {
      if (rightValue === 0) return { value: null, errors: ['Delenie nulou nie je povolené.'] }
      resultValue = leftValue / rightValue
    } else {
      return { value: null, errors: ['Vzorec obsahuje nepodporovaný operátor.'] }
    }

    valueStack.push(resultValue)
  }

  if (valueStack.length !== 1) {
    return { value: null, errors: ['Vzorec má neplatné poradie operátorov a premenných.'] }
  }

  const result = valueStack[0]

  return { value: Number.isFinite(result) ? result : null, errors: Number.isFinite(result) ? [] : ['Výsledok vzorca je neplatný.'] }
}

const normalizeVisibleSections = (input, fallback = []) => {
  const allowed = new Set(VISIBLE_SECTION_OPTIONS.map((option) => option.key))
  if (!Array.isArray(input)) return fallback
  return [...new Set(input.map((item) => String(item || '').trim()).filter((item) => allowed.has(item)))]
}

const getDefaultVisibleSectionsConfig = () => ({
  club: [...DEFAULT_VISIBLE_SECTIONS_BY_ROLE.club],
  coach: [...DEFAULT_VISIBLE_SECTIONS_BY_ROLE.coach],
  parent: [...DEFAULT_VISIBLE_SECTIONS_BY_ROLE.parent],
  player: [...DEFAULT_VISIBLE_SECTIONS_BY_ROLE.player]
})

const formatPermissionLabel = (permission) => {
  if (!permission) return ''
  if (PERMISSION_LABELS[permission]) return PERMISSION_LABELS[permission]

  const normalizedPermission = permission.replace(/([a-z])([A-Z])/g, '$1.$2')

  const parts = normalizedPermission
    .toLowerCase()
    .split(/[._:]/)
    .filter(Boolean)

  if (parts.length === 0) return permission

  const lastPart = parts[parts.length - 1]
  const actionLabel = PERMISSION_ACTION_LABELS[lastPart]
  const resourceParts = actionLabel ? parts.slice(0, -1) : parts
  const resourceLabel = resourceParts
    .map((part) => PERMISSION_TOKEN_LABELS[part] || part)
    .join(' ')
    .trim()

  if (actionLabel && resourceLabel) {
    return `${actionLabel} ${resourceLabel}`
  }

  if (actionLabel) {
    return actionLabel
  }

  return resourceLabel
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function MyClub() {
  const location = useLocation()
  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const normalizedCurrentRole = String(currentUser?.role || '').trim().toLowerCase() === 'club_admin'
    ? 'club'
    : String(currentUser?.role || '').trim().toLowerCase()

  const currentUserPermissionSet = useMemo(() => {
    const merged = [
      ...(Array.isArray(currentUser?.permissions) ? currentUser.permissions : []),
      ...(Array.isArray(currentUser?.delegatedPermissions) ? currentUser.delegatedPermissions : []),
      ...(Array.isArray(currentUser?.effectivePermissions) ? currentUser.effectivePermissions : [])
    ]
      .map((permission) => String(permission || '').trim())
      .filter(Boolean)

    return new Set(merged)
  }, [currentUser])

  const canManageFieldsSection = normalizedCurrentRole === 'club' || currentUserPermissionSet.has('fields.manage')

  const [club, setClub] = useState({
    name: '',
    sport: '',
    logo: '',
    logoFile: null,
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    bankName: '',
    swiftCode: '',
    accountHolderName: '',
    iban: '',
    address: '',
    city: '',
    country: 'SK',
    email: '',
    phone: '',
    website: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(true)
  const [clubExists, setClubExists] = useState(false)
  const [clubId, setClubId] = useState(null)
  const [clubSport, setClubSport] = useState('')
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [members, setMembers] = useState({ trainers: [], players: [], totals: { trainers: 0, players: 0 } })
  const [categories, setCategories] = useState([])
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [categoryDraft, setCategoryDraft] = useState({
    name: '',
    trainerName: '',
    extraStaffNames: []
  })
  const [permissionCatalog, setPermissionCatalog] = useState({})
  const [managerRoles, setManagerRoles] = useState([])
  const [managers, setManagers] = useState([])
  const [roleDraft, setRoleDraft] = useState({ roleTitle: '', permissions: [] })
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [editingManagerId, setEditingManagerId] = useState(null)
  const [editingTrainerId, setEditingTrainerId] = useState(null)
  const [editingTrainerFunctionId, setEditingTrainerFunctionId] = useState(null)
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [showManagerForm, setShowManagerForm] = useState(false)
  const [showTrainerForm, setShowTrainerForm] = useState(false)
  const [showPlayerForm, setShowPlayerForm] = useState(false)
  const [showManagerRoleForm, setShowManagerRoleForm] = useState(false)
  const [showTrainerFunctionForm, setShowTrainerFunctionForm] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, payload: null })
  const [activeSettingsSection, setActiveSettingsSection] = useState('managerRoles')
  const [attendanceSettingsTab, setAttendanceSettingsTab] = useState('indicators')
  const [trainingsSettingsTab, setTrainingsSettingsTab] = useState('divisions')
  const [showSeasonForm, setShowSeasonForm] = useState(false)
  const [seasonDraft, setSeasonDraft] = useState({ name: '', from: '', to: '' })
  const [attendanceSeasons, setAttendanceSeasons] = useState([])
  const [clubFields, setClubFields] = useState([])
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState(null)
  const [fieldDraft, setFieldDraft] = useState(() => createDefaultFieldDraft())
  const [editingSeasonId, setEditingSeasonId] = useState(null)
  const [showTrainingDivisionForm, setShowTrainingDivisionForm] = useState(false)
  const [trainingDivisionDraft, setTrainingDivisionDraft] = useState({ name: '', groups: [''] })
  const [trainingDivisions, setTrainingDivisions] = useState([])
  const [editingTrainingDivisionId, setEditingTrainingDivisionId] = useState(null)
  const [trainingExerciseDisplaySettings, setTrainingExerciseDisplaySettings] = useState({
    divisions: {},
    defaultDivisionId: ''
  })
  const [trainingExerciseDisplayLoaded, setTrainingExerciseDisplayLoaded] = useState(false)
  const [trainingExerciseDisplaySaving, setTrainingExerciseDisplaySaving] = useState(false)
  const [showExerciseCategoryForm, setShowExerciseCategoryForm] = useState(false)
  const [exerciseCategoryDraft, setExerciseCategoryDraft] = useState({ name: '', subcategories: [''], assignedDivisionGroups: {} })
  const [exerciseCategories, setExerciseCategories] = useState([])
  const [editingExerciseCategoryId, setEditingExerciseCategoryId] = useState(null)
  const [draggedExerciseCategoryId, setDraggedExerciseCategoryId] = useState(null)
  const [exerciseCategoryDropTargetId, setExerciseCategoryDropTargetId] = useState(null)
  const [draggedExerciseSubcategoryIndex, setDraggedExerciseSubcategoryIndex] = useState(null)
  const [exerciseSubcategoryDropTargetIndex, setExerciseSubcategoryDropTargetIndex] = useState(null)
  const [attendanceDisplayDraft, setAttendanceDisplayDraft] = useState({ topBlockRows: [], tableColumns: {}, evidenceColumns: {} })
  const [attendanceDisplayLoaded, setAttendanceDisplayLoaded] = useState(false)
  const [attendanceDisplaySaving, setAttendanceDisplaySaving] = useState(false)
  const [activeMembersSection, setActiveMembersSection] = useState('categories')
  const [activeBasicSection, setActiveBasicSection] = useState('basicInfo')
  const [activeExerciseDatabaseSection, setActiveExerciseDatabaseSection] = useState('exerciseList')
  const [exerciseListViewMode, setExerciseListViewMode] = useState('cards')
  const [exerciseListFilters, setExerciseListFilters] = useState({
    intensity: 'all',
    playersCount: 'all',
    categoryId: 'all',
    subcategory: 'all'
  })
  const [exerciseDatabaseItems, setExerciseDatabaseItems] = useState([])
  const [openedExerciseDetailItem, setOpenedExerciseDetailItem] = useState(null)
  const [isExerciseDetailVideoPlaying, setIsExerciseDetailVideoPlaying] = useState(false)
  const [editingExerciseDatabaseItemId, setEditingExerciseDatabaseItemId] = useState(null)
  const [exerciseFormDraft, setExerciseFormDraft] = useState({
    name: '',
    description: '',
    intensity: 'Stredná',
    playersCount: [],
    youtubeUrl: '',
    imageUrl: '',
    imageName: '',
    selectedCategoryIds: [],
    categorySelections: {},
    divisionGroups: {},
    isActive: true,
    isPublic: true
  })
  const [visibleSectionsDraft, setVisibleSectionsDraft] = useState(() => getDefaultVisibleSectionsConfig())
  const [trainerFunctions, setTrainerFunctions] = useState([])
  const [trainerFunctionDraft, setTrainerFunctionDraft] = useState({ name: '' })
  const [managerDraft, setManagerDraft] = useState({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', photo: '', photoFile: null })
  const [trainerDraft, setTrainerDraft] = useState({ firstName: '', lastName: '', mobile: '', email: '', functionRole: 'coach', trainerFunctionId: '', photo: '', photoFile: null, categoryIds: [] })
  const [playerDraft, setPlayerDraft] = useState({ firstName: '', lastName: '', personalId: '', mobile: '', email: '', photo: '', photoFile: null, categoryIds: [] })
  const [playerLastNameFilter, setPlayerLastNameFilter] = useState('')
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState('all')
  const [playerSuggestionsOpen, setPlayerSuggestionsOpen] = useState(false)
  const [playerSuggestionsStyle, setPlayerSuggestionsStyle] = useState({ top: 0, left: 0, width: 0 })
  const [draggedCategoryId, setDraggedCategoryId] = useState(null)
  const [draggedMetricId, setDraggedMetricId] = useState(null)
  const [metrics, setMetrics] = useState([])
  const [metricsLoaded, setMetricsLoaded] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [showMetricEditor, setShowMetricEditor] = useState(false)
  const [editingMetricId, setEditingMetricId] = useState(null)
  const [metricDraft, setMetricDraft] = useState({ name: '', shortName: '', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: false, isActive: true })
  const [formulaDraft, setFormulaDraft] = useState([])
  const [formulaFunctionDraft, setFormulaFunctionDraft] = useState({ fn: 'SUM', metricId: '', metricIds: [] })
  const [formulaPreviewValue, setFormulaPreviewValue] = useState(null)
  const [formulaWarnings, setFormulaWarnings] = useState([])
  const [validationErrors, setValidationErrors] = useState([])
  const [formulaValidating, setFormulaValidating] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const managerPhotoInputRef = useRef(null)
  const trainerPhotoInputRef = useRef(null)
  const playerPhotoInputRef = useRef(null)
  const clubLogoInputRef = useRef(null)
  const playerLastNameInputRef = useRef(null)
  const playerLastNameSuggestionsRef = useRef(null)
  const categoryFormRef = useRef(null)
  const trainerFormRef = useRef(null)
  const playerFormRef = useRef(null)
  const managerFormRef = useRef(null)
  const managerRoleFormRef = useRef(null)
  const trainerFunctionFormRef = useRef(null)
  const metricEditorFormRef = useRef(null)
  const exerciseCategoryFormRef = useRef(null)
  const exerciseImageInputRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const requestedTab = String(params.get('tab') || '').trim()
    const requestedSection = String(params.get('section') || '').trim()

    if (requestedTab !== 'exerciseDatabase') return

    setActiveTab('exerciseDatabase')

    if (requestedSection === 'exerciseList' || requestedSection === 'createExercise' || requestedSection === 'exerciseCategories') {
      setActiveExerciseDatabaseSection(requestedSection)
      if (requestedSection === 'createExercise') {
        setEditingExerciseDatabaseItemId(null)
      }
    }
  }, [location.search])

  useEffect(() => {
    fetchMyClub()
  }, [])

  useEffect(() => {
    if (!success) return undefined

    const timeoutId = setTimeout(() => {
      setSuccess('')
    }, 2500)

    return () => clearTimeout(timeoutId)
  }, [success])

  useEffect(() => {
    const storageKey = `trainingDivisionNames:${clubId || 'global'}`
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      const normalized = Array.isArray(parsed)
        ? parsed
            .map((item) => {
              const groups = Array.isArray(item?.groups)
                ? item.groups.map((groupName) => String(groupName || '').trim()).filter(Boolean)
                : []
              return {
                id: String(item?.id || ''),
                name: String(item?.name || '').trim(),
                groups
              }
            })
            .filter((item) => item.id && item.name)
        : []
      setTrainingDivisions(normalized)
    } catch {
      setTrainingDivisions([])
    }
  }, [clubId])

  useEffect(() => {
    const storageKey = `trainingDivisionNames:${clubId || 'global'}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(trainingDivisions))
    } catch {
      // Ignore write failures and keep in-memory state.
    }
  }, [clubId, trainingDivisions])

  useEffect(() => {
    const storageKey = `trainingExerciseDisplaySettings:${clubId || 'global'}`
    setTrainingExerciseDisplayLoaded(false)

    const resolveLocalSettings = () => {
      try {
        const raw = localStorage.getItem(storageKey)
        const parsed = raw ? JSON.parse(raw) : {}

        const rawDivisions = parsed?.divisions && typeof parsed.divisions === 'object'
          ? parsed.divisions
          : {}

        // Backward compatibility for older storage model.
        if (Object.keys(rawDivisions).length === 0 && (parsed?.showGroupSection !== undefined || parsed?.divisionId)) {
          const legacyDivisionId = String(parsed?.divisionId || '')
          const legacyShow = parsed?.showGroupSection !== false
          return {
            divisions: legacyDivisionId ? { [legacyDivisionId]: { visible: legacyShow } } : {},
            defaultDivisionId: legacyDivisionId
          }
        }

        return {
          divisions: rawDivisions,
          defaultDivisionId: String(parsed?.defaultDivisionId || '')
        }
      } catch {
        return {
          divisions: {},
          defaultDivisionId: ''
        }
      }
    }

    const loadTrainingDisplaySettings = async () => {
      try {
        const response = await api.getTrainingExerciseDisplaySettings()
        const parsed = response?.settings && typeof response.settings === 'object' ? response.settings : {}
        const normalizedRemote = {
          divisions: parsed?.divisions && typeof parsed.divisions === 'object' ? parsed.divisions : {},
          defaultDivisionId: String(parsed?.defaultDivisionId || '')
        }
        const localSettings = resolveLocalSettings()
        const hasRemoteValue = Object.keys(normalizedRemote.divisions).length > 0 || Boolean(String(normalizedRemote.defaultDivisionId || '').trim())
        const normalized = hasRemoteValue ? normalizedRemote : localSettings

        setTrainingExerciseDisplaySettings(normalized)

        try {
          localStorage.setItem(storageKey, JSON.stringify(normalized))
        } catch {
          // no-op
        }
      } catch {
        setTrainingExerciseDisplaySettings(resolveLocalSettings())
      } finally {
        setTrainingExerciseDisplayLoaded(true)
      }
    }

    loadTrainingDisplaySettings()
  }, [clubId])

  useEffect(() => {
    if (!trainingExerciseDisplayLoaded) return

    const storageKey = `trainingExerciseDisplaySettings:${clubId || 'global'}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(trainingExerciseDisplaySettings))
    } catch {
      // Ignore write failures and keep in-memory state.
    }
  }, [clubId, trainingExerciseDisplayLoaded, trainingExerciseDisplaySettings])

  useEffect(() => {
    if (!Array.isArray(trainingDivisions) || trainingDivisions.length === 0) {
      setTrainingExerciseDisplaySettings((prev) => ({
        ...prev,
        divisions: {},
        defaultDivisionId: ''
      }))
      return
    }

    setTrainingExerciseDisplaySettings((prev) => ({
      ...prev,
      divisions: trainingDivisions.reduce((acc, division) => {
        const divisionId = String(division?.id || '')
        if (!divisionId) return acc
        const existing = prev?.divisions && typeof prev.divisions === 'object' ? prev.divisions[divisionId] : null
        acc[divisionId] = {
          visible: existing?.visible !== false
        }
        return acc
      }, {}),
      defaultDivisionId: trainingDivisions.some((item) => String(item?.id || '') === String(prev?.defaultDivisionId || ''))
        ? String(prev.defaultDivisionId)
        : String(trainingDivisions[0]?.id || '')
    }))
  }, [trainingDivisions])

  useEffect(() => {
    const storageKey = `exerciseCategories:${clubId || 'global'}`
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      const normalized = Array.isArray(parsed)
        ? parsed
            .map((item) => {
              const subcategories = Array.isArray(item?.subcategories)
                ? item.subcategories.map((name) => String(name || '').trim()).filter(Boolean)
                : []
              const assignedDivisionGroups = item?.assignedDivisionGroups && typeof item.assignedDivisionGroups === 'object'
                ? Object.entries(item.assignedDivisionGroups).reduce((acc, [divisionId, groups]) => {
                    const resolvedDivisionId = String(divisionId || '').trim()
                    if (!resolvedDivisionId) return acc
                    const normalizedGroups = Array.isArray(groups)
                      ? groups.map((name) => String(name || '').trim()).filter(Boolean)
                      : []
                    if (normalizedGroups.length > 0) {
                      acc[resolvedDivisionId] = Array.from(new Set(normalizedGroups))
                    }
                    return acc
                  }, {})
                : {}
              return {
                id: String(item?.id || ''),
                name: String(item?.name || '').trim(),
                subcategories,
                assignedDivisionGroups
              }
            })
            .filter((item) => item.id && item.name)
        : []
      setExerciseCategories(normalized)
    } catch {
      setExerciseCategories([])
    }
  }, [clubId])

  useEffect(() => {
    const storageKey = `exerciseCategories:${clubId || 'global'}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(exerciseCategories))
    } catch {
      // Ignore write failures and keep in-memory state.
    }
  }, [clubId, exerciseCategories])

  useEffect(() => {
    const storageKey = `exerciseDatabaseItems:${clubId || 'global'}`
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      const normalized = Array.isArray(parsed)
        ? parsed.map((item) => {
            const youtube = item?.youtube && typeof item.youtube === 'object' ? item.youtube : {}
            return {
              id: String(item?.id || ''),
              name: String(item?.name || '').trim(),
              description: String(item?.description || '').trim(),
              durationMinutes: Number.parseInt(String(item?.durationMinutes || 0), 10) || 0,
              intensity: String(item?.intensity || 'Stredná'),
              playersCount: normalizeExercisePlayersCount(item?.playersCount),
              imageUrl: String(item?.imageUrl || '').trim(),
              imageName: String(item?.imageName || '').trim(),
              selectedCategoryIds: Array.isArray(item?.selectedCategoryIds)
                ? item.selectedCategoryIds.map((categoryId) => String(categoryId || '').trim()).filter(Boolean)
                : [],
              categorySelections: item?.categorySelections && typeof item.categorySelections === 'object' ? item.categorySelections : {},
              divisionGroups: item?.divisionGroups && typeof item.divisionGroups === 'object' ? item.divisionGroups : {},
              isActive: item?.isActive !== false,
              isPublic: item?.isPublic !== false,
              rating: normalizeExerciseRating(item?.rating),
              isFavorite: normalizeExerciseFavorite(item?.isFavorite),
              youtube: {
                url: String(youtube?.url || '').trim(),
                videoId: String(youtube?.videoId || '').trim()
              },
              createdAt: String(item?.createdAt || ''),
              updatedAt: String(item?.updatedAt || '')
            }
          }).filter((item) => item.id && item.name)
        : []

      setExerciseDatabaseItems(normalized)
    } catch {
      setExerciseDatabaseItems([])
    }
  }, [clubId])

  useEffect(() => {
    const storageKey = `exerciseDatabaseItems:${clubId || 'global'}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(exerciseDatabaseItems))
    } catch {
      // Ignore write failures and keep in-memory state.
    }
  }, [clubId, exerciseDatabaseItems])

  useEffect(() => {
    if (!playerSuggestionsOpen) return undefined

    const updatePosition = () => {
      const input = playerLastNameInputRef.current
      if (!input) return
      const rect = input.getBoundingClientRect()
      setPlayerSuggestionsStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      })
    }

    const handlePointerDown = (event) => {
      const target = event.target
      if (playerLastNameInputRef.current?.contains(target) || playerLastNameSuggestionsRef.current?.contains(target)) {
        return
      }
      setPlayerSuggestionsOpen(false)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [playerSuggestionsOpen, playerLastNameFilter])

  useEffect(() => {
    if (!showCategoryForm) return

    requestAnimationFrame(() => {
      categoryFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showCategoryForm, editingCategoryId])

  useEffect(() => {
    if (!showTrainerForm || activeMembersSection !== 'coaches') return

    requestAnimationFrame(() => {
      trainerFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showTrainerForm, editingTrainerId, activeMembersSection])

  useEffect(() => {
    if (!showPlayerForm || activeMembersSection !== 'players') return

    requestAnimationFrame(() => {
      playerFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showPlayerForm, editingPlayerId, activeMembersSection])

  useEffect(() => {
    if (!showManagerForm || activeTab !== 'members' || activeMembersSection !== 'managers') return

    requestAnimationFrame(() => {
      managerFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showManagerForm, editingManagerId, activeTab, activeMembersSection])

  useEffect(() => {
    if (!showManagerRoleForm || activeTab !== 'settings' || activeSettingsSection !== 'managerRoles') return

    requestAnimationFrame(() => {
      managerRoleFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showManagerRoleForm, editingRoleId, activeTab, activeSettingsSection])

  useEffect(() => {
    if (!showTrainerFunctionForm || activeTab !== 'settings' || activeSettingsSection !== 'trainerFunctions') return

    requestAnimationFrame(() => {
      trainerFunctionFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showTrainerFunctionForm, editingTrainerFunctionId, activeTab, activeSettingsSection])

  useEffect(() => {
    if (!showMetricEditor || activeTab !== 'settings' || activeSettingsSection !== 'attendance') return

    requestAnimationFrame(() => {
      metricEditorFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showMetricEditor, editingMetricId, activeTab, activeSettingsSection])

  useEffect(() => {
    if (!showExerciseCategoryForm || activeTab !== 'exerciseDatabase' || activeExerciseDatabaseSection !== 'exerciseCategories') return

    requestAnimationFrame(() => {
      exerciseCategoryFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }, [showExerciseCategoryForm, editingExerciseCategoryId, activeTab, activeExerciseDatabaseSection])

  useEffect(() => {
    if (activeTab !== 'members' && showCategoryForm) {
      setShowCategoryForm(false)
      setEditingCategoryId(null)
      setCategoryDraft({ name: '', trainerName: '', extraStaffNames: [] })
    }

    if (activeTab !== 'members' && showTrainerForm) {
      setShowTrainerForm(false)
      setEditingTrainerId(null)
      setTrainerDraft({ firstName: '', lastName: '', mobile: '', email: '', functionRole: 'coach', trainerFunctionId: '', photo: '', photoFile: null, categoryIds: [] })
    }

    if (activeTab !== 'members' && showPlayerForm) {
      setShowPlayerForm(false)
      setEditingPlayerId(null)
      setPlayerDraft({ firstName: '', lastName: '', personalId: '', mobile: '', email: '', photo: '', photoFile: null, categoryIds: [] })
    }

    if (activeTab !== 'members' && showManagerForm) {
      setShowManagerForm(false)
      setEditingManagerId(null)
      setManagerDraft({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', photo: '', photoFile: null })
    }
  }, [activeTab, showCategoryForm, showTrainerForm, showPlayerForm, showManagerForm])

  useEffect(() => {
    if (activeMembersSection !== 'categories' && showCategoryForm) {
      setShowCategoryForm(false)
      setEditingCategoryId(null)
      setCategoryDraft({ name: '', trainerName: '', extraStaffNames: [] })
    }

    if (activeMembersSection !== 'coaches' && showTrainerForm) {
      setShowTrainerForm(false)
      setEditingTrainerId(null)
      setTrainerDraft({ firstName: '', lastName: '', mobile: '', email: '', functionRole: 'coach', trainerFunctionId: '', photo: '', photoFile: null, categoryIds: [] })
    }

    if (activeMembersSection !== 'players' && showPlayerForm) {
      setShowPlayerForm(false)
      setEditingPlayerId(null)
      setPlayerDraft({ firstName: '', lastName: '', personalId: '', mobile: '', email: '', photo: '', photoFile: null, categoryIds: [] })
    }

    if (activeMembersSection !== 'managers' && showManagerForm) {
      setShowManagerForm(false)
      setEditingManagerId(null)
      setManagerDraft({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', photo: '', photoFile: null })
    }
  }, [activeMembersSection, showCategoryForm, showTrainerForm, showPlayerForm, showManagerForm])

  useEffect(() => {
    if (activeTab !== 'settings' && showManagerRoleForm) {
      setShowManagerRoleForm(false)
      setRoleDraft({ roleTitle: '', permissions: [] })
      setEditingRoleId(null)
    }

    if (activeTab !== 'settings' && showTrainerFunctionForm) {
      setShowTrainerFunctionForm(false)
      setTrainerFunctionDraft({ name: '' })
      setEditingTrainerFunctionId(null)
    }

    if (activeTab !== 'settings' && showMetricEditor) {
      setShowMetricEditor(false)
      resetMetricEditor()
    }

    if (activeTab !== 'settings' && showFieldForm) {
      setShowFieldForm(false)
      setEditingFieldId(null)
      setFieldDraft(createDefaultFieldDraft())
    }
  }, [activeTab, showManagerRoleForm, showTrainerFunctionForm, showMetricEditor, showFieldForm])

  useEffect(() => {
    if (activeSettingsSection !== 'managerRoles' && showManagerRoleForm) {
      setShowManagerRoleForm(false)
      setRoleDraft({ roleTitle: '', permissions: [] })
      setEditingRoleId(null)
    }

    if (activeSettingsSection !== 'trainerFunctions' && showTrainerFunctionForm) {
      setShowTrainerFunctionForm(false)
      setTrainerFunctionDraft({ name: '' })
      setEditingTrainerFunctionId(null)
    }

    if (activeSettingsSection !== 'attendance' && showMetricEditor) {
      setShowMetricEditor(false)
      resetMetricEditor()
    }

    if (activeSettingsSection !== 'attendance' && showSeasonForm) {
      setShowSeasonForm(false)
      setSeasonDraft({ name: '', from: '', to: '' })
      setEditingSeasonId(null)
    }

    if (activeSettingsSection !== 'fields' && showFieldForm) {
      setShowFieldForm(false)
      setEditingFieldId(null)
      setFieldDraft(createDefaultFieldDraft())
    }

    if (activeSettingsSection !== 'trainings' && showTrainingDivisionForm) {
      setShowTrainingDivisionForm(false)
      setTrainingDivisionDraft({ name: '', groups: [''] })
      setEditingTrainingDivisionId(null)
    }

    if (!(activeTab === 'exerciseDatabase' && activeExerciseDatabaseSection === 'exerciseCategories') && showExerciseCategoryForm) {
      setShowExerciseCategoryForm(false)
      setExerciseCategoryDraft({ name: '', subcategories: [''], assignedDivisionGroups: {} })
      setEditingExerciseCategoryId(null)
    }
  }, [activeTab, activeSettingsSection, activeExerciseDatabaseSection, showManagerRoleForm, showTrainerFunctionForm, showMetricEditor, showSeasonForm, showFieldForm, showTrainingDivisionForm, showExerciseCategoryForm])

  useEffect(() => {
    if (!clubId) return
    api.getAttendanceSeasons()
      .then((res) => setAttendanceSeasons(Array.isArray(res?.seasons) ? res.seasons : []))
      .catch(() => setAttendanceSeasons([]))
  }, [clubId])

  useEffect(() => {
    if (!clubId) return
    api.getClubFields()
      .then((res) => setClubFields(Array.isArray(res?.fields) ? res.fields.map(normalizeClubField) : []))
      .catch(() => setClubFields([]))
  }, [clubId])

  useEffect(() => {
    if (!clubId || !metricsLoaded) return

    const loadAttendanceDisplaySettings = async () => {
      try {
        const response = await api.getAttendanceDisplaySettings()
        const remoteDraft = response?.settings && typeof response.settings === 'object' ? response.settings : {}
        const hasRemoteValue = Object.keys(remoteDraft).length > 0

        let localDraft = {}
        try {
          const storedValue = localStorage.getItem(`attendanceDisplaySettings:${clubId}`)
          localDraft = storedValue ? JSON.parse(storedValue) : {}
        } catch {
          localDraft = {}
        }

        const normalized = normalizeAttendanceDisplayDraft(metrics, hasRemoteValue ? remoteDraft : localDraft)
        setAttendanceDisplayDraft(normalized)

        try {
          localStorage.setItem(`attendanceDisplaySettings:${clubId}`, JSON.stringify(normalized))
        } catch {
          // no-op
        }
      } catch {
        try {
          const storedValue = localStorage.getItem(`attendanceDisplaySettings:${clubId}`)
          const parsedDraft = storedValue ? JSON.parse(storedValue) : {}
          setAttendanceDisplayDraft(normalizeAttendanceDisplayDraft(metrics, parsedDraft))
        } catch {
          setAttendanceDisplayDraft(normalizeAttendanceDisplayDraft(metrics, {}))
        }
      } finally {
        setAttendanceDisplayLoaded(true)
      }
    }

    loadAttendanceDisplaySettings()
  }, [clubId, metricsLoaded, metrics])

  useEffect(() => {
    if (!clubId || !attendanceDisplayLoaded) return

    try {
      localStorage.setItem(`attendanceDisplaySettings:${clubId}`, JSON.stringify(attendanceDisplayDraft))
    } catch {
      // no-op
    }
  }, [clubId, attendanceDisplayLoaded, attendanceDisplayDraft])

  useEffect(() => {
    if (!clubExists || activeTab !== 'settings' || activeSettingsSection !== 'attendance' || metricsLoaded) return
    fetchAttendanceMetrics()
  }, [clubExists, activeTab, activeSettingsSection, metricsLoaded])

  useEffect(() => {
    if (!showMetricEditor || metricDraft.mode !== 'formula') {
      setFormulaPreviewValue(null)
      setFormulaWarnings([])
      return
    }

    const localValidation = validateMetricDraft(metricDraft, formulaDraft)
    setFormulaPreviewValue(localValidation.previewValue)
    setFormulaWarnings(localValidation.nextWarnings)
  }, [showMetricEditor, metricDraft, formulaDraft, editingMetricId, metrics])

  useEffect(() => {
    if (activeSettingsSection === 'attendance') {
      setAttendanceSettingsTab('periods')
    }
    if (activeSettingsSection === 'trainings') {
      setTrainingsSettingsTab('divisions')
    }
  }, [activeSettingsSection])

  const fetchMyClub = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getMyClub()
      const resolvedSport = normalizeSportKey(data?.sport)
      setClub({
        name: data.name || '',
        sport: resolvedSport,
        logo: data.logo || '',
        logoFile: null,
        ownerFirstName: data.ownerFirstName || '',
        ownerLastName: data.ownerLastName || '',
        ownerEmail: data.ownerEmail || '',
        bankName: data.bankName || '',
        swiftCode: data.swiftCode || '',
        accountHolderName: data.accountHolderName || '',
        iban: data.iban || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || 'SK',
        email: data.email || '',
        phone: data.phone || '',
        website: data.website || ''
      })
      setClubSport(resolvedSport)
      setClubId(data.id || null)

      try {
        const fieldTypesResponse = await api.getMyClubFieldTypes()
        const normalizedApiTypes = Array.isArray(fieldTypesResponse?.types)
          ? fieldTypesResponse.types
            .map((item) => ({
              key: String(item?.key || '').trim(),
              label: String(item?.label || '').trim()
            }))
            .filter((item) => item.key && item.label)
          : []

        if (normalizedApiTypes.length > 0) {
          setFieldTypeOptions(normalizedApiTypes)
          if (!resolvedSport && fieldTypesResponse?.sport) {
            setClubSport(normalizeSportKey(fieldTypesResponse.sport))
          }
        } else {
          setFieldTypeOptions(getFallbackFieldTypes(resolvedSport || 'football'))
        }
      } catch {
        setFieldTypeOptions(getFallbackFieldTypes(resolvedSport || 'football'))
      }

      setEditing(true)
      setClubExists(true)
      await Promise.all([
        fetchMyClubMembers(),
        fetchClubCategories(),
        fetchManagersSetup(data.id)
      ])
    } catch (err) {
      console.log('Klub zatiaľ neexistuje, zobrazujem prázdny formulár')
      // Ak klub neexistuje, nechať prázdny formulár
      setClubExists(false)
      setClubSport('')
      setFieldTypeOptions([])
      setEditing(true)
      if (Number(err?.status || 0) === 401) {
        setError('Relácia vypršala. Prosím, odhláste sa a prihláste znova.')
      } else {
        setError('')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchManagersSetup = async (resolvedClubId) => {
    if (!resolvedClubId) return

    const [catalogResult, rolesResult, managersResult, visibleSectionsResult, trainerFunctionsResult] = await Promise.allSettled([
      api.getPermissionCatalog(),
      api.getClubManagerRoles(resolvedClubId),
      api.getClubManagers(resolvedClubId),
      api.getClubVisibleSections(resolvedClubId),
      api.getClubTrainerFunctions(resolvedClubId)
    ])

    if (catalogResult.status === 'fulfilled') {
      setPermissionCatalog(catalogResult.value?.catalog || {})
    } else {
      setPermissionCatalog({})
    }

    if (rolesResult.status === 'fulfilled') {
      setManagerRoles(rolesResult.value?.roles || [])
    } else {
      setManagerRoles([])
    }

    if (managersResult.status === 'fulfilled') {
      setManagers(managersResult.value?.managers || [])
    } else {
      setManagers([])
    }

    if (visibleSectionsResult.status === 'fulfilled') {
      const payload = visibleSectionsResult.value?.roles || {}
      setVisibleSectionsDraft({
        club: normalizeVisibleSections(payload.club, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.club),
        coach: normalizeVisibleSections(payload.coach, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.coach),
        parent: normalizeVisibleSections(payload.parent, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.parent),
        player: normalizeVisibleSections(payload.player, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.player)
      })
    } else {
      setVisibleSectionsDraft(getDefaultVisibleSectionsConfig())
    }

    if (trainerFunctionsResult.status === 'fulfilled') {
      setTrainerFunctions(Array.isArray(trainerFunctionsResult.value?.functions) ? trainerFunctionsResult.value.functions : [])
    } else {
      setTrainerFunctions([])
    }
  }

  const fetchMyClubMembers = async () => {
    try {
      const data = await api.getMyClubMembers()
      setMembers({
        trainers: Array.isArray(data?.trainers) ? data.trainers : [],
        players: Array.isArray(data?.players) ? data.players : [],
        totals: data?.totals || { trainers: 0, players: 0 }
      })
    } catch (err) {
      setMembers({ trainers: [], players: [], totals: { trainers: 0, players: 0 } })
    }
  }

  const fetchClubCategories = async () => {
    try {
      const data = await api.getTeams()
      setCategories(Array.isArray(data?.teams) ? data.teams : [])
    } catch {
      setCategories([])
    }
  }

  const buildMetricDraftFromMetric = (metric) => ({
    name: String(metric?.name || '').trim(),
    shortName: String(metric?.shortName || '').trim(),
    type: getPrimaryMetricType(metric),
    valueTypes: normalizeMetricValueTypes(metric),
    mode: metric?.mode || 'manual',
    isDefault: Boolean(metric?.isDefault),
    isActive: metric?.isActive !== false
  })

  const resetMetricEditor = () => {
    setEditingMetricId(null)
    setMetricDraft({ name: '', shortName: '', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: false, isActive: true })
    setFormulaDraft([])
    setFormulaFunctionDraft({ fn: 'SUM', metricId: '', metricIds: [] })
    setValidationErrors([])
    setFormulaWarnings([])
    setFormulaPreviewValue(null)
  }

  const fetchAttendanceMetrics = async () => {
    try {
      setMetricsLoading(true)
      const response = await api.getMetrics(clubId ? { clubId } : {})
      let loadedMetrics = Array.isArray(response?.metrics)
        ? response.metrics.map((metric) => normalizeMetric(metric))
        : []

      const hasCalendarDaysMetric = loadedMetrics.some((metric) => isCalendarDaysMetric(metric))
      if (!hasCalendarDaysMetric) {
        try {
          const created = await api.createMetric({
            id: CALENDAR_DAYS_METRIC_ID,
            name: 'Kalendárne dni',
            shortName: 'KD',
            type: 'number',
            valueTypes: ['number'],
            mode: 'manual',
            isDefault: true,
            isActive: true,
            formula: [],
            context: 'attendance',
            ...(clubId ? { clubId } : {})
          })

          if (created?.metric) {
            loadedMetrics = [...loadedMetrics, normalizeMetric(created.metric)]
          }
        } catch {
          // fallback to local default append below
        }
      }

      const preparedMetrics = ensureCalendarDaysMetric(dedupeCalendarDaysMetric(loadedMetrics))
      const fallbackMetrics = preparedMetrics.length > 0 ? preparedMetrics : createDefaultAttendanceMetrics()

      let orderedMetrics = fallbackMetrics
      try {
        const storageKey = `attendanceMetricsOrder:${clubId || 'global'}`
        const storedOrderRaw = localStorage.getItem(storageKey)
        const storedOrder = storedOrderRaw ? JSON.parse(storedOrderRaw) : []
        if (Array.isArray(storedOrder) && storedOrder.length > 0) {
          const orderMap = new Map(storedOrder.map((metricId, index) => [String(metricId), index]))
          orderedMetrics = [...fallbackMetrics].sort((left, right) => {
            const leftPos = orderMap.get(String(left?.id || ''))
            const rightPos = orderMap.get(String(right?.id || ''))
            if (leftPos === undefined && rightPos === undefined) return 0
            if (leftPos === undefined) return 1
            if (rightPos === undefined) return -1
            return leftPos - rightPos
          })
        }
      } catch {
        orderedMetrics = fallbackMetrics
      }

      setMetrics(orderedMetrics)
      setMetricsLoaded(true)
    } catch {
      setMetrics(createDefaultAttendanceMetrics())
      setMetricsLoaded(true)
    } finally {
      setMetricsLoading(false)
    }
  }

  const openCreateMetricEditor = () => {
    resetMetricEditor()
    setShowMetricEditor(true)
  }

  const openEditMetricEditor = (metric) => {
    if (!metric) return
    setEditingMetricId(metric.id)
    setMetricDraft(buildMetricDraftFromMetric(metric))
    setFormulaDraft(Array.isArray(metric.formula) ? JSON.parse(JSON.stringify(metric.formula)) : [])
    setFormulaFunctionDraft({ fn: 'SUM', metricId: '', metricIds: [] })
    setValidationErrors([])
    setFormulaWarnings([])
    setFormulaPreviewValue(null)
    setShowMetricEditor(true)
  }

  const cancelMetricEditor = () => {
    setShowMetricEditor(false)
    resetMetricEditor()
  }

  const appendFormulaVariable = (metricId) => {
    if (!metricId) return
    setFormulaDraft((prev) => [...prev, { type: 'variable', metricId: String(metricId) }])
  }

  const appendFormulaVariableFromDraft = () => {
    if (!formulaFunctionDraft.metricId) return
    appendFormulaVariable(formulaFunctionDraft.metricId)
  }

  const appendFormulaOperator = (op) => {
    if (!op) return
    setFormulaDraft((prev) => [...prev, { type: 'operator', op }])
  }

  const appendFormulaLiteral = (value) => {
    const digit = String(value || '').trim()
    if (!/^\d$/.test(digit)) return

    setFormulaDraft((prev) => {
      const next = [...prev]
      const lastNode = next[next.length - 1]

      if (lastNode && lastNode.type === 'literal') {
        const mergedRaw = `${getLiteralRawValue(lastNode)}${digit}`
        const mergedValue = Number(mergedRaw)
        if (!Number.isFinite(mergedValue)) return prev
        next[next.length - 1] = { ...lastNode, value: mergedValue, raw: mergedRaw }
        return next
      }

      const normalized = Number(digit)
      if (!Number.isFinite(normalized)) return prev
      return [...next, { type: 'literal', value: normalized, raw: digit }]
    })
  }

  const appendFormulaDecimalPoint = () => {
    setFormulaDraft((prev) => {
      const next = [...prev]
      const lastNode = next[next.length - 1]

      if (lastNode && lastNode.type === 'literal') {
        const currentRaw = getLiteralRawValue(lastNode)
        if (currentRaw.includes('.')) return prev
        const mergedRaw = currentRaw ? `${currentRaw}.` : '0.'
        const mergedValue = Number(mergedRaw)
        if (!Number.isFinite(mergedValue)) return prev
        next[next.length - 1] = { ...lastNode, value: mergedValue, raw: mergedRaw }
        return next
      }

      return [...next, { type: 'literal', value: 0, raw: '0.' }]
    })
  }

  const toggleFormulaLiteralSign = () => {
    setFormulaDraft((prev) => {
      const next = [...prev]
      const lastNode = next[next.length - 1]
      if (!lastNode || lastNode.type !== 'literal') return prev

      const currentRaw = getLiteralRawValue(lastNode)
      if (!currentRaw) return prev

      const toggledRaw = currentRaw.startsWith('-') ? currentRaw.slice(1) : `-${currentRaw}`
      const toggledValue = Number(toggledRaw)
      if (!Number.isFinite(toggledValue)) return prev

      next[next.length - 1] = { ...lastNode, value: toggledValue, raw: toggledRaw }
      return next
    })
  }

  const appendFormulaFunction = () => {
    const functionName = formulaFunctionDraft.fn
    const metricIds = Array.isArray(formulaFunctionDraft.metricIds) ? formulaFunctionDraft.metricIds : []
    if (!functionName || metricIds.length === 0) return

    const args = metricIds.map((metricId) => ({ type: 'variable', metricId: String(metricId) }))

    setFormulaDraft((prev) => [...prev, { type: 'function', fn: functionName, args }])
    setFormulaFunctionDraft((prev) => ({ ...prev, metricId: '', metricIds: [] }))
  }

  const addFormulaFunctionArg = () => {
    if (!formulaFunctionDraft.metricId) return
    setFormulaFunctionDraft((prev) => ({
      ...prev,
      metricIds: [...new Set([...(prev.metricIds || []), String(prev.metricId)])],
      metricId: ''
    }))
  }

  const removeFormulaFunctionArg = (metricId) => {
    setFormulaFunctionDraft((prev) => ({
      ...prev,
      metricIds: (prev.metricIds || []).filter((item) => String(item) !== String(metricId))
    }))
  }

  const removeFormulaNode = (index) => {
    setFormulaDraft((prev) => prev.filter((_, nodeIndex) => nodeIndex !== index))
  }

  const clearFormula = () => {
    setFormulaDraft([])
  }

  const validateMetricDraft = (draft, draftFormula) => {
    const nextErrors = []
    const nextWarnings = []
    const name = String(draft?.name || '').trim()

    if (!name) {
      nextErrors.push('Názov ukazovateľa je povinný.')
    }

    const duplicate = metrics.find(
      (metric) => String(metric.id) !== String(editingMetricId || '') && String(metric.name || '').trim().toLowerCase() === name.toLowerCase()
    )
    if (duplicate) {
      nextErrors.push('Ukazovateľ s týmto názvom už existuje.')
    }

    const selectedTypes = Array.isArray(draft?.valueTypes) ? draft.valueTypes.filter(Boolean) : []
    if (selectedTypes.length === 0) {
      nextErrors.push('Vyberte aspoň jeden typ hodnoty.')
    }

    const primaryType = selectedTypes[0] || draft.type || 'number'

    let previewValue = null

    if (draft.mode === 'formula') {
      const dependencies = collectFormulaDependencies(draftFormula)
      const hasValueNode = (Array.isArray(draftFormula) ? draftFormula : []).some((node) => node && node.type !== 'operator')
      if (!hasValueNode) {
        nextErrors.push('Vzorec musí obsahovať aspoň jednu hodnotu.')
      }

      if (dependencies.has(String(editingMetricId || '__new__'))) {
        nextErrors.push('Vzorec obsahuje cyklický odkaz na seba samého.')
      }

      const metricsMap = new Map(metrics.map((metric) => [String(metric.id), metric]))
      const evalResult = evaluateFormulaNodes(draftFormula, metricsMap)
      if (evalResult.errors.length > 0) {
        nextErrors.push(...evalResult.errors)
      } else {
        previewValue = evalResult.value
      }

      dependencies.forEach((dependencyId) => {
        const referencedMetric = metricsMap.get(String(dependencyId))
        if (referencedMetric && referencedMetric.isActive === false) {
          nextWarnings.push(`Vzorec odkazuje na vypnutý ukazovateľ „${referencedMetric.name}“.`)
        }
      })

      if (primaryType === 'percent' && typeof previewValue === 'number' && (previewValue < 0 || previewValue > 100)) {
        nextErrors.push('Percento musí byť v rozsahu 0–100.')
      }
    }

    return { nextErrors, nextWarnings, previewValue }
  }

  const validateFormulaOnServer = async (draft, draftFormula) => {
    try {
      setFormulaValidating(true)
      const selectedTypes = Array.isArray(draft?.valueTypes) ? draft.valueTypes.filter(Boolean) : []
      const response = await api.validateMetricFormula({
        metricId: editingMetricId || null,
        type: selectedTypes[0] || draft.type || 'number',
        valueTypes: selectedTypes,
        mode: draft.mode,
        formula: draftFormula
      })

      const remoteErrors = Array.isArray(response?.errors)
        ? response.errors.map((item) => item?.message || item?.code).filter(Boolean)
        : []

      return remoteErrors
    } catch {
      return []
    } finally {
      setFormulaValidating(false)
    }
  }

  const runFormulaValidation = async () => {
    const localValidation = validateMetricDraft(metricDraft, formulaDraft)
    const remoteErrors = metricDraft.mode === 'formula'
      ? await validateFormulaOnServer(metricDraft, formulaDraft)
      : []

    setValidationErrors([...localValidation.nextErrors, ...remoteErrors])
    setFormulaWarnings(localValidation.nextWarnings)
    setFormulaPreviewValue(localValidation.previewValue)

    return {
      localValidation,
      remoteErrors,
      hasErrors: localValidation.nextErrors.length > 0 || remoteErrors.length > 0
    }
  }

  const saveMetric = async () => {
    const validationResult = await runFormulaValidation()
    if (validationResult.hasErrors) return

    const selectedTypes = Array.isArray(metricDraft?.valueTypes) ? metricDraft.valueTypes.filter(Boolean) : []
    const primaryType = selectedTypes[0] || metricDraft.type || 'number'

    const payload = {
      name: String(metricDraft.name || '').trim(),
      shortName: String(metricDraft.shortName || '').trim(),
      type: primaryType,
      valueTypes: selectedTypes,
      mode: metricDraft.mode,
      isActive: editingMetricId ? metricDraft.isActive : true,
      formula: metricDraft.mode === 'formula' ? formulaDraft : []
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      if (editingMetricId) {
        await api.updateMetric(editingMetricId, payload)
        setSuccess('Ukazovateľ bol úspešne upravený')
      } else {
        await api.createMetric(payload)
        setSuccess('Ukazovateľ bol úspešne vytvorený')
      }

      await fetchAttendanceMetrics()
      cancelMetricEditor()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa uložiť ukazovateľ')
    } finally {
      setLoading(false)
    }
  }

  const saveSeason = () => {
    const seasonName = String(seasonDraft.name || '').trim()
    const fromValue = String(seasonDraft.from || '').trim()
    const toValue = String(seasonDraft.to || '').trim()

    const normalizeDayMonth = (value) => {
      const match = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})$/)
      if (!match) return null

      const day = Number(match[1])
      const month = Number(match[2])

      if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) {
        return null
      }

      return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`
    }

    setError('')
    setSuccess('')

    if (!seasonName) {
      setError('Zadajte NÁZOV OBDOBIA.')
      return
    }

    const normalizedFrom = normalizeDayMonth(fromValue)
    const normalizedTo = normalizeDayMonth(toValue)

    if (!normalizedFrom || !normalizedTo) {
      setError('Rozpätie sezóny musí byť vo formáte dd.mm (napr. 01.07.).')
      return
    }

    if (editingSeasonId) {
      api.updateAttendanceSeason(editingSeasonId, { name: seasonName, from: normalizedFrom, to: normalizedTo })
        .then((res) => {
          setAttendanceSeasons((prev) => prev.map((s) => String(s.id) === String(editingSeasonId) ? res.season : s))
          setSuccess('Sezóna bola upravená')
        })
        .catch(() => setError('Chyba pri ukladaní sezóny.'))
    } else {
      api.createAttendanceSeason({ name: seasonName, from: normalizedFrom, to: normalizedTo })
        .then((res) => {
          setAttendanceSeasons((prev) => [...prev, res.season])
          setSuccess('Sezóna bola uložená')
        })
        .catch(() => setError('Chyba pri ukladaní sezóny.'))
    }

    setShowSeasonForm(false)
    setEditingSeasonId(null)
    setSeasonDraft({ name: '', from: '', to: '' })
  }

  const startEditSeason = (season) => {
    if (!season?.id) return
    setError('')
    setSuccess('')
    setEditingSeasonId(season.id)
    setSeasonDraft({
      name: String(season.name || ''),
      from: String(season.from || ''),
      to: String(season.to || '')
    })
    setShowSeasonForm(true)
  }

  const removeSeason = (season) => {
    if (!season?.id) return
    setError('')
    setSuccess('')
    api.deleteAttendanceSeason(season.id)
      .then(() => setSuccess('Sezóna bola odstránená'))
      .catch(() => setError('Chyba pri odstraňovaní sezóny.'))
    setAttendanceSeasons((prev) => prev.filter((item) => String(item.id) !== String(season.id)))

    if (String(editingSeasonId || '') === String(season.id)) {
      setEditingSeasonId(null)
      setShowSeasonForm(false)
      setSeasonDraft({ name: '', from: '', to: '' })
    }

  }

  const saveField = () => {
    const fieldName = String(fieldDraft.name || '').trim()
    const fieldSurfaceType = String(fieldDraft.surfaceType || '').trim()
    const fieldDimensions = String(fieldDraft.dimensions || '').trim()
    const fieldPartsTotal = Number(fieldDraft.partsTotal)

    setError('')
    setSuccess('')

    if (!fieldName) {
      setError('Zadajte názov ihriska.')
      return
    }

    if (!fieldSurfaceType) {
      setError('Zadajte typ ihriska.')
      return
    }

    if (!fieldDimensions) {
      setError('Zadajte rozmer ihriska.')
      return
    }

    if (!Number.isInteger(fieldPartsTotal) || fieldPartsTotal < 1) {
      setError('Počet častí musí byť celé číslo väčšie ako 0.')
      return
    }

    const payload = { name: fieldName, surfaceType: fieldSurfaceType, dimensions: fieldDimensions, partsTotal: fieldPartsTotal }

    if (editingFieldId) {
      api.updateClubField(editingFieldId, payload)
        .then((res) => {
          setClubFields((prev) => prev.map((f) => String(f.id) === String(editingFieldId) ? normalizeClubField(res.field) : f))
          setSuccess('Ihrisko bolo upravené')
        })
        .catch(() => setError('Chyba pri ukladaní ihriska.'))
    } else {
      api.createClubField(payload)
        .then((res) => {
          setClubFields((prev) => [...prev, normalizeClubField(res.field)])
          setSuccess('Ihrisko bolo uložené')
        })
        .catch(() => setError('Chyba pri ukladaní ihriska.'))
    }

    setShowFieldForm(false)
    setEditingFieldId(null)
    setFieldDraft(createDefaultFieldDraft())
  }

  const startEditField = (field) => {
    if (!field?.id) return
    setError('')
    setSuccess('')
    setEditingFieldId(field.id)
    setFieldDraft({
      name: String(field.name || ''),
      surfaceType: String(field.surfaceType || ''),
      dimensions: String(field.dimensions || ''),
      partsTotal: String(field.partsTotal || '')
    })
    setShowFieldForm(true)
  }

  const removeField = (field) => {
    if (!field?.id) return
    setError('')
    setSuccess('')
    api.deleteClubField(field.id)
      .then(() => setSuccess('Ihrisko bolo odstránené'))
      .catch(() => setError('Chyba pri odstraňovaní ihriska.'))
    setClubFields((prev) => prev.filter((item) => String(item.id) !== String(field.id)))

    if (String(editingFieldId || '') === String(field.id)) {
      setEditingFieldId(null)
      setShowFieldForm(false)
      setFieldDraft(createDefaultFieldDraft())
    }
  }

  const adjustFieldPartsTotal = (delta) => {
    setFieldDraft((prev) => {
      const parsed = Number.parseInt(String(prev.partsTotal || '').trim(), 10)
      const current = Number.isInteger(parsed) && parsed > 0 ? parsed : 1
      const nextValue = Math.max(1, current + delta)
      return {
        ...prev,
        partsTotal: String(nextValue)
      }
    })
  }

  const createTrainingDivision = () => {
    const name = String(trainingDivisionDraft.name || '').trim()
    const groups = Array.isArray(trainingDivisionDraft.groups)
      ? trainingDivisionDraft.groups.map((groupName) => String(groupName || '').trim()).filter(Boolean)
      : []

    if (!name) {
      setError('Zadajte názov delenia.')
      return
    }

    if (groups.length === 0) {
      setError('Zadajte aspoň jednu skupinu.')
      return
    }

    const exists = trainingDivisions.some((item) => {
      if (editingTrainingDivisionId && String(item?.id || '') === String(editingTrainingDivisionId)) return false
      return String(item?.name || '').trim().toLowerCase() === name.toLowerCase()
    })
    if (exists) {
      setError('Takýto názov delenia už existuje.')
      return
    }

    if (editingTrainingDivisionId) {
      setTrainingDivisions((prev) => prev.map((item) => {
        if (String(item?.id || '') !== String(editingTrainingDivisionId)) return item
        return {
          ...item,
          name,
          groups
        }
      }))
      setSuccess('Delenie bolo upravené.')
    } else {
      setTrainingDivisions((prev) => [
        ...prev,
        {
          id: `division-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          groups
        }
      ])
      setSuccess('Názov delenia bol vytvorený.')
    }

    setTrainingDivisionDraft({ name: '', groups: [''] })
    setEditingTrainingDivisionId(null)
    setShowTrainingDivisionForm(false)
  }

  const startEditTrainingDivision = (division) => {
    if (!division?.id) return
    const normalizedGroups = Array.isArray(division.groups)
      ? division.groups.map((groupName) => String(groupName || '').trim()).filter(Boolean)
      : []

    setError('')
    setSuccess('')
    setEditingTrainingDivisionId(String(division.id))
    setTrainingDivisionDraft({
      name: String(division.name || ''),
      groups: normalizedGroups.length > 0 ? normalizedGroups : ['']
    })
    setShowTrainingDivisionForm(true)
  }

  const removeTrainingDivision = (division) => {
    if (!division?.id) return
    setError('')
    setSuccess('')
    setTrainingDivisions((prev) => prev.filter((item) => String(item?.id || '') !== String(division.id)))

    if (String(editingTrainingDivisionId || '') === String(division.id)) {
      setEditingTrainingDivisionId(null)
      setTrainingDivisionDraft({ name: '', groups: [''] })
      setShowTrainingDivisionForm(false)
    }

    setSuccess('Delenie bolo odstránené.')
  }

  const createExerciseCategory = () => {
    const name = String(exerciseCategoryDraft.name || '').trim()
    const subcategories = Array.isArray(exerciseCategoryDraft.subcategories)
      ? exerciseCategoryDraft.subcategories.map((subName) => String(subName || '').trim()).filter(Boolean)
      : []
    const assignedDivisionGroups = normalizeExerciseCategoryDivisionGroups(exerciseCategoryDraft.assignedDivisionGroups)

    if (!name) {
      setError('Zadajte názov kategórie cvičení.')
      return
    }

    const exists = exerciseCategories.some((item) => {
      if (editingExerciseCategoryId && String(item?.id || '') === String(editingExerciseCategoryId)) return false
      return String(item?.name || '').trim().toLowerCase() === name.toLowerCase()
    })

    if (exists) {
      setError('Takáto kategória cvičení už existuje.')
      return
    }

    if (editingExerciseCategoryId) {
      setExerciseCategories((prev) => prev.map((item) => {
        if (String(item?.id || '') !== String(editingExerciseCategoryId)) return item
        return {
          ...item,
          name,
          subcategories,
          assignedDivisionGroups
        }
      }))
      setSuccess('Kategória cvičení bola upravená.')
    } else {
      setExerciseCategories((prev) => [
        ...prev,
        {
          id: `exercise-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          subcategories,
          assignedDivisionGroups
        }
      ])
      setSuccess('Kategória cvičení bola vytvorená.')
    }

    setExerciseCategoryDraft({ name: '', subcategories: [''], assignedDivisionGroups: {} })
    setEditingExerciseCategoryId(null)
    setShowExerciseCategoryForm(false)
  }

  const addExerciseSubcategoryRow = () => {
    setExerciseCategoryDraft((prev) => ({
      ...prev,
      subcategories: [...(Array.isArray(prev.subcategories) ? prev.subcategories : ['']), '']
    }))
  }

  const updateExerciseSubcategoryRow = (index, value) => {
    setExerciseCategoryDraft((prev) => ({
      ...prev,
      subcategories: (Array.isArray(prev.subcategories) ? prev.subcategories : ['']).map((item, itemIndex) => (
        itemIndex === index ? value : item
      ))
    }))
  }

  const removeExerciseSubcategoryRow = (index) => {
    setExerciseCategoryDraft((prev) => {
      const currentRows = Array.isArray(prev.subcategories) ? prev.subcategories : ['']
      if (currentRows.length <= 1) {
        return {
          ...prev,
          subcategories: ['']
        }
      }
      return {
        ...prev,
        subcategories: currentRows.filter((_, itemIndex) => itemIndex !== index)
      }
    })
  }

  const startEditExerciseCategory = (category) => {
    if (!category?.id) return
    const normalizedSubcategories = Array.isArray(category.subcategories)
      ? category.subcategories.map((subName) => String(subName || '').trim()).filter(Boolean)
      : []

    setError('')
    setSuccess('')
    setEditingExerciseCategoryId(String(category.id))
    setExerciseCategoryDraft({
      name: String(category.name || ''),
      subcategories: normalizedSubcategories.length > 0 ? normalizedSubcategories : [''],
      assignedDivisionGroups: normalizeExerciseCategoryDivisionGroups(category?.assignedDivisionGroups)
    })
    setShowExerciseCategoryForm(true)
  }

  const removeExerciseCategory = (category) => {
    if (!category?.id) return
    setError('')
    setSuccess('')
    setExerciseCategories((prev) => prev.filter((item) => String(item?.id || '') !== String(category.id)))

    if (String(editingExerciseCategoryId || '') === String(category.id)) {
      setEditingExerciseCategoryId(null)
      setExerciseCategoryDraft({ name: '', subcategories: [''], assignedDivisionGroups: {} })
      setShowExerciseCategoryForm(false)
    }

    setSuccess('Kategória cvičení bola odstránená.')
  }

  const getTrainingDivisionGroups = (division) => (
    Array.isArray(division?.groups)
      ? division.groups.map((groupName) => String(groupName || '').trim()).filter(Boolean)
      : []
  )

  const normalizeExerciseCategoryDivisionGroups = (rawGroups, divisionSource = trainingDivisions) => {
    const source = rawGroups && typeof rawGroups === 'object' ? rawGroups : {}
    const nextGroups = {}

    const divisionMap = new Map(
      (Array.isArray(divisionSource) ? divisionSource : []).map((division) => [
        String(division?.id || ''),
        getTrainingDivisionGroups(division)
      ])
    )

    Object.entries(source).forEach(([divisionId, selectedGroups]) => {
      const resolvedDivisionId = String(divisionId || '').trim()
      if (!resolvedDivisionId || !divisionMap.has(resolvedDivisionId)) return

      const allowedGroups = divisionMap.get(resolvedDivisionId) || []
      if (allowedGroups.length === 0) return

      const selected = Array.isArray(selectedGroups)
        ? selectedGroups.map((name) => String(name || '').trim()).filter(Boolean)
        : []
      const uniqueSelected = Array.from(new Set(selected)).filter((name) => allowedGroups.includes(name))
      if (uniqueSelected.length > 0) {
        nextGroups[resolvedDivisionId] = uniqueSelected
      }
    })

    return nextGroups
  }

  const addExerciseCategoryDivisionGroupSelection = (divisionId, groupName) => {
    const resolvedDivisionId = String(divisionId || '').trim()
    const resolvedGroupName = String(groupName || '').trim()
    if (!resolvedDivisionId || !resolvedGroupName) return

    setExerciseCategoryDraft((prev) => {
      const currentMap = prev?.assignedDivisionGroups && typeof prev.assignedDivisionGroups === 'object'
        ? prev.assignedDivisionGroups
        : {}
      const selectedForDivision = Array.isArray(currentMap[resolvedDivisionId])
        ? currentMap[resolvedDivisionId]
        : []
      if (selectedForDivision.includes(resolvedGroupName)) return prev

      return {
        ...prev,
        assignedDivisionGroups: {
          ...currentMap,
          [resolvedDivisionId]: [...selectedForDivision, resolvedGroupName]
        }
      }
    })
  }

  const removeExerciseCategoryDivisionGroupSelection = (divisionId, groupName) => {
    const resolvedDivisionId = String(divisionId || '').trim()
    const resolvedGroupName = String(groupName || '').trim()
    if (!resolvedDivisionId || !resolvedGroupName) return

    setExerciseCategoryDraft((prev) => {
      const currentMap = prev?.assignedDivisionGroups && typeof prev.assignedDivisionGroups === 'object'
        ? prev.assignedDivisionGroups
        : {}
      const selectedForDivision = Array.isArray(currentMap[resolvedDivisionId])
        ? currentMap[resolvedDivisionId]
        : []
      const nextSelected = selectedForDivision.filter((item) => item !== resolvedGroupName)

      const nextMap = { ...currentMap }
      if (nextSelected.length > 0) {
        nextMap[resolvedDivisionId] = nextSelected
      } else {
        delete nextMap[resolvedDivisionId]
      }

      return {
        ...prev,
        assignedDivisionGroups: nextMap
      }
    })
  }

  useEffect(() => {
    setExerciseCategories((prev) => {
      const source = Array.isArray(prev) ? prev : []
      const normalized = source.map((category) => ({
        ...category,
        assignedDivisionGroups: normalizeExerciseCategoryDivisionGroups(category?.assignedDivisionGroups, trainingDivisions)
      }))

      if (JSON.stringify(source) === JSON.stringify(normalized)) {
        return source
      }

      return normalized
    })

    setExerciseCategoryDraft((prev) => {
      const current = prev?.assignedDivisionGroups && typeof prev.assignedDivisionGroups === 'object'
        ? prev.assignedDivisionGroups
        : {}
      const normalized = normalizeExerciseCategoryDivisionGroups(current, trainingDivisions)

      if (JSON.stringify(current) === JSON.stringify(normalized)) {
        return prev
      }

      return {
        ...prev,
        assignedDivisionGroups: normalized
      }
    })
  }, [trainingDivisions])

  const isTrainingDivisionVisibleInExerciseForm = (divisionId) => {
    const resolvedId = String(divisionId || '')
    if (!resolvedId) return false
    const config = trainingExerciseDisplaySettings?.divisions && typeof trainingExerciseDisplaySettings.divisions === 'object'
      ? trainingExerciseDisplaySettings.divisions[resolvedId]
      : null
    return config?.visible !== false
  }

  const normalizeExerciseCategorySelections = (rawSelections, categorySource = exerciseCategories) => {
    const source = rawSelections && typeof rawSelections === 'object' ? rawSelections : {}
    const nextSelections = {}

    const categoriesById = new Map(
      (Array.isArray(categorySource) ? categorySource : []).map((category) => [
        String(category?.id || ''),
        Array.isArray(category?.subcategories)
          ? category.subcategories.map((name) => String(name || '').trim()).filter(Boolean)
          : []
      ])
    )

    Object.entries(source).forEach(([categoryId, selectedSubcategories]) => {
      const resolvedCategoryId = String(categoryId || '').trim()
      if (!resolvedCategoryId || !categoriesById.has(resolvedCategoryId)) return

      const allowedSubcategories = categoriesById.get(resolvedCategoryId) || []
      if (allowedSubcategories.length === 0) return

      const selected = Array.isArray(selectedSubcategories)
        ? selectedSubcategories.map((name) => String(name || '').trim()).filter(Boolean)
        : []

      const uniqueSelected = Array.from(new Set(selected)).filter((name) => allowedSubcategories.includes(name))
      if (uniqueSelected.length > 0) {
        nextSelections[resolvedCategoryId] = uniqueSelected
      }
    })

    return nextSelections
  }

  const resolveSelectedExerciseCategoryIds = (rawCategoryIds, rawCategorySelections, categorySource = exerciseCategories) => {
    const sourceIds = Array.isArray(rawCategoryIds) ? rawCategoryIds : []
    const normalizedSelections = normalizeExerciseCategorySelections(rawCategorySelections, categorySource)
    const sourceSet = new Set(
      sourceIds
        .map((categoryId) => String(categoryId || '').trim())
        .filter(Boolean)
    )

    return Array.from(new Set(
      (Array.isArray(categorySource) ? categorySource : [])
        .map((category) => {
          const categoryId = String(category?.id || '').trim()
          if (!categoryId) return ''

          const hasSubcategories = Array.isArray(category?.subcategories)
            && category.subcategories.map((name) => String(name || '').trim()).filter(Boolean).length > 0

          if (hasSubcategories) {
            const selectedSubcategories = Array.isArray(normalizedSelections?.[categoryId])
              ? normalizedSelections[categoryId]
              : []
            return selectedSubcategories.length > 0 ? categoryId : ''
          }

          return sourceSet.has(categoryId) ? categoryId : ''
        })
        .filter(Boolean)
    ))
  }

  const toggleExerciseCategorySelection = (categoryId) => {
    const resolvedCategoryId = String(categoryId || '').trim()
    if (!resolvedCategoryId) return

    setExerciseFormDraft((prev) => {
      const current = Array.isArray(prev?.selectedCategoryIds) ? prev.selectedCategoryIds : []
      const isSelected = current.includes(resolvedCategoryId)
      return {
        ...prev,
        selectedCategoryIds: isSelected
          ? current.filter((item) => item !== resolvedCategoryId)
          : [...current, resolvedCategoryId]
      }
    })
  }

  const addExerciseSubcategorySelection = (categoryId, subcategoryName) => {
    const resolvedCategoryId = String(categoryId || '').trim()
    const resolvedSubcategory = String(subcategoryName || '').trim()
    if (!resolvedCategoryId || !resolvedSubcategory) return

    setExerciseFormDraft((prev) => {
      const current = prev?.categorySelections && typeof prev.categorySelections === 'object'
        ? prev.categorySelections
        : {}
      const selectedForCategory = Array.isArray(current[resolvedCategoryId])
        ? current[resolvedCategoryId]
        : []
      if (selectedForCategory.includes(resolvedSubcategory)) return prev

      return {
        ...prev,
        categorySelections: {
          ...current,
          [resolvedCategoryId]: [...selectedForCategory, resolvedSubcategory]
        }
      }
    })
  }

  const removeExerciseSubcategorySelection = (categoryId, subcategoryName) => {
    const resolvedCategoryId = String(categoryId || '').trim()
    const resolvedSubcategory = String(subcategoryName || '').trim()
    if (!resolvedCategoryId || !resolvedSubcategory) return

    setExerciseFormDraft((prev) => {
      const current = prev?.categorySelections && typeof prev.categorySelections === 'object'
        ? prev.categorySelections
        : {}
      const selectedForCategory = Array.isArray(current[resolvedCategoryId])
        ? current[resolvedCategoryId]
        : []
      const nextSelected = selectedForCategory.filter((name) => name !== resolvedSubcategory)

      const nextSelections = { ...current }
      if (nextSelected.length > 0) {
        nextSelections[resolvedCategoryId] = nextSelected
      } else {
        delete nextSelections[resolvedCategoryId]
      }

      return {
        ...prev,
        categorySelections: nextSelections
      }
    })
  }

  const getVisibleTrainingDivisionsForExerciseForm = () => (
    trainingDivisions.filter((division) => isTrainingDivisionVisibleInExerciseForm(division.id))
  )

  const getFilteredExerciseCategoriesForForm = () => {
    const visibleDivisions = getVisibleTrainingDivisionsForExerciseForm()
    const visibleDivisionIds = new Set(visibleDivisions.map((division) => String(division?.id || '')))
    const selectedDivisionGroups = exerciseFormDraft?.divisionGroups && typeof exerciseFormDraft.divisionGroups === 'object'
      ? exerciseFormDraft.divisionGroups
      : {}

    return (Array.isArray(exerciseCategories) ? exerciseCategories : []).filter((category) => {
      const assignedGroups = category?.assignedDivisionGroups && typeof category.assignedDivisionGroups === 'object'
        ? category.assignedDivisionGroups
        : {}

      const relevantAssignments = Object.entries(assignedGroups).filter(([divisionId]) => (
        visibleDivisionIds.has(String(divisionId || ''))
      ))

      if (relevantAssignments.length === 0) return true

      return relevantAssignments.some(([divisionId, allowedGroups]) => {
        const selectedGroup = String(selectedDivisionGroups[String(divisionId || '')] || '').trim()
        if (!selectedGroup) return false

        const normalizedAllowedGroups = Array.isArray(allowedGroups)
          ? allowedGroups.map((name) => String(name || '').trim()).filter(Boolean)
          : []

        return normalizedAllowedGroups.includes(selectedGroup)
      })
    })
  }

  useEffect(() => {
    setExerciseFormDraft((prev) => {
      const currentSelections = prev?.categorySelections && typeof prev.categorySelections === 'object'
        ? prev.categorySelections
        : {}
      const normalizedSelections = normalizeExerciseCategorySelections(currentSelections, exerciseCategories)
      const currentSelectedCategoryIds = Array.isArray(prev?.selectedCategoryIds) ? prev.selectedCategoryIds : []
      const normalizedSelectedCategoryIds = resolveSelectedExerciseCategoryIds(
        currentSelectedCategoryIds,
        normalizedSelections,
        exerciseCategories
      )

      if (
        JSON.stringify(currentSelections) === JSON.stringify(normalizedSelections)
        && JSON.stringify(currentSelectedCategoryIds) === JSON.stringify(normalizedSelectedCategoryIds)
      ) {
        return prev
      }

      return {
        ...prev,
        categorySelections: normalizedSelections,
        selectedCategoryIds: normalizedSelectedCategoryIds
      }
    })
  }, [exerciseCategories])

  useEffect(() => {
    const filteredCategoryIds = new Set(
      getFilteredExerciseCategoriesForForm().map((category) => String(category?.id || ''))
    )

    setExerciseFormDraft((prev) => {
      const currentSelections = prev?.categorySelections && typeof prev.categorySelections === 'object'
        ? prev.categorySelections
        : {}
      const currentSelectedCategoryIds = Array.isArray(prev?.selectedCategoryIds) ? prev.selectedCategoryIds : []

      const nextSelections = Object.entries(currentSelections).reduce((acc, [categoryId, selectedSubcategories]) => {
        const resolvedCategoryId = String(categoryId || '')
        if (!filteredCategoryIds.has(resolvedCategoryId)) return acc
        if (!Array.isArray(selectedSubcategories) || selectedSubcategories.length === 0) return acc
        acc[resolvedCategoryId] = selectedSubcategories
        return acc
      }, {})

      const nextSelectedCategoryIds = currentSelectedCategoryIds.filter((categoryId) => (
        filteredCategoryIds.has(String(categoryId || ''))
      ))

      if (
        JSON.stringify(currentSelections) === JSON.stringify(nextSelections)
        && JSON.stringify(currentSelectedCategoryIds) === JSON.stringify(nextSelectedCategoryIds)
      ) {
        return prev
      }

      return {
        ...prev,
        categorySelections: nextSelections,
        selectedCategoryIds: nextSelectedCategoryIds
      }
    })
  }, [exerciseCategories, exerciseFormDraft.divisionGroups, trainingDivisions, trainingExerciseDisplaySettings])

  useEffect(() => {
    const visibleDivisions = getVisibleTrainingDivisionsForExerciseForm()
    const currentMap = exerciseFormDraft?.divisionGroups && typeof exerciseFormDraft.divisionGroups === 'object'
      ? exerciseFormDraft.divisionGroups
      : {}

    const nextMap = visibleDivisions.reduce((acc, division) => {
      const divisionId = String(division?.id || '')
      if (!divisionId) return acc
      const divisionGroups = getTrainingDivisionGroups(division)
      const currentSelected = String(currentMap[divisionId] || '').trim()
      if (divisionGroups.length === 0) {
        acc[divisionId] = ''
        return acc
      }
      acc[divisionId] = divisionGroups.includes(currentSelected) ? currentSelected : divisionGroups[0]
      return acc
    }, {})

    if (JSON.stringify(currentMap) === JSON.stringify(nextMap)) return

    setExerciseFormDraft((prev) => ({
      ...prev,
      divisionGroups: nextMap
    }))
  }, [trainingDivisions, trainingExerciseDisplaySettings, exerciseFormDraft.divisionGroups])

  const resetExerciseFormDraft = () => {
    setEditingExerciseDatabaseItemId(null)
    setExerciseFormDraft({
      name: '',
      description: '',
      intensity: 'Stredná',
      playersCount: [],
      youtubeUrl: '',
      imageUrl: '',
      imageName: '',
      selectedCategoryIds: [],
      categorySelections: {},
      divisionGroups: getVisibleTrainingDivisionsForExerciseForm().reduce((acc, division) => {
        const divisionId = String(division?.id || '')
        if (!divisionId) return acc
        const divisionGroups = getTrainingDivisionGroups(division)
        acc[divisionId] = divisionGroups[0] || ''
        return acc
      }, {}),
      isActive: true,
      isPublic: true
    })
  }

  const openExerciseImagePicker = () => {
    exerciseImageInputRef.current?.click()
  }

  const clearExerciseImage = () => {
    setExerciseFormDraft((prev) => ({
      ...prev,
      imageUrl: '',
      imageName: ''
    }))
    if (exerciseImageInputRef.current) {
      exerciseImageInputRef.current.value = ''
    }
  }

  const handleExerciseImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!String(file.type || '').startsWith('image/')) {
      setError('Vyberte prosim obrazok.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setExerciseFormDraft((prev) => ({
        ...prev,
        imageUrl: dataUrl,
        imageName: String(file.name || '')
      }))
      setError('')
    } catch {
      setError('Obrazok sa nepodarilo nacitat.')
    }
  }

  const getExercisePreviewImage = (item) => {
    const uploadedImage = String(item?.imageUrl || '').trim()
    if (uploadedImage) return uploadedImage

    const youtubeVideoId = String(item?.youtube?.videoId || '').trim()
    return getYoutubeThumbnailUrl(youtubeVideoId)
  }

  const toggleExercisePlayersCount = (countValue) => {
    const resolvedCount = String(countValue || '').trim()
    if (!resolvedCount) return

    setExerciseFormDraft((prev) => {
      const selectedValues = normalizeExercisePlayersCount(prev?.playersCount)
      const isSelected = selectedValues.includes(resolvedCount)
      const nextSelectedValues = isSelected
        ? selectedValues.filter((item) => item !== resolvedCount)
        : [...selectedValues, resolvedCount]

      return {
        ...prev,
        playersCount: normalizeExercisePlayersCount(nextSelectedValues)
      }
    })
  }

  const startEditExerciseDatabaseItem = (item) => {
    if (!item?.id) return

    setError('')
    setSuccess('')
    setEditingExerciseDatabaseItemId(String(item.id))
    setExerciseFormDraft({
      name: String(item?.name || ''),
      description: String(item?.description || ''),
      intensity: String(item?.intensity || 'Stredná'),
      playersCount: normalizeExercisePlayersCount(item?.playersCount),
      youtubeUrl: String(item?.youtube?.url || ''),
      imageUrl: String(item?.imageUrl || ''),
      imageName: String(item?.imageName || ''),
      selectedCategoryIds: resolveSelectedExerciseCategoryIds(item?.selectedCategoryIds, item?.categorySelections),
      categorySelections: item?.categorySelections && typeof item.categorySelections === 'object' ? item.categorySelections : {},
      divisionGroups: item?.divisionGroups && typeof item.divisionGroups === 'object' ? item.divisionGroups : {},
      isActive: item?.isActive !== false,
      isPublic: item?.isPublic !== false
    })
    setActiveExerciseDatabaseSection('createExercise')
  }

  const openExerciseDetailItem = (item) => {
    if (!item?.id) return
    setIsExerciseDetailVideoPlaying(false)
    setOpenedExerciseDetailItem(item)
  }

  const closeExerciseDetailItem = () => {
    setIsExerciseDetailVideoPlaying(false)
    setOpenedExerciseDetailItem(null)
  }

  const startExerciseDetailVideo = () => {
    const videoId = String(openedExerciseDetailItem?.youtube?.videoId || '').trim()
    if (!videoId) return
    setIsExerciseDetailVideoPlaying(true)
  }

  const editExerciseFromDetail = (item) => {
    closeExerciseDetailItem()
    startEditExerciseDatabaseItem(item)
  }

  const removeExerciseFromDetail = (item) => {
    closeExerciseDetailItem()
    removeExerciseDatabaseItem(item)
  }

  const removeExerciseDatabaseItem = (item) => {
    const itemId = String(item?.id || '')
    if (!itemId) return

    setError('')
    setSuccess('')

    setExerciseDatabaseItems((prev) => (Array.isArray(prev) ? prev.filter((entry) => String(entry?.id || '') !== itemId) : []))

    if (String(editingExerciseDatabaseItemId || '') === itemId) {
      resetExerciseFormDraft()
    }

    setSuccess('Cvičenie bolo odstránené.')
  }

  const saveExerciseFromDatabaseForm = () => {
    const exerciseName = String(exerciseFormDraft.name || '').trim()
    if (!exerciseName) {
      setError('Zadajte názov cvičenia.')
      return
    }

    const youtubeUrlRaw = String(exerciseFormDraft.youtubeUrl || '').trim()
    const youtubeVideoId = extractYoutubeVideoId(youtubeUrlRaw)
    if (youtubeUrlRaw && !youtubeVideoId) {
      setError('YouTube odkaz nie je v podporovanom formáte.')
      return
    }

    const editingId = String(editingExerciseDatabaseItemId || '')
    const normalizedCategorySelections = normalizeExerciseCategorySelections(exerciseFormDraft.categorySelections)
    const normalizedSelectedCategoryIds = resolveSelectedExerciseCategoryIds(
      exerciseFormDraft.selectedCategoryIds,
      normalizedCategorySelections
    )
    const nextItem = {
      id: editingId || `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: exerciseName,
      description: String(exerciseFormDraft.description || '').trim(),
      intensity: String(exerciseFormDraft.intensity || 'Stredná'),
      playersCount: normalizeExercisePlayersCount(exerciseFormDraft.playersCount),
      imageUrl: String(exerciseFormDraft.imageUrl || '').trim(),
      imageName: String(exerciseFormDraft.imageName || '').trim(),
      selectedCategoryIds: normalizedSelectedCategoryIds,
      categorySelections: normalizedCategorySelections,
      divisionGroups: exerciseFormDraft?.divisionGroups && typeof exerciseFormDraft.divisionGroups === 'object'
        ? exerciseFormDraft.divisionGroups
        : {},
      isActive: exerciseFormDraft.isActive !== false,
      isPublic: exerciseFormDraft.isPublic !== false,
      youtube: {
        url: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : '',
        videoId: youtubeVideoId
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setExerciseDatabaseItems((prev) => {
      const source = Array.isArray(prev) ? prev : []
      if (!editingId) {
        return [{ ...nextItem, rating: 0, isFavorite: false }, ...source]
      }

      return source.map((entry) => {
        const isEditedEntry = String(entry?.id || '') === editingId
        if (!isEditedEntry) return entry
        return {
          ...entry,
          ...nextItem,
          id: entry.id,
          createdAt: entry.createdAt || nextItem.createdAt,
          rating: normalizeExerciseRating(entry?.rating),
          isFavorite: normalizeExerciseFavorite(entry?.isFavorite)
        }
      })
    })

    setError('')
    setSuccess(editingId ? 'Cvičenie bolo upravené.' : 'Cvičenie bolo uložené.')
    resetExerciseFormDraft()
    setActiveExerciseDatabaseSection('exerciseList')
  }

  const saveTrainingExerciseDisplaySettings = async () => {
    if (!clubId) return

    try {
      setTrainingExerciseDisplaySaving(true)
      setError('')
      setSuccess('')

      const normalized = {
        divisions: trainingExerciseDisplaySettings?.divisions && typeof trainingExerciseDisplaySettings.divisions === 'object'
          ? trainingExerciseDisplaySettings.divisions
          : {},
        defaultDivisionId: String(trainingExerciseDisplaySettings?.defaultDivisionId || '')
      }

      try {
        await api.updateTrainingExerciseDisplaySettings(normalized)
      } catch (err) {
        // Older API deployments may not have the endpoint yet; keep UX functional via local fallback.
        if (!api.isEndpointNotFound(err)) {
          throw err
        }
      }

      try {
        localStorage.setItem(`trainingExerciseDisplaySettings:${clubId || 'global'}`, JSON.stringify(normalized))
      } catch {
        // no-op
      }

      setSuccess('Nastavenie zobrazenia tréningov bolo uložené.')
    } catch (err) {
      setError(err.message || 'Nepodarilo sa uložiť nastavenie zobrazenia tréningov.')
    } finally {
      setTrainingExerciseDisplaySaving(false)
    }
  }

  const resetExerciseListFilters = () => {
    setExerciseListFilters({
      intensity: 'all',
      playersCount: 'all',
      categoryId: 'all',
      subcategory: 'all'
    })
  }

  const exerciseListSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = String(exerciseListFilters?.categoryId || 'all')
    if (selectedCategoryId === 'all') return []

    const selectedCategory = (Array.isArray(exerciseCategories) ? exerciseCategories : [])
      .find((item) => String(item?.id || '') === selectedCategoryId)

    return Array.isArray(selectedCategory?.subcategories)
      ? selectedCategory.subcategories.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  }, [exerciseCategories, exerciseListFilters?.categoryId])

  useEffect(() => {
    const selectedCategoryId = String(exerciseListFilters?.categoryId || 'all')
    const selectedSubcategory = String(exerciseListFilters?.subcategory || 'all')

    if (selectedCategoryId === 'all' && selectedSubcategory !== 'all') {
      setExerciseListFilters((prev) => ({ ...prev, subcategory: 'all' }))
      return
    }

    if (selectedCategoryId !== 'all' && selectedSubcategory !== 'all' && !exerciseListSubcategoryOptions.includes(selectedSubcategory)) {
      setExerciseListFilters((prev) => ({ ...prev, subcategory: 'all' }))
    }
  }, [exerciseListFilters?.categoryId, exerciseListFilters?.subcategory, exerciseListSubcategoryOptions])

  const filteredExerciseDatabaseItems = useMemo(() => {
    const selectedIntensity = String(exerciseListFilters?.intensity || 'all')
    const selectedPlayersCount = String(exerciseListFilters?.playersCount || 'all')
    const selectedCategoryId = String(exerciseListFilters?.categoryId || 'all')
    const selectedSubcategory = String(exerciseListFilters?.subcategory || 'all')

    return (Array.isArray(exerciseDatabaseItems) ? exerciseDatabaseItems : []).filter((item) => {
      if (selectedIntensity !== 'all' && String(item?.intensity || '') !== selectedIntensity) {
        return false
      }

      if (selectedPlayersCount !== 'all') {
        const selectedValues = normalizeExercisePlayersCount(item?.playersCount)
        if (!selectedValues.includes(selectedPlayersCount)) return false
      }

      if (selectedCategoryId !== 'all') {
        const selectedItemCategoryIds = resolveSelectedExerciseCategoryIds(item?.selectedCategoryIds, item?.categorySelections)
        if (!selectedItemCategoryIds.includes(selectedCategoryId)) {
          return false
        }

        if (selectedSubcategory !== 'all') {
          const selectedSubcategories = Array.isArray(item?.categorySelections?.[selectedCategoryId])
            ? item.categorySelections[selectedCategoryId]
            : []
          if (!selectedSubcategories.includes(selectedSubcategory)) {
            return false
          }
        }
      }

      return true
    })
  }, [exerciseDatabaseItems, exerciseListFilters])

  const startExerciseCategoryDrag = (categoryId) => {
    setDraggedExerciseCategoryId(String(categoryId || ''))
  }

  const handleExerciseCategoryDragOver = (event, categoryId) => {
    event.preventDefault()
    setExerciseCategoryDropTargetId(String(categoryId || ''))
  }

  const handleExerciseCategoryDrop = (categoryId) => {
    const draggedId = String(draggedExerciseCategoryId || '')
    const targetId = String(categoryId || '')
    if (!draggedId || !targetId || draggedId === targetId) {
      setExerciseCategoryDropTargetId(null)
      return
    }

    setExerciseCategories((prev) => {
      const source = Array.isArray(prev) ? [...prev] : []
      const fromIndex = source.findIndex((item) => String(item?.id || '') === draggedId)
      const toIndex = source.findIndex((item) => String(item?.id || '') === targetId)
      if (fromIndex < 0 || toIndex < 0) return prev

      const [moved] = source.splice(fromIndex, 1)
      source.splice(toIndex, 0, moved)
      return source
    })

    setExerciseCategoryDropTargetId(null)
    setDraggedExerciseCategoryId(null)
  }

  const endExerciseCategoryDrag = () => {
    setExerciseCategoryDropTargetId(null)
    setDraggedExerciseCategoryId(null)
  }

  const startExerciseSubcategoryDrag = (index) => {
    setDraggedExerciseSubcategoryIndex(index)
  }

  const handleExerciseSubcategoryDragOver = (event, index) => {
    event.preventDefault()
    setExerciseSubcategoryDropTargetIndex(index)
  }

  const handleExerciseSubcategoryDrop = (index) => {
    const fromIndex = Number.isInteger(draggedExerciseSubcategoryIndex) ? draggedExerciseSubcategoryIndex : -1
    const toIndex = Number.isInteger(index) ? index : -1
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      setExerciseSubcategoryDropTargetIndex(null)
      return
    }

    setExerciseCategoryDraft((prev) => {
      const source = Array.isArray(prev.subcategories) ? [...prev.subcategories] : []
      if (source.length === 0) return prev
      const [moved] = source.splice(fromIndex, 1)
      source.splice(toIndex, 0, moved)
      return {
        ...prev,
        subcategories: source
      }
    })

    setExerciseSubcategoryDropTargetIndex(null)
    setDraggedExerciseSubcategoryIndex(null)
  }

  const endExerciseSubcategoryDrag = () => {
    setExerciseSubcategoryDropTargetIndex(null)
    setDraggedExerciseSubcategoryIndex(null)
  }

  const addTrainingDivisionGroupRow = () => {
    setTrainingDivisionDraft((prev) => ({
      ...prev,
      groups: [...(Array.isArray(prev.groups) ? prev.groups : ['']), '']
    }))
  }

  const updateTrainingDivisionGroupRow = (index, value) => {
    setTrainingDivisionDraft((prev) => ({
      ...prev,
      groups: (Array.isArray(prev.groups) ? prev.groups : ['']).map((item, itemIndex) => (
        itemIndex === index ? value : item
      ))
    }))
  }

  const removeTrainingDivisionGroupRow = (index) => {
    setTrainingDivisionDraft((prev) => {
      const currentRows = Array.isArray(prev.groups) ? prev.groups : ['']
      if (currentRows.length <= 1) {
        return {
          ...prev,
          groups: ['']
        }
      }
      return {
        ...prev,
        groups: currentRows.filter((_, itemIndex) => itemIndex !== index)
      }
    })
  }

  const fieldTypeLabelMap = useMemo(() => {
    return new Map(fieldTypeOptions.map((item) => [item.key, item.label]))
  }, [fieldTypeOptions])

  const getFieldSurfaceTypeLabel = (value) => {
    const key = String(value || '').trim()
    if (!key) return '—'
    return fieldTypeLabelMap.get(key) || key
  }

  const toggleTopBlockMetricCell = (rowId, metricId, checked) => {
    const resolvedRowId = String(rowId || '').trim()
    const resolvedMetricId = String(metricId || '').trim()
    if (!resolvedMetricId || !resolvedRowId) return

    setAttendanceDisplayDraft((prev) => ({
      ...prev,
      topBlockRows: (Array.isArray(prev.topBlockRows) ? prev.topBlockRows : []).map((row) => {
        if (String(row?.id || '') !== resolvedRowId) return row
        return {
          ...row,
          metrics: {
            ...(row?.metrics && typeof row.metrics === 'object' ? row.metrics : {}),
            [resolvedMetricId]: checked
          }
        }
      })
    }))
  }

  const toggleTableMetricCell = (metricId, checked) => {
    const resolvedMetricId = String(metricId || '').trim()
    if (!resolvedMetricId) return

    setAttendanceDisplayDraft((prev) => ({
      ...prev,
      tableColumns: {
        ...(prev?.tableColumns && typeof prev.tableColumns === 'object' ? prev.tableColumns : {}),
        [resolvedMetricId]: checked
      }
    }))
  }

  const toggleEvidenceMetricCell = (metricId, checked) => {
    const resolvedMetricId = String(metricId || '').trim()
    if (!resolvedMetricId) return

    setAttendanceDisplayDraft((prev) => ({
      ...prev,
      evidenceColumns: {
        ...(prev?.evidenceColumns && typeof prev.evidenceColumns === 'object' ? prev.evidenceColumns : {}),
        [resolvedMetricId]: checked
      }
    }))
  }

  const renameTopBlockRow = (rowId, value) => {
    const resolvedRowId = String(rowId || '').trim()
    if (!resolvedRowId) return
    setAttendanceDisplayDraft((prev) => ({
      ...prev,
      topBlockRows: (Array.isArray(prev.topBlockRows) ? prev.topBlockRows : []).map((row) => {
        if (String(row?.id || '') !== resolvedRowId) return row
        return { ...row, name: String(value || '') }
      })
    }))
  }

  const addTopBlockRow = () => {
    setAttendanceDisplayDraft((prev) => {
      const metricIds = displaySettingsMetrics.map((metric) => String(metric.id)).filter(Boolean)
      const currentRows = Array.isArray(prev.topBlockRows) ? prev.topBlockRows : []
      const nextIndex = currentRows.length + 1
      const newRow = buildDefaultTopBlockRow(metricIds, nextIndex - 1, `Karta ${nextIndex}`)

      return {
        ...prev,
        topBlockRows: [...currentRows, newRow]
      }
    })
  }

  const removeTopBlockRow = (rowId) => {
    const resolvedRowId = String(rowId || '').trim()
    if (!resolvedRowId) return

    setAttendanceDisplayDraft((prev) => {
      const nextRows = (Array.isArray(prev.topBlockRows) ? prev.topBlockRows : []).filter((row) => String(row?.id || '') !== resolvedRowId)
      return {
        ...prev,
        topBlockRows: nextRows.length > 0 ? nextRows : [buildDefaultTopBlockRow(displaySettingsMetrics.map((metric) => String(metric.id)).filter(Boolean), 0, 'Karta 1')]
      }
    })
  }

  const saveAttendanceDisplaySettings = async () => {
    if (!clubId) return

    try {
      setAttendanceDisplaySaving(true)
      setError('')
      setSuccess('')

      const normalized = normalizeAttendanceDisplayDraft(metrics, attendanceDisplayDraft)

      try {
        await api.updateAttendanceDisplaySettings(normalized)
      } catch (err) {
        // Older API deployments may not have the endpoint yet; keep UX functional via local fallback.
        if (!api.isEndpointNotFound(err)) {
          throw err
        }
      }

      setAttendanceDisplayDraft(normalized)

      try {
        localStorage.setItem(`attendanceDisplaySettings:${clubId}`, JSON.stringify(normalized))
      } catch {
        // no-op
      }

      setSuccess('Nastavenie zobrazenia ukazovateľov bolo uložené.')
    } catch (err) {
      setError(err.message || 'Nepodarilo sa uložiť nastavenie zobrazenia ukazovateľov.')
    } finally {
      setAttendanceDisplaySaving(false)
    }
  }

  const toggleMetricActive = async (metric, isActive) => {
    if (!metric?.id) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.updateMetric(metric.id, {
        name: metric.name,
        type: getPrimaryMetricType(metric),
        valueTypes: normalizeMetricValueTypes(metric),
        mode: metric.mode,
        isActive,
        formula: Array.isArray(metric.formula) ? metric.formula : []
      })
      setMetrics((prev) => prev.map((item) => (String(item.id) === String(metric.id) ? { ...item, isActive } : item)))
      setSuccess('Nastavenie ukazovateľa bolo uložené')
    } catch (err) {
      setError(err.message || 'Nepodarilo sa aktualizovať ukazovateľ')
    } finally {
      setLoading(false)
    }
  }

  const removeMetric = async (metric) => {
    if (!metric?.id) return
    if (metric.isDefault || isCalendarDaysMetric(metric)) {
      setError('Preddefinovaný ukazovateľ nie je možné zmazať, iba deaktivovať.')
      return
    }

    const blockedBy = metrics
      .filter((item) => String(item.id) !== String(metric.id))
      .filter((item) => collectFormulaDependencies(item.formula).has(String(metric.id)))

    if (blockedBy.length > 0) {
      setError(`Ukazovateľ nie je možné zmazať. Používajú ho vzorce: ${blockedBy.map((item) => item.name).join(', ')}`)
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteMetric(metric.id)
      setSuccess('Ukazovateľ bol odstránený')
      await fetchAttendanceMetrics()
      if (String(editingMetricId) === String(metric.id)) {
        cancelMetricEditor()
      }
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odstrániť ukazovateľ')
    } finally {
      setLoading(false)
    }
  }

  const createCategoryFromMembers = async () => {
    const name = String(categoryDraft.name || '').trim()
    const trainerLastName = String(categoryDraft.trainerName || '').trim()
    if (!name) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      if (editingCategoryId) {
        await api.updateTeam(editingCategoryId, { name, ageGroup: name })
        setSuccess('Kategória bola úspešne upravená')
        await fetchClubCategories()
      } else {
        const payload = { name, ageGroup: name }
        if (trainerLastName) {
          payload.trainerLastName = trainerLastName
        }

        const response = await api.createTeam(payload)
        setSuccess(
          response?.virtualCoachCreated
            ? 'Kategória bola úspešne vytvorená. Bol vytvorený imaginárny tréner, ktorého môžete upraviť v sekcii Tréneri.'
            : 'Kategória bola úspešne vytvorená'
        )
        await Promise.all([fetchClubCategories(), fetchMyClubMembers()])
      }

      setCategoryDraft({ name: '', trainerName: '', extraStaffNames: [] })
      setShowCategoryForm(false)
      setEditingCategoryId(null)
    } catch (err) {
      setError(err.message || (editingCategoryId ? 'Nepodarilo sa upraviť kategóriu' : 'Nepodarilo sa vytvoriť kategóriu'))
    } finally {
      setLoading(false)
    }
  }

  const toggleCategoryForm = () => {
    if (showCategoryForm) {
      setShowCategoryForm(false)
      setEditingCategoryId(null)
      setCategoryDraft({ name: '', trainerName: '', extraStaffNames: [] })
      return
    }

    setShowCategoryForm(true)
    setEditingCategoryId(null)
    setCategoryDraft({ name: '', trainerName: '', extraStaffNames: [] })
  }

  const editCategoryFromMembers = (team) => {
    if (!team) return

    setShowCategoryForm(true)
    setEditingCategoryId(team.id)
    setCategoryDraft({
      name: String(team.name || ''),
      trainerName: '',
      extraStaffNames: []
    })
  }

  const openCreateTrainerForm = () => {
    const defaultFunction = trainerFunctionOptions[0]
    setShowTrainerForm(true)
    setEditingTrainerId(null)
    setTrainerDraft({
      firstName: '',
      lastName: '',
      mobile: '',
      email: '',
      functionRole: defaultFunction?.baseRole === 'assistant' ? 'assistant' : 'coach',
      trainerFunctionId: defaultFunction?.id ? String(defaultFunction.id) : '',
      photo: '',
      photoFile: null,
      categoryIds: []
    })
  }

  const startEditTrainer = (member) => {
    const selectedCategoryIds = categories
      .filter((category) => Number(category.coachId) === Number(member.userId))
      .map((category) => category.id)
    const fallbackFunction = trainerFunctionOptions.find((item) => item.baseRole === member.role) || trainerFunctionOptions[0]

    setShowTrainerForm(true)
    setEditingTrainerId(member.userId)
    setTrainerDraft({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      mobile: member.mobile || '',
      email: member.email || '',
      functionRole: member.role === 'assistant' ? 'assistant' : 'coach',
      trainerFunctionId: fallbackFunction?.id ? String(fallbackFunction.id) : '',
      photo: member.photo || '',
      photoFile: null,
      categoryIds: member.role === 'assistant' ? [] : selectedCategoryIds
    })
  }

  const cancelEditTrainer = () => {
    const defaultFunction = trainerFunctionOptions[0]
    setEditingTrainerId(null)
    setShowTrainerForm(false)
    setTrainerDraft({
      firstName: '',
      lastName: '',
      mobile: '',
      email: '',
      functionRole: defaultFunction?.baseRole === 'assistant' ? 'assistant' : 'coach',
      trainerFunctionId: defaultFunction?.id ? String(defaultFunction.id) : '',
      photo: '',
      photoFile: null,
      categoryIds: []
    })
  }

  const openCreatePlayerForm = () => {
    setShowPlayerForm(true)
    setEditingPlayerId(null)
    setPlayerDraft({ firstName: '', lastName: '', personalId: '', mobile: '', email: '', photo: '', photoFile: null, categoryIds: [] })
  }

  const startEditPlayer = (member) => {
    setShowPlayerForm(true)
    setEditingPlayerId(member.userId)
    setPlayerDraft({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      personalId: member.personalId || '',
      mobile: member.mobile || '',
      email: member.email || '',
      photo: member.photo || '',
      photoFile: null,
      categoryIds: Array.isArray(member.categories) ? member.categories.map((item) => item.id) : []
    })
  }

  const cancelEditPlayer = () => {
    setEditingPlayerId(null)
    setShowPlayerForm(false)
    setPlayerDraft({ firstName: '', lastName: '', personalId: '', mobile: '', email: '', photo: '', photoFile: null, categoryIds: [] })
  }

  const togglePlayerCategory = (teamId, checked) => {
    setPlayerDraft((prev) => ({
      ...prev,
      categoryIds: checked
        ? [...new Set([...(prev.categoryIds || []), teamId])]
        : (prev.categoryIds || []).filter((id) => id !== teamId)
    }))
  }

  const openPlayerPhotoPicker = () => {
    playerPhotoInputRef.current?.click()
  }

  const handlePlayerPhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPlayerDraft((prev) => ({
      ...prev,
      photoFile: file
    }))
  }

  const clearPlayerPhoto = () => {
    setPlayerDraft((prev) => ({
      ...prev,
      photo: '',
      photoFile: null
    }))

    if (playerPhotoInputRef.current) {
      playerPhotoInputRef.current.value = ''
    }
  }

  const savePlayerFromMembers = async () => {
    const firstName = String(playerDraft.firstName || '').trim()
    const lastName = String(playerDraft.lastName || '').trim()
    const personalId = String(playerDraft.personalId || '').trim()
    const mobile = String(playerDraft.mobile || '').trim()
    const email = String(playerDraft.email || '').trim()

    if (!firstName || !lastName) {
      setError('Meno a priezvisko hráča sú povinné')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      let uploadedPhotoUrl = playerDraft.photo || ''
      if (playerDraft.photoFile) {
        const uploadResult = await api.uploadImage(playerDraft.photoFile, 'player-photos')
        uploadedPhotoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
      }

      const payload = {
        firstName,
        lastName,
        personalId,
        mobile,
        email,
        photo: uploadedPhotoUrl,
        categories: Array.isArray(playerDraft.categoryIds) ? playerDraft.categoryIds : []
      }

      const response = editingPlayerId
        ? await api.updateMyClubPlayer(editingPlayerId, payload)
        : await api.createMyClubPlayer(payload)

      setSuccess(response?.message || (editingPlayerId ? 'Hráč bol úspešne upravený' : 'Hráč bol úspešne pridaný'))
      await fetchMyClubMembers()
      cancelEditPlayer()
    } catch (err) {
      setError(err.message || (editingPlayerId ? 'Nepodarilo sa upraviť hráča' : 'Nepodarilo sa pridať hráča'))
    } finally {
      setLoading(false)
    }
  }

  const removePlayerFromMembers = async (member) => {
    if (!member?.userId) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.removeMyClubPlayer(member.userId)
      if (Number(editingPlayerId) === Number(member.userId)) {
        cancelEditPlayer()
      }
      setSuccess('Hráč bol odobratý z klubu')
      await fetchMyClubMembers()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odobrať hráča z klubu')
    } finally {
      setLoading(false)
    }
  }

  const toggleTrainerCategory = (teamId, checked) => {
    setTrainerDraft((prev) => ({
      ...prev,
      categoryIds: checked
        ? [...new Set([...(prev.categoryIds || []), teamId])]
        : (prev.categoryIds || []).filter((id) => id !== teamId)
    }))
  }

  const openTrainerPhotoPicker = () => {
    trainerPhotoInputRef.current?.click()
  }

  const handleTrainerPhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setTrainerDraft((prev) => ({
      ...prev,
      photoFile: file
    }))
  }

  const clearTrainerPhoto = () => {
    setTrainerDraft((prev) => ({
      ...prev,
      photo: '',
      photoFile: null
    }))

    if (trainerPhotoInputRef.current) {
      trainerPhotoInputRef.current.value = ''
    }
  }

  const saveTrainerFromMembers = async () => {
    const firstName = String(trainerDraft.firstName || '').trim()
    const lastName = String(trainerDraft.lastName || '').trim()
    const mobile = String(trainerDraft.mobile || '').trim()
    const email = String(trainerDraft.email || '').trim()
    const selectedFunction = trainerFunctionOptions.find((item) => String(item.id) === String(trainerDraft.trainerFunctionId || ''))
    const functionRole = selectedFunction?.baseRole === 'assistant' || trainerDraft.functionRole === 'assistant' ? 'assistant' : 'coach'

    if (!firstName || !lastName || !email) {
      setError('Meno, priezvisko a e-mail trénera sú povinné')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      let uploadedPhotoUrl = trainerDraft.photo || ''
      if (trainerDraft.photoFile) {
        const uploadResult = await api.uploadImage(trainerDraft.photoFile, 'trainer-photos')
        uploadedPhotoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
      }

      const payload = {
        firstName,
        lastName,
        mobile,
        email,
        functionRole,
        photo: uploadedPhotoUrl,
        categories: Array.isArray(trainerDraft.categoryIds) ? trainerDraft.categoryIds : []
      }

      let response
      if (editingTrainerId) {
        const editedMember = members.trainers.find((member) => Number(member.userId) === Number(editingTrainerId))
        response = await api.updateMyClubTrainer(editingTrainerId, {
          ...payload,
          convertToReal: Boolean(editedMember?.isVirtual)
        })
      } else {
        response = await api.createMyClubTrainer(payload)
      }

      setSuccess(response?.message || (editingTrainerId ? 'Tréner bol úspešne upravený' : 'Tréner bol úspešne pridaný'))
      await Promise.all([fetchMyClubMembers(), fetchClubCategories()])
      cancelEditTrainer()
    } catch (err) {
      setError(err.message || (editingTrainerId ? 'Nepodarilo sa uložiť trénera' : 'Nepodarilo sa pridať trénera'))
    } finally {
      setLoading(false)
    }
  }

  const deleteTrainerFromMembers = async (member) => {
    if (!member?.userId) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteMyClubTrainer(member.userId)
      if (editingTrainerId === member.userId) {
        cancelEditTrainer()
      }
      setSuccess('Tréner bol odobratý z klubu')
      await Promise.all([fetchMyClubMembers(), fetchClubCategories()])
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odobrať trénera')
    } finally {
      setLoading(false)
    }
  }

  const openRemovalConfirm = (type, payload) => {
    if (!type || !payload) return
    setConfirmDialog({ open: true, type, payload })
  }

  const closeRemovalConfirm = () => {
    setConfirmDialog({ open: false, type: null, payload: null })
  }

  const confirmRemoval = async () => {
    const payload = confirmDialog.payload
    const type = confirmDialog.type
    closeRemovalConfirm()

    if (type === 'player' && payload?.userId) {
      await removePlayerFromMembers(payload)
      return
    }

    if (type === 'trainer' && payload?.userId) {
      await deleteTrainerFromMembers(payload)
      return
    }

    if (type === 'category' && payload?.id) {
      await deleteCategoryFromMembers(payload)
      return
    }

    if (type === 'manager' && payload?.id) {
      await removeManager(payload.id)
      return
    }

    if (type === 'managerRole' && payload?.id) {
      await removeManagerRole(payload.id, payload.name)
      return
    }

    if (type === 'trainerFunction' && payload?.id) {
      await removeTrainerFunction(payload)
      return
    }

    if (type === 'draftPermission' && payload?.permission) {
      removeDraftPermission(payload.permission)
      return
    }

    if (type === 'metric' && payload?.id) {
      await removeMetric(payload)
      return
    }

    if (type === 'season' && payload?.id) {
      removeSeason(payload)
      return
    }

    if (type === 'field' && payload?.id) {
      removeField(payload)
      return
    }

    if (type === 'exerciseDatabaseItem' && payload?.id) {
      removeExerciseDatabaseItem(payload)
    }
  }

  const openEditingExerciseRemovalConfirm = () => {
    const editingId = String(editingExerciseDatabaseItemId || '').trim()
    if (!editingId) return
    const item = exerciseDatabaseItems.find((entry) => String(entry?.id || '').trim() === editingId)
    if (!item) return
    openRemovalConfirm('exerciseDatabaseItem', item)
  }

  const addExtraCategoryStaff = () => {
    setCategoryDraft((prev) => ({
      ...prev,
      extraStaffNames: [...prev.extraStaffNames, '']
    }))
  }

  const updateExtraCategoryStaff = (index, value) => {
    setCategoryDraft((prev) => ({
      ...prev,
      extraStaffNames: prev.extraStaffNames.map((item, itemIndex) => (itemIndex === index ? value : item))
    }))
  }

  const staffNameOptions = [...new Set(
    members.trainers.map((member) => `${member.firstName} ${member.lastName}`.trim()).filter(Boolean)
  )]

  const getDisplayTrainerName = (member) => {
    const firstName = String(member?.firstName || '').trim()
    const lastName = String(member?.lastName || '').trim()
    const isVirtualPlaceholder = Boolean(member?.isVirtual) && firstName.toLowerCase().includes('imagin')

    return [isVirtualPlaceholder ? '' : firstName, lastName].filter(Boolean).join(' ').trim()
  }

  const getTrainerCategoriesLabel = (member) => {
    const trainerId = Number(member?.userId)
    if (!trainerId) return '—'

    const names = categories
      .filter((category) => Number(category.coachId) === trainerId)
      .map((category) => String(category.name || '').trim())
      .filter(Boolean)

    return names.length > 0 ? names.join(', ') : '—'
  }

  const getPlayerCategoriesLabel = (member) => {
    const categoryNames = Array.isArray(member?.categories)
      ? member.categories.map((category) => String(category?.name || '').trim()).filter(Boolean)
      : []

    return categoryNames.length > 0 ? categoryNames.join(', ') : '—'
  }

  const playerLastNameSuggestions = [...new Set(
    (members.players || [])
      .map((member) => String(member?.lastName || '').trim())
      .filter(Boolean)
  )]

  const playerLastNamePrefixSuggestions = String(playerLastNameFilter || '').trim()
    ? playerLastNameSuggestions
      .filter((lastName) => lastName.toLowerCase().startsWith(String(playerLastNameFilter || '').trim().toLowerCase()))
      .slice(0, 6)
    : []

  useEffect(() => {
    if (playerLastNamePrefixSuggestions.length === 0) {
      setPlayerSuggestionsOpen(false)
    }
  }, [playerLastNamePrefixSuggestions.length])

  const playersCategoryOptions = [...new Map(
    categories
      .map((category) => [String(category.id), { id: category.id, name: String(category.name || '').trim() }])
  ).values()].filter((category) => category.name)

  const filteredPlayers = (members.players || []).filter((member) => {
    const memberLastName = String(member?.lastName || '').trim().toLowerCase()
    const surnameFilter = String(playerLastNameFilter || '').trim().toLowerCase()
    const byLastName = !surnameFilter || memberLastName.includes(surnameFilter)

    const memberCategoryIds = Array.isArray(member?.categories)
      ? member.categories.map((category) => String(category?.id))
      : []

    const byCategory = playerCategoryFilter === 'all'
      ? true
      : playerCategoryFilter === 'none'
        ? memberCategoryIds.length === 0
        : memberCategoryIds.includes(String(playerCategoryFilter))

    return byLastName && byCategory
  })

  const deleteCategoryFromMembers = async (team) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteTeam(team.id)
      setSuccess('Kategória bola úspešne odstránená')
      await fetchClubCategories()
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odstrániť kategóriu')
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryDragStart = (event, categoryId) => {
    setDraggedCategoryId(categoryId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(categoryId))
  }

  const handleCategoryDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleCategoryDrop = async (event, targetCategoryId) => {
    event.preventDefault()

    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId(null)
      return
    }

    const currentCategories = [...categories]
    const fromIndex = currentCategories.findIndex((item) => item.id === draggedCategoryId)
    const targetIndex = currentCategories.findIndex((item) => item.id === targetCategoryId)

    if (fromIndex === -1 || targetIndex === -1) {
      setDraggedCategoryId(null)
      return
    }

    const next = [...currentCategories]
    const [movedCategory] = next.splice(fromIndex, 1)
    next.splice(targetIndex, 0, movedCategory)

    setCategories(next)
    setDraggedCategoryId(null)

    try {
      await api.reorderTeams(next.map((item) => item.id), clubId)
      setError('')
      setSuccess('Poradie kategórií bolo uložené')
    } catch (err) {
      setError(err.message || 'Nepodarilo sa uložiť poradie kategórií')
      await fetchClubCategories()
    }
  }

  const handleCategoryDragEnd = () => {
    setDraggedCategoryId(null)
  }

  const handleMetricDragStart = (event, metricId) => {
    const resolvedId = String(metricId || '').trim()
    if (!resolvedId) return
    setDraggedMetricId(resolvedId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', resolvedId)
  }

  const handleMetricDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleMetricDrop = (event, targetMetricId) => {
    event.preventDefault()

    const sourceMetricId = String(draggedMetricId || '').trim()
    const targetId = String(targetMetricId || '').trim()

    if (!sourceMetricId || !targetId || sourceMetricId === targetId) {
      setDraggedMetricId(null)
      return
    }

    const currentMetrics = [...metrics]
    const fromIndex = currentMetrics.findIndex((item) => String(item?.id || '') === sourceMetricId)
    const targetIndex = currentMetrics.findIndex((item) => String(item?.id || '') === targetId)

    if (fromIndex === -1 || targetIndex === -1) {
      setDraggedMetricId(null)
      return
    }

    const next = [...currentMetrics]
    const [movedMetric] = next.splice(fromIndex, 1)
    next.splice(targetIndex, 0, movedMetric)

    setMetrics(next)
    setDraggedMetricId(null)

    try {
      const storageKey = `attendanceMetricsOrder:${clubId || 'global'}`
      localStorage.setItem(storageKey, JSON.stringify(next.map((item) => String(item?.id || '')).filter(Boolean)))
    } catch {
      // no-op
    }
  }

  const handleMetricDragEnd = () => {
    setDraggedMetricId(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setClub(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
    setSuccess('')
  }

  const openClubLogoPicker = () => {
    clubLogoInputRef.current?.click()
  }

  const handleClubLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setClub((prev) => ({
      ...prev,
      logoFile: file
    }))
    setError('')
    setSuccess('')
  }

  const clearClubLogo = () => {
    setClub((prev) => ({
      ...prev,
      logo: '',
      logoFile: null
    }))

    if (clubLogoInputRef.current) {
      clubLogoInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!club.name || !club.name.trim()) {
        setError('Názov klubu je povinný')
        setLoading(false)
        return
      }

      let uploadedLogoUrl = String(club.logo || '').trim()
      if (club.logoFile) {
        const uploadResult = await api.uploadClubLogo(club.logoFile)
        uploadedLogoUrl = uploadResult.fileUrl || uploadResult.relativePath || uploadedLogoUrl
      }

      const clubPayload = {
        ...club,
        logo: uploadedLogoUrl
      }
      delete clubPayload.logoFile
      delete clubPayload.ownerFirstName
      delete clubPayload.ownerLastName
      delete clubPayload.ownerEmail

      if (clubExists) {
        await api.updateMyClub(clubPayload)
        setSuccess('Nastavenia klubu boli úspešne uložené!')
      } else {
        const result = await api.createClub(clubPayload)
        setSuccess('Klub bol úspešne vytvorený!')
        setClubId(result?.clubId || null)
        setClubExists(true)
        await Promise.all([
          fetchMyClubMembers(),
          fetchClubCategories(),
          fetchManagersSetup(result?.clubId)
        ])
      }

      setClub((prev) => ({
        ...prev,
        logo: uploadedLogoUrl,
        logoFile: null
      }))

      setEditing(true)
    } catch (err) {
      console.error('Error saving club:', err)
      setError(err.message || 'Chyba pri ukladaní')
    } finally {
      setLoading(false)
    }
  }

  const toggleDraftPermission = (permission, checked) => {
    if (!permission) return
    setRoleDraft((prev) => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, permission])]
        : prev.permissions.filter((item) => item !== permission)
    }))
  }

  const removeDraftPermission = (permission) => {
    setRoleDraft((prev) => ({
      ...prev,
      permissions: prev.permissions.filter((item) => item !== permission)
    }))
  }

  const catalogPermissions = Object.entries(permissionCatalog || {}).flatMap(([groupName, permissions]) =>
    (permissions || []).map((permission) => ({
      key: `${groupName}__${permission}`,
      label: formatPermissionLabel(permission),
      value: permission
    }))
  )

  const fallbackPermissions = Object.keys(PERMISSION_LABELS).map((permission) => ({
    key: `fallback__${permission}`,
    label: formatPermissionLabel(permission),
    value: permission
  }))

  const requiredManagerPermissions = [
    { key: 'required__planner.manage', label: formatPermissionLabel('planner.manage'), value: 'planner.manage' },
    { key: 'required__fields.manage', label: formatPermissionLabel('fields.manage'), value: 'fields.manage' }
  ]

  const permissionOptions = [...(catalogPermissions.length > 0 ? catalogPermissions : fallbackPermissions), ...requiredManagerPermissions]
    .filter((option, index, array) => array.findIndex((item) => item.value === option.value) === index)

  useEffect(() => {
    if (activeSettingsSection !== 'fields') return
    if (canManageFieldsSection) return
    setActiveSettingsSection('managerRoles')
  }, [activeSettingsSection, canManageFieldsSection])

  const trainerFunctionOptions = Array.isArray(trainerFunctions) ? trainerFunctions : []

  const saveTrainerFunction = async () => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    const name = String(trainerFunctionDraft.name || '').trim()

    if (!name) {
      setError('Názov funkcie trénera je povinný')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      if (editingTrainerFunctionId) {
        await api.updateClubTrainerFunction(clubId, editingTrainerFunctionId, { name })
        setSuccess('Funkcia trénera bola upravená')
      } else {
        await api.createClubTrainerFunction(clubId, { name })
        setSuccess('Funkcia trénera bola uložená')
      }
      await fetchManagersSetup(clubId)
      setTrainerFunctionDraft({ name: '' })
      setEditingTrainerFunctionId(null)
      setShowTrainerFunctionForm(false)
    } catch (err) {
      setError(err.message || 'Nepodarilo sa uložiť funkciu trénera')
    } finally {
      setLoading(false)
    }
  }

  const removeTrainerFunction = async (functionItem) => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    if (!functionItem?.id) return
    if (functionItem?.isDefault) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteClubTrainerFunction(clubId, functionItem.id)
      setSuccess('Funkcia trénera bola odstránená')
      await fetchManagersSetup(clubId)
      if (Number(editingTrainerFunctionId) === Number(functionItem.id)) {
        setEditingTrainerFunctionId(null)
        setTrainerFunctionDraft({ name: '' })
        setShowTrainerFunctionForm(false)
      }
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odstrániť funkciu trénera')
    } finally {
      setLoading(false)
    }
  }

  const startEditTrainerFunction = (functionItem) => {
    if (!functionItem?.id || functionItem?.isDefault) return

    setEditingTrainerFunctionId(functionItem.id)
    setTrainerFunctionDraft({ name: functionItem.name || '' })
    setShowTrainerFunctionForm(true)
    setError('')
    setSuccess('')
  }

  const toggleVisibleSection = (roleKey, sectionKey, checked) => {
    setVisibleSectionsDraft((prev) => ({
      ...prev,
      [roleKey]: checked
        ? [...new Set([...(prev[roleKey] || []), sectionKey])]
        : (prev[roleKey] || []).filter((item) => item !== sectionKey)
    }))
  }

  const saveVisibleSections = async () => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    try {
      const payload = {
        club: normalizeVisibleSections(visibleSectionsDraft.club, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.club),
        coach: normalizeVisibleSections(visibleSectionsDraft.coach, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.coach),
        parent: normalizeVisibleSections(visibleSectionsDraft.parent, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.parent),
        player: normalizeVisibleSections(visibleSectionsDraft.player, DEFAULT_VISIBLE_SECTIONS_BY_ROLE.player)
      }

      await api.updateClubVisibleSections(clubId, { roles: payload })
      window.dispatchEvent(new CustomEvent('visible-sections-updated', { detail: { roles: payload } }))
      setSuccess('Nastavenie zobrazených sekcií bolo uložené')
      setError('')
    } catch {
      setError('Nepodarilo sa uložiť nastavenie zobrazených sekcií')
    }
  }

  const saveManagerRole = async () => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    if (!roleDraft.roleTitle.trim()) {
      setError('Názov roly správcu je povinný')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      if (editingRoleId) {
        await api.updateClubManagerRole(clubId, editingRoleId, {
          name: roleDraft.roleTitle,
          permissions: roleDraft.permissions
        })
      } else {
        await api.createClubManagerRole(clubId, {
          name: roleDraft.roleTitle,
          permissions: roleDraft.permissions
        })
      }

      setSuccess(editingRoleId ? 'Rola správcu bola upravená' : 'Rola správcu a oprávnenia boli uložené')
      await fetchManagersSetup(clubId)
      setRoleDraft({ roleTitle: '', permissions: [] })
      setEditingRoleId(null)
    } catch (err) {
      setError(err.message || (editingRoleId ? 'Nepodarilo sa upraviť rolu správcu' : 'Nepodarilo sa uložiť rolu správcu'))
    } finally {
      setLoading(false)
    }
  }

  const startEditRole = (role) => {
    if (!role) return
    setShowManagerRoleForm(true)
    setRoleDraft({
      roleTitle: role.name || '',
      permissions: Array.isArray(role.permissions) ? role.permissions : []
    })
    setEditingRoleId(role.id)
    setError('')
    setSuccess('')
  }

  const cancelEditRole = () => {
    setRoleDraft({ roleTitle: '', permissions: [] })
    setEditingRoleId(null)
  }

  const removeManagerRole = async (roleId, roleName) => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteClubManagerRole(clubId, roleId)
      if (editingRoleId === roleId) {
        setRoleDraft({ roleTitle: '', permissions: [] })
        setEditingRoleId(null)
      }
      setSuccess('Rola správcu bola odstránená')
      await fetchManagersSetup(clubId)
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odstrániť rolu správcu')
    } finally {
      setLoading(false)
    }
  }

  const createManager = async () => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    if (!managerDraft.firstName.trim() || !managerDraft.lastName.trim() || !managerDraft.email.trim()) {
      setError('Meno, priezvisko a email sú povinné')
      return
    }

    const roleId = Number(managerDraft.roleId)
    if (!roleId) {
      setError('Vyberte rolu správcu')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      let uploadedPhotoUrl = managerDraft.photo || ''
      if (managerDraft.photoFile) {
        const uploadResult = await api.uploadImage(managerDraft.photoFile, 'manager-photos')
        uploadedPhotoUrl = uploadResult.fileUrl || uploadResult.relativePath || ''
      }

      if (editingManagerId) {
        await api.updateClubManager(clubId, editingManagerId, {
          firstName: managerDraft.firstName,
          lastName: managerDraft.lastName,
          email: managerDraft.email,
          mobile: managerDraft.mobile,
          photo: uploadedPhotoUrl,
          roleId
        })
        setSuccess('Správca klubu bol upravený')
      } else {
        await api.createClubManager(clubId, {
          firstName: managerDraft.firstName,
          lastName: managerDraft.lastName,
          email: managerDraft.email,
          mobile: managerDraft.mobile,
          photo: uploadedPhotoUrl,
          roleId
        })
        setSuccess('Správca klubu bol pridaný')
      }

      await fetchManagersSetup(clubId)
      setManagerDraft({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', photo: '', photoFile: null })
      setEditingManagerId(null)
    } catch (err) {
      setError(err.message || (editingManagerId ? 'Nepodarilo sa upraviť správcu klubu' : 'Nepodarilo sa pridať správcu klubu'))
    } finally {
      setLoading(false)
    }
  }

  const startEditManager = (manager) => {
    if (!manager) return

    setShowManagerForm(true)

    setManagerDraft({
      firstName: manager.firstName || '',
      lastName: manager.lastName || '',
      email: manager.email || '',
      mobile: manager.mobile || '',
      roleId: manager.roleId ? String(manager.roleId) : '',
      photo: manager.photo || '',
      photoFile: null
    })
    setEditingManagerId(manager.id)
    setError('')
    setSuccess('')
  }

  const cancelEditManager = () => {
    setEditingManagerId(null)
    setManagerDraft({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', photo: '', photoFile: null })
  }

  const openManagerPhotoPicker = () => {
    managerPhotoInputRef.current?.click()
  }

  const handleManagerPhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setManagerDraft((prev) => ({
      ...prev,
      photoFile: file
    }))
  }

  const clearManagerPhoto = () => {
    setManagerDraft((prev) => ({
      ...prev,
      photo: '',
      photoFile: null
    }))

    if (managerPhotoInputRef.current) {
      managerPhotoInputRef.current.value = ''
    }
  }

  const removeManager = async (managerId) => {
    if (!clubId) {
      setError('Klub nebol nájdený')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await api.deleteClubManager(clubId, managerId)
      setSuccess('Správca klubu bol odobratý')
      await fetchManagersSetup(clubId)
      if (editingManagerId === managerId) {
        setEditingManagerId(null)
        setManagerDraft({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', photo: '', photoFile: null })
      }
    } catch (err) {
      setError(err.message || 'Nepodarilo sa odobrať správcu klubu')
    } finally {
      setLoading(false)
    }
  }

  const metricsSorted = [...metrics]
  const displaySettingsMetrics = metricsSorted.filter((metric) => metric?.isActive !== false)

  const activeMetricsCount = metrics.filter((metric) => metric.isActive).length
  const availableFormulaMetrics = metrics.filter((metric) => String(metric.id) !== String(editingMetricId || ''))

  const getFormulaNodeLabel = (node, options = {}) => {
    const preferShortName = Boolean(options.preferShortName)
    if (!node) return '—'
    if (node.type === 'literal') {
      const literalLabel = getLiteralRawValue(node)
      return literalLabel || String(node.value ?? '')
    }
    if (node.type === 'operator') {
      if (node.op === '*') return '×'
      if (node.op === '/') return '÷'
      return node.op || '?'
    }

    if (node.type === 'variable') {
      const metric = metrics.find((item) => String(item.id) === String(node.metricId))
      if (!metric) return 'Neznáma premenná'
      const shortName = String(metric.shortName || '').trim()
      if (preferShortName && shortName) return shortName
      return metric.name || shortName || 'Neznáma premenná'
    }

    if (node.type === 'function') {
      const args = Array.isArray(node.args) ? node.args : []
      const labels = args.map((arg) => getFormulaNodeLabel(arg, options)).join(', ')
      return `${node.fn || 'FN'}(${labels})`
    }

    return '—'
  }

  const formulaDraftSummary = formulaDraft.map((node) => getFormulaNodeLabel(node)).join(' ')

  const confirmDialogConfig = (() => {
    const payload = confirmDialog.payload || {}
    const fullName = `${payload.firstName || ''} ${payload.lastName || ''}`.trim()

    if (confirmDialog.type === 'player') {
      return {
        title: 'Potvrdiť odobratie hráča',
        message: `Naozaj chcete odobrať hráča „${fullName}“ z klubu? Hráč nebude zmazaný, iba odobratý z tohto klubu.`,
        confirmLabel: 'Potvrdiť odobratie'
      }
    }

    if (confirmDialog.type === 'trainer') {
      return {
        title: 'Potvrdiť odobratie trénera',
        message: `Naozaj chcete odobrať trénera „${fullName}“ z klubu? Tréner nebude zmazaný, iba odobratý z tohto klubu.`,
        confirmLabel: 'Potvrdiť odobratie'
      }
    }

    if (confirmDialog.type === 'category') {
      return {
        title: 'Potvrdiť odstránenie kategórie',
        message: `Naozaj chcete odstrániť kategóriu „${payload.name || 'kategória'}“?`,
        confirmLabel: 'Potvrdiť odstránenie'
      }
    }

    if (confirmDialog.type === 'manager') {
      return {
        title: 'Potvrdiť odobratie správcu',
        message: `Naozaj chcete odobrať správcu „${fullName}“ z klubu?`,
        confirmLabel: 'Potvrdiť odobratie'
      }
    }

    if (confirmDialog.type === 'managerRole') {
      return {
        title: 'Potvrdiť odstránenie roly',
        message: `Naozaj chcete odstrániť rolu „${payload.name || 'správcu'}“?`,
        confirmLabel: 'Potvrdiť odstránenie'
      }
    }

    if (confirmDialog.type === 'trainerFunction') {
      return {
        title: 'Potvrdiť odstránenie funkcie',
        message: `Naozaj chcete odstrániť funkciu „${payload.name || 'tréner'}“?`,
        confirmLabel: 'Potvrdiť odstránenie'
      }
    }

    if (confirmDialog.type === 'draftPermission') {
      return {
        title: 'Potvrdiť odobratie funkcie',
        message: `Naozaj chcete odobrať funkciu „${formatPermissionLabel(payload.permission || '')}“ z tejto roly?`,
        confirmLabel: 'Potvrdiť odobratie'
      }
    }

    if (confirmDialog.type === 'metric') {
      return {
        title: 'Potvrdiť odstránenie ukazovateľa',
        message: `Naozaj chcete odstrániť ukazovateľ „${payload.name || 'ukazovateľ'}“?`,
        confirmLabel: 'Potvrdiť odstránenie'
      }
    }

    if (confirmDialog.type === 'season') {
      return {
        title: 'Potvrdiť odstránenie sezóny',
        message: `Naozaj chcete odstrániť sezónu „${payload.name || 'sezóna'}“?`,
        confirmLabel: 'Potvrdiť odstránenie'
      }
    }

    if (confirmDialog.type === 'field') {
      return {
        title: 'Potvrdiť odstránenie ihriska',
        message: `Naozaj chcete odstrániť ihrisko „${payload.name || 'ihrisko'}“?`,
        confirmLabel: 'Potvrdiť odstránenie'
      }
    }

    if (confirmDialog.type === 'exerciseDatabaseItem') {
      return {
        title: 'Potvrdiť odstránenie cvičenia',
        message: `Naozaj chcete odstrániť cvičenie „${payload.name || 'cvičenie'}“?`,
        confirmLabel: 'Odstrániť cvičenie'
      }
    }

    return {
      title: 'Potvrdiť akciu',
      message: 'Naozaj chcete pokračovať?',
      confirmLabel: 'Potvrdiť'
    }
  })()

  return (
    <div className="my-club-container">
      <div className="club-header">
        <div>
          <h1>Nastavenia klubu</h1>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="club-tabs" role="navigation" aria-label="Sekcie nastavení klubu">
        <button
          type="button"
          className={`club-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          Informácie o klube
        </button>
        {clubExists && (
          <button
            type="button"
            className={`club-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Členovia klubu
          </button>
        )}
        {clubExists && (
          <button
            type="button"
            className={`club-tab ${activeTab === 'exerciseDatabase' ? 'active' : ''}`}
            onClick={() => setActiveTab('exerciseDatabase')}
          >
            Databáza cvičení
          </button>
        )}
        {clubExists && (
          <button
            type="button"
            className={`club-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Nastavenia
          </button>
        )}
      </div>

      {activeTab === 'basic' && (
        <form onSubmit={handleSubmit} className="club-settings-form">
          <div className="form-section settings-layout members-layout">
            <aside className="card settings-sidebar-card" aria-label="Základné informácie - navigácia sekcií">
              <nav className="settings-submenu" aria-label="Submenu základných informácií">
                <a
                  href="#"
                  className={`settings-submenu-item ${activeBasicSection === 'basicInfo' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveBasicSection('basicInfo')
                  }}
                  aria-current={activeBasicSection === 'basicInfo' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">info</span>
                  <span>Základné informácie</span>
                </a>

                <a
                  href="#"
                  className={`settings-submenu-item ${activeBasicSection === 'contactInfo' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveBasicSection('contactInfo')
                  }}
                  aria-current={activeBasicSection === 'contactInfo' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">contact_support</span>
                  <span>Kontaktné údaje</span>
                </a>

                <a
                  href="#"
                  className={`settings-submenu-item ${activeBasicSection === 'clubAdmin' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveBasicSection('clubAdmin')
                  }}
                  aria-current={activeBasicSection === 'clubAdmin' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">manage_accounts</span>
                  <span>Admin klubu</span>
                </a>

                <a
                  href="#"
                  className={`settings-submenu-item ${activeBasicSection === 'banking' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveBasicSection('banking')
                  }}
                  aria-current={activeBasicSection === 'banking' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">account_balance</span>
                  <span>Bankové spojenie</span>
                </a>
              </nav>
            </aside>

            <div className="settings-main">
            {activeBasicSection === 'basicInfo' && (
              <>
              <div id="sekcia-zakladne" className="panel-card">
                <h2><span className="section-icon material-icons-round">info</span>Základné informácie</h2>

                <div className="form-group">
                  <label htmlFor="name">Názov klubu *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={club.name}
                    onChange={handleInputChange}
                    placeholder="Názov klubu"
                    required
                    disabled={clubExists || loading}
                  />
                </div>

                <div className="form-group">
                  <input
                    ref={clubLogoInputRef}
                    type="file"
                    id="club-logo"
                    name="club-logo"
                    accept="image/*"
                    onChange={handleClubLogoChange}
                    style={{ display: 'none' }}
                  />

                  <label htmlFor="club-logo">Logo klubu</label>
                  <div className="manager-photo-upload-row">
                    <input
                      type="text"
                      readOnly
                      value={club.logoFile ? club.logoFile.name : club.logo ? 'Logo nahrané' : 'Pridať logo klubu'}
                      className="manager-photo-upload-display"
                      onClick={openClubLogoPicker}
                    />
                    <button type="button" className="manager-photo-upload-trigger" onClick={openClubLogoPicker}>
                      pridať logo
                    </button>
                    <button
                      type="button"
                      className="manager-photo-remove-btn"
                      onClick={clearClubLogo}
                      aria-label="Odstrániť logo klubu"
                      title="Odstrániť logo"
                      disabled={!(club.logoFile || club.logo)}
                    >
                      <span className="material-icons-round" aria-hidden="true">delete</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="address">Adresa</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={club.address}
                    onChange={handleInputChange}
                    placeholder="Ulica a číslo"
                    disabled={loading}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">Mesto</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={club.city}
                      onChange={handleInputChange}
                      placeholder="Mesto"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="country">Krajina</label>
                    <select
                      id="country"
                      name="country"
                      value={club.country}
                      onChange={handleInputChange}
                      disabled={loading}
                    >
                      <option value="SK">Slovensko</option>
                      <option value="CZ">Česko</option>
                      <option value="PL">Poľsko</option>
                      <option value="HU">Maďarsko</option>
                      <option value="AT">Rakúsko</option>
                    </select>
                  </div>
                </div>

              </div>
              <div className="form-actions basic-section-actions">
                <button
                  type="submit"
                  className="manager-add-btn basic-save-btn"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
              </div>
              </>
            )}

            {activeBasicSection === 'contactInfo' && (
              <>
              <div id="sekcia-kontakt" className="panel-card">
                <h2><span className="section-icon material-icons-round">contact_support</span>Kontaktné údaje</h2>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={club.email}
                    onChange={handleInputChange}
                    placeholder="kontakt@klub.sk"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Telefón</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={club.phone}
                    onChange={handleInputChange}
                    placeholder="+421 900 123 456"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="website">Web stránka</label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={club.website}
                    onChange={handleInputChange}
                    placeholder="https://www.klub.sk"
                    disabled={loading}
                  />
                </div>

              </div>
              <div className="form-actions basic-section-actions">
                <button
                  type="submit"
                  className="manager-add-btn basic-save-btn"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
              </div>
              </>
            )}

            {activeBasicSection === 'clubAdmin' && (
              <>
              <div className="panel-card">
                <h2><span className="section-icon material-icons-round">manage_accounts</span>Admin klubu</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="owner-first-name">Meno</label>
                    <input
                      type="text"
                      id="owner-first-name"
                      value={club.ownerFirstName || ''}
                      placeholder="Meno admina"
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="owner-last-name">Priezvisko</label>
                    <input
                      type="text"
                      id="owner-last-name"
                      value={club.ownerLastName || ''}
                      placeholder="Priezvisko admina"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="owner-email">Email</label>
                  <input
                    type="email"
                    id="owner-email"
                    value={club.ownerEmail || ''}
                    placeholder="admin@klub.sk"
                    disabled
                  />
                </div>
              </div>
              <div className="form-actions basic-section-actions">
                <button
                  type="submit"
                  className="manager-add-btn basic-save-btn"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
              </div>
              </>
            )}

            {activeBasicSection === 'banking' && (
              <>
              <div className="panel-card">
                <h2><span className="section-icon material-icons-round">account_balance</span>Bankové spojenie</h2>

                <div className="form-group">
                  <label htmlFor="bank-name">Názov banky</label>
                  <input
                    type="text"
                    id="bank-name"
                    name="bankName"
                    value={club.bankName}
                    onChange={handleInputChange}
                    placeholder="Názov banky"
                    disabled={loading}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="swift-code">SWIFT kód</label>
                    <input
                      type="text"
                      id="swift-code"
                      name="swiftCode"
                      value={club.swiftCode}
                      onChange={handleInputChange}
                      placeholder="SWIFT/BIC"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="account-holder-name">Meno majiteľa účtu</label>
                    <input
                      type="text"
                      id="account-holder-name"
                      name="accountHolderName"
                      value={club.accountHolderName}
                      onChange={handleInputChange}
                      placeholder="Meno majiteľa účtu"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="iban">IBAN</label>
                  <input
                    type="text"
                    id="iban"
                    name="iban"
                    value={club.iban}
                    onChange={handleInputChange}
                    placeholder="SK.. .... .... .... .... ...."
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="form-actions basic-section-actions">
                <button
                  type="submit"
                  className="manager-add-btn basic-save-btn"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
              </div>
              </>
            )}
            </div>
          </div>
        </form>
      )}

      {clubExists && activeTab === 'members' && (
        <div id="sekcia-clenovia" className="form-section" style={{ marginTop: '24px' }}>
          <div className="settings-layout members-layout">
            <aside className="card settings-sidebar-card" aria-label="Členovia klubu - navigácia sekcií">
              <nav className="settings-submenu" aria-label="Submenu členovia klubu">
                <a
                  href="#"
                  className={`settings-submenu-item ${activeMembersSection === 'categories' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveMembersSection('categories')
                  }}
                  aria-current={activeMembersSection === 'categories' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">category</span>
                  <span>Kategórie</span>
                </a>

                <a
                  href="#"
                  className={`settings-submenu-item ${activeMembersSection === 'coaches' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveMembersSection('coaches')
                  }}
                  aria-current={activeMembersSection === 'coaches' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">school</span>
                  <span>Tréneri</span>
                </a>

                <a
                  href="#"
                  className={`settings-submenu-item ${activeMembersSection === 'players' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveMembersSection('players')
                  }}
                  aria-current={activeMembersSection === 'players' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">sports_soccer</span>
                  <span>Hráči</span>
                </a>

                <a
                  href="#"
                  className={`settings-submenu-item ${activeMembersSection === 'managers' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveMembersSection('managers')
                  }}
                  aria-current={activeMembersSection === 'managers' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">manage_accounts</span>
                  <span>Správcovia</span>
                </a>
              </nav>
            </aside>

            <div className="settings-main">
            {activeMembersSection === 'categories' && (
              <div className="members-categories-stack">
                <div className="card members-card members-count-card">
                  <div className="members-card-bg">
                    <span className="material-icons-round">category</span>
                  </div>
                  <h3 style={{ marginBottom: '6px' }}><span className="section-icon material-icons-round">category</span>Počet kategórií</h3>
                  <div className="members-count">{categories.length} <span>kategórií</span></div>
                </div>

                <div className="card members-card members-categories-list-card">
                  <h3 style={{ marginBottom: '10px' }}>Zoznam kategórií</h3>

                  {categories.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Zatiaľ neexistujú žiadne kategórie</p>
                  ) : (
                    categories.map((team) => (
                      <div
                        key={team.id}
                        className={`member-category-row ${draggedCategoryId === team.id ? 'dragging' : ''}`}
                        draggable={!loading}
                        onDragStart={(event) => handleCategoryDragStart(event, team.id)}
                        onDragOver={handleCategoryDragOver}
                        onDrop={(event) => handleCategoryDrop(event, team.id)}
                        onDragEnd={handleCategoryDragEnd}
                      >
                        <div className="member-category-main">
                          <span className="material-icons-round member-category-drag-icon" aria-hidden="true">drag_indicator</span>
                          <div>
                            <strong>{team.name}</strong>
                            {String(team.ageGroup || '').trim() && String(team.ageGroup || '').trim() !== String(team.name || '').trim() ? (
                              <div className="member-category-meta">{team.ageGroup}</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="member-category-actions">
                          <button
                            type="button"
                            className="role-action-btn role-action-edit"
                            onClick={() => editCategoryFromMembers(team)}
                            disabled={loading}
                            aria-label={`Upraviť kategóriu ${team.name}`}
                            title="Upraviť kategóriu"
                          >
                            <span className="material-icons-round" aria-hidden="true">edit</span>
                          </button>
                          <button
                            type="button"
                            className="role-action-btn role-action-delete"
                            onClick={() => openRemovalConfirm('category', team)}
                            disabled={loading}
                            aria-label={`Odstrániť kategóriu ${team.name}`}
                            title="Odstrániť kategóriu"
                          >
                            <span className="material-icons-round" aria-hidden="true">delete</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="members-categories-actions">
                  <button
                    type="button"
                    className={`manager-add-btn ${showCategoryForm ? 'category-form-toggle-cancel' : ''}`}
                    onClick={toggleCategoryForm}
                    disabled={loading}
                  >
                    {showCategoryForm ? 'Zrušiť formulár' : (editingCategoryId ? 'Upraviť kategóriu' : 'Vytvoriť kategóriu')}
                  </button>
                </div>

                {showCategoryForm ? (
                  <div ref={categoryFormRef} className="card members-category-form-card">
                    <div className="form-group">
                      <label htmlFor="members-category-name">Názov kategórie</label>
                      <input
                        id="members-category-name"
                        type="text"
                        value={categoryDraft.name}
                        onChange={(e) => setCategoryDraft((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Názov kategórie"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="members-category-trainer">Tréner kategórie</label>
                      <input
                        id="members-category-trainer"
                        type="text"
                        list="members-category-staff-options"
                        value={categoryDraft.trainerName}
                        onChange={(e) => setCategoryDraft((prev) => ({ ...prev, trainerName: e.target.value }))}
                        placeholder="Priezvisko trenera"
                      >
                      </input>
                    </div>

                    <datalist id="members-category-staff-options">
                      {staffNameOptions.map((name) => (
                        <option key={`staff-option-${name}`} value={name} />
                      ))}
                    </datalist>

                    {categoryDraft.extraStaffNames.map((staffName, index) => (
                      <div className="form-group" key={`extra-staff-${index}`}>
                        <label htmlFor={`members-category-extra-${index}`}>Ďalší tréner/asistent</label>
                        <input
                          id={`members-category-extra-${index}`}
                          type="text"
                          list="members-category-staff-options"
                          value={staffName}
                          onChange={(e) => updateExtraCategoryStaff(index, e.target.value)}
                          placeholder="Začnite písať meno"
                        >
                        </input>
                      </div>
                    ))}

                    {categoryDraft.trainerName.trim() ? (
                      <div className="category-trainer-actions">
                        <button
                          type="button"
                          className="category-add-staff-btn"
                          onClick={addExtraCategoryStaff}
                          disabled={loading}
                        >
                          Pridať ďalšieho trénera (asistenta)
                        </button>
                      </div>
                    ) : null}

                    <div className="form-actions">
                      <button
                        type="button"
                        className="manager-add-btn"
                        onClick={createCategoryFromMembers}
                        disabled={loading}
                      >
                        {editingCategoryId ? 'Uložiť úpravy' : 'Uložiť'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeMembersSection === 'coaches' && (
            <div className="members-categories-stack">
              <div className="card members-card members-count-card players-count-card">
                <div className="members-card-bg">
                  <span className="material-icons-round">school</span>
                </div>
                <h3 style={{ marginBottom: '6px' }}><span className="section-icon material-icons-round">school</span>Počet trénerov</h3>
                <div className="members-count">{members.totals.trainers || 0} <span>členov</span></div>
              </div>
              <div className="card members-card members-categories-list-card">
                <h3 style={{ marginBottom: '10px' }}>Zoznam trénerov</h3>

                {members.trainers.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Zatiaľ žiadni tréneri ani asistenti</p>
                ) : (
                  <div className="manager-table manager-table-trainers">
                    <div className="manager-table-head">
                      <div>Meno a Priezvisko</div>
                      <div>Mobil</div>
                      <div>Kategória</div>
                      <div className="manager-table-actions-head">Akcie</div>
                    </div>

                    {members.trainers.map((member) => (
                      <div key={member.userId} className="manager-table-row">
                        <div className="manager-table-name">
                          <div className="manager-name-with-photo">
                            <div className="manager-avatar" aria-hidden="true">
                              {member.photo ? <img src={resolveMediaUrl(member.photo)} alt="" /> : <span className="material-icons-round">person</span>}
                            </div>
                            <div>
                              <strong>
                                <span>{Boolean(member.isVirtual) && String(member.firstName || '').trim().toLowerCase().includes('imagin') ? '' : String(member.firstName || '').trim()}</span>{' '}
                                <span className={member.isVirtual ? 'virtual-trainer-surname' : ''}>{member.lastName}</span>
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="manager-table-email">{String(member.mobile || '').trim() || '—'}</div>

                        <div className="manager-table-email">{getTrainerCategoriesLabel(member)}</div>

                        <div className="manager-table-actions">
                          {member.role === 'coach' ? (
                            <>
                              <button
                                type="button"
                                className="role-action-btn role-action-edit"
                                onClick={() => startEditTrainer(member)}
                                disabled={loading}
                                aria-label={`Upraviť trénera ${getDisplayTrainerName(member)}`}
                                title={member.isVirtual ? 'Upraviť a spraviť reálneho' : 'Upraviť trénera'}
                              >
                                <span className="material-icons-round" aria-hidden="true">edit</span>
                              </button>
                              <button
                                type="button"
                                className="role-action-btn role-action-delete"
                                onClick={() => openRemovalConfirm('trainer', member)}
                                disabled={loading}
                                aria-label={`Odstrániť trénera ${getDisplayTrainerName(member)}`}
                                title="Odstrániť trénera"
                              >
                                <span className="material-icons-round" aria-hidden="true">delete</span>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="members-categories-actions">
                <button
                  type="button"
                  className={`manager-add-btn ${showTrainerForm ? 'category-form-toggle-cancel' : ''}`}
                  onClick={() => {
                    if (showTrainerForm) {
                      cancelEditTrainer()
                    } else {
                      openCreateTrainerForm()
                    }
                  }}
                  disabled={loading}
                >
                  {showTrainerForm ? 'Zrušiť formulár' : 'Pridať trénera'}
                </button>
              </div>

              {showTrainerForm ? (
                <div ref={trainerFormRef} className="card members-category-form-card">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Meno trénera</label>
                        <input
                          type="text"
                          value={trainerDraft.firstName}
                          onChange={(e) => setTrainerDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                          placeholder="Meno"
                        />
                      </div>

                      <div className="form-group">
                        <label>Priezvisko trénera</label>
                        <input
                          type="text"
                          value={trainerDraft.lastName}
                          onChange={(e) => setTrainerDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Priezvisko"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Mobil</label>
                        <input
                          type="text"
                          value={trainerDraft.mobile}
                          onChange={(e) => setTrainerDraft((prev) => ({ ...prev, mobile: e.target.value }))}
                          placeholder="Mobil trénera"
                        />
                      </div>

                      <div className="form-group">
                        <label>E-mail trénera</label>
                        <input
                          type="email"
                          value={trainerDraft.email}
                          onChange={(e) => setTrainerDraft((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="Email trénera"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Funkcia</label>
                        <select
                          value={trainerDraft.trainerFunctionId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value
                            const selected = trainerFunctionOptions.find((item) => String(item.id) === String(selectedId))
                            setTrainerDraft((prev) => ({
                              ...prev,
                              trainerFunctionId: selectedId,
                              functionRole: selected?.baseRole === 'assistant' ? 'assistant' : 'coach',
                              categoryIds: selected?.baseRole === 'assistant' ? [] : prev.categoryIds
                            }))
                          }}
                        >
                          {trainerFunctionOptions.length === 0 ? (
                            <option value="">Najprv vytvorte funkcie trénerov</option>
                          ) : (
                            trainerFunctionOptions.map((trainerFunction) => (
                              <option key={`trainer-function-${trainerFunction.id}`} value={trainerFunction.id}>
                                {trainerFunction.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Kategórie</label>
                        <details className="manager-permissions-dropdown">
                          <summary className="manager-permissions-trigger">
                            {(trainerDraft.categoryIds || []).length > 0
                              ? `Vybrané kategórie: ${(trainerDraft.categoryIds || []).length}`
                              : 'Vyberte kategórie'}
                          </summary>

                          <div className="manager-permissions-menu" role="group" aria-label="Výber kategórií trénera">
                            {categories.length === 0 ? (
                              <p className="manager-empty-text" style={{ margin: 0 }}>Najprv vytvorte kategórie.</p>
                            ) : (
                              categories.map((team) => (
                                <label key={`trainer-category-${team.id}`} className="manager-permission-item">
                                  <input
                                    type="checkbox"
                                    checked={(trainerDraft.categoryIds || []).includes(team.id)}
                                    onChange={(e) => toggleTrainerCategory(team.id, e.target.checked)}
                                  />
                                  <span>{team.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </details>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group trainer-photo-full-row">
                        <label>Fotka</label>
                        <div className="manager-photo-upload-row">
                          <input
                            ref={trainerPhotoInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleTrainerPhotoChange}
                          />

                          <input
                            type="text"
                            readOnly
                            value={trainerDraft.photoFile ? trainerDraft.photoFile.name : trainerDraft.photo ? 'Fotka nahraná' : 'Pridať fotku trénera'}
                            className="manager-photo-upload-display"
                            onClick={openTrainerPhotoPicker}
                          />
                          <button type="button" className="manager-photo-upload-trigger" onClick={openTrainerPhotoPicker}>
                            pridať fotku
                          </button>
                          <button
                            type="button"
                            className="manager-photo-remove-btn"
                            onClick={clearTrainerPhoto}
                            aria-label="Odstrániť fotku trénera"
                            title="Odstrániť fotku"
                            disabled={!(trainerDraft.photoFile || trainerDraft.photo)}
                          >
                            <span className="material-icons-round" aria-hidden="true">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="manager-add-btn"
                        onClick={saveTrainerFromMembers}
                        disabled={loading}
                      >
                        {editingTrainerId ? 'Uložiť trénera' : 'Pridať trénera'}
                      </button>
                    </div>
                </div>
              ) : null}
            </div>
            )}

            {activeMembersSection === 'players' && (
            <div className="members-categories-stack">
              <div className="card members-card members-count-card">
                <div className="members-card-bg">
                  <span className="material-icons-round">sports_soccer</span>
                </div>
                <h3 style={{ marginBottom: '6px' }}><span className="section-icon material-icons-round">sports_soccer</span>Počet hráčov</h3>
                <div className="players-count-toolbar">
                  <div className="members-count">{members.totals.players || 0} <span>členov</span></div>

                  <div className="players-filter-inline">
                    <div className="form-group players-filter-field" style={{ marginBottom: 0 }}>
                    <input
                      ref={playerLastNameInputRef}
                      id="players-lastname-filter"
                      type="text"
                      aria-label="Vyhľadať podľa priezviska"
                      value={playerLastNameFilter}
                      onChange={(e) => {
                        setPlayerLastNameFilter(e.target.value)
                        setPlayerSuggestionsOpen(true)
                      }}
                      onFocus={() => setPlayerSuggestionsOpen(true)}
                      placeholder="Zadajte priezvisko"
                    />
                    {playerSuggestionsOpen && playerLastNamePrefixSuggestions.length > 0 ? (
                      <div
                        ref={playerLastNameSuggestionsRef}
                        className="players-lastname-suggestions players-lastname-suggestions-fixed"
                        role="listbox"
                        aria-label="Návrhy priezviska"
                        style={{
                          top: `${playerSuggestionsStyle.top}px`,
                          left: `${playerSuggestionsStyle.left}px`,
                          width: `${playerSuggestionsStyle.width}px`
                        }}
                      >
                        {playerLastNamePrefixSuggestions.map((lastName) => (
                          <button
                            type="button"
                            key={`lastname-suggestion-${lastName}`}
                            className="players-lastname-suggestion"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setPlayerLastNameFilter(lastName)
                              setPlayerSuggestionsOpen(false)
                            }}
                          >
                            {lastName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    </div>

                    <div className="form-group players-filter-field" style={{ marginBottom: 0 }}>
                      <select
                        className="players-category-filter"
                        id="players-category-filter"
                        aria-label="Zobraz hráčov kategórie"
                        value={playerCategoryFilter}
                        onChange={(e) => setPlayerCategoryFilter(e.target.value)}
                      >
                        <option value="all">Vyber kategóriu</option>
                        <option value="none">Bez kategórie</option>
                        {playersCategoryOptions.map((category) => (
                          <option key={`player-filter-category-${category.id}`} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card members-card members-categories-list-card">
                <h3 style={{ marginBottom: '10px' }}>Zoznam hráčov</h3>

                {filteredPlayers.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Zatiaľ žiadni hráči</p>
                ) : (
                  <div className="manager-table manager-table-players">
                    <div className="manager-table-head">
                      <div>Meno a Priezvisko</div>
                      <div>Kategória</div>
                      <div className="manager-table-actions-head">Akcie</div>
                    </div>

                    {filteredPlayers.map((member) => (
                      <div key={member.userId} className="manager-table-row">
                        <div className="manager-table-name">
                          <div className="manager-name-with-photo">
                            <div className="manager-avatar" aria-hidden="true">
                              {member.photo ? <img src={resolveMediaUrl(member.photo)} alt="" /> : <span className="material-icons-round">person</span>}
                            </div>
                            <div>
                              <strong>{member.firstName} {member.lastName}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="manager-table-email">{getPlayerCategoriesLabel(member)}</div>

                        <div className="manager-table-actions">
                          <button
                            type="button"
                            className="role-action-btn role-action-edit"
                            onClick={() => startEditPlayer(member)}
                            disabled={loading}
                            aria-label={`Upraviť hráča ${member.firstName} ${member.lastName}`}
                            title="Upraviť hráča"
                          >
                            <span className="material-icons-round" aria-hidden="true">edit</span>
                          </button>

                          <button
                            type="button"
                            className="role-action-btn role-action-delete"
                            onClick={() => openRemovalConfirm('player', member)}
                            disabled={loading}
                            aria-label={`Odobrať hráča ${member.firstName} ${member.lastName} z klubu`}
                            title="Odobrať hráča z klubu"
                          >
                            <span className="material-icons-round" aria-hidden="true">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="members-categories-actions">
                <button
                  type="button"
                  className={`manager-add-btn ${showPlayerForm ? 'category-form-toggle-cancel' : ''}`}
                  onClick={() => {
                    if (showPlayerForm) {
                      cancelEditPlayer()
                    } else {
                      openCreatePlayerForm()
                    }
                  }}
                  disabled={loading}
                >
                  {showPlayerForm ? 'Zrušiť formulár' : 'Pridať hráča'}
                </button>
              </div>

              {showPlayerForm ? (
                <div ref={playerFormRef} className="card members-category-form-card">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Meno hráča</label>
                      <input
                        type="text"
                        value={playerDraft.firstName}
                        onChange={(e) => setPlayerDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Meno"
                      />
                    </div>

                    <div className="form-group">
                      <label>Priezvisko hráča</label>
                      <input
                        type="text"
                        value={playerDraft.lastName}
                        onChange={(e) => setPlayerDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Priezvisko"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Rodné číslo</label>
                      <input
                        type="text"
                        value={playerDraft.personalId}
                        onChange={(e) => setPlayerDraft((prev) => ({ ...prev, personalId: e.target.value }))}
                        placeholder="Rodné číslo"
                      />
                    </div>

                    <div className="form-group">
                      <label>Mobil</label>
                      <input
                        type="text"
                        value={playerDraft.mobile}
                        onChange={(e) => setPlayerDraft((prev) => ({ ...prev, mobile: e.target.value }))}
                        placeholder="Mobil hráča"
                      />
                    </div>

                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>E-mail hráča</label>
                      <input
                        type="email"
                        value={playerDraft.email}
                        onChange={(e) => setPlayerDraft((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Email hráča (voliteľné)"
                      />
                    </div>

                    <div className="form-group">
                      <label>Kategórie</label>
                      <details className="manager-permissions-dropdown">
                        <summary className="manager-permissions-trigger">
                          {(playerDraft.categoryIds || []).length > 0
                            ? `Vybrané kategórie: ${(playerDraft.categoryIds || []).length}`
                            : 'Vyberte kategórie'}
                        </summary>

                        <div className="manager-permissions-menu" role="group" aria-label="Výber kategórií hráča">
                          {categories.length === 0 ? (
                            <p className="manager-empty-text" style={{ margin: 0 }}>Najprv vytvorte kategórie.</p>
                          ) : (
                            categories.map((team) => (
                              <label key={`player-category-${team.id}`} className="manager-permission-item">
                                <input
                                  type="checkbox"
                                  checked={(playerDraft.categoryIds || []).includes(team.id)}
                                  onChange={(e) => togglePlayerCategory(team.id, e.target.checked)}
                                />
                                <span>{team.name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </details>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group trainer-photo-full-row">
                      <label>Fotka</label>
                      <div className="manager-photo-upload-row">
                        <input
                          ref={playerPhotoInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handlePlayerPhotoChange}
                        />

                        <input
                          type="text"
                          readOnly
                          value={playerDraft.photoFile ? playerDraft.photoFile.name : playerDraft.photo ? 'Fotka nahraná' : 'Pridať fotku hráča'}
                          className="manager-photo-upload-display"
                          onClick={openPlayerPhotoPicker}
                        />
                        <button type="button" className="manager-photo-upload-trigger" onClick={openPlayerPhotoPicker}>
                          pridať fotku
                        </button>
                        <button
                          type="button"
                          className="manager-photo-remove-btn"
                          onClick={clearPlayerPhoto}
                          aria-label="Odstrániť fotku hráča"
                          title="Odstrániť fotku"
                          disabled={!(playerDraft.photoFile || playerDraft.photo)}
                        >
                          <span className="material-icons-round" aria-hidden="true">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="manager-empty-text" style={{ margin: '0.25rem 0 0' }}>
                    Hráč bez vyplneného a potvrdeného e-mailu je vedený ako imaginárny hráč.
                  </p>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="manager-add-btn"
                      onClick={savePlayerFromMembers}
                      disabled={loading}
                    >
                      {editingPlayerId ? 'Uložiť hráča' : 'Pridať hráča'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            )}

            {activeMembersSection === 'managers' && (
            <div className="manager-manage-section">
              <div className="card members-card members-count-card">
                <div className="members-card-bg">
                  <span className="material-icons-round">people</span>
                </div>
                <h3 style={{ marginBottom: '6px' }}><span className="section-icon material-icons-round">people</span>Počet správcov</h3>
                <div className="members-count">{managers.length} <span>členov</span></div>
              </div>

              <div className="card manager-club-card">
                <div className="manager-club-card-header">
                  <div className="manager-role-heading">
                    <h3 className="manager-section-title">Zoznam správcov</h3>
                  </div>
                </div>

                {managers.length === 0 ? (
                  <div className="empty-managers">
                    <div className="empty-managers-icon material-icons-round">person_off</div>
                    <p style={{ color: 'var(--text-secondary)' }}>Neboli nájdení žiadni správcovia.</p>
                  </div>
                ) : (
                  <div className="manager-table">
                    <div className="manager-table-head">
                      <div>Meno a Priezvisko</div>
                      <div>Email</div>
                      <div>Rola</div>
                      <div className="manager-table-actions-head">Akcie</div>
                    </div>

                    {managers.map((manager) => (
                      <div key={manager.id} className="manager-table-row">
                        <div className="manager-table-name">
                          <div className="manager-name-with-photo">
                            <div className="manager-avatar" aria-hidden="true">
                              {manager.photo ? <img src={resolveMediaUrl(manager.photo)} alt="" /> : <span className="material-icons-round">person</span>}
                            </div>
                            <div>
                              <strong>{manager.firstName} {manager.lastName}</strong>
                              {manager.mobile ? <div className="manager-row-meta">{manager.mobile}</div> : null}
                            </div>
                          </div>
                        </div>

                        <div className="manager-table-email">{manager.email}</div>

                        <div>
                          <span className="manager-role-badge">{manager.roleName}</span>
                        </div>

                        <div className="manager-table-actions">
                          <button
                            type="button"
                            className="role-action-btn role-action-edit"
                            onClick={() => startEditManager(manager)}
                            disabled={loading}
                            aria-label={`Upraviť správcu ${manager.firstName} ${manager.lastName}`}
                            title="Upraviť správcu"
                          >
                            <span className="material-icons-round" aria-hidden="true">edit</span>
                          </button>

                          <button
                            type="button"
                            className="role-action-btn role-action-delete"
                            onClick={() => openRemovalConfirm('manager', manager)}
                            disabled={loading}
                            aria-label={`Odstrániť správcu ${manager.firstName} ${manager.lastName}`}
                            title="Odstrániť správcu"
                          >
                            <span className="material-icons-round" aria-hidden="true">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="manager-toggle-row">
                <button
                  type="button"
                  className={`manager-add-btn manager-toggle-btn ${showManagerForm ? 'category-form-toggle-cancel' : ''}`}
                  onClick={() => {
                    if (showManagerForm) {
                      setShowManagerForm(false)
                      cancelEditManager()
                    } else {
                      setShowManagerForm(true)
                    }
                  }}
                  disabled={loading}
                >
                  {showManagerForm ? 'Zrušiť formulár' : 'Pridať správcu'}
                </button>
              </div>

              {showManagerForm ? (
                <div ref={managerFormRef} className="card manager-form-card">
                  <h3 style={{ marginBottom: '10px' }}>
                    {editingManagerId ? 'Upraviť správcu' : 'Pridať správcu'}
                  </h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Meno</label>
                      <input
                        type="text"
                        value={managerDraft.firstName}
                        onChange={(e) => setManagerDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Meno"
                      />
                    </div>
                    <div className="form-group">
                      <label>Priezvisko</label>
                      <input
                        type="text"
                        id="manager-last-name"
                        value={managerDraft.lastName}
                        onChange={(e) => setManagerDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Priezvisko"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="manager-email">Email</label>
                      <input
                        type="email"
                        id="manager-email"
                        value={managerDraft.email}
                        onChange={(e) => setManagerDraft((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Email"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="manager-mobile">Mobil</label>
                      <input
                        type="text"
                        id="manager-mobile"
                        value={managerDraft.mobile}
                        onChange={(e) => setManagerDraft((prev) => ({ ...prev, mobile: e.target.value }))}
                        placeholder="Mobil"
                      />
                    </div>
                  </div>

                  <div className="form-row manager-photo-role-row">
                    <div className="form-group">
                      <input
                        ref={managerPhotoInputRef}
                        type="file"
                        id="manager-photo"
                        name="manager-photo"
                        accept="image/*"
                        onChange={handleManagerPhotoChange}
                        style={{ display: 'none' }}
                      />

                      <label htmlFor="manager-photo">Fotka správcu</label>
                      <div className="manager-photo-upload-row">
                        <input
                          type="text"
                          readOnly
                          value={managerDraft.photoFile ? managerDraft.photoFile.name : managerDraft.photo ? 'Fotka nahraná' : 'Pridať fotku správcu'}
                          className="manager-photo-upload-display"
                          onClick={openManagerPhotoPicker}
                        />
                        <button type="button" className="manager-photo-upload-trigger" onClick={openManagerPhotoPicker}>
                          pridať fotku
                        </button>
                        <button
                          type="button"
                          className="manager-photo-remove-btn"
                          onClick={clearManagerPhoto}
                          aria-label="Odstrániť fotku správcu"
                          title="Odstrániť fotku"
                          disabled={!(managerDraft.photoFile || managerDraft.photo)}
                        >
                          <span className="material-icons-round" aria-hidden="true">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="manager-role-select">Rola správcu</label>
                      <select
                        id="manager-role-select"
                        value={managerDraft.roleId}
                        onChange={(e) => setManagerDraft((prev) => ({ ...prev, roleId: e.target.value }))}
                      >
                        <option value="">Vyberte rolu správcu</option>
                        {managerRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="manager-add-btn" onClick={createManager} disabled={loading}>
                      {loading ? 'Ukladám...' : 'Uložiť'}
                    </button>

                    {editingManagerId ? (
                      <button type="button" className="manager-add-btn manager-cancel-btn" onClick={cancelEditManager} disabled={loading}>
                        Zrušiť úpravu
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            )}
            </div>
          </div>
        </div>
      )}

      {clubExists && activeTab === 'exerciseDatabase' && (
        <div className="form-section settings-layout" style={{ marginTop: '24px' }}>
          <aside className="card settings-sidebar-card" aria-label="Databáza cvičení - navigácia sekcií">
            <nav className="settings-submenu" aria-label="Subsidebar databáza cvičení">
              <a
                href="#"
                className={`settings-submenu-item ${activeExerciseDatabaseSection === 'exerciseList' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveExerciseDatabaseSection('exerciseList')
                }}
                aria-current={activeExerciseDatabaseSection === 'exerciseList' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">format_list_bulleted</span>
                <span>Zoznam cvičení</span>
              </a>

              <a
                href="#"
                className={`settings-submenu-item ${activeExerciseDatabaseSection === 'createExercise' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  resetExerciseFormDraft()
                  setActiveExerciseDatabaseSection('createExercise')
                }}
                aria-current={activeExerciseDatabaseSection === 'createExercise' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">add_circle</span>
                <span>Vytvoriť cvičenie</span>
              </a>

              <a
                href="#"
                className={`settings-submenu-item ${activeExerciseDatabaseSection === 'exerciseCategories' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveExerciseDatabaseSection('exerciseCategories')
                }}
                aria-current={activeExerciseDatabaseSection === 'exerciseCategories' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">fitness_center</span>
                <span>Kategórie cvičení</span>
              </a>
            </nav>
          </aside>

          <div className="settings-main">
            {activeExerciseDatabaseSection === 'createExercise' && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card metrics-section-card">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon" aria-hidden="true">{editingExerciseDatabaseItemId ? 'edit' : 'add_circle'}</span>
                    <h3 className="manager-section-title">{editingExerciseDatabaseItemId ? 'Upraviť cvičenie' : 'Vytvoriť nové cvičenie'}</h3>
                  </div>

                  <div className="exercise-builder-sections">
                    <section className="exercise-builder-section">
                      <h4 className="exercise-builder-section-title">
                        <span className="material-icons-round" aria-hidden="true">info</span>
                        Základné informácie
                      </h4>

                      <div className="form-group">
                        <label htmlFor="exercise-name">Názov cvičenia</label>
                        <input
                          id="exercise-name"
                          type="text"
                          value={exerciseFormDraft.name}
                          onChange={(event) => setExerciseFormDraft((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="napr. Prihrávky v trojuholníku"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="exercise-description">Popis cvičenia</label>
                        <textarea
                          id="exercise-description"
                          value={exerciseFormDraft.description}
                          onChange={(event) => setExerciseFormDraft((prev) => ({ ...prev, description: event.target.value }))}
                          placeholder="Podrobný popis priebehu a pravidiel cvičenia..."
                          rows={4}
                        />
                      </div>

                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <div className="form-group">
                          <label htmlFor="exercise-intensity">Intenzita</label>
                          <select
                            id="exercise-intensity"
                            value={exerciseFormDraft.intensity}
                            onChange={(event) => setExerciseFormDraft((prev) => ({ ...prev, intensity: event.target.value }))}
                          >
                            <option value="Nízka">Nízka</option>
                            <option value="Stredná">Stredná</option>
                            <option value="Vysoká">Vysoká</option>
                            <option value="Maximálna">Maximálna</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Počet hráčov</label>
                          <details className="manager-permissions-dropdown">
                            <summary className="manager-permissions-trigger">
                              {formatExercisePlayersCount(exerciseFormDraft.playersCount)
                                ? `Vybrané: ${formatExercisePlayersCount(exerciseFormDraft.playersCount)}`
                                : 'Vyber počty hráčov'}
                            </summary>
                            <div className="manager-permissions-list">
                              {EXERCISE_PLAYERS_COUNT_OPTIONS.map((countValue) => {
                                const optionId = `exercise-players-count-${countValue}`
                                const checked = normalizeExercisePlayersCount(exerciseFormDraft.playersCount).includes(countValue)

                                return (
                                  <label key={optionId} htmlFor={optionId} className="manager-permission-item">
                                    <input
                                      id={optionId}
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleExercisePlayersCount(countValue)}
                                    />
                                    <span>{countValue}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </details>
                        </div>
                      </div>
                    </section>

                    {getVisibleTrainingDivisionsForExerciseForm().map((division) => {
                      const divisionId = String(division?.id || '')
                      const divisionGroups = getTrainingDivisionGroups(division)
                      const selectedGroup = String(exerciseFormDraft?.divisionGroups?.[divisionId] || '')

                      return (
                        <section key={`exercise-division-section-${divisionId}`} className="exercise-builder-section">
                          <h4 className="exercise-builder-section-title">
                            <span className="material-icons-round" aria-hidden="true">category</span>
                            {division.name || 'Delenie tréningov'}
                          </h4>

                          {divisionGroups.length === 0 ? (
                            <p className="manager-empty-text" style={{ margin: 0 }}>
                              Toto delenie nemá žiadne skupiny.
                            </p>
                          ) : (
                            <div className="exercise-short-code-grid">
                              {divisionGroups.map((groupName) => (
                                <button
                                  key={`${divisionId}-${groupName}`}
                                  type="button"
                                  className={`exercise-short-code-btn ${selectedGroup === groupName ? 'active' : ''}`}
                                  onClick={() => setExerciseFormDraft((prev) => ({
                                    ...prev,
                                    divisionGroups: {
                                      ...(prev?.divisionGroups && typeof prev.divisionGroups === 'object' ? prev.divisionGroups : {}),
                                      [divisionId]: groupName
                                    }
                                  }))}
                                >
                                  {groupName}
                                </button>
                              ))}
                            </div>
                          )}
                        </section>
                      )
                    })}

                    <section className="exercise-builder-section">
                      <h4 className="exercise-builder-section-title">
                        <span className="material-icons-round" aria-hidden="true">category</span>
                        Kategórie a podkategórie
                      </h4>

                      {exerciseCategories.length === 0 ? (
                        <p className="manager-empty-text" style={{ margin: 0 }}>
                          Najprv vytvorte kategórie v sekcii Kategórie cvičení.
                        </p>
                      ) : getFilteredExerciseCategoriesForForm().length === 0 ? (
                        <p className="manager-empty-text" style={{ margin: 0 }}>
                          Pre zvolený typ tréningu nie sú dostupné žiadne kategórie.
                        </p>
                      ) : (
                        (() => {
                          const filteredCategories = getFilteredExerciseCategoriesForForm()
                          const categoryGridClass = filteredCategories.length === 4
                            ? 'grid-2'
                            : filteredCategories.length === 3
                              ? 'grid-3'
                              : filteredCategories.length === 2
                                ? 'grid-2'
                                : filteredCategories.length > 4
                                  ? 'grid-3'
                                  : 'grid-1'

                          return (
                            <div className={`exercise-category-picker-list ${categoryGridClass}`}>
                              {filteredCategories.map((category) => {
                            const categoryId = String(category?.id || '')
                            const categoryName = String(category?.name || '').trim()
                            const subcategories = Array.isArray(category?.subcategories)
                              ? category.subcategories.map((name) => String(name || '').trim()).filter(Boolean)
                              : []
                            const selectedCategories = Array.isArray(exerciseFormDraft?.selectedCategoryIds)
                              ? exerciseFormDraft.selectedCategoryIds
                              : []
                            const selectedSubcategories = Array.isArray(exerciseFormDraft?.categorySelections?.[categoryId])
                              ? exerciseFormDraft.categorySelections[categoryId]
                              : []
                            const hasSubcategories = subcategories.length > 0
                            const isCategorySelected = hasSubcategories
                              ? selectedSubcategories.length > 0
                              : selectedCategories.includes(categoryId)

                            return (
                              <div key={`exercise-category-picker-${categoryId}`} className="exercise-category-picker-card">
                                <div className="exercise-category-picker-top">
                                  <strong>{categoryName || 'Kategória cvičení'}</strong>
                                </div>

                                {!hasSubcategories ? (
                                  <label className="exercise-category-single-select-field" htmlFor={`exercise-category-checkbox-${categoryId}`}>
                                    <span>Označiť kategóriu</span>
                                    <input
                                      id={`exercise-category-checkbox-${categoryId}`}
                                      type="checkbox"
                                      checked={isCategorySelected}
                                      onChange={() => toggleExerciseCategorySelection(categoryId)}
                                      aria-label={`Označiť kategóriu ${categoryName || 'kategória'}`}
                                    />
                                  </label>
                                ) : (
                                  <>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                      <details className="manager-permissions-dropdown">
                                        <summary className="manager-permissions-trigger">
                                          {selectedSubcategories.length > 0
                                            ? `Vybrané podkategórie (${selectedSubcategories.length})`
                                            : 'Označ podkategórie'}
                                        </summary>

                                        <div className="manager-permissions-menu" role="group" aria-label={`Výber podkategórií pre ${categoryName || 'kategóriu'}`}>
                                          {subcategories.map((subcategoryName) => {
                                            const isChecked = selectedSubcategories.includes(subcategoryName)
                                            return (
                                              <label
                                                key={`${categoryId}-${subcategoryName}`}
                                                className="manager-permission-item"
                                                htmlFor={`exercise-subcategory-checkbox-${categoryId}-${subcategoryName}`}
                                              >
                                                <span>{subcategoryName}</span>
                                                <input
                                                  id={`exercise-subcategory-checkbox-${categoryId}-${subcategoryName}`}
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => {
                                                    if (isChecked) {
                                                      removeExerciseSubcategorySelection(categoryId, subcategoryName)
                                                    } else {
                                                      addExerciseSubcategorySelection(categoryId, subcategoryName)
                                                    }
                                                  }}
                                                />
                                              </label>
                                            )
                                          })}
                                        </div>
                                      </details>
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                              })}
                            </div>
                          )
                        })()
                      )}
                    </section>

                    <section className="exercise-builder-section">
                      <h4 className="exercise-builder-section-title">
                        <span className="material-icons-round" aria-hidden="true">image</span>
                        Prílohy a diagramy
                      </h4>

                      <div className="form-group">
                        <label htmlFor="exercise-youtube-url">YouTube video (odkaz)</label>
                        <input
                          id="exercise-youtube-url"
                          type="url"
                          value={exerciseFormDraft.youtubeUrl}
                          onChange={(event) => setExerciseFormDraft((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>

                      <div className="exercise-upload-placeholder">
                        <input
                          ref={exerciseImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleExerciseImageChange}
                          style={{ display: 'none' }}
                        />
                        <span className="material-icons-round" aria-hidden="true">cloud_upload</span>
                        <p>Nahrajte obrázok cvičenia</p>
                        <small>PNG, JPG alebo GIF do 10MB</small>
                        {exerciseFormDraft.imageUrl ? (
                          <div className="exercise-upload-preview-wrap">
                            <img src={exerciseFormDraft.imageUrl} alt="Náhľad obrázka cvičenia" className="exercise-upload-preview" />
                            <small>{exerciseFormDraft.imageName || 'Nahratý obrázok'}</small>
                          </div>
                        ) : null}
                        <div className="exercise-upload-actions">
                          <button type="button" className="btn-secondary" onClick={openExerciseImagePicker}>Prehliadať súbory</button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={clearExerciseImage}
                            disabled={!exerciseFormDraft.imageUrl}
                          >
                            Odstrániť obrázok
                          </button>
                        </div>
                      </div>
                    </section>

                  </div>
                </div>

                <div className="form-actions exercise-form-actions" style={{ justifyContent: 'flex-end', marginTop: 0 }}>
                  <button type="button" className="manager-role-save-btn exercise-form-action-btn" onClick={saveExerciseFromDatabaseForm}>
                    {editingExerciseDatabaseItemId ? 'Uložiť úpravy' : 'Uložiť cvičenie'}
                  </button>
                  <button type="button" className="btn-secondary exercise-form-action-btn" onClick={resetExerciseFormDraft}>
                    Zrušiť
                  </button>
                  {editingExerciseDatabaseItemId ? (
                    <button
                      type="button"
                      className="manager-add-btn category-form-toggle-cancel exercise-form-action-btn"
                      onClick={openEditingExerciseRemovalConfirm}
                    >
                      Odstrániť cvičenie
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {activeExerciseDatabaseSection === 'exerciseList' && (
              <>
                <div className="card settings-placeholder-card metrics-section-card exercise-db-filters-card">
                  <div className="exercise-db-filters" role="region" aria-label="Filtre zoznamu cvičení">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="exercise-list-filter-category">Kategória</label>
                      <select
                        id="exercise-list-filter-category"
                        value={exerciseListFilters.categoryId}
                        onChange={(event) => {
                          const nextCategoryId = event.target.value
                          setExerciseListFilters((prev) => ({
                            ...prev,
                            categoryId: nextCategoryId,
                            subcategory: 'all'
                          }))
                        }}
                      >
                        <option value="all">Všetky</option>
                        {exerciseCategories.map((category) => (
                          <option key={`exercise-list-filter-category-${category.id}`} value={String(category.id)}>
                            {String(category.name || 'Kategória')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="exercise-list-filter-subcategory">Podkategória</label>
                      <select
                        id="exercise-list-filter-subcategory"
                        value={exerciseListFilters.subcategory}
                        onChange={(event) => setExerciseListFilters((prev) => ({ ...prev, subcategory: event.target.value }))}
                        disabled={exerciseListFilters.categoryId === 'all' || exerciseListSubcategoryOptions.length === 0}
                      >
                        <option value="all">Všetky</option>
                        {exerciseListSubcategoryOptions.map((subcategory) => (
                          <option key={`exercise-list-filter-subcategory-${subcategory}`} value={subcategory}>
                            {subcategory}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="exercise-list-filter-players">Počet hráčov</label>
                      <select
                        id="exercise-list-filter-players"
                        value={exerciseListFilters.playersCount}
                        onChange={(event) => setExerciseListFilters((prev) => ({ ...prev, playersCount: event.target.value }))}
                      >
                        <option value="all">Všetky</option>
                        {EXERCISE_PLAYERS_COUNT_OPTIONS.map((countValue) => (
                          <option key={`exercise-list-filter-players-${countValue}`} value={countValue}>
                            {countValue}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="exercise-list-filter-intensity">Intenzita</label>
                      <select
                        id="exercise-list-filter-intensity"
                        value={exerciseListFilters.intensity}
                        onChange={(event) => setExerciseListFilters((prev) => ({ ...prev, intensity: event.target.value }))}
                      >
                        <option value="all">Všetky</option>
                        <option value="Nízka">Nízka</option>
                        <option value="Stredná">Stredná</option>
                        <option value="Vysoká">Vysoká</option>
                        <option value="Maximálna">Maximálna</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary exercise-db-filter-reset-btn"
                      onClick={resetExerciseListFilters}
                    >
                      Reset filtra
                    </button>
                  </div>
                </div>

                <div className="card settings-placeholder-card metrics-section-card">
                <div className="exercise-db-head-row">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon" aria-hidden="true">format_list_bulleted</span>
                    <h3 className="manager-section-title">Zoznam cvičení</h3>
                  </div>

                  <div className="exercise-db-view-toggle" role="tablist" aria-label="Prepnutie zobrazenia zoznamu cvičení">
                    <button
                      type="button"
                      className={`exercise-db-view-btn ${exerciseListViewMode === 'cards' ? 'active' : ''}`}
                      onClick={() => setExerciseListViewMode('cards')}
                      role="tab"
                      aria-selected={exerciseListViewMode === 'cards'}
                    >
                      <span className="material-icons-round" aria-hidden="true">grid_view</span>
                      Karty
                    </button>
                    <button
                      type="button"
                      className={`exercise-db-view-btn ${exerciseListViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setExerciseListViewMode('list')}
                      role="tab"
                      aria-selected={exerciseListViewMode === 'list'}
                    >
                      <span className="material-icons-round" aria-hidden="true">list</span>
                      Zoznam
                    </button>
                  </div>
                </div>

                {exerciseDatabaseItems.length === 0 ? (
                  <p className="manager-empty-text" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
                    Databáza cvičení je zatiaľ prázdna.
                  </p>
                ) : filteredExerciseDatabaseItems.length === 0 ? (
                  <p className="manager-empty-text" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
                    Žiadne cvičenie nezodpovedá filtru.
                  </p>
                ) : exerciseListViewMode === 'cards' ? (
                  <div className="exercise-db-cards" style={{ marginTop: '0.8rem' }}>
                    {filteredExerciseDatabaseItems.map((item) => (
                      <div
                        key={`card-${item.id}`}
                        className="exercise-db-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => openExerciseDetailItem(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openExerciseDetailItem(item)
                          }
                        }}
                        aria-label={`Otvoriť detail cvičenia ${item.name}`}
                      >
                        <div className="exercise-db-card-media">
                          {getExercisePreviewImage(item) ? (
                            <img
                              src={getExercisePreviewImage(item)}
                              alt={`Obrázok cvičenia ${item.name}`}
                              className="exercise-db-card-media-image"
                            />
                          ) : (
                            <div className="exercise-db-card-media-fallback">
                              <span className="material-icons-round" aria-hidden="true">image</span>
                            </div>
                          )}
                        </div>

                        <div className="exercise-db-card-title">{item.name}</div>
                        <p className="exercise-db-card-description">{item.description || 'Bez popisu cvičenia.'}</p>

                        <div className="exercise-db-card-stats">
                          <div className="exercise-db-card-stat-item" aria-label="Počet hráčov">
                            <span className="material-icons-round" aria-hidden="true">groups</span>
                            <div>
                              <small>Počet hráčov</small>
                              <strong>{formatExercisePlayersCount(item.playersCount) || '—'}</strong>
                            </div>
                          </div>

                          <div className="exercise-db-card-stat-item" aria-label="Intenzita">
                            <span className="material-icons-round" aria-hidden="true">whatshot</span>
                            <div>
                              <small>Intenzita</small>
                              <strong>{item.intensity || '—'}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="exercise-db-card-footer-actions">
                          <button
                            type="button"
                            className="btn-secondary exercise-db-card-action-btn"
                            onClick={(event) => {
                              event.stopPropagation()
                              openExerciseDetailItem(item)
                            }}
                            aria-label={`Otvoriť detail cvičenia ${item.name}`}
                            title="Zobraziť"
                          >
                            Zobraziť
                          </button>

                          <button
                            type="button"
                            className="btn-secondary exercise-db-card-action-btn"
                            onClick={(event) => {
                              event.stopPropagation()
                              startEditExerciseDatabaseItem(item)
                            }}
                            aria-label={`Upraviť cvičenie ${item.name}`}
                            title="Upraviť"
                          >
                            Upraviť
                          </button>
                          <button
                            type="button"
                            className="role-action-btn role-action-delete exercise-db-card-delete-btn"
                            onClick={(event) => {
                              event.stopPropagation()
                              removeExerciseDatabaseItem(item)
                            }}
                            aria-label={`Odstrániť cvičenie ${item.name}`}
                            title="Odstrániť"
                          >
                            <span className="material-icons-round" aria-hidden="true">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="exercise-db-list" style={{ marginTop: '0.8rem' }}>
                    {filteredExerciseDatabaseItems.map((item) => (
                      <div key={item.id} className="exercise-db-row">
                        <div>
                          <strong>{item.name}</strong>
                          <div className="exercise-db-row-meta">
                            Intenzita: {item.intensity}
                          </div>
                        </div>

                        <div className="exercise-db-row-right">
                          {item?.youtube?.url ? (
                            <a href={item.youtube.url} target="_blank" rel="noreferrer" className="exercise-db-youtube-link">
                              YouTube
                            </a>
                          ) : (
                            <span className="exercise-db-youtube-link muted">Bez videa</span>
                          )}

                          <div className="manager-table-actions">
                            <button
                              type="button"
                              className="role-action-btn role-action-edit"
                              onClick={() => startEditExerciseDatabaseItem(item)}
                              aria-label={`Upraviť cvičenie ${item.name}`}
                              title="Upraviť"
                            >
                              <span className="material-icons-round" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              className="role-action-btn role-action-delete"
                              onClick={() => removeExerciseDatabaseItem(item)}
                              aria-label={`Odstrániť cvičenie ${item.name}`}
                              title="Odstrániť"
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {openedExerciseDetailItem ? (
                  <div
                    id="exercise-detail-panel"
                    className="exercise-detail-overlay"
                    aria-label="Detail cvičenia"
                    onClick={closeExerciseDetailItem}
                  >
                    <div className="exercise-detail-card" onClick={(event) => event.stopPropagation()}>
                      <div className="exercise-detail-head">
                        <h4>{openedExerciseDetailItem.name}</h4>
                        <button
                          type="button"
                          className="role-action-btn"
                          onClick={closeExerciseDetailItem}
                          aria-label="Zavrieť detail cvičenia"
                          title="Zavrieť"
                        >
                          <span className="material-icons-round" aria-hidden="true">close</span>
                        </button>
                      </div>

                      <div
                        className={`exercise-detail-media ${String(openedExerciseDetailItem?.youtube?.videoId || '').trim() ? 'playable' : ''}`}
                        onClick={() => {
                          if (!isExerciseDetailVideoPlaying) {
                            startExerciseDetailVideo()
                          }
                        }}
                      >
                        {isExerciseDetailVideoPlaying && String(openedExerciseDetailItem?.youtube?.videoId || '').trim() ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${String(openedExerciseDetailItem.youtube.videoId).trim()}?autoplay=1&rel=0`}
                            title={`Video cvičenia ${openedExerciseDetailItem.name}`}
                            className="exercise-detail-media-video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        ) : getExercisePreviewImage(openedExerciseDetailItem) ? (
                          <>
                            <img
                              src={getExercisePreviewImage(openedExerciseDetailItem)}
                              alt={`Obrázok cvičenia ${openedExerciseDetailItem.name}`}
                            />
                            {String(openedExerciseDetailItem?.youtube?.videoId || '').trim() ? (
                              <button
                                type="button"
                                className="exercise-detail-play-btn"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  startExerciseDetailVideo()
                                }}
                                aria-label="Prehrať video"
                                title="Prehrať video"
                              >
                                <span className="material-icons-round" aria-hidden="true">play_arrow</span>
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <div className="exercise-detail-media-fallback">
                            <span className="material-icons-round" aria-hidden="true">image</span>
                          </div>
                        )}
                      </div>

                      <div className="exercise-detail-body">
                        <p><strong>Intenzita:</strong> {openedExerciseDetailItem.intensity}</p>
                        {(Array.isArray(openedExerciseDetailItem?.selectedCategoryIds) && openedExerciseDetailItem.selectedCategoryIds.length > 0)
                        || (openedExerciseDetailItem?.categorySelections && Object.keys(openedExerciseDetailItem.categorySelections).length > 0) ? (
                          <div className="exercise-detail-categories">
                            <strong>Kategórie:</strong>
                            <span>
                              {exerciseCategories
                                .map((category) => {
                                  const categoryId = String(category?.id || '')
                                  const isCategorySelected = Array.isArray(openedExerciseDetailItem?.selectedCategoryIds)
                                    ? openedExerciseDetailItem.selectedCategoryIds.includes(categoryId)
                                    : false
                                  const selectedSubcategories = Array.isArray(openedExerciseDetailItem?.categorySelections?.[categoryId])
                                    ? openedExerciseDetailItem.categorySelections[categoryId]
                                    : []
                                  if (!isCategorySelected && selectedSubcategories.length === 0) return null
                                  if (selectedSubcategories.length === 0) return `${String(category?.name || 'Kategória')}`
                                  return `${String(category?.name || 'Kategória')}: ${selectedSubcategories.join(', ')}`
                                })
                                .filter(Boolean)
                                .join(' | ')}
                            </span>
                          </div>
                        ) : null}
                        {openedExerciseDetailItem.description ? (
                          <p>{openedExerciseDetailItem.description}</p>
                        ) : (
                          <p className="manager-empty-text" style={{ margin: 0 }}>Cvičenie zatiaľ nemá popis.</p>
                        )}
                      </div>

                      <div className="exercise-detail-actions">
                        <button
                          type="button"
                          className="manager-add-btn"
                          onClick={() => editExerciseFromDetail(openedExerciseDetailItem)}
                        >
                          Upraviť
                        </button>
                        <button
                          type="button"
                          className="manager-add-btn category-form-toggle-cancel"
                          onClick={() => removeExerciseFromDetail(openedExerciseDetailItem)}
                        >
                          Odstrániť
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              </>
            )}

            {activeExerciseDatabaseSection === 'exerciseCategories' && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card metrics-section-card">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon" aria-hidden="true">fitness_center</span>
                    <h3 className="manager-section-title">Nastavenia cvičení</h3>
                  </div>

                  {exerciseCategories.length === 0 ? (
                    <p className="manager-empty-text" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                      Zatiaľ neexistujú žiadne kategórie cvičení.
                    </p>
                  ) : (
                    <div className="manager-table manager-table-exercise-categories" style={{ marginTop: '0.45rem' }}>
                      <div className="manager-table-head" style={{ gridTemplateColumns: 'minmax(190px, 0.9fr) minmax(220px, 1.1fr) 100px 92px' }}>
                        <div>Kategória cvičení</div>
                        <div>Podkategórie</div>
                        <div>Typ</div>
                        <div className="manager-table-actions-head">Akcie</div>
                      </div>
                      {exerciseCategories.map((category) => (
                        <div
                          key={category.id}
                          className={`manager-table-row ${String(draggedExerciseCategoryId || '') === String(category.id) ? 'dragging' : ''} ${String(exerciseCategoryDropTargetId || '') === String(category.id) ? 'drag-over' : ''}`}
                          style={{ gridTemplateColumns: 'minmax(190px, 0.9fr) minmax(220px, 1.1fr) 100px 92px' }}
                          draggable
                          onDragStart={() => startExerciseCategoryDrag(category.id)}
                          onDragOver={(event) => handleExerciseCategoryDragOver(event, category.id)}
                          onDrop={() => handleExerciseCategoryDrop(category.id)}
                          onDragEnd={endExerciseCategoryDrag}
                        >
                          <div className="exercise-category-name-cell">
                            <span className="material-icons-round exercise-drag-handle" aria-hidden="true">drag_indicator</span>
                            <span>{category.name}</span>
                          </div>
                          <div>{Array.isArray(category.subcategories) && category.subcategories.length > 0 ? category.subcategories.join(', ') : '—'}</div>
                          <div>
                            {Object.keys(category?.assignedDivisionGroups || {}).length > 0
                              ? getVisibleTrainingDivisionsForExerciseForm()
                                  .map((division) => {
                                    const divisionId = String(division?.id || '')
                                    const selectedGroups = Array.isArray(category?.assignedDivisionGroups?.[divisionId])
                                      ? category.assignedDivisionGroups[divisionId]
                                      : []
                                    if (selectedGroups.length === 0) return null
                                    return selectedGroups.join(', ')
                                  })
                                  .filter(Boolean)
                                  .join(' | ')
                              : '—'}
                          </div>
                          <div className="manager-table-actions">
                            <button
                              type="button"
                              className="role-action-btn role-action-edit"
                              onClick={() => startEditExerciseCategory(category)}
                              aria-label={`Upraviť kategóriu cvičení ${category.name}`}
                              title="Upraviť kategóriu"
                            >
                              <span className="material-icons-round" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              className="role-action-btn role-action-delete"
                              onClick={() => removeExerciseCategory(category)}
                              aria-label={`Odstrániť kategóriu cvičení ${category.name}`}
                              title="Odstrániť kategóriu"
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="members-categories-actions">
                  <button
                    type="button"
                    className={`manager-add-btn ${showExerciseCategoryForm ? 'category-form-toggle-cancel' : ''}`}
                    onClick={() => {
                      if (showExerciseCategoryForm) {
                        setShowExerciseCategoryForm(false)
                        setExerciseCategoryDraft({ name: '', subcategories: [''], assignedDivisionGroups: {} })
                        setEditingExerciseCategoryId(null)
                        return
                      }
                      setEditingExerciseCategoryId(null)
                      setShowExerciseCategoryForm(true)
                    }}
                  >
                    {showExerciseCategoryForm ? 'Zavrieť formulár' : 'Vytvoriť kategóriu cvičení'}
                  </button>
                </div>

                {showExerciseCategoryForm ? (
                  <div ref={exerciseCategoryFormRef} className="card settings-placeholder-card metrics-editor-card" style={{ marginBottom: 0 }}>
                    <div className="metrics-editor-head">
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon" aria-hidden="true">add_circle</span>
                        <h3 className="manager-section-title">{editingExerciseCategoryId ? 'Upraviť kategóriu cvičení' : 'Nová kategória cvičení'}</h3>
                      </div>
                    </div>

                    <div className="form-group training-division-name-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="exercise-category-name">Kategória cvičení</label>
                      <input
                        id="exercise-category-name"
                        type="text"
                        value={exerciseCategoryDraft.name}
                        onChange={(event) => setExerciseCategoryDraft((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="napr. Koordinačné cvičenia"
                      />
                    </div>

                    <div className="form-group training-division-groups-block" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                      <label>Podkategórie cvičení</label>

                      <div className="training-division-group-rows">
                        {(Array.isArray(exerciseCategoryDraft.subcategories) ? exerciseCategoryDraft.subcategories : ['']).map((subcategoryName, subIndex) => (
                          <div
                            key={`exercise-subcategory-${subIndex}`}
                            className={`training-division-group-row ${draggedExerciseSubcategoryIndex === subIndex ? 'dragging' : ''} ${exerciseSubcategoryDropTargetIndex === subIndex ? 'drag-over' : ''}`}
                            draggable
                            onDragStart={() => startExerciseSubcategoryDrag(subIndex)}
                            onDragOver={(event) => handleExerciseSubcategoryDragOver(event, subIndex)}
                            onDrop={() => handleExerciseSubcategoryDrop(subIndex)}
                            onDragEnd={endExerciseSubcategoryDrag}
                          >
                            <span className="material-icons-round exercise-drag-handle" aria-hidden="true">drag_indicator</span>
                            <input
                              type="text"
                              className="training-division-group-input"
                              value={subcategoryName}
                              onChange={(event) => updateExerciseSubcategoryRow(subIndex, event.target.value)}
                              placeholder={`Podkategória ${subIndex + 1}`}
                            />
                            <button
                              type="button"
                              className="training-division-remove-row-btn"
                              onClick={() => removeExerciseSubcategoryRow(subIndex)}
                              aria-label={`Odstrániť podkategóriu ${subIndex + 1}`}
                              title="Odstrániť pole"
                            >
                              <span className="material-icons-round" aria-hidden="true">close</span>
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="training-division-add-row-btn"
                        onClick={addExerciseSubcategoryRow}
                      >
                        pridať riadok
                      </button>
                    </div>

                    <div className="form-group training-division-groups-block" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                      <label>Delenie tréningov a skupiny</label>

                      {getVisibleTrainingDivisionsForExerciseForm().length === 0 ? (
                        <p className="manager-empty-text" style={{ margin: 0 }}>
                          V nastaveniach zobrazenia tréningov nie je povolené žiadne delenie.
                        </p>
                      ) : (
                        <div className="exercise-category-division-picker-list">
                          {getVisibleTrainingDivisionsForExerciseForm().map((division) => {
                            const divisionId = String(division?.id || '')
                            const divisionGroups = getTrainingDivisionGroups(division)
                            const selectedGroups = Array.isArray(exerciseCategoryDraft?.assignedDivisionGroups?.[divisionId])
                              ? exerciseCategoryDraft.assignedDivisionGroups[divisionId]
                              : []

                            return (
                              <div key={`exercise-category-division-picker-${divisionId}`} className="exercise-category-division-picker-card">
                                <div className="exercise-category-picker-top">
                                  <strong>{division.name || 'Delenie tréningov'}</strong>
                                  <span>{selectedGroups.length} vybrané</span>
                                </div>

                                {divisionGroups.length === 0 ? (
                                  <p className="manager-empty-text" style={{ margin: 0 }}>
                                    Toto delenie nemá žiadne skupiny.
                                  </p>
                                ) : (
                                  <>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                      <label htmlFor={`exercise-category-division-groups-${divisionId}`}>Pridať skupinu</label>
                                      <select
                                        id={`exercise-category-division-groups-${divisionId}`}
                                        value=""
                                        onChange={(event) => addExerciseCategoryDivisionGroupSelection(divisionId, event.target.value)}
                                      >
                                        <option value="">Vyber skupinu...</option>
                                        {divisionGroups.map((groupName) => (
                                          <option key={`${divisionId}-${groupName}`} value={groupName}>{groupName}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {selectedGroups.length > 0 ? (
                                      <div className="exercise-subcategory-tags">
                                        {selectedGroups.map((groupName) => (
                                          <button
                                            key={`selected-exercise-category-group-${divisionId}-${groupName}`}
                                            type="button"
                                            className="exercise-subcategory-tag"
                                            onClick={() => removeExerciseCategoryDivisionGroupSelection(divisionId, groupName)}
                                            title="Odstrániť skupinu"
                                          >
                                            <span>{groupName}</span>
                                            <span className="material-icons-round" aria-hidden="true">close</span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="manager-empty-text" style={{ margin: 0 }}>
                                        Zatiaľ nie je vybraná žiadna skupina.
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="form-actions" style={{ marginBottom: '0.2rem', marginTop: '0.9rem' }}>
                      <button type="button" className="manager-role-save-btn" onClick={createExerciseCategory}>
                        {editingExerciseCategoryId ? 'Uložiť zmeny' : 'Vytvoriť'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {clubExists && activeTab === 'settings' && (
        <div className="form-section settings-layout" style={{ marginTop: '24px' }}>
          <aside className="card settings-sidebar-card" aria-label="Nastavenia - navigácia sekcií">
            <nav className="settings-submenu" aria-label="Submenu nastavení">
              <a
                href="#"
                className={`settings-submenu-item ${activeSettingsSection === 'managerRoles' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveSettingsSection('managerRoles')
                }}
                aria-current={activeSettingsSection === 'managerRoles' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">admin_panel_settings</span>
                <span>Role správcov</span>
              </a>

              <a
                href="#"
                className={`settings-submenu-item ${activeSettingsSection === 'trainerFunctions' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveSettingsSection('trainerFunctions')
                }}
                aria-current={activeSettingsSection === 'trainerFunctions' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">badge</span>
                <span>Funkcie trénerov</span>
              </a>

              <a
                href="#"
                className={`settings-submenu-item ${activeSettingsSection === 'visibleSections' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveSettingsSection('visibleSections')
                }}
                aria-current={activeSettingsSection === 'visibleSections' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">view_sidebar</span>
                <span>Zobrazené sekcie</span>
              </a>

              <a
                href="#"
                className={`settings-submenu-item ${activeSettingsSection === 'attendance' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveSettingsSection('attendance')
                }}
                aria-current={activeSettingsSection === 'attendance' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">event_available</span>
                <span>Dochádzka</span>
              </a>

              {canManageFieldsSection ? (
                <a
                  href="#"
                  className={`settings-submenu-item ${activeSettingsSection === 'fields' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveSettingsSection('fields')
                  }}
                  aria-current={activeSettingsSection === 'fields' ? 'page' : undefined}
                >
                  <span className="material-icons-round" aria-hidden="true">stadium</span>
                  <span>Správa ihrísk</span>
                </a>
              ) : null}

              <a
                href="#"
                className="settings-submenu-item"
                onClick={(e) => e.preventDefault()}
              >
                <span className="material-icons-round" aria-hidden="true">quiz</span>
                <span>Testy</span>
              </a>

              <a
                href="#"
                className={`settings-submenu-item ${activeSettingsSection === 'trainings' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveSettingsSection('trainings')
                }}
                aria-current={activeSettingsSection === 'trainings' ? 'page' : undefined}
              >
                <span className="material-icons-round" aria-hidden="true">sports</span>
                <span>Tréningy</span>
              </a>
            </nav>
          </aside>

          <div className="settings-main">
            {activeSettingsSection === 'managerRoles' && (
              <div className="manager-role-section">
                <div className="card manager-roles-list-card">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon manager-edit-roles-icon">edit_note</span>
                    <h3 className="manager-section-title manager-list-title">Zoznam vytvorených rolí</h3>
                  </div>

                  {managerRoles.length === 0 ? (
                    <div className="empty-managers">
                      <div className="empty-managers-icon material-icons-round">playlist_remove</div>
                      <p style={{ color: 'var(--text-secondary)' }}>Zatiaľ neexistujú žiadne roly správcov.</p>
                    </div>
                  ) : (
                    <div className="manager-table manager-table-manager-roles">
                      <div className="manager-table-head">
                        <div>Názov roly</div>
                        <div>Funkcie</div>
                        <div className="manager-table-actions-head">Akcie</div>
                      </div>

                      {managerRoles.map((role) => (
                        <div key={role.id} className="manager-table-row">
                          <div className="manager-table-name">
                            <strong>{role.name}</strong>
                          </div>

                          <div className="manager-table-email">
                            {Array.isArray(role.permissions) && role.permissions.length > 0
                              ? role.permissions.map((permission) => formatPermissionLabel(permission)).join(' · ')
                              : 'Bez oprávnení'}
                          </div>

                          <div className="manager-table-actions">
                            <button
                              type="button"
                              className="role-action-btn"
                              onClick={() => startEditRole(role)}
                              disabled={loading}
                              aria-label={`Upraviť rolu ${role.name}`}
                              title="Upraviť rolu"
                            >
                              <span className="material-icons-round" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              className="role-action-btn role-action-delete"
                              onClick={() => openRemovalConfirm('managerRole', role)}
                              disabled={loading}
                              aria-label={`Odstrániť rolu ${role.name}`}
                              title="Odstrániť rolu"
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="manager-toggle-row">
                  <button
                    type="button"
                    className={`manager-add-btn manager-toggle-btn ${showManagerRoleForm ? 'category-form-toggle-cancel' : ''}`}
                    onClick={() => {
                      if (showManagerRoleForm) {
                        setShowManagerRoleForm(false)
                        setRoleDraft({ roleTitle: '', permissions: [] })
                        setEditingRoleId(null)
                      } else {
                        setShowManagerRoleForm(true)
                        setRoleDraft({ roleTitle: '', permissions: [] })
                        setEditingRoleId(null)
                      }
                    }}
                    disabled={loading}
                  >
                    {showManagerRoleForm ? 'Zrušiť formulár' : 'Vytvoriť rolu správcu'}
                  </button>
                </div>

                {showManagerRoleForm ? (
                <div ref={managerRoleFormRef} className="card manager-form-card">
                  <div className="manager-role-content">
                    <div className="manager-role-heading">
                      <span className="material-icons-round section-icon">admin_panel_settings</span>
                      <h3 className="manager-section-title">{editingRoleId ? 'Upraviť rolu správcu' : 'Vytvoriť rolu správcu'}</h3>
                    </div>

                    <div className="form-group">
                      <label htmlFor="manager-role-title">Definícia role správcu</label>
                      <input
                        type="text"
                        id="manager-role-title"
                        value={roleDraft.roleTitle}
                        onChange={(e) => setRoleDraft((prev) => ({ ...prev, roleTitle: e.target.value }))}
                        placeholder="napr. Športový manažér, Finančný správca"
                      />
                    </div>

                    <div className="form-group">
                      <label>Výber funkcií</label>
                      <details className="manager-permissions-dropdown">
                        <summary className="manager-permissions-trigger">
                          {roleDraft.permissions.length > 0
                            ? `Vybrané funkcie: ${roleDraft.permissions.length}`
                            : 'Vyberte funkcie'}
                        </summary>

                        <div className="manager-permissions-menu" role="group" aria-label="Výber funkcií správcu">
                          {permissionOptions.length === 0 ? (
                            <p className="manager-empty-text" style={{ margin: 0 }}>Funkcie sa nepodarilo načítať.</p>
                          ) : (
                            permissionOptions.map((option) => (
                              <label key={option.key} className="manager-permission-item">
                                <input
                                  type="checkbox"
                                  checked={roleDraft.permissions.includes(option.value)}
                                  onChange={(e) => toggleDraftPermission(option.value, e.target.checked)}
                                />
                                <span>{option.label}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </details>
                      <p className="manager-empty-text" style={{ marginTop: '0.45rem' }}>
                        Označte všetky funkcie, ktoré má mať táto rola.
                      </p>
                    </div>

                    <div className={`manager-selected-permissions ${editingRoleId ? 'manager-selected-permissions-editing' : ''}`}>
                      {roleDraft.permissions.length === 0 ? (
                        <p className="manager-empty-text">Zatiaľ nie je vybratá žiadna funkcia.</p>
                      ) : (
                        roleDraft.permissions.map((permission) => (
                          <div key={permission} className="manager-selected-item">
                            <span>{formatPermissionLabel(permission)}</span>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openRemovalConfirm('draftPermission', { permission })}
                            >
                              Odobrať
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="form-actions">
                      <button type="button" className="manager-role-save-btn" onClick={saveManagerRole} disabled={loading}>
                        {loading ? 'Ukladám...' : (editingRoleId ? 'Uložiť úpravy roly' : 'Uložiť rolu správcu')}
                      </button>
                    </div>
                    <p className="manager-warning-text">
                      Najskôr vytvorte rolu správcu, potom ju priraďte konkrétnej osobe nižšie.
                    </p>
                  </div>
                </div>
                ) : null}
              </div>
            )}

            {activeSettingsSection === 'attendance' && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card attendance-settings-menu-card">
                  <div className="attendance-settings-menu" role="tablist" aria-label="Menu dochádzky">
                    <button
                      type="button"
                      className={`attendance-settings-menu-item ${attendanceSettingsTab === 'periods' ? 'active' : ''}`}
                      onClick={() => setAttendanceSettingsTab('periods')}
                      role="tab"
                      aria-selected={attendanceSettingsTab === 'periods'}
                    >
                      Obdobia
                    </button>
                    <span className="attendance-settings-menu-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className={`attendance-settings-menu-item ${attendanceSettingsTab === 'indicators' ? 'active' : ''}`}
                      onClick={() => setAttendanceSettingsTab('indicators')}
                      role="tab"
                      aria-selected={attendanceSettingsTab === 'indicators'}
                    >
                      Ukazovatele
                    </button>
                    <span className="attendance-settings-menu-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className={`attendance-settings-menu-item ${attendanceSettingsTab === 'displaySettings' ? 'active' : ''}`}
                      onClick={() => setAttendanceSettingsTab('displaySettings')}
                      role="tab"
                      aria-selected={attendanceSettingsTab === 'displaySettings'}
                    >
                      Nastavenie zobrazenia ukazovateľov
                    </button>
                  </div>
                </div>

                {attendanceSettingsTab === 'indicators' ? (
                <>
                <div className="card settings-placeholder-card metrics-section-card">
                  <div className="metrics-toolbar">
                    <div>
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon">analytics</span>
                        <h3 className="manager-section-title">Ukazovatele dochádzky a plánovania</h3>
                      </div>
                    </div>

                    <div className="metrics-toolbar-actions">
                      <span className="metrics-active-chip" title="Počet zapnutých ukazovateľov">
                        Aktívne: {activeMetricsCount}/{metrics.length}
                      </span>
                    </div>
                  </div>

                  {metricsLoading ? (
                    <p className="manager-empty-text">Načítavam ukazovatele...</p>
                  ) : (
                    <>
                    <p className="manager-empty-text" style={{ marginBottom: '0.6rem' }}>
                      Poradie ukazovateľov v tomto zozname určuje poradie v kartách a tabuľkách dochádzky.
                    </p>
                    <div className="metrics-table-wrap" role="region" aria-label="Tabuľka ukazovateľov">
                      <div className="metrics-table metrics-table-head" role="row">
                        <div className="metrics-col-right">Skratky</div>
                        <div>Názov ukazovateľa</div>
                        <div className="metrics-col-center">Status</div>
                        <div className="metrics-col-right manager-table-actions-head">Akcie</div>
                      </div>

                      {metricsSorted.map((metric) => {
                        const typeMeta = getMetricTypeMeta(metric.type)
                        const metricIconText = getMetricIconText(metric)
                        return (
                          <div
                            key={metric.id}
                            className={`metrics-table metrics-table-row ${draggedMetricId === String(metric.id) ? 'dragging' : ''}`}
                            role="row"
                            draggable={!loading}
                            onDragStart={(event) => handleMetricDragStart(event, metric.id)}
                            onDragOver={handleMetricDragOver}
                            onDrop={(event) => handleMetricDrop(event, metric.id)}
                            onDragEnd={handleMetricDragEnd}
                          >
                            <div className="metrics-drag-cell">
                              <span className="material-icons-round metrics-drag-handle" aria-hidden="true">drag_indicator</span>
                              <div className="metrics-type-icon" title={typeMeta.label}>
                                {metricIconText ? (
                                  <span className={`metrics-type-icon-text ${getMetricIconFontClass(metricIconText)}`} aria-hidden="true">{metricIconText}</span>
                                ) : (
                                  <span className="material-icons-round" aria-hidden="true">{typeMeta.icon}</span>
                                )}
                              </div>
                            </div>

                            <div className="metrics-name-cell">
                              <strong>{metric.name}</strong>
                            </div>

                            <div className="metrics-col-center">
                              <label className="metrics-switch" title="Zapnúť/vypnúť ukazovateľ">
                                <input
                                  type="checkbox"
                                  checked={metric.isActive !== false}
                                  onChange={(event) => toggleMetricActive(metric, event.target.checked)}
                                  disabled={loading}
                                />
                                <span className="metrics-switch-track" aria-hidden="true" />
                              </label>
                            </div>

                            <div className="metrics-col-right metrics-actions">
                              <button
                                type="button"
                                className="role-action-btn role-action-edit"
                                onClick={() => openEditMetricEditor(metric)}
                                disabled={loading}
                                title="Upraviť ukazovateľ"
                              >
                                <span className="material-icons-round" aria-hidden="true">edit</span>
                              </button>

                              {!(metric.isDefault || isCalendarDaysMetric(metric)) ? (
                                <button
                                  type="button"
                                  className="role-action-btn role-action-delete"
                                  onClick={() => openRemovalConfirm('metric', metric)}
                                  disabled={loading}
                                  title="Odstrániť ukazovateľ"
                                >
                                  <span className="material-icons-round" aria-hidden="true">delete</span>
                                </button>
                              ) : (
                                <button type="button" className="role-action-btn" disabled title="Preddefinovaný ukazovateľ sa nemaže">
                                  <span className="material-icons-round" aria-hidden="true">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    </>
                  )}
                </div>

                <div className="members-categories-actions">
                  <button
                    type="button"
                    className={`manager-add-btn ${showMetricEditor ? 'category-form-toggle-cancel' : ''}`}
                    onClick={showMetricEditor ? cancelMetricEditor : openCreateMetricEditor}
                    disabled={loading}
                  >
                    {showMetricEditor ? 'Zrušiť formulár' : 'Vytvoriť vlastný'}
                  </button>
                </div>

                {showMetricEditor ? (
                  <div ref={metricEditorFormRef} className="card settings-placeholder-card metrics-editor-card">
                    <div className="metrics-editor-head">
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon">tune</span>
                        <h3 className="manager-section-title">{editingMetricId ? 'Upraviť ukazovateľ' : 'Nový ukazovateľ'}</h3>
                      </div>
                    </div>

                    <div className="form-row" style={{ marginBottom: '0.9rem' }}>
                      <div className="form-group">
                        <label htmlFor="metric-name">Názov</label>
                        <input
                          id="metric-name"
                          type="text"
                          value={metricDraft.name}
                          onChange={(event) => setMetricDraft((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="napr. Explozivita hráča"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="metric-short-name">Skratka názvu</label>
                        <input
                          id="metric-short-name"
                          type="text"
                          value={metricDraft.shortName}
                          onChange={(event) => setMetricDraft((prev) => ({ ...prev, shortName: event.target.value }))}
                          placeholder="napr. EXPL"
                        />
                      </div>
                    </div>

                    <div className="form-row" style={{ marginBottom: '0.9rem' }}>
                      <div className="form-group">
                        <label htmlFor="metric-type">Typ hodnoty</label>
                        <details className="manager-permissions-dropdown" id="metric-type">
                          <summary className="manager-permissions-trigger">
                            {(metricDraft.valueTypes || []).length > 0
                              ? `${(metricDraft.valueTypes || []).map((value) => METRIC_TYPE_OPTIONS.find((item) => item.value === value)?.label || value).join(', ')}`
                              : 'Vyberte typy hodnoty'}
                          </summary>

                          <div className="manager-permissions-menu" role="group" aria-label="Výber typov hodnoty">
                            {METRIC_TYPE_OPTIONS.map((option) => (
                              <label key={option.value} className="manager-permission-item">
                                <input
                                  type="checkbox"
                                  checked={(metricDraft.valueTypes || []).includes(option.value)}
                                  onChange={(event) => {
                                    setMetricDraft((prev) => {
                                      const nextTypes = event.target.checked
                                        ? [...new Set([...(prev.valueTypes || []), option.value])]
                                        : (prev.valueTypes || []).filter((item) => item !== option.value)
                                      return {
                                        ...prev,
                                        valueTypes: nextTypes,
                                        type: nextTypes[0] || 'number'
                                      }
                                    })
                                  }}
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      </div>

                      <div className="form-group">
                        <label htmlFor="metric-mode">Spôsob zadávania</label>
                        <select
                          id="metric-mode"
                          value={metricDraft.mode}
                          onChange={(event) => setMetricDraft((prev) => ({ ...prev, mode: event.target.value }))}
                        >
                          {METRIC_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {metricDraft.mode === 'formula' ? (
                      <div className="metrics-formula-builder">
                        <h4>Rozšírenie</h4>

                        <div className="metrics-formula-canvas" aria-label="Vizuálny návrh vzorca" style={{ marginTop: 0 }}>
                          <div className="metrics-canvas-head">
                            <div className="metrics-canvas-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => removeFormulaNode(formulaDraft.length - 1)}
                                disabled={formulaDraft.length === 0}
                                title="Späť"
                              >
                                <span className="material-icons-round" aria-hidden="true">undo</span>
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={clearFormula}
                                disabled={formulaDraft.length === 0}
                                title="Vyčistiť"
                              >
                                <span className="material-icons-round" aria-hidden="true">delete</span>
                              </button>
                            </div>
                          </div>
                          {formulaDraftSummary ? <div className="metrics-formula-summary">{formulaDraftSummary}</div> : null}
                          <div className="metrics-token-list" style={{ marginBottom: formulaDraft.length === 0 ? '0.45rem' : 0 }}>
                            <div className="metrics-token-item metrics-token-item-variable">
                              <span>{String(metricDraft.shortName || '').trim() || String(metricDraft.name || '').trim() || 'Nová skratka'}</span>
                            </div>
                            <div className="metrics-token-item metrics-token-item-operator">
                              <span>=</span>
                            </div>
                            {formulaDraft.map((node, index) => (
                              <div key={`${node.type}-${index}`} className={`metrics-token-item metrics-token-item-${node.type}`}>
                                <span>{getFormulaNodeLabel(node, { preferShortName: true })}</span>
                                <button
                                  type="button"
                                  className="metrics-token-remove-btn"
                                  onClick={() => removeFormulaNode(index)}
                                  aria-label="Odobrať položku zo vzorca"
                                  title="Odobrať položku"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          {formulaDraft.length === 0 ? (
                            <p className="manager-empty-text">Vzorec je zatiaľ prázdny.</p>
                          ) : null}
                        </div>

                        <div className="metrics-formula-tools" style={{ marginTop: '0.75rem' }}>
                          <div className="form-row metrics-tool-row-grid" style={{ marginBottom: 0 }}>
                            <div className="metrics-tool-group metrics-tool-row">
                              <p className="metrics-tool-label">Paleta premenných</p>
                              <div className="metrics-chip-list">
                                {availableFormulaMetrics.length === 0 ? (
                                  <span className="manager-empty-text">Nie sú dostupné žiadne premenné.</span>
                                ) : (
                                  availableFormulaMetrics.map((metric) => {
                                    const typeMeta = getMetricTypeMeta(getPrimaryMetricType(metric))
                                    const metricIconText = getMetricIconText(metric)
                                    return (
                                      <button
                                        key={`metric-chip-${metric.id}`}
                                        type="button"
                                        className="metrics-chip-btn metrics-chip-btn-variable"
                                        onClick={() => appendFormulaVariable(metric.id)}
                                        title={`Pridať premennú ${metric.name}`}
                                      >
                                        {metricIconText ? (
                                          <span className={`metrics-chip-icon-badge ${getMetricIconFontClass(metricIconText)}`} aria-hidden="true">{metricIconText}</span>
                                        ) : (
                                          <span className="material-icons-round" aria-hidden="true" style={{ fontSize: '14px', marginRight: '0.25rem' }}>{typeMeta.icon}</span>
                                        )}
                                        {metric.name}
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                            </div>

                            <div className="metrics-tool-group metrics-tool-row metrics-tool-row-half">
                              <p className="metrics-tool-label">Paleta číslic</p>
                              <div className="metrics-chip-list">
                                <button
                                  type="button"
                                  className="metrics-chip-btn metrics-chip-btn-digit"
                                  onClick={toggleFormulaLiteralSign}
                                  title="Prepnúť znamienko posledného čísla"
                                >
                                  +/-
                                </button>
                                <button
                                  type="button"
                                  className="metrics-chip-btn metrics-chip-btn-digit"
                                  onClick={appendFormulaDecimalPoint}
                                  title="Pridať desatinnú bodku"
                                >
                                  .
                                </button>
                                {FORMULA_DIGIT_OPTIONS.map((digit) => (
                                  <button
                                    key={`digit-${digit}`}
                                    type="button"
                                    className="metrics-chip-btn metrics-chip-btn-digit"
                                    onClick={() => appendFormulaLiteral(digit)}
                                    title={`Pridať číslicu ${digit}`}
                                  >
                                    {digit}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="metrics-tool-group metrics-tool-row metrics-tool-row-half">
                              <p className="metrics-tool-label">Operátory</p>
                              <div className="metrics-chip-list">
                                {FORMULA_OPERATOR_OPTIONS.map((operator) => (
                                  <button
                                    key={operator.value}
                                    type="button"
                                    className="metrics-chip-btn metrics-chip-btn-op"
                                    onClick={() => appendFormulaOperator(operator.value)}
                                    title="Pridať operátor"
                                  >
                                    {operator.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    ) : null}

                    {validationErrors.length > 0 ? (
                      <div className="metrics-validation-list" role="alert">
                        {validationErrors.map((message, index) => (
                          <p key={`${message}-${index}`}>• {message}</p>
                        ))}
                      </div>
                    ) : null}

                    {formulaWarnings.length > 0 ? (
                      <div className="metrics-warning-list">
                        {formulaWarnings.map((message, index) => (
                          <p key={`${message}-${index}`}>• {message}</p>
                        ))}
                      </div>
                    ) : null}

                    <div className="form-actions" style={{ marginBottom: '0.2rem' }}>
                      <button type="button" className="manager-role-save-btn" onClick={saveMetric} disabled={loading}>
                        {editingMetricId ? 'Uložiť ukazovateľ' : 'Vytvoriť ukazovateľ'}
                      </button>
                    </div>
                  </div>
                ) : null}
                </>
                ) : attendanceSettingsTab === 'periods' ? (
                  <div className="members-categories-stack">
                    <div className="card settings-placeholder-card metrics-section-card">
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon">date_range</span>
                        <h3 className="manager-section-title">Obdobia sezóny</h3>
                      </div>

                      {attendanceSeasons.length === 0 ? (
                        <p className="manager-empty-text" style={{ marginBottom: 0 }}>
                          Zatiaľ nie je uložené žiadne obdobie dochádzky.
                        </p>
                      ) : (
                        <div className="manager-table" style={{ marginTop: '0.45rem' }}>
                          <div className="manager-table-head" style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(170px, 0.9fr) 92px' }}>
                            <div>NÁZOV OBDOBIA</div>
                            <div>Rozpätie</div>
                            <div className="manager-table-actions-head">Akcie</div>
                          </div>

                          {attendanceSeasons.map((season) => (
                            <div key={season.id} className="manager-table-row" style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(170px, 0.9fr) 92px' }}>
                              <div>{season.name}</div>
                              <div>{season.from} – {season.to}</div>
                              <div className="manager-table-actions">
                                <button
                                  type="button"
                                  className="role-action-btn role-action-edit"
                                  onClick={() => startEditSeason(season)}
                                  disabled={loading}
                                  aria-label={`Upraviť sezónu ${season.name}`}
                                  title="Upraviť sezónu"
                                >
                                  <span className="material-icons-round" aria-hidden="true">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="role-action-btn role-action-delete"
                                  onClick={() => openRemovalConfirm('season', season)}
                                  disabled={loading}
                                  aria-label={`Odstrániť sezónu ${season.name}`}
                                  title="Odstrániť sezónu"
                                >
                                  <span className="material-icons-round" aria-hidden="true">delete</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="members-categories-actions">
                      <button
                        type="button"
                        className={`manager-add-btn ${showSeasonForm ? 'category-form-toggle-cancel' : ''}`}
                        onClick={() => {
                          if (showSeasonForm) {
                            setShowSeasonForm(false)
                            setEditingSeasonId(null)
                            setSeasonDraft({ name: '', from: '', to: '' })
                          } else {
                            setShowSeasonForm(true)
                          }
                        }}
                        disabled={loading}
                      >
                        {showSeasonForm ? 'Zavrieť formulár' : 'Pridať sezónu'}
                      </button>
                    </div>

                    {showSeasonForm ? (
                      <div className="card settings-placeholder-card metrics-editor-card" style={{ marginBottom: 0 }}>
                        <div className="metrics-editor-head">
                          <div className="manager-role-heading">
                            <span className="material-icons-round section-icon">event</span>
                            <h3 className="manager-section-title">{editingSeasonId ? 'Úprava sezóny' : 'Nová sezóna'}</h3>
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                          <label htmlFor="season-name">NÁZOV OBDOBIA</label>
                          <input
                            id="season-name"
                            type="text"
                            value={seasonDraft.name}
                            onChange={(event) => setSeasonDraft((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="napr. Jesenná časť"
                          />
                        </div>

                        <div className="form-row" style={{ marginBottom: 0 }}>
                          <div className="form-group">
                            <label htmlFor="season-from">Rozpätie sezóny od</label>
                            <input
                              id="season-from"
                              type="text"
                              value={seasonDraft.from}
                              onChange={(event) => {
                                const rawValue = event.target.value.replace(/[^0-9.]/g, '').slice(0, 5)
                                setSeasonDraft((prev) => ({ ...prev, from: rawValue }))
                              }}
                              placeholder="dd.mm"
                              inputMode="numeric"
                              maxLength={5}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="season-to">Rozpätie sezóny do</label>
                            <input
                              id="season-to"
                              type="text"
                              value={seasonDraft.to}
                              onChange={(event) => {
                                const rawValue = event.target.value.replace(/[^0-9.]/g, '').slice(0, 5)
                                setSeasonDraft((prev) => ({ ...prev, to: rawValue }))
                              }}
                              placeholder="dd.mm"
                              inputMode="numeric"
                              maxLength={5}
                            />
                          </div>
                        </div>

                        <p className="manager-empty-text" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                          Zadávajte iba deň a mesiac (napr. 01.07. až 31.12.). Každý nový rok začína nová sezóna.
                        </p>

                        <div className="form-actions" style={{ marginBottom: '0.2rem', marginTop: '0.9rem' }}>
                          <button type="button" className="manager-role-save-btn" onClick={saveSeason} disabled={loading}>
                            {editingSeasonId ? 'Uložiť zmeny' : 'Uložiť'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                  </div>
                ) : (
                  <>
                  <div className="card settings-placeholder-card metrics-section-card">
                    <div className="metrics-toolbar">
                      <div>
                        <div className="manager-role-heading">
                          <span className="material-icons-round section-icon">table_view</span>
                          <h3 className="manager-section-title">Nastavenie zobrazenia ukazovateľov</h3>
                        </div>
                      </div>
                    </div>

                    {metricsLoading ? (
                      <p className="manager-empty-text">Načítavam ukazovatele...</p>
                    ) : displaySettingsMetrics.length === 0 ? (
                      <p className="manager-empty-text">Nie sú dostupné žiadne zapnuté ukazovatele.</p>
                    ) : (
                      <div className="attendance-display-sections-stack">
                        <div>
                          <div className="attendance-display-matrix-wrap" role="region" aria-label="Horný blok - mriežka kariet">
                            <span className="field-help-icon-wrap attendance-display-help-wrap attendance-display-floating-help" tabIndex={0} aria-describedby="attendance-top-help-tooltip">
                              <span className="material-icons-round field-help-icon" aria-hidden="true">error_outline</span>
                              <span id="attendance-top-help-tooltip" role="tooltip" className="field-help-tooltip">
                                Zobrazuje sa v hornej časti stránky Dochádzka ako karty ukazovateľov.
                              </span>
                            </span>
                            <div className="attendance-display-matrix-scroll">
                            <table className="attendance-display-matrix-table">
                              <thead>
                                <tr>
                                  <th>Horný blok</th>
                                  {displaySettingsMetrics.map((metric) => {
                                    const metricId = String(metric.id)
                                    const shortName = String(metric.shortName || '').trim()
                                    return <th key={`top-metric-col-${metricId}`}>{shortName || metric.name}</th>
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {(Array.isArray(attendanceDisplayDraft?.topBlockRows) ? attendanceDisplayDraft.topBlockRows : []).map((row, index) => (
                                  <tr key={`top-block-row-${row.id}`}>
                                    <td>
                                      <div className="attendance-display-row-name-wrap">
                                        <input
                                          type="text"
                                          className="metrics-control attendance-display-row-name"
                                          value={String(row?.name || '')}
                                          onChange={(event) => renameTopBlockRow(row.id, event.target.value)}
                                        />
                                        <button
                                          type="button"
                                          className="attendance-display-delete-btn"
                                          aria-label={`Odstrániť riadok ${index + 1}`}
                                          onClick={() => removeTopBlockRow(row.id)}
                                        >
                                          <span className="material-icons-round" aria-hidden="true">delete</span>
                                        </button>
                                      </div>
                                    </td>
                                    {displaySettingsMetrics.map((metric) => {
                                      const metricId = String(metric.id)
                                      return (
                                        <td key={`top-cell-${row.id}-${metricId}`} className="attendance-display-matrix-cell">
                                          <input
                                            type="checkbox"
                                            checked={row?.metrics?.[metricId] === true}
                                            onChange={(event) => toggleTopBlockMetricCell(row.id, metricId, event.target.checked)}
                                          />
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="attendance-display-matrix-wrap" role="region" aria-label="Tabuľka - výber stĺpcov">
                            <span className="field-help-icon-wrap attendance-display-help-wrap attendance-display-floating-help" tabIndex={0} aria-describedby="attendance-table-help-tooltip">
                              <span className="material-icons-round field-help-icon" aria-hidden="true">error_outline</span>
                              <span id="attendance-table-help-tooltip" role="tooltip" className="field-help-tooltip">
                                Zobrazuje sa v hlavnej tabuľke Dochádzka hráčov na stránke Dochádzka.
                              </span>
                            </span>
                            <div className="attendance-display-matrix-scroll">
                            <table className="attendance-display-matrix-table">
                              <thead>
                                <tr>
                                  <th>Tabuľka</th>
                                  {displaySettingsMetrics.map((metric) => {
                                    const metricId = String(metric.id)
                                    const shortName = String(metric.shortName || '').trim()
                                    return <th key={`table-metric-col-${metricId}`}>{shortName || metric.name}</th>
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <strong>Dochádzka hráčov</strong>
                                  </td>
                                  {displaySettingsMetrics.map((metric) => {
                                    const metricId = String(metric.id)
                                    return (
                                      <td key={`table-cell-${metricId}`} className="attendance-display-matrix-cell">
                                        <input
                                          type="checkbox"
                                          checked={attendanceDisplayDraft?.tableColumns?.[metricId] !== false}
                                          onChange={(event) => toggleTableMetricCell(metricId, event.target.checked)}
                                        />
                                      </td>
                                    )
                                  })}
                                </tr>
                              </tbody>
                            </table>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="attendance-display-matrix-wrap" role="region" aria-label="Evidencia / Plánovanie - výber stĺpcov">
                            <span className="field-help-icon-wrap attendance-display-help-wrap attendance-display-floating-help" tabIndex={0} aria-describedby="attendance-evidence-help-tooltip">
                              <span className="material-icons-round field-help-icon" aria-hidden="true">error_outline</span>
                              <span id="attendance-evidence-help-tooltip" role="tooltip" className="field-help-tooltip">
                                Zobrazuje sa v evidencii dochádzky a v plánovaní tréningov.
                              </span>
                            </span>
                            <div className="attendance-display-matrix-scroll">
                            <table className="attendance-display-matrix-table">
                              <thead>
                                <tr>
                                  <th>Evidencia / Plánovanie</th>
                                  {displaySettingsMetrics.map((metric) => {
                                    const metricId = String(metric.id)
                                    const shortName = String(metric.shortName || '').trim()
                                    return <th key={`evidence-metric-col-${metricId}`}>{shortName || metric.name}</th>
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <strong>Dochádzka / Plánovanie tréningov</strong>
                                  </td>
                                  {displaySettingsMetrics.map((metric) => {
                                    const metricId = String(metric.id)
                                    return (
                                      <td key={`evidence-cell-${metricId}`} className="attendance-display-matrix-cell">
                                        <input
                                          type="checkbox"
                                          checked={attendanceDisplayDraft?.evidenceColumns?.[metricId] !== false}
                                          onChange={(event) => toggleEvidenceMetricCell(metricId, event.target.checked)}
                                        />
                                      </td>
                                    )
                                  })}
                                </tr>
                              </tbody>
                            </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-actions" style={{ marginTop: '0.9rem' }}>
                    <button
                      type="button"
                      className="manager-add-btn attendance-display-add-card-btn"
                      onClick={addTopBlockRow}
                    >
                      Pridať kartu do horného bloku
                    </button>
                    <button
                      type="button"
                      className="manager-role-save-btn"
                      onClick={saveAttendanceDisplaySettings}
                      disabled={!attendanceDisplayLoaded || attendanceDisplaySaving}
                    >
                      {attendanceDisplaySaving ? 'Ukladám...' : 'Uložiť nastavenia zobrazenia'}
                    </button>
                  </div>
                  </>
                )}
              </div>
            )}

            {activeSettingsSection === 'fields' && canManageFieldsSection && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon" aria-hidden="true">stadium</span>
                    <h3 className="manager-section-title">Správa ihrísk</h3>
                  </div>

                  <p className="manager-warning-text" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
                    Počet častí ihriska bude použitý pri plánovaní tréningov, aby tréneri videli dostupnú časť plochy.
                  </p>

                  {clubFields.length === 0 ? (
                    <p className="manager-empty-text">Zatiaľ nie je uložené žiadne ihrisko.</p>
                  ) : (
                    <div className="manager-table" style={{ marginTop: '0.45rem' }}>
                      <div className="manager-table-head" style={{ gridTemplateColumns: 'minmax(190px, 1fr) minmax(190px, 1fr) minmax(140px, 0.8fr) minmax(110px, 0.7fr) 92px' }}>
                        <div>Názov ihriska</div>
                        <div>Typ ihriska</div>
                        <div>Rozmer</div>
                        <div>Počet častí</div>
                        <div className="manager-table-actions-head">Akcie</div>
                      </div>

                      {clubFields.map((field) => (
                        <div
                          key={field.id}
                          className="manager-table-row"
                          style={{ gridTemplateColumns: 'minmax(190px, 1fr) minmax(190px, 1fr) minmax(140px, 0.8fr) minmax(110px, 0.7fr) 92px' }}
                        >
                          <div>{field.name}</div>
                          <div>{getFieldSurfaceTypeLabel(field.surfaceType)}</div>
                          <div>{field.dimensions}</div>
                          <div>{field.partsTotal || '—'}</div>
                          <div className="manager-table-actions">
                            <button
                              type="button"
                              className="role-action-btn role-action-edit"
                              onClick={() => startEditField(field)}
                              disabled={loading}
                              aria-label={`Upraviť ihrisko ${field.name}`}
                              title="Upraviť ihrisko"
                            >
                              <span className="material-icons-round" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              className="role-action-btn role-action-delete"
                              onClick={() => openRemovalConfirm('field', field)}
                              disabled={loading}
                              aria-label={`Odstrániť ihrisko ${field.name}`}
                              title="Odstrániť ihrisko"
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="members-categories-actions">
                  <button
                    type="button"
                    className={`manager-add-btn ${showFieldForm ? 'category-form-toggle-cancel' : ''}`}
                    onClick={() => {
                      if (showFieldForm) {
                        setShowFieldForm(false)
                        setEditingFieldId(null)
                        setFieldDraft(createDefaultFieldDraft())
                      } else {
                        setEditingFieldId(null)
                        setFieldDraft(createDefaultFieldDraft())
                        setShowFieldForm(true)
                      }
                    }}
                    disabled={loading}
                  >
                    {showFieldForm ? (editingFieldId ? 'Zrušiť úpravu' : 'Zavrieť formulár') : 'Pridať ihrisko'}
                  </button>
                </div>

                {showFieldForm ? (
                  <div className="card settings-placeholder-card metrics-editor-card" style={{ marginBottom: 0 }}>
                    <div className="metrics-editor-head">
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon">{editingFieldId ? 'edit_location_alt' : 'add_location_alt'}</span>
                        <h3 className="manager-section-title">{editingFieldId ? 'Upraviť ihrisko' : 'Nové ihrisko'}</h3>
                      </div>
                    </div>

                    <div className="form-row" style={{ marginBottom: '0.9rem' }}>
                      <div className="form-group">
                        <label htmlFor="field-name">Názov ihriska</label>
                        <input
                          id="field-name"
                          type="text"
                          value={fieldDraft.name}
                          onChange={(event) => setFieldDraft((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="napr. Hlavné ihrisko A"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="field-surface-type">Typ ihriska</label>
                        <select
                          id="field-surface-type"
                          value={fieldDraft.surfaceType}
                          onChange={(event) => setFieldDraft((prev) => ({ ...prev, surfaceType: event.target.value }))}
                        >
                          <option value="">Vyberte typ ihriska</option>
                          {fieldTypeOptions.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row" style={{ marginBottom: 0 }}>
                      <div className="form-group">
                        <label htmlFor="field-dimensions">Rozmer ihriska</label>
                        <input
                          id="field-dimensions"
                          type="text"
                          value={fieldDraft.dimensions}
                          onChange={(event) => setFieldDraft((prev) => ({ ...prev, dimensions: event.target.value }))}
                          placeholder="napr. 105 × 68 m"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="field-parts-total" className="field-parts-label">
                          <span>Počet častí ihriska</span>
                          <span className="field-help-icon-wrap" tabIndex={0} aria-describedby="field-parts-help-tooltip">
                            <span
                              className="material-icons-round field-help-icon"
                              aria-hidden="true"
                            >
                              error_outline
                            </span>
                            <span id="field-parts-help-tooltip" role="tooltip" className="field-help-tooltip">
                              Určuje, na koľko častí sa ihrisko rozdelí v plánovači tréningov. Tréner potom rezervuje počet častí a ostatní vidia zvyšnú dostupnú kapacitu.
                            </span>
                          </span>
                        </label>
                        <div className="field-parts-input-wrap">
                          <input
                            id="field-parts-total"
                            className="field-parts-input"
                            type="number"
                            min={1}
                            step={1}
                            value={fieldDraft.partsTotal}
                            onChange={(event) => {
                              const numericValue = String(event.target.value || '').replace(/[^0-9]/g, '')
                              setFieldDraft((prev) => ({ ...prev, partsTotal: numericValue }))
                            }}
                            placeholder="napr. 2 alebo 4"
                          />

                          <div className="field-parts-stepper" role="group" aria-label="Ovládanie počtu častí ihriska">
                            <button
                              type="button"
                              className="field-parts-step-btn"
                              onClick={() => adjustFieldPartsTotal(1)}
                              aria-label="Zvýšiť počet častí"
                              title="Zvýšiť"
                            >
                              <span className="material-icons-round" aria-hidden="true">keyboard_arrow_up</span>
                            </button>
                            <button
                              type="button"
                              className="field-parts-step-btn"
                              onClick={() => adjustFieldPartsTotal(-1)}
                              aria-label="Znížiť počet častí"
                              title="Znížiť"
                            >
                              <span className="material-icons-round" aria-hidden="true">keyboard_arrow_down</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="manager-empty-text" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                      Príklad: ak tréner vyberie polovicu ihriska, v plánovaní bude ostatným dostupná len druhá polovica.
                    </p>

                    <div className="form-actions" style={{ marginBottom: '0.2rem', marginTop: '0.9rem' }}>
                      <button type="button" className="manager-role-save-btn" onClick={saveField} disabled={loading}>
                        {editingFieldId ? 'Uložiť zmeny' : 'Uložiť ihrisko'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeSettingsSection === 'trainings' && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card attendance-settings-menu-card">
                  <div className="attendance-settings-menu" role="tablist" aria-label="Menu tréningov">
                    <button
                      type="button"
                      className={`attendance-settings-menu-item ${trainingsSettingsTab === 'divisions' ? 'active' : ''}`}
                      onClick={() => setTrainingsSettingsTab('divisions')}
                      role="tab"
                      aria-selected={trainingsSettingsTab === 'divisions'}
                    >
                      Rozdelenie tréningov
                    </button>
                    <span className="attendance-settings-menu-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className={`attendance-settings-menu-item ${trainingsSettingsTab === 'displaySettings' ? 'active' : ''}`}
                      onClick={() => setTrainingsSettingsTab('displaySettings')}
                      role="tab"
                      aria-selected={trainingsSettingsTab === 'displaySettings'}
                    >
                      Nastavenia zobrazenia tréningov
                    </button>
                  </div>
                </div>

                {trainingsSettingsTab === 'divisions' ? (
                  <>
                    <div className="card settings-placeholder-card metrics-section-card">
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon" aria-hidden="true">sports</span>
                        <h3 className="manager-section-title">Rozdelenie tréningov</h3>
                      </div>

                      {trainingDivisions.length === 0 ? (
                        <p className="manager-empty-text" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                          Zatiaľ nie je vytvorený žiadny názov delenia.
                        </p>
                      ) : (
                        <div className="manager-table manager-table-training-divisions" style={{ marginTop: '0.45rem' }}>
                          <div className="manager-table-head">
                            <div>Názov delenia</div>
                            <div className="manager-table-actions-head">Akcie</div>
                          </div>
                          {trainingDivisions.map((division) => (
                            <div key={division.id} className="manager-table-row">
                              <div>{division.name}</div>
                              <div className="manager-table-actions">
                                <button
                                  type="button"
                                  className="role-action-btn role-action-edit"
                                  onClick={() => startEditTrainingDivision(division)}
                                  aria-label={`Upraviť delenie ${division.name}`}
                                  title="Upraviť delenie"
                                >
                                  <span className="material-icons-round" aria-hidden="true">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="role-action-btn role-action-delete"
                                  onClick={() => removeTrainingDivision(division)}
                                  aria-label={`Odstrániť delenie ${division.name}`}
                                  title="Odstrániť delenie"
                                >
                                  <span className="material-icons-round" aria-hidden="true">delete</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="members-categories-actions">
                      <button
                        type="button"
                        className={`manager-add-btn ${showTrainingDivisionForm ? 'category-form-toggle-cancel' : ''}`}
                        onClick={() => {
                          if (showTrainingDivisionForm) {
                            setShowTrainingDivisionForm(false)
                            setTrainingDivisionDraft({ name: '', groups: [''] })
                            setEditingTrainingDivisionId(null)
                            return
                          }
                          setEditingTrainingDivisionId(null)
                          setShowTrainingDivisionForm(true)
                        }}
                      >
                        {showTrainingDivisionForm ? 'Zavrieť formulár' : 'Vytvoriť názov delenia'}
                      </button>
                    </div>

                    {showTrainingDivisionForm ? (
                      <div className="card settings-placeholder-card metrics-editor-card" style={{ marginBottom: 0 }}>
                        <div className="metrics-editor-head">
                          <div className="manager-role-heading">
                            <span className="material-icons-round section-icon" aria-hidden="true">add_circle</span>
                            <h3 className="manager-section-title">{editingTrainingDivisionId ? 'Upraviť delenie' : 'Nové delenie'}</h3>
                          </div>
                        </div>

                        <div className="form-group training-division-name-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="training-division-name">Názov delenia</label>
                          <input
                            id="training-division-name"
                            type="text"
                            value={trainingDivisionDraft.name}
                            onChange={(event) => setTrainingDivisionDraft((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="napr. Herné jednotky"
                          />
                        </div>

                        <div className="form-group training-division-groups-block" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                          <label>jednotlivé skupiny</label>

                          <div className="training-division-group-rows">
                            {(Array.isArray(trainingDivisionDraft.groups) ? trainingDivisionDraft.groups : ['']).map((groupName, groupIndex) => (
                              <div key={`training-division-group-${groupIndex}`} className="training-division-group-row">
                                <input
                                  type="text"
                                  className="training-division-group-input"
                                  value={groupName}
                                  onChange={(event) => updateTrainingDivisionGroupRow(groupIndex, event.target.value)}
                                  placeholder={`Skupina ${groupIndex + 1}`}
                                />
                                <button
                                  type="button"
                                  className="training-division-remove-row-btn"
                                  onClick={() => removeTrainingDivisionGroupRow(groupIndex)}
                                  aria-label={`Odstrániť skupinu ${groupIndex + 1}`}
                                  title="Odstrániť pole"
                                >
                                  <span className="material-icons-round" aria-hidden="true">close</span>
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="training-division-add-row-btn"
                            onClick={addTrainingDivisionGroupRow}
                          >
                            pridať riadok
                          </button>
                        </div>

                        <div className="form-actions" style={{ marginBottom: '0.2rem', marginTop: '0.9rem' }}>
                          <button type="button" className="manager-role-save-btn" onClick={createTrainingDivision}>
                            {editingTrainingDivisionId ? 'Uložiť zmeny' : 'Vytvoriť'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="card settings-placeholder-card metrics-section-card training-display-settings-card">
                    <div className="manager-role-heading">
                      <span className="material-icons-round section-icon" aria-hidden="true">analytics</span>
                      <h3 className="manager-section-title">Nastavenia zobrazenia tréningov</h3>
                    </div>

                    <p className="manager-empty-text" style={{ marginTop: 0, marginBottom: '0.7rem' }}>
                      Vyberte, ktoré rozdelenia tréningov sa budú zobrazovať vo formulári "Vytvoriť nové cvičenie".
                    </p>

                    <div className="manager-table training-display-settings-table" style={{ marginTop: 0 }}>
                      <div className="manager-table-head">
                        <div>Rozdelenie tréningov</div>
                        <div className="metrics-col-center">Zobraziť vo formulári</div>
                      </div>

                      {trainingDivisions.length === 0 ? (
                        <div className="manager-table-row">
                          <div className="manager-empty-text" style={{ margin: 0 }}>
                            Najskôr vytvorte rozdelenie tréningov.
                          </div>
                          <div />
                        </div>
                      ) : (
                        trainingDivisions.map((division) => {
                          const divisionId = String(division?.id || '')
                          const divisionConfig = trainingExerciseDisplaySettings?.divisions?.[divisionId] || {}
                          const isVisible = divisionConfig?.visible !== false

                          return (
                            <div key={`training-display-config-${divisionId}`} className="manager-table-row">
                              <div className="training-display-division-name">
                                <strong>{division.name || 'Delenie tréningov'}</strong>
                              </div>
                              <div className="metrics-col-center">
                                <label className="metrics-switch" title="Zapnúť/vypnúť zobrazenie tejto sekcie">
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={(event) => {
                                      const nextVisible = event.target.checked
                                      setTrainingExerciseDisplaySettings((prev) => ({
                                        ...prev,
                                        divisions: {
                                          ...(prev?.divisions && typeof prev.divisions === 'object' ? prev.divisions : {}),
                                          [divisionId]: { visible: nextVisible }
                                        },
                                        defaultDivisionId: nextVisible
                                          ? (String(prev?.defaultDivisionId || '') || divisionId)
                                          : (String(prev?.defaultDivisionId || '') === divisionId
                                              ? String(trainingDivisions.find((item) => String(item?.id || '') !== divisionId && ((prev?.divisions?.[String(item?.id || '')]?.visible) !== false))?.id || '')
                                              : String(prev?.defaultDivisionId || ''))
                                      }))
                                    }}
                                  />
                                  <span className="metrics-switch-track" aria-hidden="true" />
                                </label>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="form-actions" style={{ marginTop: '0.9rem' }}>
                      <button
                        type="button"
                        className="manager-role-save-btn"
                        onClick={saveTrainingExerciseDisplaySettings}
                        disabled={trainingExerciseDisplaySaving}
                      >
                        {trainingExerciseDisplaySaving ? 'Ukladám...' : 'Uložiť nastavenia zobrazenia'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSettingsSection === 'exercises' && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card metrics-section-card">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon" aria-hidden="true">fitness_center</span>
                    <h3 className="manager-section-title">Nastavenia cvičení</h3>
                  </div>

                  {exerciseCategories.length === 0 ? (
                    <p className="manager-empty-text" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                      Zatiaľ neexistujú žiadne kategórie cvičení.
                    </p>
                  ) : (
                    <div className="manager-table manager-table-exercise-categories" style={{ marginTop: '0.45rem' }}>
                      <div className="manager-table-head" style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(240px, 1.2fr) 92px' }}>
                        <div>Kategória cvičení</div>
                        <div>Podkategórie</div>
                        <div className="manager-table-actions-head">Akcie</div>
                      </div>
                      {exerciseCategories.map((category) => (
                        <div
                          key={category.id}
                          className={`manager-table-row ${String(draggedExerciseCategoryId || '') === String(category.id) ? 'dragging' : ''} ${String(exerciseCategoryDropTargetId || '') === String(category.id) ? 'drag-over' : ''}`}
                          style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(240px, 1.2fr) 92px' }}
                          draggable
                          onDragStart={() => startExerciseCategoryDrag(category.id)}
                          onDragOver={(event) => handleExerciseCategoryDragOver(event, category.id)}
                          onDrop={() => handleExerciseCategoryDrop(category.id)}
                          onDragEnd={endExerciseCategoryDrag}
                        >
                          <div className="exercise-category-name-cell">
                            <span className="material-icons-round exercise-drag-handle" aria-hidden="true">drag_indicator</span>
                            <span>{category.name}</span>
                          </div>
                          <div>{Array.isArray(category.subcategories) && category.subcategories.length > 0 ? category.subcategories.join(', ') : '—'}</div>
                          <div className="manager-table-actions">
                            <button
                              type="button"
                              className="role-action-btn role-action-edit"
                              onClick={() => startEditExerciseCategory(category)}
                              aria-label={`Upraviť kategóriu cvičení ${category.name}`}
                              title="Upraviť kategóriu"
                            >
                              <span className="material-icons-round" aria-hidden="true">edit</span>
                            </button>
                            <button
                              type="button"
                              className="role-action-btn role-action-delete"
                              onClick={() => removeExerciseCategory(category)}
                              aria-label={`Odstrániť kategóriu cvičení ${category.name}`}
                              title="Odstrániť kategóriu"
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="members-categories-actions">
                  <button
                    type="button"
                    className={`manager-add-btn ${showExerciseCategoryForm ? 'category-form-toggle-cancel' : ''}`}
                    onClick={() => {
                      if (showExerciseCategoryForm) {
                        setShowExerciseCategoryForm(false)
                        setExerciseCategoryDraft({ name: '', subcategories: [''], assignedDivisionGroups: {} })
                        setEditingExerciseCategoryId(null)
                        return
                      }
                      setEditingExerciseCategoryId(null)
                      setShowExerciseCategoryForm(true)
                    }}
                  >
                    {showExerciseCategoryForm ? 'Zavrieť formulár' : 'Vytvoriť kategóriu cvičení'}
                  </button>
                </div>

                {showExerciseCategoryForm ? (
                  <div className="card settings-placeholder-card metrics-editor-card" style={{ marginBottom: 0 }}>
                    <div className="metrics-editor-head">
                      <div className="manager-role-heading">
                        <span className="material-icons-round section-icon" aria-hidden="true">add_circle</span>
                        <h3 className="manager-section-title">{editingExerciseCategoryId ? 'Upraviť kategóriu cvičení' : 'Nová kategória cvičení'}</h3>
                      </div>
                    </div>

                    <div className="form-group training-division-name-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="exercise-category-name">Kategória cvičení</label>
                      <input
                        id="exercise-category-name"
                        type="text"
                        value={exerciseCategoryDraft.name}
                        onChange={(event) => setExerciseCategoryDraft((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="napr. Koordinačné cvičenia"
                      />
                    </div>

                    <div className="form-group training-division-groups-block" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                      <label>Podkategórie cvičení</label>

                      <div className="training-division-group-rows">
                        {(Array.isArray(exerciseCategoryDraft.subcategories) ? exerciseCategoryDraft.subcategories : ['']).map((subcategoryName, subIndex) => (
                          <div
                            key={`exercise-subcategory-${subIndex}`}
                            className={`training-division-group-row ${draggedExerciseSubcategoryIndex === subIndex ? 'dragging' : ''} ${exerciseSubcategoryDropTargetIndex === subIndex ? 'drag-over' : ''}`}
                            draggable
                            onDragStart={() => startExerciseSubcategoryDrag(subIndex)}
                            onDragOver={(event) => handleExerciseSubcategoryDragOver(event, subIndex)}
                            onDrop={() => handleExerciseSubcategoryDrop(subIndex)}
                            onDragEnd={endExerciseSubcategoryDrag}
                          >
                            <span className="material-icons-round exercise-drag-handle" aria-hidden="true">drag_indicator</span>
                            <input
                              type="text"
                              className="training-division-group-input"
                              value={subcategoryName}
                              onChange={(event) => updateExerciseSubcategoryRow(subIndex, event.target.value)}
                              placeholder={`Podkategória ${subIndex + 1}`}
                            />
                            <button
                              type="button"
                              className="training-division-remove-row-btn"
                              onClick={() => removeExerciseSubcategoryRow(subIndex)}
                              aria-label={`Odstrániť podkategóriu ${subIndex + 1}`}
                              title="Odstrániť pole"
                            >
                              <span className="material-icons-round" aria-hidden="true">close</span>
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="training-division-add-row-btn"
                        onClick={addExerciseSubcategoryRow}
                      >
                        pridať riadok
                      </button>
                    </div>

                    <div className="form-actions" style={{ marginBottom: '0.2rem', marginTop: '0.9rem' }}>
                      <button type="button" className="manager-role-save-btn" onClick={createExerciseCategory}>
                        {editingExerciseCategoryId ? 'Uložiť zmeny' : 'Vytvoriť'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeSettingsSection === 'visibleSections' && (
              <>
              <div className="card settings-placeholder-card">
                <div className="manager-role-heading">
                  <span className="material-icons-round section-icon">view_sidebar</span>
                  <h3 className="manager-section-title">Zobrazené sekcie</h3>
                </div>

                <p className="manager-warning-text" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
                  Zvoľte, ktoré sekcie menu sa majú zobrazovať jednotlivým rolám.
                </p>

                <div className="settings-roles-grid">
                  {SETTINGS_ROLES.map((role) => (
                    <div key={role.key} className="settings-role-card">
                      <h4 className="settings-role-title">{role.label}</h4>

                      <div className="settings-section-list" role="group" aria-label={`Sekcie pre rolu ${role.label}`}>
                        {VISIBLE_SECTION_OPTIONS.map((section) => (
                          <label key={`${role.key}-${section.key}`} className="settings-section-item">
                            <input
                              type="checkbox"
                              checked={(visibleSectionsDraft[role.key] || []).includes(section.key)}
                              onChange={(e) => toggleVisibleSection(role.key, section.key, e.target.checked)}
                            />
                            <span>{section.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions basic-section-actions">
                <button type="button" className="manager-role-save-btn" onClick={saveVisibleSections}>
                  Uložiť zobrazené sekcie
                </button>
              </div>
              </>
            )}

            {activeSettingsSection === 'trainerFunctions' && (
              <div className="members-categories-stack">
                <div className="card settings-placeholder-card">
                  <div className="manager-role-heading">
                    <span className="material-icons-round section-icon">badge</span>
                    <h3 className="manager-section-title">Funkcie trénerov</h3>
                  </div>

                  <p className="manager-warning-text" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
                    Tu môžete vytvoriť funkcie trénerov, ktoré sa zobrazia v dropdowne „Funkcia“ v časti Členovia klubu → Tréneri.
                  </p>

                  {trainerFunctionOptions.length === 0 ? (
                    <p className="manager-empty-text">Zatiaľ neexistujú žiadne funkcie trénerov.</p>
                  ) : (
                    <div className="manager-table manager-table-trainer-functions">
                      <div className="manager-table-head">
                        <div>Názov funkcie</div>
                        <div className="manager-table-actions-head">Akcie</div>
                      </div>

                      {trainerFunctionOptions.map((trainerFunction) => (
                        <div key={trainerFunction.id} className="manager-table-row">
                          <div className="manager-table-name">
                            <strong>{trainerFunction.name}</strong>
                          </div>

                          <div className="manager-table-actions">
                            {!trainerFunction.isDefault ? (
                              <button
                                type="button"
                                className="role-action-btn role-action-edit"
                                onClick={() => startEditTrainerFunction(trainerFunction)}
                                disabled={loading}
                                aria-label={`Upraviť funkciu ${trainerFunction.name}`}
                                title="Upraviť funkciu"
                              >
                                <span className="material-icons-round" aria-hidden="true">edit</span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={`role-action-btn ${trainerFunction.isDefault ? '' : 'role-action-delete'}`}
                              onClick={() => openRemovalConfirm('trainerFunction', trainerFunction)}
                              disabled={loading || Boolean(trainerFunction.isDefault)}
                              aria-label={`Odstrániť funkciu ${trainerFunction.name}`}
                              title={trainerFunction.isDefault ? 'Predvolenú funkciu nie je možné odstrániť' : 'Odstrániť funkciu'}
                            >
                              <span className="material-icons-round" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="members-categories-actions">
                  <button
                    type="button"
                    className={`manager-add-btn ${showTrainerFunctionForm ? 'category-form-toggle-cancel' : ''}`}
                    onClick={() => {
                      if (showTrainerFunctionForm) {
                        setShowTrainerFunctionForm(false)
                        setTrainerFunctionDraft({ name: '' })
                        setEditingTrainerFunctionId(null)
                      } else {
                        setShowTrainerFunctionForm(true)
                        setEditingTrainerFunctionId(null)
                      }
                    }}
                    disabled={loading}
                  >
                    {showTrainerFunctionForm ? 'Zrušiť formulár' : 'Vytvoriť funkciu'}
                  </button>
                </div>

                {showTrainerFunctionForm ? (
                  <div ref={trainerFunctionFormRef} className="card settings-placeholder-card">
                    <div className="form-row" style={{ marginBottom: '0.9rem' }}>
                      <div className="form-group trainer-photo-full-row">
                        <label htmlFor="trainer-function-name">Názov funkcie trénera</label>
                        <input
                          id="trainer-function-name"
                          type="text"
                          value={trainerFunctionDraft.name}
                          onChange={(e) => setTrainerFunctionDraft((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="napr. Tréner techniky"
                        />
                      </div>
                    </div>

                    <div className="form-actions" style={{ marginBottom: '0.2rem' }}>
                      <button type="button" className="manager-role-save-btn" onClick={saveTrainerFunction} disabled={loading}>
                        {editingTrainerFunctionId ? 'Uložiť funkciu' : 'Vytvoriť funkciu'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDialog.open ? (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" aria-label="Potvrdenie odstránenia">
          <div className="confirm-modal-card">
            <h3>
              {confirmDialogConfig.title}
            </h3>
            <p>
              {confirmDialogConfig.message}
            </p>

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeRemovalConfirm}
                disabled={loading}
              >
                Zrušiť
              </button>
              <button
                type="button"
                className="manager-add-btn category-form-toggle-cancel"
                onClick={confirmRemoval}
                disabled={loading}
              >
                {confirmDialogConfig.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MyClub
