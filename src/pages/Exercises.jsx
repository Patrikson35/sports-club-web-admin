// ...existing code...
import React, { useEffect, useMemo, useState } from 'react'
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

const EXERCISE_PLAYERS_COUNT_OPTIONS = Array.from({ length: 20 }, (_, index) => String(index + 1))
const DEFAULT_SPORT_OPTIONS = [
  { key: 'football', label: 'Futbal', sortOrder: 1, isActive: true },
  { key: 'hockey', label: 'Hokej', sortOrder: 2, isActive: true },
  { key: 'basketball', label: 'Basketbal', sortOrder: 3, isActive: true },
  { key: 'handball', label: 'Hádzaná', sortOrder: 4, isActive: true },
  { key: 'volleyball', label: 'Volejbal', sortOrder: 5, isActive: true },
  { key: 'tennis', label: 'Tenis', sortOrder: 6, isActive: true }
]

const SPORT_KEY_ALIASES = {
  futbal: 'football',
  football: 'football',
  hokej: 'hockey',
  hockey: 'hockey',
  basketbal: 'basketball',
  basketball: 'basketball',
  hadzana: 'handball',
  handball: 'handball',
  volejbal: 'volleyball',
  volleyball: 'volleyball',
  tenis: 'tennis',
  tennis: 'tennis'
}

const normalizeSportFilterKey = (value) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')

  return SPORT_KEY_ALIASES[raw] || raw
}

const ADMIN_ROLE_KEYS = ['admin', 'system_admin', 'super_admin', 'founder']

const isAdminCreator = (item) => {
  const creatorRole = String(item?.creatorRole || item?.creator_role || '').trim().toLowerCase()
  return ADMIN_ROLE_KEYS.includes(creatorRole)
}

const resolveExerciseIsPublic = (item) => {
  return Boolean(item?.isSystem)
    || Boolean(item?.is_system)
    || isAdminCreator(item)
}

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

const normalizeCustomLabels = (value) => {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
}

const normalizeExerciseItems = (value) => {
  const parsed = Array.isArray(value) ? value : []

  return parsed
    .map((item) => {
      const youtube = item?.youtube && typeof item.youtube === 'object' ? item.youtube : {}
      return {
        id: String(item?.id || '').trim(),
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim(),
        sportKey: String(item?.sportKey || '').trim(),
        isSystem: Boolean(item?.isSystem),
        clubId: item?.clubId || null,
        createdByUserId: item?.createdByUserId || null,
        categoryName: String(item?.categoryName || '').trim(),
        intensity: String(item?.intensity || 'Stredná').trim(),
        rating: normalizeExerciseRating(item?.rating),
        isFavorite: normalizeExerciseFavorite(item?.isFavorite),
        playersCount: normalizeExercisePlayersCount(item?.playersCount),
        imageUrl: resolveMediaUrl(item?.imageUrl || ''),
        imageName: String(item?.imageName || '').trim(),
        selectedCategoryIds: Array.isArray(item?.selectedCategoryIds)
          ? item.selectedCategoryIds.map((categoryId) => String(categoryId || '').trim()).filter(Boolean)
          : [],
        categorySelections: item?.categorySelections && typeof item.categorySelections === 'object' ? item.categorySelections : {},
        youtube: {
          url: String(youtube?.url || '').trim(),
          videoId: String(youtube?.videoId || '').trim()
        },
        customLabels: normalizeCustomLabels(item?.customLabels),
        createdAt: String(item?.createdAt || '').trim(),
        updatedAt: String(item?.updatedAt || '').trim()
      }
    })
    .filter((item) => item.id && item.name)
}

const getYoutubeThumbnailUrl = (videoId) => {
  const resolvedId = String(videoId || '').trim()
  if (!resolvedId) return ''
  return `https://img.youtube.com/vi/${resolvedId}/hqdefault.jpg`
}

const extractYoutubeVideoId = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const directIdMatch = raw.match(/^[a-zA-Z0-9_-]{11}$/)
  if (directIdMatch) return directIdMatch[0]

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match?.[1]) return match[1]
  }

  return ''
}

const resolveSelectedExerciseCategoryIds = (selectedCategoryIds, categorySelections) => {
  const selectedFromIds = Array.isArray(selectedCategoryIds)
    ? selectedCategoryIds.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  const selectedFromSelections = categorySelections && typeof categorySelections === 'object'
    ? Object.entries(categorySelections)
        .filter(([, subcategories]) => Array.isArray(subcategories))
        .map(([categoryId]) => String(categoryId || '').trim())
        .filter(Boolean)
    : []

  return Array.from(new Set([...selectedFromIds, ...selectedFromSelections]))
}

