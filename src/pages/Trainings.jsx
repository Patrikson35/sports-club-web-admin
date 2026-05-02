import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '../api'
import TimeClockPickerModal from '../components/TimeClockPickerModal'
import './Trainings.css'

const MONTH_NAMES = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December']
const WEEK_DAYS = ['PO', 'UT', 'ST', 'ŠT', 'PI', 'SO', 'NE']
const METRIC_COLORS = {
  TJ: '#facc15',
  PZ: '#fb923c',
  MZ: '#ef4444',
  CUP: '#ec4899'
}
const METRIC_PRIORITY = ['TJ', 'PZ', 'MZ', 'CUP']
const MEDIA_API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '')

const pad2 = (value) => String(value).padStart(2, '0')

const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const toDisplayDate = (dateKey) => {
  const value = String(dateKey || '')
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  return `${match[3]}. ${match[2]}. ${match[1]}`
}

const getMondayBasedDayIndex = (date) => (date.getDay() + 6) % 7

const buildCalendarCells = (monthDate) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const startOffset = getMondayBasedDayIndex(firstDayOfMonth)
  const cells = []

  for (let index = 0; index < 42; index += 1) {
    let dayDate
    let muted = false

    if (index < startOffset) {
      const day = daysInPrevMonth - startOffset + index + 1
      dayDate = new Date(year, month - 1, day)
      muted = true
    } else if (index < startOffset + daysInMonth) {
      const day = index - startOffset + 1
      dayDate = new Date(year, month, day)
    } else {
      const day = index - (startOffset + daysInMonth) + 1
      dayDate = new Date(year, month + 1, day)
      muted = true
    }

    cells.push({
      key: `training-calendar-cell-${year}-${month}-${index}`,
      day: dayDate.getDate(),
      dateKey: toDateKey(dayDate),
      muted
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

const resolveMetricCodeFromSession = (session) => {
  const recurrenceMeta = parsePlannerRecurrenceRule(session?.recurrenceRule || session?.recurrence_rule)
  const metaCode = String(recurrenceMeta?.indicatorCode || '').trim().toUpperCase()
  if (metaCode && METRIC_COLORS[metaCode]) return metaCode

  const sessionType = String(session?.sessionType || session?.session_type || session?.type || '').trim().toLowerCase()
  if (sessionType === 'training') return 'TJ'
  if (sessionType === 'match') return 'PZ'
  if (sessionType === 'friendly_match' || sessionType === 'cancelled') return 'MZ'
  if (sessionType === 'tournament') return 'CUP'
  return 'TJ'
}

const resolveDateKeyFromSession = (session) => {
  const dateValue = session?.date
    || session?.training_date
    || session?.scheduled_date
    || session?.session_date
    || session?.event_date

  if (dateValue) {
    const dateMatch = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (dateMatch) return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    const parsed = new Date(String(dateValue))
    if (!Number.isNaN(parsed.getTime())) return toDateKey(parsed)
  }

  const startDateValue = session?.startAt || session?.start_at
  if (!startDateValue) return ''
  const startDateMatch = String(startDateValue).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (startDateMatch) return `${startDateMatch[1]}-${startDateMatch[2]}-${startDateMatch[3]}`
  const startDate = new Date(String(startDateValue))
  if (Number.isNaN(startDate.getTime())) return ''
  return toDateKey(startDate)
}

const toHourMinuteFromDateCandidate = (value) => {
  if (!value) return ''
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return ''
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`
}

const resolveStartTimeFromSession = (session) => {
  const direct = String(session?.startTime || session?.start_time || session?.time_from || session?.from_time || '').trim()
  const match = direct.match(/^(\d{1,2}:\d{2})/)
  if (match) return match[1]
  return toHourMinuteFromDateCandidate(session?.startAt || session?.start_at)
}

const toMinutesFromHHmm = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return Number.POSITIVE_INFINITY
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY
  return (Math.max(0, Math.min(23, hour)) * 60) + Math.max(0, Math.min(59, minute))
}

const toCleanText = (value) => {
  if (Array.isArray(value)) {
    const normalizedList = value
      .map((item) => toCleanText(item))
      .filter(Boolean)
    return normalizedList.join(', ')
  }

  if (value && typeof value === 'object') {
    return toCleanText(value.name || value.title || value.label || value.value || value.key || '')
  }

  return String(value || '').trim()
}

const toLookupKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')

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

const getYoutubeThumbnailUrl = (youtubeVideoId) => {
  const id = String(youtubeVideoId || '').trim()
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}

const getExercisePreviewImage = (item) => {
  const uploadedImage = resolveMediaUrl(item?.imageUrl || item?.image || item?.thumbnail)
  if (uploadedImage) return uploadedImage

  const youtubeVideoId = String(item?.youtube?.videoId || item?.youtubeVideoId || '').trim()
  return getYoutubeThumbnailUrl(youtubeVideoId)
}

const addCategoryDefinitionsToMap = (categories, targetMap) => {
  const source = Array.isArray(categories) ? categories : []
  const map = targetMap instanceof Map ? targetMap : new Map()

  source.forEach((category) => {
    const categoryName = toCleanText(category?.name || category?.title || category?.label || category)
    const normalizedCategoryKey = toLookupKey(categoryName)
    if (!categoryName) return

    if (!map.has(normalizedCategoryKey)) map.set(normalizedCategoryKey, new Set())
    const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : []

    subcategories.forEach((subcategory) => {
      const subcategoryName = toCleanText(subcategory?.name || subcategory?.title || subcategory?.label || subcategory)
      if (subcategoryName) map.get(normalizedCategoryKey).add(subcategoryName)
    })
  })

  return map
}

const normalizeExerciseMeta = (exercise) => {
  const source = (exercise && typeof exercise === 'object') ? exercise : {}
  const asText = (value) => {
    if (Array.isArray(value)) {
      const normalizedList = value
        .map((item) => asText(item))
        .filter(Boolean)
      return normalizedList.join(', ')
    }

    if (value && typeof value === 'object') {
      const fromObject = value.name
        || value.title
        || value.label
        || value.value
        || value.key
        || ''
      return asText(fromObject)
    }

    return String(value || '').trim()
  }

  return {
    id: asText(source.id),
    name: asText(source.name || source.title || source.exerciseName || 'Cvičenie'),
    focus: asText(source.focus || source.description || source.goal || source.objective || ''),
    minutes: Number(source.minutes || source.duration || source.defaultDuration || 10) || 10,
    category: asText(source.category || source.categoryName || source.category_name || source.exercise_category || source.mainCategory || source.type || ''),
    subcategory: asText(source.subcategory || source.subcategoryName || source.subcategory_name || source.exercise_subcategory || source.skill || source.topic || ''),
    categories: Array.isArray(source.categories)
      ? source.categories.map((item) => asText(item)).filter(Boolean)
      : [],
    subcategories: Array.isArray(source.subcategories)
      ? source.subcategories.map((item) => asText(item)).filter(Boolean)
      : [],
    subcategoriesByCategory: (source.subcategoriesByCategory && typeof source.subcategoriesByCategory === 'object')
      ? source.subcategoriesByCategory
      : {},
    playerCount: asText(source.playerCount || source.player_count || source.players_count || source.numberOfPlayers || source.players || ''),
    intensity: asText(source.intensity || source.load || source.difficulty || source.level || ''),
    rating: Number.parseInt(String(source.rating || 0), 10) || 0,
    imageUrl: resolveMediaUrl(source.imageUrl || source.image || source.thumbnail || ''),
    youtube: source?.youtube && typeof source.youtube === 'object'
      ? {
          url: asText(source.youtube.url || ''),
          videoId: asText(source.youtube.videoId || source.youtube.id || '')
        }
      : {
          url: asText(source.youtubeUrl || ''),
          videoId: asText(source.youtubeVideoId || '')
        },
    isSystem: Boolean(source.isSystem)
  }
}

const normalizeTrainingsList = (source) => {
  const parsed = Array.isArray(source) ? source : []

  return parsed
    .map((item, index) => {
      const dateValue = item?.date
        || item?.training_date
        || item?.scheduled_date
        || item?.session_date
        || item?.event_date
        || item?.startAt
        || item?.start_at

      const dateText = String(dateValue || '').trim()
      const date = dateText ? dateText : new Date().toISOString()

      const rawExercises = Array.isArray(item?.exercises)
        ? item.exercises
        : Array.isArray(item?.items)
          ? item.items
          : []

      const parsedExerciseCount = Number(item?.exerciseCount ?? item?.exercise_count ?? item?.exercises_count)
      const exerciseCount = Number.isFinite(parsedExerciseCount)
        ? Math.max(0, parsedExerciseCount)
        : rawExercises.length

      const statusValue = String(item?.status || '').trim().toLowerCase()
      const isCompleted = statusValue === 'completed' || item?.isCompleted === true

      const id = String(item?.id || item?.sessionId || item?.session_id || `${date}-${index + 1}`).trim()

      return {
        id,
        teamId: String(item?.teamId || item?.team_id || item?.team?.id || '').trim(),
        name: String(item?.name || item?.title || item?.sessionTitle || 'Tréning').trim(),
        date,
        location: String(item?.location || item?.fieldName || item?.field_name || '').trim(),
        exerciseCount,
        status: isCompleted ? 'completed' : 'scheduled'
      }
    })
    .filter((item) => item.id)
    .filter((item) => Number(item.exerciseCount || 0) > 0)
}

const resolveSchoolSeasonKey = (dateValue) => {
  const parsed = new Date(String(dateValue || ''))
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = parsed.getMonth() + 1
  const seasonStartYear = month >= 7 ? year : year - 1
  return `${seasonStartYear}/${seasonStartYear + 1}`
}

const mergeNormalizedTrainings = (primary = [], secondary = []) => {
  const map = new Map()

  ;(Array.isArray(primary) ? primary : []).forEach((item) => {
    const id = String(item?.id || '').trim()
    if (!id) return
    map.set(id, item)
  })

  ;(Array.isArray(secondary) ? secondary : []).forEach((item) => {
    const id = String(item?.id || '').trim()
    if (!id || map.has(id)) return
    map.set(id, item)
  })

  return Array.from(map.values()).sort((left, right) => {
    const leftTime = new Date(String(left?.date || '')).getTime()
    const rightTime = new Date(String(right?.date || '')).getTime()
    const safeLeft = Number.isFinite(leftTime) ? leftTime : 0
    const safeRight = Number.isFinite(rightTime) ? rightTime : 0
    return safeRight - safeLeft
  })
}

const mapMyClubExerciseToLibraryItem = (item, categoryNameById = new Map()) => {
  const source = (item && typeof item === 'object') ? item : {}

  const selectedCategoryIds = Array.isArray(source.selectedCategoryIds)
    ? source.selectedCategoryIds.map((value) => String(value || '').trim()).filter(Boolean)
    : []

  const selectedCategoryNames = selectedCategoryIds
    .map((id) => String(categoryNameById.get(id) || '').trim())
    .filter(Boolean)

  const categorySelections = (source.categorySelections && typeof source.categorySelections === 'object')
    ? source.categorySelections
    : {}

  const subcategoriesByCategory = {}

  Object.entries(categorySelections).forEach(([rawKey, rawValues]) => {
    const categoryLabel = String(categoryNameById.get(String(rawKey || '').trim()) || rawKey || '').trim()
    const normalizedCategoryKey = toLookupKey(categoryLabel)
    if (!normalizedCategoryKey) return

    const parsedValues = (Array.isArray(rawValues) ? rawValues : [])
      .map((value) => toCleanText(value?.name || value?.title || value?.label || value))
      .filter(Boolean)

    if (parsedValues.length === 0) return

    const existing = Array.isArray(subcategoriesByCategory[normalizedCategoryKey])
      ? subcategoriesByCategory[normalizedCategoryKey]
      : []

    subcategoriesByCategory[normalizedCategoryKey] = [...new Set([...existing, ...parsedValues])]
  })

  const categoryNamesFromSelectionKeys = Object.keys(categorySelections)
    .map((rawKey) => {
      const safeKey = String(rawKey || '').trim()
      if (!safeKey) return ''
      return String(categoryNameById.get(safeKey) || safeKey).trim()
    })
    .filter(Boolean)

  const derivedSubcategories = Object.values(categorySelections)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((value) => {
      if (value && typeof value === 'object') {
        return String(value?.name || value?.title || value?.label || value?.value || '').trim()
      }
      return String(value || '').trim()
    })
    .filter(Boolean)

  const rawCategoryCandidates = [
    String(source.categoryName || '').trim(),
    String(source.mainCategory || '').trim(),
    String(source.category || '').trim(),
    ...selectedCategoryNames,
    ...categoryNamesFromSelectionKeys
  ].filter(Boolean)

  const mergedCategories = [...new Set(rawCategoryCandidates)]

  const primaryCategory = mergedCategories[0] || ''
  const primarySubcategory = String(source.subcategory || '').trim() || derivedSubcategories[0] || ''

  return normalizeExerciseMeta({
    id: source.id,
    name: source.name || source.title,
    description: source.description,
    duration: source.duration,
    intensity: source.intensity,
    rating: source.rating,
    imageUrl: source.imageUrl,
    youtube: source.youtube,
    players: Array.isArray(source.playersCount) ? source.playersCount : source.playerCount,
    categoryName: primaryCategory,
    category: source.category,
    subcategory: primarySubcategory,
    categories: mergedCategories,
    subcategories: derivedSubcategories,
    subcategoriesByCategory,
    isSystem: source.isSystem
  })
}

const mergeExerciseLibraryItems = (baseList = [], clubList = []) => {
  const merged = new Map()

  const pushItem = (item, sourcePriority = 0) => {
    const normalized = (item && typeof item === 'object') ? item : null
    const id = String(normalized?.id || '').trim()
    if (!id || !normalized) return

    const existing = merged.get(id)
    if (!existing) {
      merged.set(id, { ...normalized, __priority: sourcePriority })
      return
    }

    const existingPriority = Number(existing.__priority || 0)
    const nextPriority = Number(sourcePriority || 0)
    const preferNew = nextPriority >= existingPriority

    const mergedCategories = [...new Set([
      ...(Array.isArray(existing.categories) ? existing.categories : []),
      ...(Array.isArray(normalized.categories) ? normalized.categories : []),
      String(existing.category || '').trim(),
      String(normalized.category || '').trim()
    ].filter(Boolean))]

    const mergedSubcategories = [...new Set([
      ...(Array.isArray(existing.subcategories) ? existing.subcategories : []),
      ...(Array.isArray(normalized.subcategories) ? normalized.subcategories : []),
      String(existing.subcategory || '').trim(),
      String(normalized.subcategory || '').trim()
    ].filter(Boolean))]

    const next = {
      ...existing,
      ...(preferNew ? normalized : {}),
      categories: mergedCategories,
      subcategories: mergedSubcategories,
      category: mergedCategories[0] || String((preferNew ? normalized.category : existing.category) || '').trim(),
      subcategory: mergedSubcategories[0] || String((preferNew ? normalized.subcategory : existing.subcategory) || '').trim(),
      __priority: Math.max(existingPriority, nextPriority)
    }

    merged.set(id, next)
  }

  ;(Array.isArray(baseList) ? baseList : []).forEach((item) => pushItem(item, 1))
  ;(Array.isArray(clubList) ? clubList : []).forEach((item) => pushItem(item, 2))

  return Array.from(merged.values()).map((item) => {
    const { __priority, ...clean } = item
    return clean
  })
}

const DEFAULT_COMPOSER_SECTIONS = [
  {
    id: 'warmup',
    order: '01',
    title: 'Prípravná časť',
    estimatedMinutes: 20,
    exercises: []
  },
  {
    id: 'main',
    order: '02',
    title: 'Hlavná časť',
    estimatedMinutes: 55,
    exercises: []
  },
  {
    id: 'finish',
    order: '03',
    title: 'Záver',
    estimatedMinutes: 15,
    exercises: []
  }
]

function Trainings() {
  const [trainings, setTrainings] = useState([])
  const [loading, setLoading] = useState(true)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [teamOptions, setTeamOptions] = useState([])
  const [fieldOptions, setFieldOptions] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState('')
  const [selectedFieldPartsCount, setSelectedFieldPartsCount] = useState('0')
  const [selectedFieldParts, setSelectedFieldParts] = useState([])
  const [isSavingComposer, setIsSavingComposer] = useState(false)
  const [isTimeClockOpen, setIsTimeClockOpen] = useState(false)
  const [isDateCalendarOpen, setIsDateCalendarOpen] = useState(false)
  const [availableExercises, setAvailableExercises] = useState([])
  const [categorySubcategoriesByName, setCategorySubcategoriesByName] = useState({})
  const [exerciseFiltersBySection, setExerciseFiltersBySection] = useState({})
  const [selectedExerciseIdBySection, setSelectedExerciseIdBySection] = useState({})
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [calendarSessions, setCalendarSessions] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [linkedSessionId, setLinkedSessionId] = useState('')
  const [composerError, setComposerError] = useState('')
  const [composerSuccess, setComposerSuccess] = useState('')
  const [sessionMeta, setSessionMeta] = useState({
    date: new Date().toISOString().slice(0, 10),
    timeFrom: '16:00',
    location: ''
  })
  const [sections, setSections] = useState(DEFAULT_COMPOSER_SECTIONS)
  const [draggedExercise, setDraggedExercise] = useState({ sectionId: '', exerciseId: '' })
  const [dragOverExerciseIdBySection, setDragOverExerciseIdBySection] = useState({})
  const [rowActionLoadingId, setRowActionLoadingId] = useState('')
  const [linkedSessionName, setLinkedSessionName] = useState('')
  const [viewTrainingDetail, setViewTrainingDetail] = useState(null)
  const [editConfirmDialog, setEditConfirmDialog] = useState({ open: false, training: null })

  useEffect(() => {
    loadTrainings()
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadExerciseLibrary = async () => {
      const categoryDefinitionMap = new Map()
      let normalizedFromExercisesApi = []

      try {
        const categoryResponse = await api.getExerciseCategories()
        if (isMounted) {
          addCategoryDefinitionsToMap(categoryResponse?.categories, categoryDefinitionMap)
        }
      } catch {
        // Club views may not have this endpoint fully populated; fallback below still applies.
      }

      try {
        const response = await api.getExercises()
        if (!isMounted) return

        normalizedFromExercisesApi = (Array.isArray(response?.exercises) ? response.exercises : [])
          .map((item) => normalizeExerciseMeta(item))
          .filter((item) => item.id)
      } catch {
        normalizedFromExercisesApi = []
      }

      try {
        const myClubResponse = await api.getMyClub()
        if (!isMounted) return

        addCategoryDefinitionsToMap(myClubResponse?.exerciseCategories, categoryDefinitionMap)

        const categoryNameById = new Map(
          (Array.isArray(myClubResponse?.exerciseCategories) ? myClubResponse.exerciseCategories : [])
            .map((category) => [String(category?.id || '').trim(), String(category?.name || '').trim()])
            .filter(([id, name]) => id && name)
        )

        const myClubItems = Array.isArray(myClubResponse?.exerciseDatabaseItems)
          ? myClubResponse.exerciseDatabaseItems
          : (Array.isArray(myClubResponse?.exerciseItems) ? myClubResponse.exerciseItems : [])

        const normalizedFromMyClub = myClubItems
          .map((item) => mapMyClubExerciseToLibraryItem(item, categoryNameById))
          .filter((item) => item.id)

        const merged = mergeExerciseLibraryItems(normalizedFromExercisesApi, normalizedFromMyClub)
        setAvailableExercises(merged)
        setCategorySubcategoriesByName(Object.fromEntries(
          Array.from(categoryDefinitionMap.entries()).map(([key, value]) => [
            key,
            Array.from(value).sort((a, b) => a.localeCompare(b, 'sk'))
          ])
        ))
      } catch {
        if (isMounted) {
          setAvailableExercises(normalizedFromExercisesApi)
          setCategorySubcategoriesByName(Object.fromEntries(
            Array.from(categoryDefinitionMap.entries()).map(([key, value]) => [
              key,
              Array.from(value).sort((a, b) => a.localeCompare(b, 'sk'))
            ])
          ))
        }
      }
    }

    loadExerciseLibrary()

    return () => {
      isMounted = false
    }
  }, [])

  const loadTrainings = async (fallbackSource = []) => {
    try {
      const data = await api.getTrainings()
      const source = Array.isArray(data?.trainings)
        ? data.trainings
        : Array.isArray(data?.sessions)
          ? data.sessions
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.data)
              ? data.data
              : (Array.isArray(data) ? data : [])

      const normalized = normalizeTrainingsList(source)
      const fallbackNormalized = normalizeTrainingsList(fallbackSource)
      setTrainings(mergeNormalizedTrainings(normalized, fallbackNormalized))
    } catch (error) {
      console.error('Chyba načítání tréninků:', error)
      setTrainings(normalizeTrainingsList(fallbackSource))
    } finally {
      setLoading(false)
    }
  }

  const loadTeamsForComposer = async () => {
    try {
      const response = await api.getTeams()
      const teams = Array.isArray(response?.teams)
        ? response.teams
            .map((team) => ({
              id: String(team?.id || '').trim(),
              name: String(team?.name || '').trim()
            }))
            .filter((team) => team.id && team.name)
        : []

      setTeamOptions(teams)

      if (teams.length === 1) {
        setSelectedTeamId(teams[0].id)
      } else if (!teams.some((team) => team.id === selectedTeamId)) {
        setSelectedTeamId('')
      }
    } catch (error) {
      setTeamOptions([])
      setSelectedTeamId('')
      setComposerError('Nepodarilo sa načítať kategórie pre plánovanie tréningu.')
    }
  }

  const loadFieldsForComposer = async () => {
    try {
      const response = await api.getClubFields()
      const fields = Array.isArray(response?.fields)
        ? response.fields
            .map((field, index) => {
              const id = String(field?.id ?? '').trim() || `fallback-${index + 1}`
              const name = String(field?.name || '').trim() || `Ihrisko ${index + 1}`
              const rawParts = Number(field?.partsTotal ?? field?.parts_total ?? 1)
              const partsTotal = Number.isFinite(rawParts) && rawParts > 0 ? Math.floor(rawParts) : 1
              return { id, name, partsTotal }
            })
            .filter((field) => field.id && field.name)
        : []

      setFieldOptions(fields)

      if (fields.length > 0) {
        const fieldExists = fields.some((field) => field.id === selectedFieldId)
        const nextFieldId = fieldExists ? selectedFieldId : fields[0].id
        const nextField = fields.find((field) => field.id === nextFieldId) || fields[0]
        const currentCount = Number(selectedFieldPartsCount)
        const safeCount = Number.isFinite(currentCount)
          ? Math.max(0, Math.min(Math.floor(currentCount), nextField.partsTotal))
          : 0

        setSelectedFieldId(nextFieldId)
        setSelectedFieldPartsCount(String(safeCount))
        setSelectedFieldParts(Array.from({ length: safeCount }, (_, index) => index + 1))
      } else {
        setSelectedFieldId('')
        setSelectedFieldPartsCount('0')
        setSelectedFieldParts([])
      }
    } catch {
      setFieldOptions([])
      setSelectedFieldId('')
      setSelectedFieldPartsCount('0')
      setSelectedFieldParts([])
      setComposerError('Nepodarilo sa načítať ihriská zo správy ihrísk.')
    }
  }

  const totalComposerMinutes = useMemo(() => (
    sections.reduce((total, section) => {
      const sectionMinutes = Array.isArray(section?.exercises)
        ? section.exercises.reduce((acc, exercise) => acc + (Number(exercise?.minutes) || 0), 0)
        : 0
      return total + sectionMinutes
    }, 0)
  ), [sections])

  const totalComposerExercises = useMemo(() => (
    sections.reduce((total, section) => total + (Array.isArray(section?.exercises) ? section.exercises.length : 0), 0)
  ), [sections])

  const updateSessionMeta = (field, value) => {
    setSessionMeta((prev) => ({ ...prev, [field]: value }))
  }

  const updateExerciseMinutes = (sectionId, exerciseId, value) => {
    const parsed = Number.parseInt(String(value || '0'), 10)
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        exercises: section.exercises.map((exercise) => (
          exercise.id === exerciseId ? { ...exercise, minutes: safeValue } : exercise
        ))
      }
    }))
  }

  const removeExercise = (sectionId, exerciseId) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        exercises: section.exercises.filter((exercise) => exercise.id !== exerciseId)
      }
    }))
  }

  const moveExerciseWithinSection = (sectionId, sourceExerciseId, targetExerciseId) => {
    const safeSectionId = String(sectionId || '').trim()
    const safeSourceId = String(sourceExerciseId || '').trim()
    const safeTargetId = String(targetExerciseId || '').trim()
    if (!safeSectionId || !safeSourceId || !safeTargetId || safeSourceId === safeTargetId) return

    setSections((prev) => prev.map((section) => {
      if (section.id !== safeSectionId) return section

      const sourceIndex = section.exercises.findIndex((exercise) => String(exercise.id) === safeSourceId)
      const targetIndex = section.exercises.findIndex((exercise) => String(exercise.id) === safeTargetId)
      if (sourceIndex < 0 || targetIndex < 0) return section

      const nextExercises = [...section.exercises]
      const [movedExercise] = nextExercises.splice(sourceIndex, 1)
      nextExercises.splice(targetIndex, 0, movedExercise)

      return {
        ...section,
        exercises: nextExercises
      }
    }))
  }

  const moveExerciseToSectionEnd = (sectionId, sourceExerciseId) => {
    const safeSectionId = String(sectionId || '').trim()
    const safeSourceId = String(sourceExerciseId || '').trim()
    if (!safeSectionId || !safeSourceId) return

    setSections((prev) => prev.map((section) => {
      if (section.id !== safeSectionId) return section

      const sourceIndex = section.exercises.findIndex((exercise) => String(exercise.id) === safeSourceId)
      if (sourceIndex < 0 || sourceIndex === section.exercises.length - 1) return section

      const nextExercises = [...section.exercises]
      const [movedExercise] = nextExercises.splice(sourceIndex, 1)
      nextExercises.push(movedExercise)

      return {
        ...section,
        exercises: nextExercises
      }
    }))
  }

  const handleExerciseDragStart = (sectionId, exerciseId, event) => {
    const safeSectionId = String(sectionId || '').trim()
    const safeExerciseId = String(exerciseId || '').trim()
    if (!safeSectionId || !safeExerciseId) return

    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', `${safeSectionId}:${safeExerciseId}`)
    }

    setDraggedExercise({ sectionId: safeSectionId, exerciseId: safeExerciseId })
  }

  const handleExerciseDragOver = (sectionId, exerciseId, event) => {
    const safeSectionId = String(sectionId || '').trim()
    const safeExerciseId = String(exerciseId || '').trim()
    if (!safeSectionId || !safeExerciseId) return
    if (draggedExercise.sectionId !== safeSectionId || draggedExercise.exerciseId === safeExerciseId) return

    event.preventDefault()
    if (event?.dataTransfer) event.dataTransfer.dropEffect = 'move'

    setDragOverExerciseIdBySection((prev) => ({
      ...(prev || {}),
      [safeSectionId]: safeExerciseId
    }))
  }

  const handleExerciseDrop = (sectionId, targetExerciseId, event) => {
    event.preventDefault()
    event.stopPropagation()

    const safeSectionId = String(sectionId || '').trim()
    const safeTargetId = String(targetExerciseId || '').trim()
    if (!safeSectionId || !safeTargetId) return

    if (draggedExercise.sectionId === safeSectionId && draggedExercise.exerciseId && draggedExercise.exerciseId !== safeTargetId) {
      moveExerciseWithinSection(safeSectionId, draggedExercise.exerciseId, safeTargetId)
    }

    setDraggedExercise({ sectionId: '', exerciseId: '' })
    setDragOverExerciseIdBySection((prev) => ({
      ...(prev || {}),
      [safeSectionId]: ''
    }))
  }

  const handleExerciseDropToEnd = (sectionId, event) => {
    if (draggedExercise.sectionId !== sectionId || !draggedExercise.exerciseId) return
    event.preventDefault()
    moveExerciseToSectionEnd(sectionId, draggedExercise.exerciseId)
    setDraggedExercise({ sectionId: '', exerciseId: '' })
    setDragOverExerciseIdBySection((prev) => ({
      ...(prev || {}),
      [sectionId]: ''
    }))
  }

  const handleExerciseDragEnd = (sectionId) => {
    setDraggedExercise({ sectionId: '', exerciseId: '' })
    setDragOverExerciseIdBySection((prev) => ({
      ...(prev || {}),
      [sectionId]: ''
    }))
  }

  const addExerciseToSection = (sectionId) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      const nextIndex = section.exercises.length + 1
      return {
        ...section,
        exercises: [
          ...section.exercises,
          {
            id: `${sectionId}-${Date.now()}-${nextIndex}`,
            name: `Nové cvičenie ${nextIndex}`,
            focus: 'Doplňte zameranie cvičenia',
            minutes: 10,
            previewImage: ''
          }
        ]
      }
    }))
  }

  const getSectionExerciseFilters = useCallback((sectionId) => {
    const source = exerciseFiltersBySection?.[sectionId]
    if (source && typeof source === 'object') return source
    return {
      category: '',
      subcategory: '',
      playerCount: '',
      intensity: ''
    }
  }, [exerciseFiltersBySection])

  const updateSectionExerciseFilter = (sectionId, key, value) => {
    const safeKey = String(key || '').trim()
    if (!safeKey) return

    setExerciseFiltersBySection((prev) => {
      const current = (prev && typeof prev === 'object') ? prev : {}
      const sectionFilters = current[sectionId] && typeof current[sectionId] === 'object'
        ? current[sectionId]
        : { category: '', subcategory: '', playerCount: '', intensity: '' }

      return {
        ...current,
        [sectionId]: {
          ...sectionFilters,
          [safeKey]: String(value || '')
        }
      }
    })
  }

  const getUniqueExerciseOptionValues = useCallback((key) => {
    const values = new Set()
    availableExercises.forEach((exercise) => {
      if (key === 'category' && Array.isArray(exercise?.categories) && exercise.categories.length > 0) {
        exercise.categories.forEach((value) => {
          const normalized = String(value || '').trim()
          if (normalized) values.add(normalized)
        })
        return
      }

      if (key === 'subcategory' && Array.isArray(exercise?.subcategories) && exercise.subcategories.length > 0) {
        exercise.subcategories.forEach((value) => {
          const normalized = String(value || '').trim()
          if (normalized) values.add(normalized)
        })
        return
      }

      const value = String(exercise?.[key] || '').trim()
      if (value) values.add(value)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'sk'))
  }, [availableExercises])

  const getSubcategoryOptionsForSection = useCallback((sectionId) => {
    const filters = getSectionExerciseFilters(sectionId)
    const selectedCategory = String(filters.category || '').trim()
    if (!selectedCategory) return []
    const selectedCategoryKey = toLookupKey(selectedCategory)

    const values = new Set()
    const fromDefinitions = Array.isArray(categorySubcategoriesByName[selectedCategoryKey])
      ? categorySubcategoriesByName[selectedCategoryKey]
      : []

    fromDefinitions.forEach((value) => {
      const normalized = String(value || '').trim()
      if (normalized) values.add(normalized)
    })

    availableExercises.forEach((exercise) => {
      const matchesCategory = Array.isArray(exercise.categories) && exercise.categories.length > 0
        ? exercise.categories.some((value) => toLookupKey(value) === selectedCategoryKey)
        : toLookupKey(exercise.category) === selectedCategoryKey

      if (!matchesCategory) return

      const categorySpecificSubcategories = Array.isArray(exercise?.subcategoriesByCategory?.[selectedCategoryKey])
        ? exercise.subcategoriesByCategory[selectedCategoryKey]
        : []

      categorySpecificSubcategories.forEach((value) => {
        const normalized = String(value || '').trim()
        if (normalized) values.add(normalized)
      })

      if (Array.isArray(exercise.subcategories) && exercise.subcategories.length > 0) {
        exercise.subcategories.forEach((value) => {
          const normalized = String(value || '').trim()
          if (normalized) values.add(normalized)
        })
        return
      }

      const fallbackSubcategory = String(exercise.subcategory || '').trim()
      if (fallbackSubcategory) values.add(fallbackSubcategory)
    })

    return Array.from(values).sort((a, b) => a.localeCompare(b, 'sk'))
  }, [availableExercises, categorySubcategoriesByName, getSectionExerciseFilters])

  const getFilteredExercisesForSection = useCallback((sectionId) => {
    const filters = getSectionExerciseFilters(sectionId)
    if (!filters.category) {
      return availableExercises
    }

    const selectedCategoryKey = toLookupKey(filters.category)
    const selectedSubcategoryKey = toLookupKey(filters.subcategory)

    return availableExercises.filter((exercise) => {
      if (filters.category) {
        const matchesCategory = Array.isArray(exercise.categories) && exercise.categories.length > 0
          ? exercise.categories.some((value) => toLookupKey(value) === selectedCategoryKey)
          : toLookupKey(exercise.category) === selectedCategoryKey
        if (!matchesCategory) return false
      }

      if (filters.subcategory) {
        const categorySpecificSubcategories = Array.isArray(exercise?.subcategoriesByCategory?.[selectedCategoryKey])
          ? exercise.subcategoriesByCategory[selectedCategoryKey]
          : []

        if (categorySpecificSubcategories.length > 0) {
          const matchesInCategorySpecificSubcategories = categorySpecificSubcategories
            .some((value) => toLookupKey(value) === selectedSubcategoryKey)
          if (!matchesInCategorySpecificSubcategories) return false
        }

        const matchesSubcategory = Array.isArray(exercise.subcategories) && exercise.subcategories.length > 0
          ? exercise.subcategories.some((value) => toLookupKey(value) === selectedSubcategoryKey)
          : toLookupKey(exercise.subcategory) === selectedSubcategoryKey
        if (!matchesSubcategory) return false
      }

      if (filters.playerCount && String(exercise.playerCount || '') !== filters.playerCount) return false
      if (filters.intensity && String(exercise.intensity || '') !== filters.intensity) return false
      return true
    })
  }, [availableExercises, getSectionExerciseFilters])

  const selectExerciseCandidate = (sectionId, exerciseId) => {
    const safeSectionId = String(sectionId || '').trim()
    const safeExerciseId = String(exerciseId || '').trim()
    if (!safeSectionId) return

    setSelectedExerciseIdBySection((prev) => ({
      ...(prev || {}),
      [safeSectionId]: safeExerciseId
    }))
  }

  const addSelectedExerciseFromLibrary = (sectionId) => {
    const selectedExerciseId = String(selectedExerciseIdBySection?.[sectionId] || '').trim()
    if (!selectedExerciseId) return

    const selectedExercise = availableExercises.find((item) => String(item.id) === selectedExerciseId)
    if (!selectedExercise) return

    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section

      const nextIndex = section.exercises.length + 1
      const exerciseName = String(selectedExercise.name || '').trim() || `Cvičenie ${nextIndex}`
      const exerciseFocus = String(selectedExercise.focus || '').trim() || 'Bez doplňujúceho popisu'
      const exerciseMinutes = Number(selectedExercise.minutes) > 0 ? Number(selectedExercise.minutes) : 10
      const previewImage = getExercisePreviewImage(selectedExercise)

      return {
        ...section,
        exercises: [
          ...section.exercises,
          {
            id: `${sectionId}-library-${selectedExercise.id}-${Date.now()}`,
            name: exerciseName,
            focus: exerciseFocus,
            minutes: exerciseMinutes,
            previewImage,
            sourceExerciseId: String(selectedExercise.id || '').trim()
          }
        ]
      }
    }))

    // Reset picker in this section so every next add starts from a fresh selection.
    setExerciseFiltersBySection((prev) => ({
      ...(prev || {}),
      [sectionId]: {
        category: '',
        subcategory: '',
        playerCount: '',
        intensity: ''
      }
    }))

    setSelectedExerciseIdBySection((prev) => ({
      ...(prev || {}),
      [sectionId]: ''
    }))
  }

  const closeComposer = () => {
    setIsComposerOpen(false)
    setIsTimeClockOpen(false)
    setIsDateCalendarOpen(false)
    setLinkedSessionId('')
    setComposerError('')
    setComposerSuccess('')
    setLinkedSessionName('')
  }

  const openTrainingDocument = (detail, { autoPrint = false } = {}) => {
    const safeName = String(detail?.name || detail?.title || 'Tréning').trim() || 'Tréning'
    const safeDate = String(detail?.date || '').trim()
    const safeLocation = String(detail?.location || '').trim()
    const exercises = Array.isArray(detail?.exercises) ? detail.exercises : []

    const exercisesHtml = exercises.length > 0
      ? exercises.map((exercise, index) => (
          `<tr><td>${index + 1}</td><td>${String(exercise?.name || exercise?.title || '').trim()}</td><td>${String(exercise?.duration || exercise?.duration_minutes || '').trim()}</td><td>${String(exercise?.description || exercise?.notes || '').trim()}</td></tr>`
        )).join('')
      : '<tr><td colspan="4">Bez cvičení</td></tr>'

    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=760')
    if (!popup) return

    popup.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${safeName}</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{margin:0 0 12px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#f3f4f6} .meta{margin:0 0 8px;color:#334155}</style></head><body><h1>${safeName}</h1><p class="meta">Dátum: ${safeDate || '-'} | Miesto: ${safeLocation || '-'}</p><table><thead><tr><th>#</th><th>Cvičenie</th><th>Trvanie</th><th>Poznámka</th></tr></thead><tbody>${exercisesHtml}</tbody></table></body></html>`)
    popup.document.close()

    if (autoPrint) {
      popup.focus()
      popup.print()
    }
  }

  const loadTrainingDetail = async (training) => {
    const trainingId = String(training?.id || '').trim()
    if (!trainingId) throw new Error('Missing training id')
    return api.getTeamTrainingSessionDetail(trainingId, training?.teamId)
  }

  const handleViewTraining = async (training) => {
    const safeId = String(training?.id || '').trim()
    if (!safeId) return

    try {
      setRowActionLoadingId(`view-${safeId}`)
      const detail = await loadTrainingDetail(training)
      setViewTrainingDetail(detail)
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setComposerError(message || 'Tréning sa nepodarilo zobraziť.')
    } finally {
      setRowActionLoadingId('')
    }
  }

  const openEditConfirm = (training) => {
    setEditConfirmDialog({ open: true, training })
  }

  const closeEditConfirm = () => {
    setEditConfirmDialog({ open: false, training: null })
  }

  const handleEditTraining = async (training) => {
    const safeId = String(training?.id || '').trim()
    if (!safeId) return

    try {
      setRowActionLoadingId(`edit-${safeId}`)
      const detail = await loadTrainingDetail(training)

      const detailExercises = Array.isArray(detail?.exercises) ? detail.exercises : []
      const mappedExercises = detailExercises.map((exercise, index) => ({
        id: `edit-${safeId}-${index + 1}`,
        name: String(exercise?.name || exercise?.title || `Cvičenie ${index + 1}`).trim(),
        focus: String(exercise?.description || exercise?.notes || '').trim(),
        minutes: Math.max(1, Number(exercise?.duration || exercise?.duration_minutes || 10) || 10),
        previewImage: ''
      }))

      setSections(DEFAULT_COMPOSER_SECTIONS.map((section) => (
        section.id === 'main'
          ? { ...section, exercises: mappedExercises }
          : { ...section, exercises: [] }
      )))

      setSelectedTeamId(String(detail?.team?.id || training?.teamId || '').trim())
      setSessionMeta((prev) => ({
        ...prev,
        date: String(detail?.date || prev.date || '').slice(0, 10),
        timeFrom: String(detail?.startTime || detail?.start_time || prev.timeFrom || '16:00').slice(0, 5),
        location: String(detail?.location || '').trim()
      }))
      setLinkedSessionId(safeId)
      setLinkedSessionName(String(detail?.name || detail?.title || '').trim())
      setComposerError('')
      setComposerSuccess('')
      setIsComposerOpen(true)
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setComposerError(message || 'Tréning sa nepodarilo načítať na editáciu.')
    } finally {
      setRowActionLoadingId('')
      closeEditConfirm()
    }
  }

  const handleDeleteTraining = async (training) => {
    const safeId = String(training?.id || '').trim()
    if (!safeId) return

    const confirmed = window.confirm('Naozaj chcete odstrániť tento tréning?')
    if (!confirmed) return

    try {
      setRowActionLoadingId(`delete-${safeId}`)
      await api.deleteTeamTrainingSession(safeId, training?.teamId)
      await loadTrainings()
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setComposerError(message || 'Tréning sa nepodarilo odstrániť.')
    } finally {
      setRowActionLoadingId('')
    }
  }

  const handlePrintTraining = async (training) => {
    const safeId = String(training?.id || '').trim()
    if (!safeId) return

    try {
      setRowActionLoadingId(`print-${safeId}`)
      const detail = await loadTrainingDetail(training)
      openTrainingDocument(detail, { autoPrint: true })
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setComposerError(message || 'Tréning sa nepodarilo vytlačiť.')
    } finally {
      setRowActionLoadingId('')
    }
  }

  const openDateCalendar = () => {
    const selected = new Date(String(sessionMeta.date || ''))
    const base = Number.isNaN(selected.getTime()) ? new Date() : selected
    setCalendarMonthDate(new Date(base.getFullYear(), base.getMonth(), 1))
    setIsDateCalendarOpen(true)
  }

  const closeDateCalendar = () => {
    setIsDateCalendarOpen(false)
  }

  const selectedFieldMeta = useMemo(
    () => fieldOptions.find((field) => field.id === selectedFieldId) || null,
    [fieldOptions, selectedFieldId]
  )

  const fieldPartsOptions = useMemo(() => {
    const total = selectedFieldMeta?.partsTotal || 1
    return Array.from({ length: total + 1 }, (_, index) => String(index))
  }, [selectedFieldMeta])

  const calendarSessionsDetailsByDate = useMemo(() => {
    const map = new Map()

    ;(Array.isArray(calendarSessions) ? calendarSessions : []).forEach((session) => {
      const dateKey = resolveDateKeyFromSession(session)
      if (!dateKey) return
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey).push(session)
    })

    map.forEach((list, dateKey) => {
      const sorted = [...list].sort((left, right) => {
        const leftTime = toMinutesFromHHmm(resolveStartTimeFromSession(left))
        const rightTime = toMinutesFromHHmm(resolveStartTimeFromSession(right))
        if (leftTime !== rightTime) return leftTime - rightTime
        return String(left?.id || '').localeCompare(String(right?.id || ''))
      })
      map.set(dateKey, sorted)
    })

    return map
  }, [calendarSessions])

  const calendarSessionsByDate = useMemo(() => {
    const map = new Map()

    ;(Array.isArray(calendarSessions) ? calendarSessions : []).forEach((session) => {
      const dateKey = resolveDateKeyFromSession(session)
      if (!dateKey) return

      const metricCode = resolveMetricCodeFromSession(session)
      if (!map.has(dateKey)) map.set(dateKey, new Set())
      map.get(dateKey).add(metricCode)
    })

    return map
  }, [calendarSessions])

  const calendarCells = useMemo(() => buildCalendarCells(calendarMonthDate), [calendarMonthDate])

  const handleFieldChange = (nextFieldId) => {
    const safeFieldId = String(nextFieldId || '')
    const nextField = fieldOptions.find((field) => field.id === safeFieldId)
    const maxParts = nextField?.partsTotal || 1
    const currentCount = Number(selectedFieldPartsCount)
    const safeCount = Number.isFinite(currentCount)
      ? Math.max(0, Math.min(Math.floor(currentCount), maxParts))
      : 0

    setSelectedFieldId(safeFieldId)
    setSelectedFieldPartsCount(String(safeCount))
    setSelectedFieldParts(Array.from({ length: safeCount }, (_, index) => index + 1))
  }

  const handleFieldPartsCountChange = (nextCount) => {
    const maxParts = selectedFieldMeta?.partsTotal || 1
    const parsed = Number(nextCount)
    const safeCount = Number.isFinite(parsed)
      ? Math.max(0, Math.min(Math.floor(parsed), maxParts))
      : 0

    setSelectedFieldPartsCount(String(safeCount))
    setSelectedFieldParts(Array.from({ length: safeCount }, (_, index) => index + 1))
  }

  const applySessionPrefill = useCallback((session) => {
    if (!session || typeof session !== 'object') {
      setLinkedSessionId('')
      return
    }

    const recurrenceMeta = parsePlannerRecurrenceRule(session?.recurrenceRule || session?.recurrence_rule)
    const startTime = resolveStartTimeFromSession(session)
    const safeStartTime = startTime || String(sessionMeta.timeFrom || '16:00')
    const fieldIdFromMeta = String(recurrenceMeta?.fieldId || '').trim()
    const fieldNameFromMeta = String(recurrenceMeta?.fieldName || session?.location || '').trim()

    const resolvedField = fieldOptions.find((field) => String(field.id) === fieldIdFromMeta)
      || fieldOptions.find((field) => String(field.name || '').trim().toLowerCase() === fieldNameFromMeta.toLowerCase())
      || null

    const rawSelectedParts = Array.isArray(recurrenceMeta?.selectedFieldParts)
      ? recurrenceMeta.selectedFieldParts
      : []
    const normalizedSelectedParts = [...new Set(rawSelectedParts
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1)
    )].sort((a, b) => a - b)

    const safeFieldId = resolvedField?.id || ''
    const maxParts = Number(resolvedField?.partsTotal || 1)
    const selectedPartsWithinRange = normalizedSelectedParts.filter((value) => value <= maxParts)
    const numericMetaParts = Number(recurrenceMeta?.fieldParts)
    const fallbackCount = Number.isFinite(numericMetaParts) && numericMetaParts >= 0
      ? Math.min(Math.floor(numericMetaParts), maxParts)
      : 0

    const resolvedParts = selectedPartsWithinRange.length > 0
      ? selectedPartsWithinRange
      : Array.from({ length: fallbackCount }, (_, index) => index + 1)

    setSessionMeta((prev) => ({
      ...prev,
      timeFrom: safeStartTime
    }))
    setSelectedFieldId(safeFieldId)
    setSelectedFieldParts(resolvedParts)
    setSelectedFieldPartsCount(String(resolvedParts.length))
    setLinkedSessionId(String(session?.id || '').trim())
  }, [fieldOptions, sessionMeta.timeFrom])

  const resolveEndTime = (startTime, durationMinutes) => {
    const match = String(startTime || '').match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return '17:30'

    const startHour = Math.max(0, Math.min(23, Number(match[1]) || 0))
    const startMinute = Math.max(0, Math.min(59, Number(match[2]) || 0))
    const startTotal = (startHour * 60) + startMinute
    const safeDuration = Math.max(30, Number(durationMinutes) || 90)
    const endTotal = (startTotal + safeDuration) % (24 * 60)
    const endHour = Math.floor(endTotal / 60)
    const endMinute = endTotal % 60

    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
  }

  const saveComposer = async () => {
    const resolvedTeamId = String(selectedTeamId || '').trim()
    if (!resolvedTeamId) {
      setComposerError('Vyberte kategóriu tréningu.')
      setComposerSuccess('')
      return
    }

    const totalMinutes = sections.reduce((sum, section) => {
      const sectionMinutes = Array.isArray(section?.exercises)
        ? section.exercises.reduce((acc, exercise) => acc + (Number(exercise?.minutes) || 0), 0)
        : 0
      return sum + sectionMinutes
    }, 0)

    const trainingDateForSeason = String(sessionMeta.date || '').trim()
    const currentSeasonKey = resolveSchoolSeasonKey(trainingDateForSeason)

    const nextTJNumber = (() => {
      const relevant = (Array.isArray(trainings) ? trainings : []).filter((training) => (
        resolveSchoolSeasonKey(training?.date) === currentSeasonKey
      ))

      const maxValue = relevant.reduce((acc, training) => {
        const name = String(training?.name || '').trim()
        const match = name.match(/^TJ\s*(\d+)$/i)
        if (!match) return acc
        const parsed = Number(match[1])
        return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc
      }, 0)

      return maxValue + 1
    })()

    const generatedTitle = `TJ${nextTJNumber}`
    const title = linkedSessionId
      ? (String(linkedSessionName || '').trim() || generatedTitle)
      : generatedTitle

    const flattenedExercises = sections.flatMap((section) => (
      Array.isArray(section?.exercises)
        ? section.exercises
            .map((exercise, index) => {
              const rawExerciseId = String(exercise?.sourceExerciseId || exercise?.exerciseId || '').trim()
              if (!rawExerciseId) return null

              const parsedExerciseId = Number(rawExerciseId)
              const normalizedExerciseId = Number.isFinite(parsedExerciseId)
                ? parsedExerciseId
                : rawExerciseId

              return {
                exerciseId: normalizedExerciseId,
                title: String(exercise?.name || '').trim() || `Cvičenie ${index + 1}`,
                description: String(exercise?.focus || '').trim(),
                duration: Math.max(1, Number(exercise?.minutes) || 0),
                order_index: index + 1,
                section: String(section?.id || '').trim() || 'section'
              }
            })
            .filter(Boolean)
        : []
    ))

    const resolvedLocation = selectedFieldMeta?.name || ''
    const resolvedEndTime = resolveEndTime(sessionMeta.timeFrom, totalMinutes)

    const payload = {
      title,
      date: String(sessionMeta.date || '').trim(),
      start_time: String(sessionMeta.timeFrom || '').trim(),
      end_time: resolvedEndTime,
      location: resolvedLocation,
      session_type: 'training',
      indicatorCode: 'TJ',
      recurrence_rule: JSON.stringify({
        indicatorCode: 'TJ',
        source: 'trainings-composer',
        totalMinutes,
        fieldId: selectedFieldMeta?.id || '',
        fieldName: resolvedLocation,
        fieldParts: Number(selectedFieldPartsCount) || 0,
        selectedFieldParts
      }),
      exercises: flattenedExercises
    }

    if (!payload.date || !payload.start_time) {
      setComposerError('Doplňte dátum a čas začiatku tréningu.')
      setComposerSuccess('')
      return
    }

    if (!selectedFieldMeta?.id) {
      setComposerError('Vyberte ihrisko pre tréning.')
      setComposerSuccess('')
      return
    }

    setIsSavingComposer(true)
    setComposerError('')
    setComposerSuccess('')

    try {
      let savedResult = null
      if (linkedSessionId) {
        savedResult = await api.updateTeamTrainingSession(linkedSessionId, resolvedTeamId, payload)
      } else {
        savedResult = await api.createTeamTrainingSession(resolvedTeamId, payload)
      }

      const refreshed = await api.getTeamTrainingSessions(resolvedTeamId)
      const refreshedSessions = Array.isArray(refreshed?.sessions)
        ? refreshed.sessions
        : Array.isArray(refreshed?.trainings)
          ? refreshed.trainings
          : Array.isArray(refreshed?.items)
            ? refreshed.items
            : Array.isArray(refreshed?.data)
              ? refreshed.data
              : (Array.isArray(refreshed) ? refreshed : [])

        const savedCandidate = {
          id: String(linkedSessionId || savedResult?.id || savedResult?.sessionId || '').trim(),
          title,
          date: payload.date,
          location: resolvedLocation,
          exerciseCount: flattenedExercises.length,
          status: 'scheduled'
        }

        const fallbackForList = savedCandidate.id
          ? [savedCandidate, ...refreshedSessions]
          : refreshedSessions

      setCalendarSessions(refreshedSessions)
        await loadTrainings(fallbackForList)
      setComposerSuccess(linkedSessionId
        ? 'Tréning bol upravený a zmeny sa premietli do plánovača.'
        : 'Tréning bol uložený a priradený do plánovača aj dochádzky.')
      setIsComposerOpen(false)
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setComposerError(message || 'Tréning sa nepodarilo uložiť.')
    } finally {
      setIsSavingComposer(false)
    }
  }

  useEffect(() => {
    if (!isComposerOpen) return
    loadTeamsForComposer()
    loadFieldsForComposer()
  }, [isComposerOpen])

  useEffect(() => {
    if (!isComposerOpen) return undefined

    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [isComposerOpen])

  useEffect(() => {
    if (!isComposerOpen) return

    const safeTeamId = String(selectedTeamId || '').trim()
    if (!safeTeamId) {
      setCalendarSessions([])
      return
    }

    let isMounted = true
    setCalendarLoading(true)

    api.getTeamTrainingSessions(safeTeamId)
      .then((response) => {
        if (!isMounted) return
        const sessions = Array.isArray(response?.sessions)
          ? response.sessions
          : Array.isArray(response?.trainings)
            ? response.trainings
            : Array.isArray(response?.items)
              ? response.items
              : Array.isArray(response?.data)
                ? response.data
                : (Array.isArray(response) ? response : [])
        setCalendarSessions(sessions)
      })
      .catch(() => {
        if (!isMounted) return
        setCalendarSessions([])
      })
      .finally(() => {
        if (isMounted) setCalendarLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isComposerOpen, selectedTeamId])

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
    <div className="unified-page">
      <div className="page-header">
        <h2>Tréninky</h2>
        <p>Plánování a správa tréninků</p>
      </div>

      <div className="unified-toolbar">
        <button className="btn training-open-btn" type="button" onClick={() => setIsComposerOpen(true)}>+ Naplánovať tréning</button>
      </div>

      {isComposerOpen ? (
        <div className="training-composer-modal-backdrop" onClick={closeComposer}>
          <div className="training-composer-shell" onClick={(event) => event.stopPropagation()}>
            <div className="training-composer-head">
              <div>
                <h3>Poskladať tréningovú jednotku</h3>
                <p>Vytvorte presný časový a obsahový plán tréningu.</p>
              </div>
              <button type="button" className="btn btn-secondary training-composer-close-btn" onClick={closeComposer}>Zavrieť</button>
            </div>

            <div className="training-composer-meta-grid">
              {teamOptions.length > 1 ? (
                <div className="training-composer-field">
                  <label>Kategória</label>
                  <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(String(event.target.value || ''))}>
                    <option value="">Vyber kategóriu</option>
                    {teamOptions.map((team) => (
                      <option key={`composer-team-${team.id}`} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {teamOptions.length === 1 ? (
                <div className="training-composer-field">
                  <label>Kategória</label>
                  <input type="text" value={teamOptions[0].name} readOnly />
                </div>
              ) : null}

              <div className="training-composer-field">
                <label>Dátum</label>
                <input
                  type="text"
                  value={toDisplayDate(sessionMeta.date)}
                  readOnly
                  placeholder="Vyber dátum"
                  onClick={openDateCalendar}
                />
              </div>
              <div className="training-composer-field">
                <label>Čas začiatku</label>
                <input
                  type="time"
                  value={sessionMeta.timeFrom}
                  readOnly
                  onClick={() => setIsTimeClockOpen(true)}
                  onChange={(event) => updateSessionMeta('timeFrom', event.target.value)}
                />
              </div>
              <div className="training-composer-field">
                <label>Ihrisko</label>
                <select value={selectedFieldId} onChange={(event) => handleFieldChange(event.target.value)} disabled={fieldOptions.length === 0}>
                  {fieldOptions.length === 0 ? <option value="">Žiadne ihrisko</option> : null}
                  {fieldOptions.map((field) => (
                    <option key={`composer-field-${field.id}`} value={field.id}>{field.name}</option>
                  ))}
                </select>
              </div>
              <div className="training-composer-field">
                <label>Časti ihriska</label>
                <select value={selectedFieldPartsCount} onChange={(event) => handleFieldPartsCountChange(event.target.value)} disabled={!selectedFieldMeta}>
                  {fieldPartsOptions.map((part) => (
                    <option key={`composer-field-part-${part}`} value={part}>{part}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="training-composer-sections">
              {sections.map((section) => {
                const sectionTotal = section.exercises.reduce((sum, exercise) => sum + (Number(exercise.minutes) || 0), 0)
                return (
                  <section key={section.id} className="training-composer-section">
                    <div className="training-composer-section-head">
                      <div className="training-composer-section-title-wrap">
                        <span className="training-composer-order-chip">{section.order}</span>
                        <h4>{section.title}</h4>
                      </div>
                      <span className="training-composer-duration">Odhadovaný čas: {sectionTotal || section.estimatedMinutes} min</span>
                    </div>

                    {section.exercises.length > 0 ? (
                      <div
                        className="training-composer-exercises"
                        onDragOver={(event) => {
                          if (draggedExercise.sectionId === section.id) {
                            event.preventDefault()
                            if (event?.dataTransfer) event.dataTransfer.dropEffect = 'move'
                          }
                        }}
                        onDrop={(event) => handleExerciseDropToEnd(section.id, event)}
                      >
                        {section.exercises.map((exercise) => (
                          <article
                            key={exercise.id}
                            className={`training-composer-exercise-row${draggedExercise.exerciseId === exercise.id ? ' dragging' : ''}${dragOverExerciseIdBySection?.[section.id] === exercise.id ? ' drop-target' : ''}`}
                            draggable
                            onDragStart={(event) => handleExerciseDragStart(section.id, exercise.id, event)}
                            onDragOver={(event) => handleExerciseDragOver(section.id, exercise.id, event)}
                            onDrop={(event) => handleExerciseDrop(section.id, exercise.id, event)}
                            onDragEnd={() => handleExerciseDragEnd(section.id)}
                          >
                            <div className="training-composer-exercise-preview">
                              {String(exercise.previewImage || '').trim()
                                ? <img src={exercise.previewImage} alt={`Náhľad ${exercise.name}`} className="training-composer-exercise-preview-image" />
                                : <span className="training-composer-exercise-preview-fallback" aria-hidden="true">+</span>}
                            </div>
                            <div className="training-composer-exercise-main">
                              <strong>{exercise.name}</strong>
                              <p>{exercise.focus}</p>
                            </div>
                            <div className="training-composer-exercise-controls">
                              <input
                                type="number"
                                min="1"
                                value={exercise.minutes}
                                onChange={(event) => updateExerciseMinutes(section.id, exercise.id, event.target.value)}
                              />
                              <span className="training-composer-exercise-unit">min</span>
                              <button type="button" className="training-composer-delete-btn" onClick={() => removeExercise(section.id, exercise.id)}>
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" fill="currentColor" />
                                </svg>
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    <div className="training-exercise-picker-panel">
                      <div className="training-exercise-picker-toolbar">
                        <div className="training-exercise-picker-field">
                          <label>Kategória</label>
                          <select
                            value={getSectionExerciseFilters(section.id).category}
                            onChange={(event) => {
                              updateSectionExerciseFilter(section.id, 'category', event.target.value)
                              updateSectionExerciseFilter(section.id, 'subcategory', '')
                              selectExerciseCandidate(section.id, '')
                            }}
                          >
                            <option value="">Všetky</option>
                            {getUniqueExerciseOptionValues('category').map((value) => (
                              <option key={`exercise-category-${section.id}-${value}`} value={value}>{value}</option>
                            ))}
                          </select>
                        </div>

                        <div className="training-exercise-picker-field">
                          <label>Podkategória</label>
                          <select
                            value={getSectionExerciseFilters(section.id).subcategory}
                            disabled={!getSectionExerciseFilters(section.id).category}
                            onChange={(event) => {
                              updateSectionExerciseFilter(section.id, 'subcategory', event.target.value)
                              selectExerciseCandidate(section.id, '')
                            }}
                          >
                            <option value="">Všetky</option>
                            {getSubcategoryOptionsForSection(section.id).map((value) => (
                              <option key={`exercise-subcategory-${section.id}-${value}`} value={value}>{value}</option>
                            ))}
                          </select>
                        </div>

                        <div className="training-exercise-picker-field">
                          <label>Počet hráčov</label>
                          <select
                            value={getSectionExerciseFilters(section.id).playerCount}
                            onChange={(event) => {
                              updateSectionExerciseFilter(section.id, 'playerCount', event.target.value)
                              selectExerciseCandidate(section.id, '')
                            }}
                          >
                            <option value="">Všetky</option>
                            {getUniqueExerciseOptionValues('playerCount').map((value) => (
                              <option key={`exercise-player-count-${section.id}-${value}`} value={value}>{value}</option>
                            ))}
                          </select>
                        </div>

                        <div className="training-exercise-picker-field">
                          <label>Intenzita</label>
                          <select
                            value={getSectionExerciseFilters(section.id).intensity}
                            onChange={(event) => {
                              updateSectionExerciseFilter(section.id, 'intensity', event.target.value)
                              selectExerciseCandidate(section.id, '')
                            }}
                          >
                            <option value="">Všetky</option>
                            {getUniqueExerciseOptionValues('intensity').map((value) => (
                              <option key={`exercise-intensity-${section.id}-${value}`} value={value}>{value}</option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          className="btn training-exercise-picker-add-btn"
                          onClick={() => addSelectedExerciseFromLibrary(section.id)}
                          disabled={!String(selectedExerciseIdBySection?.[section.id] || '').trim()}
                        >
                          Pridať cvičenie
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary training-exercise-picker-manual-btn"
                          onClick={() => addExerciseToSection(section.id)}
                        >
                          Pridať manuálne
                        </button>
                      </div>

                      <div className="training-exercise-picker-library">
                        {getSectionExerciseFilters(section.id).category && getFilteredExercisesForSection(section.id).length === 0 ? (
                          <div className="training-exercise-picker-empty">
                            V tejto kategórii nie sú dostupné cvičenia pre zvolený filter.
                          </div>
                        ) : null}

                        {getSectionExerciseFilters(section.id).category && getFilteredExercisesForSection(section.id).length > 0 ? (
                          <div className="training-exercise-picker-cards" role="listbox" aria-label="Zoznam cvičení">
                            {getFilteredExercisesForSection(section.id).map((exercise) => {
                              const isActive = String(selectedExerciseIdBySection?.[section.id] || '') === String(exercise.id)
                              const previewImage = getExercisePreviewImage(exercise)
                              const rating = Math.max(0, Math.min(5, Number.parseInt(String(exercise.rating || 0), 10) || 0))
                              const categorySummary = Array.isArray(exercise.categories) && exercise.categories.length > 0
                                ? exercise.categories.join(', ')
                                : String(exercise.category || '').trim()
                              const subcategorySummary = Array.isArray(exercise.subcategories) && exercise.subcategories.length > 0
                                ? exercise.subcategories.join(', ')
                                : String(exercise.subcategory || '').trim()

                              const libraryLabel = exercise.isSystem ? 'Verejná knižnica' : 'Klubová knižnica'
                              return (
                                <button
                                  key={`exercise-list-item-${section.id}-${exercise.id}`}
                                  type="button"
                                  className={`training-exercise-picker-card ${isActive ? 'active' : ''}`}
                                  onClick={() => selectExerciseCandidate(section.id, exercise.id)}
                                  role="option"
                                  aria-selected={isActive}
                                >
                                  <div className="training-exercise-picker-card-media">
                                    {previewImage ? (
                                      <img src={previewImage} alt={`Náhľad cvičenia ${exercise.name}`} className="training-exercise-picker-card-media-image" />
                                    ) : (
                                      <div className="training-exercise-picker-card-media-fallback" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" focusable="false">
                                          <path d="M5 5h14v14H5V5Zm2 2v8.5l3.2-3.2a1 1 0 0 1 1.4 0l2.3 2.3 2.1-2.1a1 1 0 0 1 1.4 0L19 14.1V7H7Zm2.4 2.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" fill="currentColor" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>

                                  <div className="training-exercise-picker-card-head">
                                    <div className="training-exercise-picker-card-title">{exercise.name}</div>
                                    <span className="training-exercise-picker-card-favorite" aria-hidden="true">
                                      <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.02 6.02 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.5L12 21.35Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                      </svg>
                                    </span>
                                  </div>

                                  <div className="training-exercise-picker-card-note">{libraryLabel}</div>
                                  {(categorySummary || subcategorySummary) ? (
                                    <div className="training-exercise-picker-card-note">
                                      {categorySummary || 'Bez kategórie'}
                                      {subcategorySummary ? ` | ${subcategorySummary}` : ''}
                                    </div>
                                  ) : null}
                                  <p className="training-exercise-picker-card-description">{exercise.focus || 'Bez doplňujúceho popisu'}</p>

                                  <div className="training-exercise-picker-card-rating" aria-label="Úroveň cvičenia">
                                    <small>Úroveň cvičenia</small>
                                    <div className="training-exercise-picker-card-stars" role="img" aria-label={`Hodnotenie ${rating} z 5`}>
                                      {[1, 2, 3, 4, 5].map((starValue) => (
                                        <span key={`training-card-star-${section.id}-${exercise.id}-${starValue}`} className={`training-exercise-picker-card-star ${starValue <= rating ? 'active' : ''}`} aria-hidden="true">☆</span>
                                      ))}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="training-composer-footer">
              {composerError ? <p className="unified-muted" style={{ color: '#fca5a5', margin: 0 }}>{composerError}</p> : null}
              {composerSuccess ? <p className="unified-muted" style={{ color: '#9ae6b4', margin: 0 }}>{composerSuccess}</p> : null}
              <div className="training-composer-summary">
                <div>
                  <small>Celkové trvanie</small>
                  <strong>{totalComposerMinutes} min</strong>
                </div>
                <div>
                  <small>Počet cvičení</small>
                  <strong>{totalComposerExercises}</strong>
                </div>
              </div>

              <div className="training-composer-actions">
                <button type="button" className="btn btn-secondary training-composer-cancel-btn" onClick={closeComposer} disabled={isSavingComposer}>Zrušiť</button>
                <button type="button" className="btn training-composer-save-btn" onClick={saveComposer} disabled={isSavingComposer}>{isSavingComposer ? 'Ukladám...' : 'Uložiť tréning'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <TimeClockPickerModal
        isOpen={isTimeClockOpen}
        value={sessionMeta.timeFrom}
        onClose={() => setIsTimeClockOpen(false)}
        onApply={(nextValue) => updateSessionMeta('timeFrom', nextValue)}
        ariaLabel="Výber času začiatku"
      />

      {isDateCalendarOpen ? (
        <div className="training-date-calendar-overlay" role="presentation" onClick={closeDateCalendar}>
          <div
            className="training-date-calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Kalendár tréningov"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="training-date-calendar-head">
              <h3>Kalendár dochádzky</h3>
              <span>{MONTH_NAMES[calendarMonthDate.getMonth()]} {calendarMonthDate.getFullYear()}</span>
            </div>

            <div className="training-date-calendar-controls">
              <button
                type="button"
                className="training-date-calendar-icon-btn"
                onClick={() => setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                aria-label="Predchádzajúci mesiac"
              >
                <span className="material-icons-round" aria-hidden="true">chevron_left</span>
              </button>
              <button
                type="button"
                className="training-date-calendar-icon-btn"
                onClick={() => setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                aria-label="Nasledujúci mesiac"
              >
                <span className="material-icons-round" aria-hidden="true">chevron_right</span>
              </button>
            </div>

            <div className="training-date-calendar-weekdays">
              {WEEK_DAYS.map((weekDay) => (
                <span key={`training-weekday-${weekDay}`}>{weekDay}</span>
              ))}
            </div>

            <div className="training-date-calendar-grid">
              {calendarCells.map((cell) => {
                const metricSet = calendarSessionsByDate.get(cell.dateKey) || null
                const daySessions = calendarSessionsDetailsByDate.get(cell.dateKey) || []
                const metricCodes = metricSet ? Array.from(metricSet) : []
                const prioritizedCode = METRIC_PRIORITY.find((code) => metricCodes.includes(code)) || metricCodes[0] || ''
                const plannedColor = prioritizedCode ? METRIC_COLORS[prioritizedCode] : ''

                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`training-date-calendar-day ${cell.muted ? 'muted' : ''} ${!cell.muted && metricCodes.length > 0 ? 'has-planned' : ''} ${sessionMeta.date === cell.dateKey ? 'active' : ''}`}
                    style={plannedColor ? { '--training-planned-border': plannedColor } : undefined}
                    onClick={() => {
                      if (cell.muted) return
                      updateSessionMeta('date', cell.dateKey)
                      if (daySessions.length > 0) {
                        applySessionPrefill(daySessions[0])
                      } else {
                        setLinkedSessionId('')
                      }
                      closeDateCalendar()
                    }}
                  >
                    <span className="training-date-calendar-day-number">{cell.day}</span>
                  </button>
                )
              })}
            </div>

            <div className="training-date-calendar-legend" aria-label="Legenda kalendára">
              {Object.entries(METRIC_COLORS).map(([code, color]) => (
                <span key={`training-calendar-legend-${code}`} className="training-date-calendar-legend-item">
                  <span className="training-date-calendar-legend-dot" style={{ '--legend-color': color }} aria-hidden="true" />
                  <span>{code}</span>
                </span>
              ))}
            </div>

            <div className="training-date-calendar-actions">
              <button type="button" className="btn btn-secondary" onClick={closeDateCalendar}>Zrušiť</button>
              {calendarLoading ? <span className="unified-muted">Načítavam tréningy...</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      {linkedSessionId ? (
        <p className="unified-muted" style={{ marginTop: 8 }}>
          Predvyplnené podľa existujúceho tréningu. Po uložení sa aktualizuje rovnaká udalosť v plánovači.
        </p>
      ) : null}

      {viewTrainingDetail ? (
        <div className="training-detail-modal-overlay" role="dialog" aria-modal="true" aria-label="Detail tréningu" onClick={() => setViewTrainingDetail(null)}>
          <div className="training-detail-modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{String(viewTrainingDetail?.name || viewTrainingDetail?.title || 'Detail tréningu')}</h3>
            <p className="unified-muted" style={{ marginTop: 4 }}>
              Dátum: {String(viewTrainingDetail?.date || '').trim() ? new Date(String(viewTrainingDetail.date)).toLocaleDateString('cs-CZ') : '-'} | Miesto: {String(viewTrainingDetail?.location || '').trim() || '-'}
            </p>

            <div className="training-detail-modal-list">
              {(Array.isArray(viewTrainingDetail?.exercises) ? viewTrainingDetail.exercises : []).length === 0 ? (
                <p className="unified-muted" style={{ margin: 0 }}>Tento tréning nemá žiadne cvičenia.</p>
              ) : (
                (Array.isArray(viewTrainingDetail?.exercises) ? viewTrainingDetail.exercises : []).map((exercise, index) => (
                  <div key={`training-view-exercise-${index + 1}`} className="training-detail-modal-item">
                    <strong>{index + 1}. {String(exercise?.name || exercise?.title || 'Cvičenie').trim()}</strong>
                    <p>{String(exercise?.description || exercise?.notes || '').trim() || 'Bez popisu.'}</p>
                  </div>
                ))
              )}
            </div>

            <div className="training-detail-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setViewTrainingDetail(null)}>Zavrieť</button>
            </div>
          </div>
        </div>
      ) : null}

      {editConfirmDialog.open ? (
        <div className="training-edit-confirm-overlay" role="dialog" aria-modal="true" aria-label="Potvrdenie editácie" onClick={closeEditConfirm}>
          <div className="training-edit-confirm-card" onClick={(event) => event.stopPropagation()}>
            <h3>Potvrdiť editáciu tréningu</h3>
            <p className="unified-muted" style={{ marginTop: 6 }}>
              Chcete otvoriť tréning na úpravu v plánovači tréningu?
            </p>
            <div className="training-edit-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEditConfirm}>Zrušiť</button>
              <button
                type="button"
                className="btn training-composer-save-btn"
                onClick={() => handleEditTraining(editConfirmDialog.training)}
                disabled={Boolean(rowActionLoadingId)}
              >
                Potvrdiť
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Název</th>
              <th>Datum</th>
              <th>Místo</th>
              <th>Cvičení</th>
              <th>Stav</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {trainings.length === 0 ? (
              <tr>
                <td colSpan="6" className="unified-empty">
                  Žádné tréninky
                </td>
              </tr>
            ) : (
              trainings.map((training) => (
                <tr key={training.id}>
                  <td><strong>{training.name}</strong></td>
                  <td>{new Date(training.date).toLocaleDateString('cs-CZ')}</td>
                  <td>{training.location}</td>
                  <td>{training.exerciseCount} cvičení</td>
                  <td>
                    <span className={`unified-badge ${training.status === 'completed' ? 'success' : 'warning'}`}>
                      {training.status === 'completed' ? 'Dokončeno' : 'Naplánováno'}
                    </span>
                  </td>
                  <td>
                    <div className="training-table-actions">
                      <button type="button" className="btn btn-secondary training-table-action-btn" onClick={() => handleViewTraining(training)} disabled={Boolean(rowActionLoadingId)} aria-label="Zobraziť" title="Zobraziť">
                        <span className="material-icons-round training-table-action-icon" aria-hidden="true">visibility</span>
                      </button>
                      <button type="button" className="btn btn-secondary training-table-action-btn" onClick={() => openEditConfirm(training)} disabled={Boolean(rowActionLoadingId)} aria-label="Editovať" title="Editovať">
                        <span className="material-icons-round training-table-action-icon" aria-hidden="true">edit</span>
                      </button>
                      <button type="button" className="btn btn-secondary training-table-action-btn training-table-action-btn-danger" onClick={() => handleDeleteTraining(training)} disabled={Boolean(rowActionLoadingId)} aria-label="Odstrániť" title="Odstrániť">
                        <span className="material-icons-round training-table-action-icon" aria-hidden="true">delete</span>
                      </button>
                      <button type="button" className="btn btn-secondary training-table-action-btn" onClick={() => handlePrintTraining(training)} disabled={Boolean(rowActionLoadingId)} aria-label="Tlačiť" title="Tlačiť">
                        <span className="material-icons-round training-table-action-icon" aria-hidden="true">print</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Trainings
