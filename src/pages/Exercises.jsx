import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const normalizeExerciseItems = (value) => {
  const parsed = Array.isArray(value) ? value : []

  return parsed
    .map((item) => {
      const youtube = item?.youtube && typeof item.youtube === 'object' ? item.youtube : {}
      return {
        id: String(item?.id || '').trim(),
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim(),
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

function Exercises() {
  const navigate = useNavigate()
  const [clubId, setClubId] = useState(null)
  const [exerciseCategories, setExerciseCategories] = useState([])
  const [exerciseDatabaseItems, setExerciseDatabaseItems] = useState([])
  const [exerciseItemsStorageKey, setExerciseItemsStorageKey] = useState('exerciseDatabaseItems:global')
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

    const loadClubId = async () => {
      let resolved = ''

      try {
        const data = await api.getMyClub()
        resolved = String(data?.id || data?.clubId || '').trim()
      } catch {
        try {
          const raw = localStorage.getItem('user')
          const parsed = raw ? JSON.parse(raw) : null
          resolved = String(parsed?.clubId || parsed?.club_id || parsed?.club?.id || '').trim()
        } catch {
          resolved = ''
        }
      }

      if (!isMounted) return
      setClubId(resolved || null)
    }

    loadClubId()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const readFromStorage = () => {
      const preferredKey = `exerciseCategories:${clubId || 'global'}`
      const fallbackKey = 'exerciseCategories:global'
      const sourceRaw = localStorage.getItem(preferredKey) || localStorage.getItem(fallbackKey)

      try {
        const parsed = sourceRaw ? JSON.parse(sourceRaw) : []
        const normalized = Array.isArray(parsed)
          ? parsed
              .map((item) => ({
                id: String(item?.id || '').trim(),
                name: String(item?.name || '').trim(),
                subcategories: Array.isArray(item?.subcategories)
                  ? item.subcategories.map((name) => String(name || '').trim()).filter(Boolean)
                  : []
              }))
              .filter((item) => item.id && item.name)
          : []

        setExerciseCategories(normalized)
      } catch {
        setExerciseCategories([])
      }
    }

    readFromStorage()
    window.addEventListener('storage', readFromStorage)
    return () => window.removeEventListener('storage', readFromStorage)
  }, [clubId])

  useEffect(() => {
    const readFromStorage = () => {
      const preferredKey = `exerciseDatabaseItems:${clubId || 'global'}`
      const fallbackKey = 'exerciseDatabaseItems:global'
      const hasPreferred = localStorage.getItem(preferredKey) !== null
      const hasFallback = localStorage.getItem(fallbackKey) !== null
      const sourceKey = hasPreferred ? preferredKey : (hasFallback ? fallbackKey : preferredKey)
      const preferredRaw = localStorage.getItem(preferredKey)
      const fallbackRaw = localStorage.getItem(fallbackKey)

      try {
        const preferredParsed = preferredRaw ? JSON.parse(preferredRaw) : []
        const fallbackParsed = fallbackRaw ? JSON.parse(fallbackRaw) : []
        const preferredItems = normalizeExerciseItems(preferredParsed)
        const fallbackItems = normalizeExerciseItems(fallbackParsed)

        let normalized = sourceKey === fallbackKey ? fallbackItems : preferredItems

        if (preferredItems.length > 0 && fallbackItems.length > 0 && preferredKey !== fallbackKey) {
          const mergedById = new Map()

          fallbackItems.forEach((item) => {
            mergedById.set(item.id, item)
          })

          preferredItems.forEach((item) => {
            const existing = mergedById.get(item.id)
            if (!existing) {
              mergedById.set(item.id, item)
              return
            }

            const existingUpdatedAt = Date.parse(String(existing?.updatedAt || existing?.createdAt || '')) || 0
            const itemUpdatedAt = Date.parse(String(item?.updatedAt || item?.createdAt || '')) || 0

            if (itemUpdatedAt >= existingUpdatedAt) {
              mergedById.set(item.id, item)
            }
          })

          normalized = Array.from(mergedById.values())
        }

        setExerciseItemsStorageKey(sourceKey)
        setExerciseDatabaseItems(normalized)
      } catch {
        setExerciseItemsStorageKey(sourceKey)
        setExerciseDatabaseItems([])
      }
    }

    readFromStorage()
    window.addEventListener('storage', readFromStorage)
    return () => window.removeEventListener('storage', readFromStorage)
  }, [clubId])

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
    const selectedIntensity = String(exerciseListFilters?.intensity || 'all')
    const selectedPlayersCount = String(exerciseListFilters?.playersCount || 'all')
    const selectedCategoryId = String(exerciseListFilters?.categoryId || 'all')
    const selectedSubcategory = String(exerciseListFilters?.subcategory || 'all')
    const selectedLevel = String(exerciseListFilters?.level || 'all')
    const selectedFavorite = String(exerciseListFilters?.favorite || 'all')

    return exerciseDatabaseItems.filter((item) => {
      if (selectedIntensity !== 'all' && String(item?.intensity || '') !== selectedIntensity) return false

      if (selectedPlayersCount !== 'all') {
        const selectedValues = normalizeExercisePlayersCount(item?.playersCount)
        if (!selectedValues.includes(selectedPlayersCount)) return false
      }

      if (selectedLevel !== 'all') {
        const itemLevel = normalizeExerciseRating(item?.rating)
        if (String(itemLevel) !== selectedLevel) return false
      }

      if (selectedFavorite === 'favorite' && !normalizeExerciseFavorite(item?.isFavorite)) {
        return false
      }

      if (selectedFavorite === 'not-favorite' && normalizeExerciseFavorite(item?.isFavorite)) {
        return false
      }

      if (selectedCategoryId !== 'all') {
        const selectedItemCategoryIds = resolveSelectedExerciseCategoryIds(item?.selectedCategoryIds, item?.categorySelections)
        if (!selectedItemCategoryIds.includes(selectedCategoryId)) return false

        if (selectedSubcategory !== 'all') {
          const selectedSubcategories = Array.isArray(item?.categorySelections?.[selectedCategoryId])
            ? item.categorySelections[selectedCategoryId]
            : []
          if (!selectedSubcategories.includes(selectedSubcategory)) return false
        }
      }

      return true
    })
  }, [exerciseDatabaseItems, exerciseListFilters])

  const getExercisePreviewImage = (item) => {
    const uploadedImage = String(item?.imageUrl || '').trim()
    if (uploadedImage) return uploadedImage

    const youtubeVideoId = String(item?.youtube?.videoId || '').trim()
    return getYoutubeThumbnailUrl(youtubeVideoId)
  }

  const getExerciseCategorySummary = (item) => {
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
    setOpenedExerciseDetailItem(null)
  }

  const persistExerciseItemsToStorage = (nextItems) => {
    const preferredKey = `exerciseDatabaseItems:${clubId || 'global'}`
    const fallbackKey = 'exerciseDatabaseItems:global'
    const targetKeys = Array.from(new Set([exerciseItemsStorageKey, preferredKey, fallbackKey]))

    targetKeys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify(nextItems))
    })
  }

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

      try {
        persistExerciseItemsToStorage(nextItems)
      } catch {
        // Ignore write failures and keep in-memory state.
      }

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

      try {
        persistExerciseItemsToStorage(nextItems)
      } catch {
        // Ignore write failures and keep in-memory state.
      }

      return nextItems
    })
  }

  const openCreateExerciseInMyClub = () => {
    navigate('/my-club?tab=exerciseDatabase&section=createExercise')
  }

  const openedExerciseCategorySummary = openedExerciseDetailItem
    ? getExerciseCategorySummary(openedExerciseDetailItem)
    : ''

  return (
    <div className="members-categories-stack">
      <div className="exercise-library-head">
        <h2>Knižnica cvičení</h2>
        <button type="button" className="manager-add-btn" onClick={openCreateExerciseInMyClub}>
          Vytvoriť cvičenie
        </button>
      </div>

      <div className="card settings-placeholder-card metrics-section-card exercise-db-filters-card">
        <div className="exercise-db-filters exercise-library-filters" role="region" aria-label="Filtre zoznamu cvičení">
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="exercise-list-filter-level">Úroveň</label>
            <select
              id="exercise-list-filter-level"
              value={exerciseListFilters.level}
              onChange={(event) => setExerciseListFilters((prev) => ({ ...prev, level: event.target.value }))}
            >
              <option value="all">Všetky</option>
              <option value="1">1 hviezda</option>
              <option value="2">2 hviezdy</option>
              <option value="3">3 hviezdy</option>
              <option value="4">4 hviezdy</option>
              <option value="5">5 hviezd</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="exercise-list-filter-favorite">Obľúbenosť</label>
            <select
              id="exercise-list-filter-favorite"
              value={exerciseListFilters.favorite}
              onChange={(event) => setExerciseListFilters((prev) => ({ ...prev, favorite: event.target.value }))}
            >
              <option value="all">Všetky</option>
              <option value="favorite">Obľúbené</option>
              <option value="not-favorite">Neobľúbené</option>
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
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setOpenedExerciseDetailItem(item)
                    setIsExerciseDetailVideoPlaying(false)
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
                {getExerciseCategorySummary(item) ? (
                  <div className="exercise-db-card-category-note">{getExerciseCategorySummary(item)}</div>
                ) : null}
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
                <div className="exercise-detail-top-row">
                  <p><strong>Intenzita:</strong> {openedExerciseDetailItem.intensity}</p>

                  <div className="exercise-detail-status-row" aria-label="Stav cvičenia">
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
                  </div>
                </div>

                <div className="exercise-detail-meta-row">
                  {openedExerciseCategorySummary ? (
                    <div className="exercise-detail-categories">
                      <strong>Kategórie:</strong>
                      <span>{openedExerciseCategorySummary}</span>
                    </div>
                  ) : null}

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
                {openedExerciseDetailItem.description ? (
                  <p>{openedExerciseDetailItem.description}</p>
                ) : (
                  <p className="manager-empty-text" style={{ margin: 0 }}>Cvičenie zatiaľ nemá popis.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Exercises