function Exercises({ webSettingsSection = '' }) {
    // --- Klubový filtr ---
    const [clubs, setClubs] = useState([])
    const [clubsError, setClubsError] = useState('')
    useEffect(() => {
      api.getClubs()
        .then(data => setClubs(Array.isArray(data?.clubs) ? data.clubs : []))
        .catch((err) => {
          setClubs([])
          setClubsError('Nepodařilo se načíst seznam klubů. Zkuste to prosím později.')
        })
    }, [])

    // --- Nové filtry ---
    const [exerciseLibraryFilters, setExerciseLibraryFilters] = useState({
      sportKey: 'all',
      libraryType: 'all', // 'all' | 'public' | 'private'
      clubId: 'all'
    })
  const isEmbeddedWebSettingsView = Boolean(String(webSettingsSection || '').trim())
  const showExerciseListSection = !isEmbeddedWebSettingsView || webSettingsSection === 'exerciseList'
  const showCreateExerciseSection = !isEmbeddedWebSettingsView || webSettingsSection === 'createExercise'
  const showExerciseCategoriesSection = !isEmbeddedWebSettingsView || webSettingsSection === 'exerciseCategories'
  const [currentRole, setCurrentRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [sportOptions, setSportOptions] = useState(DEFAULT_SPORT_OPTIONS)
  const [exerciseCategories, setExerciseCategories] = useState([])
  const [exerciseDatabaseItems, setExerciseDatabaseItems] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCategoryCreateForm, setShowCategoryCreateForm] = useState(false)
  const [isCreatingExercise, setIsCreatingExercise] = useState(false)
  const [isLoadingBulkPreview, setIsLoadingBulkPreview] = useState(false)
  const [isImportingBulkSelection, setIsImportingBulkSelection] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isSavingCustomLabels, setIsSavingCustomLabels] = useState(false)
  const [createExerciseError, setCreateExerciseError] = useState('')
  const [createExerciseSuccess, setCreateExerciseSuccess] = useState('')
  const [bulkCreateError, setBulkCreateError] = useState('')
  const [bulkCreateSuccess, setBulkCreateSuccess] = useState('')
  const [detailActionError, setDetailActionError] = useState('')
  const [detailActionSuccess, setDetailActionSuccess] = useState('')
  const [isEditingExerciseDetail, setIsEditingExerciseDetail] = useState(false)
  const [isUpdatingExerciseDetail, setIsUpdatingExerciseDetail] = useState(false)
  const [isDeletingExerciseDetail, setIsDeletingExerciseDetail] = useState(false)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, id: '', name: '' })
  const [editExerciseDraft, setEditExerciseDraft] = useState({ title: '', sportKey: '', youtubeUrl: '', description: '' })
  const [createCategoryError, setCreateCategoryError] = useState('')
  const [customLabelDraft, setCustomLabelDraft] = useState('')
  const [createExerciseForm, setCreateExerciseForm] = useState({
    title: '',
    youtubeUrl: '',
    description: '',
    sportKey: '',
    categoryId: '',
    difficulty: '',
    duration: '',
    equipment: '',
    isSystem: false,
    customLabels: ''
  })
  const [showBulkCreateForm, setShowBulkCreateForm] = useState(false)
  const [bulkCreateForm, setBulkCreateForm] = useState({
    sportKey: '',
    channelUrl: '',
    maxResults: '50'
  })
  const [bulkPreviewChannel, setBulkPreviewChannel] = useState(null)
  const [bulkPreviewVideos, setBulkPreviewVideos] = useState([])
  const [bulkSelectedVideoIds, setBulkSelectedVideoIds] = useState([])
  const [createCategoryForm, setCreateCategoryForm] = useState({
    name: '',
    description: '',
    sportKey: '',
    parentId: '',
    isSystem: false
  })
  const [openedExerciseDetailItem, setOpenedExerciseDetailItem] = useState(null)
  const [isExerciseDetailVideoPlaying, setIsExerciseDetailVideoPlaying] = useState(false)
  const [exerciseListFilters, setExerciseListFilters] = useState({
    intensity: 'all',
    playersCount: 'all',
    categoryId: 'all',
    subcategory: 'all',
    level: 'all',
    favorite: 'all'
  })

  useEffect(() => {
    let isMounted = true

    const mapApiExerciseItem = (item) => {
      const youtubeUrl = String(
        item?.youtubeUrl
        || item?.youtube_url
        || item?.youtube?.url
        || ''
      ).trim()
      const youtubeVideoId = String(
        item?.youtubeVideoId
        || item?.youtube_video_id
        || item?.youtube?.videoId
        || extractYoutubeVideoId(youtubeUrl)
      ).trim()

      return ({
      id: String(item?.id || '').trim(),
      name: String(item?.title || item?.name || '').trim(),
      description: String(item?.description || '').trim(),
      sportKey: String(item?.sportKey || '').trim(),
      intensity: String(item?.difficulty || '').trim() || 'Stredná',
      playersCount: [],
      selectedCategoryIds: item?.category?.id ? [String(item.category.id)] : [],
      categorySelections: {},
      youtube: { url: youtubeUrl, videoId: youtubeVideoId },
      rating: 0,
      isFavorite: false,
      isSystem: resolveExerciseIsPublic(item),
      clubId: item?.clubId || null,
      createdByUserId: item?.createdByUserId || item?.created_by_user_id || null,
      categoryName: String(item?.category?.name || '').trim(),
      customLabels: normalizeCustomLabels(item?.customLabels)
    })
    }

    const loadExerciseLibrary = async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const normalizedRole = String(user?.role || '').trim().toLowerCase()
      const normalizedRoleKey = normalizedRole.replace(/[\s-]+/g, '_')
      const role = ['admin', 'system_admin', 'super_admin', 'founder'].includes(normalizedRoleKey)
        ? 'admin'
        : (normalizedRoleKey === 'club_admin' ? 'club' : normalizedRoleKey)
      const userId = String(user?.id || '').trim()
      const [categoryResponse, exerciseResponse, sportsResponsePrimary, sportsResponseFallback] = await Promise.all([
        api.getExerciseCategories(),
        api.getExercises(),
        api.getWebSettingsSports().catch(() => ({ sports: [] })),
        api.getRegistrationSports().catch(() => ({ sports: [] }))
      ])

      if (!isMounted) return

      setCurrentRole(role)
  setCurrentUserId(userId)

      const sportsRawPrimary = Array.isArray(sportsResponsePrimary?.sports) ? sportsResponsePrimary.sports : []
      const sportsRawFallback = Array.isArray(sportsResponseFallback?.sports) ? sportsResponseFallback.sports : []
      const sportsRaw = sportsRawPrimary.length > 0 ? sportsRawPrimary : sportsRawFallback
      const normalizedSports = sportsRaw
        .map((item) => ({
          key: String(item?.key || '').trim(),
          label: String(item?.label || '').trim(),
          isActive: item?.isActive !== false,
          sortOrder: Number(item?.sortOrder || 0)
        }))
        .filter((item) => item.key && item.label && item.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      setSportOptions(normalizedSports.length > 0 ? normalizedSports : DEFAULT_SPORT_OPTIONS)

      const categoriesRaw = Array.isArray(categoryResponse?.categories) ? categoryResponse.categories : []
      const normalizedCategories = categoriesRaw
        .map((item) => ({
          id: String(item?.id || '').trim(),
          name: String(item?.name || '').trim(),
          subcategories: Array.isArray(item?.subcategories)
            ? item.subcategories
                .map((subcategory) => String(subcategory?.name || '').trim())
                .filter(Boolean)
            : [],
          isSystem: Boolean(item?.isSystem),
          clubId: item?.clubId || null,
          sportKey: String(item?.sportKey || '').trim(),
        }))
        .filter((item) => item.id && item.name)

      const exercisesRaw = Array.isArray(exerciseResponse?.exercises) ? exerciseResponse.exercises : []
      const normalizedExercises = normalizeExerciseItems(exercisesRaw.map(mapApiExerciseItem))

      setExerciseCategories(normalizedCategories)
      setExerciseDatabaseItems(normalizedExercises)
    }

    const loadFromApi = async () => {
      try {
        await loadExerciseLibrary()
      } catch {
        if (!isMounted) return
        setCurrentRole('')
        setCurrentUserId('')
        setSportOptions(DEFAULT_SPORT_OPTIONS)
        setExerciseCategories([])
        setExerciseDatabaseItems([])
      }
    }

    loadFromApi()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!webSettingsSection) return

    if (webSettingsSection === 'createExercise') {
      setShowCreateForm(true)
      setShowBulkCreateForm(false)
      setShowCategoryCreateForm(false)
      return
    }

    if (webSettingsSection === 'exerciseCategories') {
      setShowCreateForm(false)
      setShowCategoryCreateForm(false)
      return
    }

    setShowCreateForm(false)
    setShowCategoryCreateForm(false)
  }, [webSettingsSection])

  const exerciseListSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = String(exerciseListFilters?.categoryId || 'all')
    if (selectedCategoryId === 'all') return []

    const selectedCategory = exerciseCategories.find((item) => String(item?.id || '') === selectedCategoryId)

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
    const { sportKey, libraryType, clubId } = exerciseLibraryFilters;
    return exerciseDatabaseItems.filter((item) => {
      const createdBy = String(item?.createdByUserId || '').trim()
      const isOwnPrivate = Boolean(currentUserId) && createdBy === String(currentUserId)

      if (sportKey !== 'all' && String(item?.sportKey || '') !== sportKey) return false;
      if (libraryType === 'public' && !item.isSystem) return false;
      if (libraryType === 'private') {
        if (item.isSystem) return false
        if (currentRole !== 'admin' && !isOwnPrivate) return false
      }
      const shouldApplyClubFilter = clubId !== 'all' && libraryType !== 'all'
      if (shouldApplyClubFilter && String(item?.clubId || '') !== clubId) return false;
      return true;
    });
  }, [exerciseDatabaseItems, exerciseLibraryFilters, currentRole, currentUserId]);

  const getExercisePreviewImage = (item) => {
    const uploadedImage = String(item?.imageUrl || '').trim()
    if (uploadedImage) return uploadedImage

    const youtubeVideoId = String(item?.youtube?.videoId || '').trim()
    return getYoutubeThumbnailUrl(youtubeVideoId)
  }

  const getExerciseCategorySummary = (item) => {
    if (String(item?.categoryName || '').trim()) {
      return String(item.categoryName).trim()
    }

    const selectedCategoryIds = resolveSelectedExerciseCategoryIds(item?.selectedCategoryIds, item?.categorySelections)

    const summary = exerciseCategories
      .map((category) => {
        const categoryId = String(category?.id || '')
        if (!selectedCategoryIds.includes(categoryId)) return null

        const categoryName = String(category?.name || 'Kategória').trim()
        const selectedSubcategories = Array.isArray(item?.categorySelections?.[categoryId])
          ? item.categorySelections[categoryId].map((sub) => String(sub || '').trim()).filter(Boolean)
          : []

        if (selectedSubcategories.length === 0) return categoryName
        return `${categoryName}: ${selectedSubcategories.join(', ')}`
      })
      .filter(Boolean)

    return summary.length > 0 ? summary.join(' | ') : ''
  }

  const resetExerciseListFilters = () => {
    setExerciseListFilters({
      intensity: 'all',
      playersCount: 'all',
      categoryId: 'all',
      subcategory: 'all',
      level: 'all',
      favorite: 'all'
    })
  }

  const closeExerciseDetailItem = () => {
    setIsExerciseDetailVideoPlaying(false)
    setIsEditingExerciseDetail(false)
    setDeleteConfirmDialog({ open: false, id: '', name: '' })
    setDetailActionError('')
    setDetailActionSuccess('')
    setOpenedExerciseDetailItem(null)
  }

  const persistExerciseItemsOnline = async () => {}

  useEffect(() => {
    const openedId = String(openedExerciseDetailItem?.id || '').trim()
    if (!openedId) return

    const updated = exerciseDatabaseItems.find((item) => String(item?.id || '').trim() === openedId)
    if (updated) {
      setOpenedExerciseDetailItem(updated)
    }
  }, [exerciseDatabaseItems, openedExerciseDetailItem?.id])

  const startExerciseDetailVideo = () => {
    const videoId = String(openedExerciseDetailItem?.youtube?.videoId || '').trim()
    if (!videoId) return
    setIsExerciseDetailVideoPlaying(true)
  }

  const setExerciseRating = (itemId, ratingValue) => {
    const resolvedItemId = String(itemId || '').trim()
    if (!resolvedItemId) return

    const normalizedRating = normalizeExerciseRating(ratingValue)
    setExerciseDatabaseItems((prev) => {
      const source = Array.isArray(prev) ? prev : []
      const nextItems = source.map((item) => {
        if (String(item?.id || '') !== resolvedItemId) return item
        return {
          ...item,
          rating: normalizedRating,
          updatedAt: new Date().toISOString()
        }
      })

      persistExerciseItemsOnline(nextItems).catch(() => {})

      return nextItems
    })
  }

  const toggleExerciseFavorite = (itemId) => {
    const resolvedItemId = String(itemId || '').trim()
    if (!resolvedItemId) return

    setExerciseDatabaseItems((prev) => {
      const source = Array.isArray(prev) ? prev : []
      const nextItems = source.map((item) => {
        if (String(item?.id || '') !== resolvedItemId) return item
        return {
          ...item,
          isFavorite: !normalizeExerciseFavorite(item?.isFavorite),
          updatedAt: new Date().toISOString()
        }
      })

      persistExerciseItemsOnline(nextItems).catch(() => {})

      return nextItems
    })
  }

  const openCreateExerciseInMyClub = () => {
    setCreateExerciseError('')
    setCreateExerciseSuccess('')
    setBulkCreateError('')
    setBulkCreateSuccess('')
    setShowBulkCreateForm(false)
    setShowCreateForm((prev) => !prev)
  }

  const openBulkCreateInMyClub = () => {
    setCreateExerciseError('')
    setCreateExerciseSuccess('')
    setBulkCreateError('')
    setBulkCreateSuccess('')
    setBulkPreviewChannel(null)
    setBulkPreviewVideos([])
    setBulkSelectedVideoIds([])
    setShowCreateForm(false)
    setShowBulkCreateForm((prev) => !prev)
  }

  const switchToSingleCreateForm = () => {
    setBulkCreateError('')
    setBulkCreateSuccess('')
    setBulkPreviewChannel(null)
    setBulkPreviewVideos([])
    setBulkSelectedVideoIds([])
    setShowBulkCreateForm(false)
    setShowCreateForm(true)
  }

  const switchToBulkCreateForm = () => {
    setCreateExerciseError('')
    setCreateExerciseSuccess('')
    setShowCreateForm(false)
    setShowBulkCreateForm(true)
  }

  const canCreateSystemExercise = currentRole === 'admin'
  const canManageExerciseCategories = currentRole === 'admin' || currentRole === 'club' || currentRole === 'coach'
  const shouldRequireSportSelection = currentRole === 'admin' || isEmbeddedWebSettingsView
  const bulkPreviewSelectableVideos = bulkPreviewVideos.filter((video) => !video.alreadyExists)

  const categoryOptionsForExercise = useMemo(() => {
    const selectedSportKey = String(createExerciseForm.sportKey || '').trim()
    if (!selectedSportKey) return exerciseCategories
    return exerciseCategories.filter((category) => {
      const categorySportKey = String(category?.sportKey || '').trim()
      return !categorySportKey || categorySportKey === selectedSportKey
    })
  }, [exerciseCategories, createExerciseForm.sportKey])

  const reloadExerciseLibrary = async () => {
    const [categoryResponse, exerciseResponse] = await Promise.all([
      api.getExerciseCategories(),
      api.getExercises()
    ])

    const categoriesRaw = Array.isArray(categoryResponse?.categories) ? categoryResponse.categories : []
    const normalizedCategories = categoriesRaw
      .map((item) => ({
        id: String(item?.id || '').trim(),
        name: String(item?.name || '').trim(),
        subcategories: Array.isArray(item?.subcategories)
          ? item.subcategories
              .map((subcategory) => String(subcategory?.name || '').trim())
              .filter(Boolean)
          : [],
        isSystem: Boolean(item?.isSystem),
        clubId: item?.clubId || null
      }))
      .filter((item) => item.id && item.name)

    const exercisesRaw = Array.isArray(exerciseResponse?.exercises) ? exerciseResponse.exercises : []
    const normalizedExercises = normalizeExerciseItems(exercisesRaw.map((item) => ({
      id: String(item?.id || '').trim(),
      name: String(item?.title || item?.name || '').trim(),
      description: String(item?.description || '').trim(),
      sportKey: String(item?.sportKey || '').trim(),
      intensity: String(item?.difficulty || '').trim() || 'Stredná',
      playersCount: [],
      selectedCategoryIds: item?.category?.id ? [String(item.category.id)] : [],
      categorySelections: {},
      youtube: {
        url: String(item?.youtubeUrl || item?.youtube_url || item?.youtube?.url || '').trim(),
        videoId: String(item?.youtubeVideoId || item?.youtube_video_id || item?.youtube?.videoId || extractYoutubeVideoId(item?.youtubeUrl || item?.youtube_url || item?.youtube?.url || '')).trim()
      },
      rating: 0,
      isFavorite: false,
      isSystem: resolveExerciseIsPublic(item),
      clubId: item?.clubId || null,
      createdByUserId: item?.createdByUserId || item?.created_by_user_id || null,
      categoryName: String(item?.category?.name || '').trim(),
      customLabels: normalizeCustomLabels(item?.customLabels)
    })))

    setExerciseCategories(normalizedCategories)
    setExerciseDatabaseItems(normalizedExercises)
  }

  const handleCreateCategory = async (event) => {
    event.preventDefault()
    const normalizedName = String(createCategoryForm.name || '').trim()
    const normalizedSportKey = String(createCategoryForm.sportKey || '').trim()
    if (!normalizedName) {
      setCreateCategoryError('Názov kategórie je povinný.')
      return
    }

    if (shouldRequireSportSelection && !normalizedSportKey) {
      setCreateCategoryError('Výber športu je povinný.')
      return
    }

    setCreateCategoryError('')
    setIsCreatingCategory(true)
    try {
      await api.createExerciseCategory({
        name: normalizedName,
        description: String(createCategoryForm.description || '').trim(),
        sportKey: normalizedSportKey || null,
        parentId: createCategoryForm.parentId ? Number(createCategoryForm.parentId) : null,
        isSystem: canCreateSystemExercise && createCategoryForm.isSystem
      })
      await reloadExerciseLibrary()
      setCreateCategoryForm({ name: '', description: '', sportKey: '', parentId: '', isSystem: false })
      setShowCategoryCreateForm(false)
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      const isEndpointMissing = api.isEndpointNotFound(error)
      setCreateCategoryError(
        isEndpointMissing
          ? 'Uloženie kategórie momentálne nie je dostupné na API serveri.'
          : (message || 'Kategóriu sa nepodarilo vytvoriť.')
      )
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const saveExerciseCustomLabels = async (exerciseId) => {
    const parsedLabels = normalizeCustomLabels(String(customLabelDraft || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean))

    setIsSavingCustomLabels(true)
    try {
      await api.updateExerciseCustomCategories(exerciseId, parsedLabels)
      setExerciseDatabaseItems((prev) => (Array.isArray(prev) ? prev.map((entry) => {
        if (String(entry?.id || '') !== String(exerciseId)) return entry
        return {
          ...entry,
          customLabels: parsedLabels,
          updatedAt: new Date().toISOString()
        }
      }) : []))
      setOpenedExerciseDetailItem((prev) => {
        if (!prev || String(prev?.id || '') !== String(exerciseId)) return prev
        return {
          ...prev,
          customLabels: parsedLabels,
          updatedAt: new Date().toISOString()
        }
      })
    } finally {
      setIsSavingCustomLabels(false)
    }
  }

  const handleCreateExercise = async (event) => {
    event.preventDefault()
    const title = String(createExerciseForm.title || '').trim()
    const normalizedSportKey = String(createExerciseForm.sportKey || '').trim()
    if (!title) {
      setCreateExerciseError('Názov cvičenia je povinný.')
      setCreateExerciseSuccess('')
      return
    }

    if (shouldRequireSportSelection && !normalizedSportKey) {
      setCreateExerciseError('Výber športu je povinný.')
      setCreateExerciseSuccess('')
      return
    }

    setIsCreatingExercise(true)
    setCreateExerciseError('')
    setCreateExerciseSuccess('')
    try {
      const payload = {
        title,
        youtubeUrl: String(createExerciseForm.youtubeUrl || '').trim() || null,
        description: String(createExerciseForm.description || '').trim(),
        sportKey: normalizedSportKey || null,
        categoryId: createExerciseForm.categoryId ? Number(createExerciseForm.categoryId) : null,
        difficulty: String(createExerciseForm.difficulty || '').trim() || null,
        duration: createExerciseForm.duration ? Number(createExerciseForm.duration) : null,
        equipment: String(createExerciseForm.equipment || '').trim() || null,
        isSystem: true,
        customLabels: normalizeCustomLabels(
          String(createExerciseForm.customLabels || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        )
      }

      await api.createExercise(payload)
      await reloadExerciseLibrary()
      setCreateExerciseForm({
        title: '',
        youtubeUrl: '',
        description: '',
        sportKey: '',
        categoryId: '',
        difficulty: '',
        duration: '',
        equipment: '',
        isSystem: false,
        customLabels: ''
      })
      setCreateExerciseSuccess('Cvičenie bolo úspešne uložené.')
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setCreateExerciseError(message || 'Cvičenie sa nepodarilo vytvoriť.')
      setCreateExerciseSuccess('')
    } finally {
      setIsCreatingExercise(false)
    }
  }

  const handleBulkCreateExercises = async (event) => {
    event.preventDefault()

    const normalizedSportKey = String(bulkCreateForm.sportKey || '').trim()
    const normalizedChannelUrl = String(bulkCreateForm.channelUrl || '').trim()
    const normalizedMaxResults = Number.parseInt(String(bulkCreateForm.maxResults || '50'), 10)

    if (!normalizedSportKey) {
      setBulkCreateError('Výber športu je povinný.')
      setBulkCreateSuccess('')
      return
    }

    if (!normalizedChannelUrl) {
      setBulkCreateError('Link na YouTube kanál je povinný.')
      setBulkCreateSuccess('')
      return
    }

    if (!Number.isInteger(normalizedMaxResults) || normalizedMaxResults < 1 || normalizedMaxResults > 200) {
      setBulkCreateError('Počet videí musí byť číslo od 1 do 200.')
      setBulkCreateSuccess('')
      return
    }

    setIsLoadingBulkPreview(true)
    setBulkCreateError('')
    setBulkCreateSuccess('')

    try {
      const response = await api.previewExerciseChannelImport({
        sportKey: normalizedSportKey,
        channelUrl: normalizedChannelUrl,
        maxResults: normalizedMaxResults
      })

      const previewChannel = response?.channel && typeof response.channel === 'object'
        ? {
            id: String(response.channel.id || '').trim(),
            title: String(response.channel.title || '').trim(),
            sourceUrl: String(response.channel.sourceUrl || normalizedChannelUrl).trim()
          }
        : null

      const previewVideos = Array.isArray(response?.videos)
        ? response.videos
            .map((video) => ({
              videoId: String(video?.videoId || '').trim(),
              title: String(video?.title || '').trim(),
              youtubeUrl: String(video?.youtubeUrl || '').trim(),
              thumbnailUrl: resolveMediaUrl(String(video?.thumbnailUrl || '').trim()),
              publishedAt: String(video?.publishedAt || '').trim(),
              publishedText: String(video?.publishedText || '').trim(),
              description: String(video?.description || '').trim(),
              alreadyExists: Boolean(video?.alreadyExists)
            }))
            .filter((video) => video.videoId && video.title)
        : []

      setBulkPreviewChannel(previewChannel)
      setBulkPreviewVideos(previewVideos)
      setBulkSelectedVideoIds(previewVideos.filter((video) => !video.alreadyExists).map((video) => video.videoId))
      const importableVideosCount = previewVideos.filter((video) => !video.alreadyExists).length

      if (previewVideos.length === 0) {
        setBulkCreateSuccess('Kanál bol načítaný, ale neobsahuje žiadne videá pre import.')
      } else if (importableVideosCount === 0) {
        setBulkCreateSuccess(`Kanál načítaný. Všetkých ${previewVideos.length} videí už je v knižnici.`)
      } else {
        setBulkCreateSuccess(`Kanál načítaný. Nové videá na import: ${importableVideosCount} z ${previewVideos.length}.`)
      }
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setBulkCreateError(message || 'Hromadné vytváranie sa nepodarilo spustiť.')
      setBulkCreateSuccess('')
      setBulkPreviewChannel(null)
      setBulkPreviewVideos([])
      setBulkSelectedVideoIds([])
    } finally {
      setIsLoadingBulkPreview(false)
    }
  }

  const toggleBulkVideoSelection = (videoId) => {
    const resolved = String(videoId || '').trim()
    if (!resolved) return

    setBulkSelectedVideoIds((prev) => {
      const source = Array.isArray(prev) ? prev : []
      if (source.includes(resolved)) {
        return source.filter((item) => item !== resolved)
      }
      return [...source, resolved]
    })
  }

  const selectAllBulkVideos = () => {
    setBulkSelectedVideoIds(bulkPreviewVideos.filter((video) => !video.alreadyExists).map((video) => video.videoId))
  }

  const clearBulkVideoSelection = () => {
    setBulkSelectedVideoIds([])
  }

  const handleBulkImportSelected = async () => {
    const normalizedSportKey = String(bulkCreateForm.sportKey || '').trim()
    const normalizedChannelUrl = String(bulkCreateForm.channelUrl || '').trim()
    const normalizedMaxResults = Number.parseInt(String(bulkCreateForm.maxResults || '50'), 10)
    const selectedIds = Array.isArray(bulkSelectedVideoIds)
      ? bulkSelectedVideoIds.map((item) => String(item || '').trim()).filter(Boolean)
      : []

    if (!normalizedSportKey || !normalizedChannelUrl) {
      setBulkCreateError('Najprv vyplň šport a link na kanál.')
      return
    }

    if (selectedIds.length === 0) {
      setBulkCreateError('Vyber aspoň jedno video na import.')
      return
    }

    setIsImportingBulkSelection(true)
    setBulkCreateError('')
    setBulkCreateSuccess('')

    try {
      const response = await api.importExercisesFromChannel({
        sportKey: normalizedSportKey,
        channelUrl: normalizedChannelUrl,
        maxResults: Number.isInteger(normalizedMaxResults) ? normalizedMaxResults : 200,
        selectedVideoIds: selectedIds
      })

      await reloadExerciseLibrary()
      const createdCount = Number(response?.createdCount || 0)
      const skippedCount = Number(response?.skippedExistingCount || 0)
      setBulkCreateSuccess(`Import dokončený. Vytvorené: ${createdCount}, preskočené (už existovali): ${skippedCount}.`)

      const importedSet = new Set(selectedIds)
      setBulkPreviewVideos((prev) => (Array.isArray(prev)
        ? prev.map((video) => importedSet.has(video.videoId)
          ? { ...video, alreadyExists: true }
          : video)
        : []))
      setBulkSelectedVideoIds([])
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setBulkCreateError(message || 'Vybrané videá sa nepodarilo importovať.')
    } finally {
      setIsImportingBulkSelection(false)
    }
  }

  const openedExerciseCategorySummary = openedExerciseDetailItem
    ? getExerciseCategorySummary(openedExerciseDetailItem)
    : ''

  useEffect(() => {
    if (!openedExerciseDetailItem) {
      setCustomLabelDraft('')
      return
    }
    setCustomLabelDraft((Array.isArray(openedExerciseDetailItem?.customLabels)
      ? openedExerciseDetailItem.customLabels
      : []).join(', '))
  }, [openedExerciseDetailItem])

  useEffect(() => {
    if (!openedExerciseDetailItem) {
      setEditExerciseDraft({ title: '', sportKey: '', youtubeUrl: '', description: '' })
      return
    }

    setEditExerciseDraft({
      title: String(openedExerciseDetailItem?.name || openedExerciseDetailItem?.title || '').trim(),
      sportKey: String(openedExerciseDetailItem?.sportKey || '').trim(),
      youtubeUrl: String(openedExerciseDetailItem?.youtube?.url || '').trim(),
      description: String(openedExerciseDetailItem?.description || '').trim()
    })
  }, [openedExerciseDetailItem])

  const canManageOpenedExercise = openedExerciseDetailItem
    ? (currentRole === 'admin' || (!openedExerciseDetailItem?.isSystem && (currentRole === 'club' || currentRole === 'coach')))
    : false
  const useAdminFocusedEditMode = isEmbeddedWebSettingsView && currentRole === 'admin' && isEditingExerciseDetail

  const startEditOpenedExercise = () => {
    if (!openedExerciseDetailItem || !canManageOpenedExercise) return
    setDetailActionError('')
    setDetailActionSuccess('')
    setIsEditingExerciseDetail(true)
  }

  const cancelEditOpenedExercise = () => {
    if (!openedExerciseDetailItem) return
    setEditExerciseDraft({
      title: String(openedExerciseDetailItem?.name || openedExerciseDetailItem?.title || '').trim(),
      sportKey: String(openedExerciseDetailItem?.sportKey || '').trim(),
      youtubeUrl: String(openedExerciseDetailItem?.youtube?.url || '').trim(),
      description: String(openedExerciseDetailItem?.description || '').trim()
    })
    setDetailActionError('')
    setIsEditingExerciseDetail(false)
  }

  const saveOpenedExerciseChanges = async () => {
    if (!openedExerciseDetailItem || !canManageOpenedExercise || isUpdatingExerciseDetail) return

    const title = String(editExerciseDraft.title || '').trim()
    if (!title) {
      setDetailActionError('Názov cvičenia je povinný.')
      return
    }

    setIsUpdatingExerciseDetail(true)
    setDetailActionError('')
    setDetailActionSuccess('')
    try {
      await api.updateExercise(openedExerciseDetailItem.id, {
        title,
        sportKey: String(editExerciseDraft.sportKey || '').trim() || null,
        youtubeUrl: String(editExerciseDraft.youtubeUrl || '').trim() || null,
        description: String(editExerciseDraft.description || '').trim() || null
      })
      await reloadExerciseLibrary()
      setDetailActionSuccess('Cvičenie bolo upravené.')
      setIsEditingExerciseDetail(false)
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setDetailActionError(message || 'Cvičenie sa nepodarilo upraviť.')
    } finally {
      setIsUpdatingExerciseDetail(false)
    }
  }

  const openDeleteExerciseConfirm = () => {
    if (!openedExerciseDetailItem || !canManageOpenedExercise || isDeletingExerciseDetail) return
    setDeleteConfirmDialog({
      open: true,
      id: String(openedExerciseDetailItem.id || ''),
      name: String(openedExerciseDetailItem.name || 'cvičenie')
    })
  }

  const closeDeleteExerciseConfirm = () => {
    if (isDeletingExerciseDetail) return
    setDeleteConfirmDialog({ open: false, id: '', name: '' })
  }

  useEffect(() => {
    if (!deleteConfirmDialog.open) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeletingExerciseDetail) {
        closeDeleteExerciseConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteConfirmDialog.open, isDeletingExerciseDetail])

  const deleteOpenedExercise = async () => {
    if (!deleteConfirmDialog.open || !deleteConfirmDialog.id || isDeletingExerciseDetail) return

    setIsDeletingExerciseDetail(true)
    setDetailActionError('')
    setDetailActionSuccess('')
    try {
      await api.deleteExercise(deleteConfirmDialog.id)
      await reloadExerciseLibrary()
      setDeleteConfirmDialog({ open: false, id: '', name: '' })
      closeExerciseDetailItem()
      setCreateExerciseSuccess('Cvičenie bolo úspešne odstránené.')
      setCreateExerciseError('')
    } catch (error) {
      const message = String(error?.payload?.error || error?.payload?.message || error?.message || '').trim()
      setDetailActionError(message || 'Cvičenie sa nepodarilo odstrániť.')
    } finally {
      setIsDeletingExerciseDetail(false)
    }
  }

  return (
    <div className="members-categories-stack exercises-page-stack">
      {!isEmbeddedWebSettingsView ? (
        <>
          <div className="exercise-library-head">
            <h2>Knižnica cvičení</h2>
          </div>

        </>
      ) : null}

      {(showCategoryCreateForm && showExerciseCategoriesSection && !isEmbeddedWebSettingsView) ? (
        <>
          <div className="card settings-placeholder-card metrics-section-card" style={{ marginBottom: '0.65rem' }}>
            <form id="create-category-form" className="exercise-db-filters exercise-db-filters--category-create" onSubmit={handleCreateCategory}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="create-category-sport">Výber športu</label>
              <select
                id="create-category-sport"
                value={createCategoryForm.sportKey}
                onChange={(event) => setCreateCategoryForm((prev) => ({ ...prev, sportKey: event.target.value }))}
                required={shouldRequireSportSelection}
              >
                <option value="">Vyber šport</option>
                {sportOptions.map((sport) => (
                  <option key={`create-category-sport-${sport.key}`} value={sport.key}>
                    {sport.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="create-category-name">Názov kategórie</label>
              <input
                id="create-category-name"
                type="text"
                value={createCategoryForm.name}
                onChange={(event) => setCreateCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Napr. Prechod do útoku"
                required
              />
            </div>

            {!shouldRequireSportSelection && !isEmbeddedWebSettingsView ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="create-category-parent">Nadradená kategória</label>
              <select
                id="create-category-parent"
                value={createCategoryForm.parentId}
                onChange={(event) => setCreateCategoryForm((prev) => ({ ...prev, parentId: event.target.value }))}
              >
                <option value="">Bez nadradenej kategórie</option>
                {exerciseCategories.map((category) => (
                  <option key={`create-category-parent-${category.id}`} value={String(category.id)}>
                    {String(category.name || 'Kategória')}
                  </option>
                ))}
              </select>
            </div>
            ) : null}

            {!shouldRequireSportSelection && !isEmbeddedWebSettingsView ? (
              <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label htmlFor="create-category-description">Popis</label>
                <input
                  id="create-category-description"
                  type="text"
                  value={createCategoryForm.description}
                  onChange={(event) => setCreateCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Voliteľný popis"
                />
              </div>
            ) : null}

            {canCreateSystemExercise ? (
              <label className="planner-stitch-checkbox-option" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="checkbox"
                  checked={createCategoryForm.isSystem}
                  onChange={(event) => setCreateCategoryForm((prev) => ({ ...prev, isSystem: event.target.checked }))}
                />
                <span>Základná (systémová) kategória pre všetky kluby</span>
              </label>
            ) : null}

            {createCategoryError ? (
              <p className="manager-empty-text" style={{ gridColumn: '1 / -1', margin: 0 }}>{createCategoryError}</p>
            ) : null}

            </form>
          </div>

          <div className="exercise-db-below-card-actions">
            <button
              type="submit"
              form="create-category-form"
              className="btn-edit exercise-db-below-card-btn"
              disabled={isCreatingCategory}
            >
              {isCreatingCategory ? 'Ukladám...' : 'Uložiť kategóriu'}
            </button>
          </div>
        </>
      ) : null}

      {(showExerciseCategoriesSection && isEmbeddedWebSettingsView) ? (
        <div className="card settings-placeholder-card metrics-section-card" style={{ marginBottom: '1rem' }}>
          <p className="manager-empty-text" style={{ margin: 0 }}>
            Kategórie cvičení sa vo web-admine nevytvárajú. Kategórie pre svoje cvičenia vytvárajú kluby a tréneri vo svojej časti systému.
          </p>
        </div>
      ) : null}

      {(showCreateForm && showCreateExerciseSection) ? (
        <>
        {createExerciseSuccess ? (
          <div className="success-message" style={{ marginBottom: '0.75rem' }}>{createExerciseSuccess}</div>
        ) : null}
        <div className="card settings-placeholder-card metrics-section-card" style={{ marginBottom: '1rem' }}>
          <form className={`exercise-db-filters${isEmbeddedWebSettingsView ? ' exercise-db-filters--single-column' : ''}`} onSubmit={handleCreateExercise}>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="create-exercise-sport">Výber športu</label>
              <select
                id="create-exercise-sport"
                value={createExerciseForm.sportKey}
                onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, sportKey: event.target.value, categoryId: '' }))}
                required={shouldRequireSportSelection}
              >
                <option value="">Vyber šport</option>
                {sportOptions.map((sport) => (
                  <option key={`create-exercise-sport-${sport.key}`} value={sport.key}>
                    {sport.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="create-exercise-title">Názov</label>
              <input
                id="create-exercise-title"
                type="text"
                value={createExerciseForm.title}
                onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Napr. Dynamické rozcvičenie"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label htmlFor="create-exercise-youtube">Link na video (YouTube)</label>
              <input
                id="create-exercise-youtube"
                type="url"
                value={createExerciseForm.youtubeUrl}
                onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            {!isEmbeddedWebSettingsView ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="create-exercise-category">Kategória</label>
                <select
                  id="create-exercise-category"
                  value={createExerciseForm.categoryId}
                  onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">Bez kategórie</option>
                  {categoryOptionsForExercise.map((category) => (
                    <option key={`create-exercise-category-${category.id}`} value={String(category.id)}>
                      {String(category.name || 'Kategória')}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {!isEmbeddedWebSettingsView ? (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="create-exercise-difficulty">Náročnosť</label>
                  <select
                    id="create-exercise-difficulty"
                    value={createExerciseForm.difficulty}
                    onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                  >
                    <option value="">Neuvedené</option>
                    <option value="Nízka">Nízka</option>
                    <option value="Stredná">Stredná</option>
                    <option value="Vysoká">Vysoká</option>
                    <option value="Maximálna">Maximálna</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="create-exercise-duration">Trvanie (min)</label>
                  <input
                    id="create-exercise-duration"
                    type="number"
                    min="1"
                    value={createExerciseForm.duration}
                    onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, duration: event.target.value }))}
                    placeholder="10"
                  />
                </div>
              </>
            ) : null}

            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label htmlFor="create-exercise-description">Popis</label>
              <textarea
                id="create-exercise-description"
                rows={3}
                value={createExerciseForm.description}
                onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Krátky popis cvičenia"
              />
            </div>

            {!isEmbeddedWebSettingsView ? (
              <>
                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor="create-exercise-equipment">Pomôcky</label>
                  <input
                    id="create-exercise-equipment"
                    type="text"
                    value={createExerciseForm.equipment}
                    onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, equipment: event.target.value }))}
                    placeholder="Kužele, lopty"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor="create-exercise-custom-labels">Vlastné delenie (čiarkou)</label>
                  <input
                    id="create-exercise-custom-labels"
                    type="text"
                    value={createExerciseForm.customLabels}
                    onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, customLabels: event.target.value }))}
                    placeholder="Napr. U12, pressing, obrana"
                  />
                </div>
              </>
            ) : null}

            {canCreateSystemExercise && !isEmbeddedWebSettingsView ? (
              <label className="planner-stitch-checkbox-option" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="checkbox"
                  checked={createExerciseForm.isSystem}
                  onChange={(event) => setCreateExerciseForm((prev) => ({ ...prev, isSystem: event.target.checked }))}
                />
                <span>Verejné cvičenie pre všetky kluby</span>
              </label>
            ) : null}

            {createExerciseError ? (
              <p className="manager-empty-text" style={{ gridColumn: '1 / -1', margin: 0 }}>{createExerciseError}</p>
            ) : null}

            <button
              type="submit"
              className="btn-secondary exercise-db-filter-reset-btn"
              disabled={isCreatingExercise}
            >
              {isCreatingExercise ? 'Ukladám...' : 'Uložiť cvičenie'}
            </button>
          </form>
        </div>
        </>
      ) : null}

      {(showBulkCreateForm && showCreateExerciseSection) ? (
        <>
          {bulkCreateSuccess ? (
            <div className="success-message" style={{ marginBottom: '0.75rem' }}>{bulkCreateSuccess}</div>
          ) : null}
          <div className="card settings-placeholder-card metrics-section-card" style={{ marginBottom: '1rem' }}>
            <form className={`exercise-db-filters${isEmbeddedWebSettingsView ? ' exercise-db-filters--single-column' : ''}`} onSubmit={handleBulkCreateExercises}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="bulk-create-exercise-sport">Výber športu</label>
                <select
                  id="bulk-create-exercise-sport"
                  value={bulkCreateForm.sportKey}
                  onChange={(event) => setBulkCreateForm((prev) => ({ ...prev, sportKey: event.target.value }))}
                  required
                >
                  <option value="">Vyber šport</option>
                  {sportOptions.map((sport) => (
                    <option key={`bulk-create-sport-${sport.key}`} value={sport.key}>
                      {sport.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="bulk-create-exercise-max-results">Počet videí (max)</label>
                <input
                  id="bulk-create-exercise-max-results"
                  type="number"
                  min="1"
                  max="200"
                  value={bulkCreateForm.maxResults}
                  onChange={(event) => setBulkCreateForm((prev) => ({ ...prev, maxResults: event.target.value }))}
                  placeholder="50"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label htmlFor="bulk-create-exercise-channel-url">Link na YouTube kanál</label>
                <input
                  id="bulk-create-exercise-channel-url"
                  type="url"
                  value={bulkCreateForm.channelUrl}
                  onChange={(event) => setBulkCreateForm((prev) => ({ ...prev, channelUrl: event.target.value }))}
                  placeholder="https://www.youtube.com/@nazovkanala"
                  required
                />
              </div>

              <p className="manager-empty-text" style={{ gridColumn: '1 / -1', margin: 0 }}>
                Tento formulár je pripravený na hromadné vytváranie. V ďalšom kroku napojíme načítanie videí z YouTube kanála, ich výber a hromadné uloženie do knižnice.
              </p>

              {bulkCreateError ? (
                <p className="manager-empty-text" style={{ gridColumn: '1 / -1', margin: 0 }}>{bulkCreateError}</p>
              ) : null}

              <button
                type="submit"
                className="btn-secondary exercise-db-filter-reset-btn"
                disabled={isLoadingBulkPreview || isImportingBulkSelection}
              >
                {isLoadingBulkPreview ? 'Načítavam videá...' : 'Načítať videá z kanála'}
              </button>
            </form>

            {bulkPreviewVideos.length > 0 ? (
              <div className="exercise-bulk-preview">
                <div className="exercise-bulk-preview-head">
                  <strong>
                    {bulkPreviewChannel?.title
                      ? `${bulkPreviewChannel.title} (${bulkPreviewSelectableVideos.length} nové)`
                      : `Nájdené nové videá (${bulkPreviewSelectableVideos.length})`}
                  </strong>
                  <div className="exercise-bulk-preview-actions">
                    <button type="button" className="btn-secondary" onClick={selectAllBulkVideos} disabled={bulkPreviewSelectableVideos.length === 0}>Vybrať všetky nové</button>
                    <button type="button" className="btn-secondary" onClick={clearBulkVideoSelection} disabled={bulkPreviewSelectableVideos.length === 0}>Zrušiť výber</button>
                  </div>
                </div>

                {bulkPreviewSelectableVideos.length > 0 ? (
                <div className="exercise-bulk-preview-list" role="list" aria-label="Zoznam videí z kanála">
                  {bulkPreviewSelectableVideos.map((video) => {
                    const isSelected = bulkSelectedVideoIds.includes(video.videoId)
                    const parsedDate = video.publishedAt ? new Date(video.publishedAt) : null
                    const hasValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())
                    const publishedLabel = hasValidDate
                      ? parsedDate.toLocaleDateString('sk-SK')
                      : (String(video.publishedText || '').trim() || '')
                    return (
                      <label key={`bulk-video-${video.videoId}`} className="exercise-bulk-preview-item" role="listitem">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleBulkVideoSelection(video.videoId)}
                        />
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} className="exercise-bulk-preview-thumb" />
                        ) : null}
                        <span className="exercise-bulk-preview-item-content">
                          <span className="exercise-bulk-preview-item-title">{video.title}</span>
                          <span className="exercise-bulk-preview-item-meta">
                            Nové video
                            {publishedLabel ? ` | ${publishedLabel}` : ''}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                ) : (
                  <p className="manager-empty-text" style={{ margin: 0 }}>
                    Všetky načítané videá už sú v knižnici, preto sa v zozname nezobrazujú.
                  </p>
                )}

                <div className="exercise-bulk-preview-footer">
                  <span>Vybrané videá: {bulkSelectedVideoIds.length}</span>
                  <button
                    type="button"
                    className="btn-edit"
                    onClick={handleBulkImportSelected}
                    disabled={isImportingBulkSelection || bulkSelectedVideoIds.length === 0}
                  >
                    {isImportingBulkSelection ? 'Importujem...' : 'Importovať vybrané videá'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {showExerciseListSection ? (


      <>
      <div className="card settings-placeholder-card metrics-section-card exercise-db-filters-card">
        {clubsError && (
          <div style={{ color: '#ff6b6b', marginBottom: 12 }}>{clubsError}</div>
        )}
        <div className="exercise-db-filters exercise-library-filters" role="region" aria-label="Filtre zoznamu cvičení">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="exercise-library-filter-sport">Vyber športu</label>
            <select
              id="exercise-library-filter-sport"
              value={exerciseLibraryFilters.sportKey}
              onChange={e => setExerciseLibraryFilters(f => ({ ...f, sportKey: e.target.value }))}
            >
              <option value="all">Všetky</option>
              {sportOptions.map((sport) => (
                <option key={`exercise-library-filter-sport-${sport.key}`} value={sport.key}>{sport.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="exercise-library-filter-type">Vyber knižnice</label>
            <select
              id="exercise-library-filter-type"
              value={exerciseLibraryFilters.libraryType}
              onChange={e => setExerciseLibraryFilters(f => ({ ...f, libraryType: e.target.value }))}
            >
              <option value="all">Všetky</option>
              <option value="public">Verejné</option>
              <option value="private">Privátne</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="exercise-library-filter-club">Vyber klubu</label>
            <select
              id="exercise-library-filter-club"
              value={exerciseLibraryFilters.clubId}
              onChange={e => setExerciseLibraryFilters(f => ({ ...f, clubId: e.target.value }))}
            >
              <option value="all">Všetky</option>
              {clubs
                .filter((club) => {
                  if (exerciseLibraryFilters.sportKey === 'all') return true

                  const clubSportKey = normalizeSportFilterKey(
                    club?.sportKey || club?.sport_key || club?.sport
                  )
                  const selectedSportKey = normalizeSportFilterKey(exerciseLibraryFilters.sportKey)

                  return clubSportKey === selectedSportKey
                })
                .map(club => (
                  <option key={`exercise-library-filter-club-${club.id}`} value={club.id}>{club.name}</option>
                ))}
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
        </div>

        {exerciseDatabaseItems.length === 0 ? (
          <p className="manager-empty-text" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
            Databáza cvičení je zatiaľ prázdna.
          </p>
        ) : filteredExerciseDatabaseItems.length === 0 ? (
          <p className="manager-empty-text" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
            Žiadne cvičenie nezodpovedá filtru.
          </p>
        ) : (
          <div className="exercise-db-cards" style={{ marginTop: '0.8rem' }}>
            {filteredExerciseDatabaseItems.map((item) => (
              <div
                key={`card-${item.id}`}
                className="exercise-db-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setOpenedExerciseDetailItem(item)
                  setIsExerciseDetailVideoPlaying(false)
                  setIsEditingExerciseDetail(false)
                  setDeleteConfirmDialog({ open: false, id: '', name: '' })
                  setDetailActionError('')
                  setDetailActionSuccess('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setOpenedExerciseDetailItem(item)
                    setIsExerciseDetailVideoPlaying(false)
                    setIsEditingExerciseDetail(false)
                    setDeleteConfirmDialog({ open: false, id: '', name: '' })
                    setDetailActionError('')
                    setDetailActionSuccess('')
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

                <div className="exercise-db-card-title-row">
                  <div className="exercise-db-card-title">{item.name}</div>
                  <button
                    type="button"
                    className={`exercise-db-card-favorite-btn ${normalizeExerciseFavorite(item?.isFavorite) ? 'active' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleExerciseFavorite(item.id)
                    }}
                    aria-label={normalizeExerciseFavorite(item?.isFavorite) ? `Odobrať ${item.name} z obľúbených` : `Pridať ${item.name} medzi obľúbené`}
                    title={normalizeExerciseFavorite(item?.isFavorite) ? 'Obľúbené cvičenie' : 'Označiť ako obľúbené'}
                  >
                    <span className="material-icons-round" aria-hidden="true">
                      {normalizeExerciseFavorite(item?.isFavorite) ? 'favorite' : 'favorite_border'}
                    </span>
                  </button>
                </div>
                <div className="exercise-db-card-category-note">
                  {item.isSystem ? 'Verejná knižnica' : 'Klubová knižnica'}
                </div>
                {getExerciseCategorySummary(item) ? (
                  <div className="exercise-db-card-category-note">{getExerciseCategorySummary(item)}</div>
                ) : null}
                {Array.isArray(item?.customLabels) && item.customLabels.length > 0 ? (
                  <div className="exercise-db-card-category-note">Vlastné: {item.customLabels.join(', ')}</div>
                ) : null}
                <p className="exercise-db-card-description">{item.description || 'Bez popisu cvičenia.'}</p>

                {/* Karty Počet hráčov a Intenzita byly odstraněny na přání uživatele */}

                <div className="exercise-db-card-rating" aria-label="Hodnotenie cvičenia">
                  <small>Úroveň cvičenia</small>
                  <div className="exercise-db-card-rating-stars" role="group" aria-label={`Hodnotenie cvičenia ${item.name}`}>
                    {[1, 2, 3, 4, 5].map((starValue) => (
                      <button
                        key={`exercise-rating-${item.id}-${starValue}`}
                        type="button"
                        className={`exercise-db-card-star-btn ${starValue <= normalizeExerciseRating(item?.rating) ? 'active' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setExerciseRating(item.id, starValue)
                        }}
                        aria-label={`Hodnotenie ${starValue} z 5`}
                        title={`${starValue} z 5`}
                      >
                        <span className="material-icons-round" aria-hidden="true">
                          {starValue <= normalizeExerciseRating(item?.rating) ? 'star' : 'star_border'}
                        </span>
                      </button>
                    ))}
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

              {!useAdminFocusedEditMode ? (
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
              ) : null}

              <div className="exercise-detail-body">
                {!useAdminFocusedEditMode ? (
                  <>
                    <div className="exercise-detail-top-row">
                      {!isEmbeddedWebSettingsView ? (
                        <p><strong>Intenzita:</strong> {openedExerciseDetailItem.intensity}</p>
                      ) : null}
                    </div>

                    <div className="exercise-detail-preferences-row" aria-label="Obľúbenosť a hodnotenie cvičenia">
                      <button
                        type="button"
                        className={`exercise-detail-favorite-badge ${normalizeExerciseFavorite(openedExerciseDetailItem?.isFavorite) ? 'active' : ''}`}
                        onClick={() => toggleExerciseFavorite(openedExerciseDetailItem.id)}
                        aria-label={normalizeExerciseFavorite(openedExerciseDetailItem?.isFavorite) ? 'Odobrať z obľúbených' : 'Pridať medzi obľúbené'}
                        title={normalizeExerciseFavorite(openedExerciseDetailItem?.isFavorite) ? 'Obľúbené cvičenie' : 'Označiť ako obľúbené'}
                      >
                        <span className="material-icons-round" aria-hidden="true">
                          {normalizeExerciseFavorite(openedExerciseDetailItem?.isFavorite) ? 'favorite' : 'favorite_border'}
                        </span>
                        {normalizeExerciseFavorite(openedExerciseDetailItem?.isFavorite) ? 'Obľúbené' : 'Neobľúbené'}
                      </button>

                      <span className="exercise-detail-rating-inline" role="group" aria-label="Úroveň cvičenia">
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <button
                            key={`detail-rating-star-${starValue}`}
                            type="button"
                            className={`exercise-detail-star-btn ${starValue <= normalizeExerciseRating(openedExerciseDetailItem?.rating) ? 'active' : ''}`}
                            onClick={() => setExerciseRating(openedExerciseDetailItem.id, starValue)}
                            aria-label={`Nastaviť úroveň ${starValue} z 5`}
                            title={`${starValue} z 5`}
                          >
                            <span className="material-icons-round" aria-hidden="true">
                              {starValue <= normalizeExerciseRating(openedExerciseDetailItem?.rating) ? 'star' : 'star_border'}
                            </span>
                          </button>
                        ))}
                      </span>
                    </div>

                    <div className="exercise-detail-meta-row">
                      {openedExerciseCategorySummary ? (
                        <div className="exercise-detail-categories">
                          <strong>Kategórie:</strong>
                          <span>{openedExerciseCategorySummary}</span>
                        </div>
                      ) : null}
                    </div>
                    {!isEmbeddedWebSettingsView ? (
                      <div className="exercise-detail-meta-row" style={{ alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ margin: 0, width: '100%' }}>
                          <label htmlFor="exercise-custom-labels-input">Vlastné kategórie / delenie</label>
                          <input
                            id="exercise-custom-labels-input"
                            type="text"
                            value={customLabelDraft}
                            onChange={(event) => setCustomLabelDraft(event.target.value)}
                            placeholder="Napr. U14, prechod, technika"
                          />
                        </div>
                        {(currentRole === 'admin' || (!openedExerciseDetailItem?.isSystem && (currentRole === 'club' || currentRole === 'coach'))) ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isSavingCustomLabels}
                            onClick={() => saveExerciseCustomLabels(openedExerciseDetailItem.id)}
                          >
                            {isSavingCustomLabels ? 'Ukladám...' : 'Uložiť delenie'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {openedExerciseDetailItem.description ? (
                      <p>{openedExerciseDetailItem.description}</p>
                    ) : (
                      <p className="manager-empty-text" style={{ margin: 0 }}>Cvičenie zatiaľ nemá popis.</p>
                    )}

                    {canManageOpenedExercise ? (
                      <div className="exercise-detail-actions-row">
                        <button
                          type="button"
                          className="btn-edit exercise-detail-edit-btn"
                          onClick={startEditOpenedExercise}
                          disabled={isUpdatingExerciseDetail || isDeletingExerciseDetail}
                        >
                          Upraviť cvičenie
                        </button>
                        <button
                          type="button"
                          className="exercise-detail-delete-btn"
                          onClick={openDeleteExerciseConfirm}
                          disabled={isUpdatingExerciseDetail || isDeletingExerciseDetail}
                        >
                          {isDeletingExerciseDetail ? 'Odstraňujem...' : 'Odstrániť cvičenie'}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {isEditingExerciseDetail ? (
                  <div className="exercise-detail-edit-box">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="exercise-edit-title">Názov</label>
                      <input
                        id="exercise-edit-title"
                        type="text"
                        value={editExerciseDraft.title}
                        onChange={(event) => setEditExerciseDraft((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="exercise-edit-youtube">Link na video (YouTube)</label>
                      <input
                        id="exercise-edit-youtube"
                        type="url"
                        value={editExerciseDraft.youtubeUrl}
                        onChange={(event) => setEditExerciseDraft((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="exercise-edit-sport">Vyber športu</label>
                      <select
                        id="exercise-edit-sport"
                        value={editExerciseDraft.sportKey}
                        onChange={(event) => setEditExerciseDraft((prev) => ({ ...prev, sportKey: event.target.value }))}
                      >
                        <option value="">Bez športu</option>
                        {sportOptions.map((sport) => (
                          <option key={`exercise-edit-sport-${sport.key}`} value={sport.key}>
                            {sport.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="exercise-edit-description">Popis</label>
                      <textarea
                        id="exercise-edit-description"
                        rows={3}
                        value={editExerciseDraft.description}
                        onChange={(event) => setEditExerciseDraft((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </div>
                    <div className="exercise-detail-actions-row">
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={saveOpenedExerciseChanges}
                        disabled={isUpdatingExerciseDetail}
                      >
                        {isUpdatingExerciseDetail ? 'Ukladám...' : 'Uložiť zmeny'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={cancelEditOpenedExercise}
                        disabled={isUpdatingExerciseDetail}
                      >
                        Zrušiť
                      </button>
                    </div>
                  </div>
                ) : null}

                {detailActionError ? (
                  <p className="manager-empty-text" style={{ margin: 0 }}>{detailActionError}</p>
                ) : null}

                {detailActionSuccess ? (
                  <p className="success-message" style={{ margin: 0 }}>{detailActionSuccess}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {deleteConfirmDialog.open ? (
          <div
            className="confirm-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Potvrdenie odstránenia cvičenia"
            onClick={closeDeleteExerciseConfirm}
          >
            <div className="confirm-modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Odstrániť cvičenie</h3>
              <p>Naozaj chceš odstrániť cvičenie "{deleteConfirmDialog.name}"?</p>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeDeleteExerciseConfirm}
                  disabled={isDeletingExerciseDetail}
                >
                  Zrušiť
                </button>
                <button
                  type="button"
                  className="exercise-detail-delete-btn"
                  onClick={deleteOpenedExercise}
                  disabled={isDeletingExerciseDetail}
                >
                  {isDeletingExerciseDetail ? 'Odstraňujem...' : 'Odstrániť'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </>
      ) : null}
    </div>
  )
}

export default Exercises
