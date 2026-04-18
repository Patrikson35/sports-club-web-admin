import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import './SchemeTool.css'

const SPORTS = {
  football: { key: 'football', label: 'Futbal' },
  basketball: { key: 'basketball', label: 'Basketbal' },
  hockey: { key: 'hockey', label: 'Hokej' }
}

const TEAM_COLORS = {
  red: '#d3394a',
  blue: '#2f77d0',
  white: '#e8edf5',
  yellow: '#f5c24a'
}

const SURFACE_OPTIONS = [
  { key: 'full', label: 'Celé ihrisko' },
  { key: 'half', label: 'Polka ihriska' },
  { key: 'quarter', label: 'Štvrtka ihriska (šestnástka)' },
  { key: 'blank', label: 'Plocha (bez čiar)' }
]

const TOOL_OPTIONS = [
  { key: 'select', label: 'Výber' },
  { key: 'player', label: 'Hráč' },
  { key: 'ball', label: 'Lopta' },
  { key: 'cone', label: 'Kužeľ' },
  { key: 'arrowPlayerBall', label: 'Pohyb hráča s loptou' },
  { key: 'arrowBallDashed', label: 'Pohyb lopty (preruš.)' },
  { key: 'areaRect', label: 'Area: obdĺžnik' },
  { key: 'areaSquare', label: 'Area: štvorec' },
  { key: 'areaCircle', label: 'Area: kruh' },
  { key: 'areaDiamond', label: 'Area: diamant' },
  { key: 'text', label: 'Text' }
]

const DEFAULT_CANVAS = { width: 1100, height: 650 }

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const isArrowTool = (toolKey) => toolKey === 'arrowPlayerBall' || toolKey === 'arrowBallDashed'

const getCanvasPoint = (canvas, event) => {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

const drawFootballField = (ctx, width, height) => {
  ctx.fillStyle = '#8fb357'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(245,249,252,0.96)'
  ctx.lineWidth = 3
  ctx.strokeRect(24, 24, width - 48, height - 48)

  ctx.beginPath()
  ctx.moveTo(width / 2, 24)
  ctx.lineTo(width / 2, height - 24)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(width / 2, height / 2, 82, 0, Math.PI * 2)
  ctx.stroke()

  const boxW = 170
  const boxH = 250

  ctx.strokeRect(24, (height - boxH) / 2, boxW, boxH)
  ctx.strokeRect(width - 24 - boxW, (height - boxH) / 2, boxW, boxH)

  ctx.strokeRect(24, (height - 120) / 2, 70, 120)
  ctx.strokeRect(width - 24 - 70, (height - 120) / 2, 70, 120)
}

const drawBasketballField = (ctx, width, height) => {
  ctx.fillStyle = '#d9b073'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(45, 32, 17, 0.9)'
  ctx.lineWidth = 3
  ctx.strokeRect(20, 20, width - 40, height - 40)

  ctx.beginPath()
  ctx.moveTo(width / 2, 20)
  ctx.lineTo(width / 2, height - 20)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(width / 2, height / 2, 74, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeRect(20, (height - 200) / 2, 160, 200)
  ctx.strokeRect(width - 180, (height - 200) / 2, 160, 200)

  ctx.beginPath()
  ctx.arc(180, height / 2, 74, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(width - 180, height / 2, 74, Math.PI / 2, -Math.PI / 2)
  ctx.stroke()
}

const drawHockeyField = (ctx, width, height) => {
  ctx.fillStyle = '#dbe9f7'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(228, 241, 255, 0.95)'
  ctx.lineWidth = 3

  const radius = 42
  ctx.beginPath()
  ctx.moveTo(20 + radius, 20)
  ctx.arcTo(width - 20, 20, width - 20, height - 20, radius)
  ctx.arcTo(width - 20, height - 20, 20, height - 20, radius)
  ctx.arcTo(20, height - 20, 20, 20, radius)
  ctx.arcTo(20, 20, width - 20, 20, radius)
  ctx.closePath()
  ctx.stroke()

  ctx.strokeStyle = '#be3a3f'
  ctx.beginPath()
  ctx.moveTo(width / 2, 20)
  ctx.lineTo(width / 2, height - 20)
  ctx.stroke()

  ctx.strokeStyle = '#2f5ea8'
  ctx.beginPath()
  ctx.moveTo(width * 0.26, 20)
  ctx.lineTo(width * 0.26, height - 20)
  ctx.moveTo(width * 0.74, 20)
  ctx.lineTo(width * 0.74, height - 20)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(228, 241, 255, 0.95)'
  const goalW = 56
  const goalH = 150
  ctx.strokeRect(20, (height - goalH) / 2, goalW, goalH)
  ctx.strokeRect(width - 20 - goalW, (height - goalH) / 2, goalW, goalH)
}

const getSurfaceRect = (surfaceKey, width, height) => {
  const margin = 18
  if (surfaceKey === 'half') {
    return {
      x: width * 0.35,
      y: margin,
      width: width * 0.63 - margin,
      height: height - margin * 2
    }
  }

  if (surfaceKey === 'quarter') {
    return {
      x: width * 0.56,
      y: height * 0.18,
      width: width * 0.41,
      height: height * 0.64
    }
  }

  return {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2
  }
}

const drawBlankSurface = (ctx, sportKey, width, height) => {
  if (sportKey === 'basketball') {
    ctx.fillStyle = '#d9b073'
  } else if (sportKey === 'hockey') {
    ctx.fillStyle = '#dbe9f7'
  } else {
    ctx.fillStyle = '#8fb357'
  }
  ctx.fillRect(0, 0, width, height)
}

const drawField = (ctx, sportKey, surfaceKey, width, height) => {
  ctx.clearRect(0, 0, width, height)
  drawBlankSurface(ctx, sportKey, width, height)

  if (surfaceKey === 'blank') {
    return
  }

  const rect = getSurfaceRect(surfaceKey, width, height)

  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.width, rect.height)
  ctx.clip()
  ctx.translate(rect.x, rect.y)

  if (sportKey === 'basketball') {
    drawBasketballField(ctx, rect.width, rect.height)
  } else if (sportKey === 'hockey') {
    drawHockeyField(ctx, rect.width, rect.height)
  } else {
    drawFootballField(ctx, rect.width, rect.height)
  }

  ctx.restore()

  if (surfaceKey === 'half' || surfaceKey === 'quarter') {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    ctx.setLineDash([])
  }
}

const drawArrow = (ctx, fromX, fromY, toX, toY, color, dashed = false) => {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  const headLength = 16

  ctx.strokeStyle = color
  ctx.lineWidth = 4
  if (dashed) {
    ctx.setLineDash([12, 8])
  }
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

const drawAreaShape = (ctx, item, isSelected) => {
  ctx.save()
  ctx.strokeStyle = item.color || 'rgba(255, 243, 196, 0.95)'
  ctx.fillStyle = item.fillColor || 'rgba(255, 243, 196, 0.18)'
  ctx.lineWidth = 2

  if (item.type === 'areaRect' || item.type === 'areaSquare') {
    const width = Number(item.width || 120)
    const height = item.type === 'areaSquare' ? width : Number(item.height || 80)
    ctx.fillRect(item.x - width / 2, item.y - height / 2, width, height)
    ctx.strokeRect(item.x - width / 2, item.y - height / 2, width, height)
  } else if (item.type === 'areaCircle') {
    const radius = Number(item.radius || 62)
    ctx.beginPath()
    ctx.arc(item.x, item.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (item.type === 'areaDiamond') {
    const size = Number(item.size || 86)
    ctx.beginPath()
    ctx.moveTo(item.x, item.y - size)
    ctx.lineTo(item.x + size, item.y)
    ctx.lineTo(item.x, item.y + size)
    ctx.lineTo(item.x - size, item.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  if (isSelected) {
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    if (item.type === 'areaRect' || item.type === 'areaSquare') {
      const width = Number(item.width || 120)
      const height = item.type === 'areaSquare' ? width : Number(item.height || 80)
      ctx.strokeRect(item.x - width / 2 - 5, item.y - height / 2 - 5, width + 10, height + 10)
    } else if (item.type === 'areaCircle') {
      const radius = Number(item.radius || 62)
      ctx.beginPath()
      ctx.arc(item.x, item.y, radius + 6, 0, Math.PI * 2)
      ctx.stroke()
    } else if (item.type === 'areaDiamond') {
      const size = Number(item.size || 86)
      ctx.beginPath()
      ctx.moveTo(item.x, item.y - size - 6)
      ctx.lineTo(item.x + size + 6, item.y)
      ctx.lineTo(item.x, item.y + size + 6)
      ctx.lineTo(item.x - size - 6, item.y)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  ctx.restore()
}

const drawSceneObjects = (ctx, objects, selectedId) => {
  objects.forEach((item) => {
    if (item.type === 'arrowPlayerBall') {
      drawArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#f6f0ad', false)

      ctx.beginPath()
      ctx.arc(item.fromX, item.fromY, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.strokeStyle = '#101828'
      ctx.lineWidth = 1.5
      ctx.stroke()
      return
    }

    if (item.type === 'arrowBallDashed') {
      drawArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#cbe0ff', true)
      return
    }

    if (item.type === 'areaRect' || item.type === 'areaSquare' || item.type === 'areaCircle' || item.type === 'areaDiamond') {
      drawAreaShape(ctx, item, String(selectedId || '') === String(item.id || ''))
      return
    }

    if (item.type === 'text') {
      ctx.font = '700 26px "Segoe UI", Arial, sans-serif'
      ctx.fillStyle = item.color || '#1f2b3a'
      ctx.fillText(String(item.text || 'Text'), item.x, item.y)
      return
    }

    const isSelected = String(selectedId || '') === String(item.id || '')

    if (item.type === 'player') {
      ctx.beginPath()
      ctx.arc(item.x, item.y, 16, 0, Math.PI * 2)
      ctx.fillStyle = item.color || TEAM_COLORS.red
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      if (item.number) {
        ctx.font = '700 14px "Segoe UI", Arial, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(item.number), item.x, item.y)
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'
      }

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(item.x, item.y, 21, 0, Math.PI * 2)
        ctx.strokeStyle = '#101828'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      return
    }

    if (item.type === 'ball') {
      ctx.beginPath()
      ctx.arc(item.x, item.y, 9, 0, Math.PI * 2)
      ctx.fillStyle = '#f6f6f6'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#141b26'
      ctx.stroke()

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(item.x, item.y, 14, 0, Math.PI * 2)
        ctx.strokeStyle = '#101828'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      return
    }

    if (item.type === 'cone') {
      ctx.fillStyle = '#f5a623'
      ctx.beginPath()
      ctx.moveTo(item.x, item.y - 14)
      ctx.lineTo(item.x - 11, item.y + 12)
      ctx.lineTo(item.x + 11, item.y + 12)
      ctx.closePath()
      ctx.fill()

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(item.x, item.y, 16, 0, Math.PI * 2)
        ctx.strokeStyle = '#101828'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  })
}

const hitTest = (objects, point) => {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const item = objects[i]

    if (item.type === 'arrowPlayerBall' || item.type === 'arrowBallDashed') {
      const minX = Math.min(item.fromX, item.toX) - 12
      const maxX = Math.max(item.fromX, item.toX) + 12
      const minY = Math.min(item.fromY, item.toY) - 12
          if (item.type === 'areaRect' || item.type === 'areaSquare') {
            const width = Number(item.width || 120)
            const height = item.type === 'areaSquare' ? width : Number(item.height || 80)
            if (
              point.x >= item.x - width / 2
              && point.x <= item.x + width / 2
              && point.y >= item.y - height / 2
              && point.y <= item.y + height / 2
            ) {
              return item
            }
            continue
          }

          if (item.type === 'areaCircle') {
            const radius = Number(item.radius || 62)
            const dx = point.x - item.x
            const dy = point.y - item.y
            if (Math.sqrt(dx * dx + dy * dy) <= radius) {
              return item
            }
            continue
          }

          if (item.type === 'areaDiamond') {
            const size = Number(item.size || 86)
            const normalized = (Math.abs(point.x - item.x) / size) + (Math.abs(point.y - item.y) / size)
            if (normalized <= 1) {
              return item
            }
            continue
          }

      const maxY = Math.max(item.fromY, item.toY) + 12
      if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
        return item
      }
      continue
    }

    if (item.type === 'text') {
      const textW = String(item.text || '').length * 14
      if (point.x >= item.x - 8 && point.x <= item.x + textW && point.y >= item.y - 28 && point.y <= item.y + 8) {
        return item
      }
      continue
    }

    const radius = item.type === 'ball' ? 12 : 18
    const dx = point.x - item.x
    const dy = point.y - item.y
    if (Math.sqrt(dx * dx + dy * dy) <= radius) {
      return item
    }
  }

  return null
}

function SchemeTool() {
  const canvasRef = useRef(null)
  const exportLinkRef = useRef(null)
  const nextIdRef = useRef(1)

  const [sportKey, setSportKey] = useState('football')
  const [surfaceKey, setSurfaceKey] = useState('full')
  const [activeTool, setActiveTool] = useState('select')
  const [activeTeamColor, setActiveTeamColor] = useState('red')
  const [sceneObjects, setSceneObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [dragState, setDragState] = useState(null)
  const [arrowStart, setArrowStart] = useState(null)
  const [exportDataUrl, setExportDataUrl] = useState('')

  const activeSportLabel = useMemo(() => SPORTS[sportKey]?.label || 'Šport', [sportKey])

  useEffect(() => {
    let isMounted = true

    const readSportFromUser = () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const candidates = [user?.sportKey, user?.sport, user?.clubSportKey, user?.clubSport]
        const normalized = candidates
          .map((item) => String(item || '').trim().toLowerCase())
          .find((item) => item === 'football' || item === 'basketball' || item === 'hockey')
        return normalized || ''
      } catch {
        return ''
      }
    }

    const mapSport = (value) => {
      const normalized = String(value || '').trim().toLowerCase()
      if (normalized === 'futbal') return 'football'
      if (normalized === 'basketbal') return 'basketball'
      if (normalized === 'hokej') return 'hockey'
      if (normalized === 'football' || normalized === 'basketball' || normalized === 'hockey') return normalized
      return ''
    }

    const loadClubSport = async () => {
      const fromUser = mapSport(readSportFromUser())
      if (fromUser && isMounted) {
        setSportKey(fromUser)
      }

      try {
        const club = await api.getMyClub()
        if (!isMounted) return
        const fromClub = mapSport(club?.sportKey || club?.sport)
        if (fromClub) {
          setSportKey(fromClub)
        }
      } catch {
        // Keep fallback sport when club sport cannot be resolved.
      }
    }

    loadClubSport()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawField(ctx, sportKey, surfaceKey, canvas.width, canvas.height)
    drawSceneObjects(ctx, sceneObjects, selectedObjectId)

    if (arrowStart) {
      ctx.beginPath()
      ctx.arc(arrowStart.x, arrowStart.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = arrowStart.type === 'arrowBallDashed' ? 'rgba(203, 224, 255, 0.95)' : 'rgba(246, 240, 173, 0.95)'
      ctx.fill()
      ctx.strokeStyle = '#101828'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [sportKey, surfaceKey, sceneObjects, selectedObjectId, arrowStart])

  const createId = () => {
    const id = `scheme-item-${nextIdRef.current}`
    nextIdRef.current += 1
    return id
  }

  const addObject = (tool, point) => {
    if (tool === 'text') {
      const text = window.prompt('Text schémy:', 'A')
      const normalizedText = String(text || '').trim()
      if (!normalizedText) return

      setSceneObjects((prev) => [
        ...prev,
        {
          id: createId(),
          type: 'text',
          x: point.x,
          y: point.y,
          text: normalizedText,
          color: '#101828'
        }
      ])
      return
    }

    if (isArrowTool(tool)) {
      if (!arrowStart) {
        setArrowStart({ ...point, type: tool })
        return
      }

      const arrowType = String(arrowStart?.type || tool)
      setSceneObjects((prev) => [
        ...prev,
        {
          id: createId(),
          type: arrowType,
          fromX: arrowStart.x,
          fromY: arrowStart.y,
          toX: point.x,
          toY: point.y,
          color: arrowType === 'arrowBallDashed' ? '#cbe0ff' : '#fff4a8'
        }
      ])
      setArrowStart(null)
      return
    }

    if (tool === 'areaRect') {
      setSceneObjects((prev) => [
        ...prev,
        { id: createId(), type: 'areaRect', x: point.x, y: point.y, width: 170, height: 100, color: 'rgba(255, 243, 196, 0.98)', fillColor: 'rgba(255, 243, 196, 0.2)' }
      ])
      return
    }

    if (tool === 'areaSquare') {
      setSceneObjects((prev) => [
        ...prev,
        { id: createId(), type: 'areaSquare', x: point.x, y: point.y, width: 128, color: 'rgba(255, 243, 196, 0.98)', fillColor: 'rgba(255, 243, 196, 0.2)' }
      ])
      return
    }

    if (tool === 'areaCircle') {
      setSceneObjects((prev) => [
        ...prev,
        { id: createId(), type: 'areaCircle', x: point.x, y: point.y, radius: 68, color: 'rgba(255, 243, 196, 0.98)', fillColor: 'rgba(255, 243, 196, 0.2)' }
      ])
      return
    }

    if (tool === 'areaDiamond') {
      setSceneObjects((prev) => [
        ...prev,
        { id: createId(), type: 'areaDiamond', x: point.x, y: point.y, size: 82, color: 'rgba(255, 243, 196, 0.98)', fillColor: 'rgba(255, 243, 196, 0.2)' }
      ])
      return
    }

    const base = {
      id: createId(),
      type: tool,
      x: point.x,
      y: point.y
    }

    if (tool === 'player') {
      base.color = TEAM_COLORS[activeTeamColor] || TEAM_COLORS.red
      base.number = ''
    }

    setSceneObjects((prev) => [...prev, base])
  }

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const point = getCanvasPoint(canvas, event)
    const hit = hitTest(sceneObjects, point)

    if (activeTool === 'select') {
      if (hit) {
        setSelectedObjectId(hit.id)
        if (hit.type !== 'arrowPlayerBall' && hit.type !== 'arrowBallDashed' && hit.type !== 'text') {
          setDragState({
            id: hit.id,
            offsetX: point.x - hit.x,
            offsetY: point.y - hit.y
          })
        } else {
          setDragState(null)
        }
      } else {
        setSelectedObjectId('')
        setDragState(null)
      }
      return
    }

    if (hit && !isArrowTool(activeTool)) {
      setSelectedObjectId(hit.id)
      return
    }

    addObject(activeTool, point)
  }

  const handlePointerMove = (event) => {
    if (!dragState) return

    const canvas = canvasRef.current
    if (!canvas) return

    const point = getCanvasPoint(canvas, event)
    const nextX = clamp(point.x - dragState.offsetX, 24, canvas.width - 24)
    const nextY = clamp(point.y - dragState.offsetY, 24, canvas.height - 24)

    setSceneObjects((prev) => prev.map((item) => {
      if (item.id !== dragState.id) return item
      return {
        ...item,
        x: nextX,
        y: nextY
      }
    }))
  }

  const handlePointerUp = () => {
    if (dragState) {
      setDragState(null)
    }
  }

  const removeSelectedObject = () => {
    if (!selectedObjectId) return
    setSceneObjects((prev) => prev.filter((item) => item.id !== selectedObjectId))
    setSelectedObjectId('')
  }

  const clearScene = () => {
    setSceneObjects([])
    setSelectedObjectId('')
    setArrowStart(null)
  }

  const undoLastObject = () => {
    setSceneObjects((prev) => prev.slice(0, -1))
    setSelectedObjectId('')
  }

  const exportToPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    setExportDataUrl(dataUrl)

    if (exportLinkRef.current) {
      exportLinkRef.current.href = dataUrl
      exportLinkRef.current.download = `schema-${sportKey}-${surfaceKey}-${Date.now()}.png`
      exportLinkRef.current.click()
    }
  }

  return (
    <div className="unified-page scheme-page">
      <div className="unified-toolbar scheme-toolbar">
        <div>
          <h2 className="manager-section-title">Editor športových schém</h2>
          <p className="unified-muted">Šport klubu: {activeSportLabel}. Vyber plochu, nástroj, kresli a exportuj PNG.</p>
        </div>
      </div>

      <div className="scheme-layout">
        <aside className="card settings-placeholder-card scheme-controls">
          <div className="form-group">
            <label htmlFor="scheme-surface">Plocha</label>
            <select id="scheme-surface" value={surfaceKey} onChange={(event) => setSurfaceKey(String(event.target.value || 'full'))}>
              {SURFACE_OPTIONS.map((surface) => (
                <option key={surface.key} value={surface.key}>{surface.label}</option>
              ))}
            </select>
          </div>

          <div className="scheme-tools">
            {TOOL_OPTIONS.map((tool) => (
              <button
                key={tool.key}
                type="button"
                className={`btn-secondary scheme-tool-btn ${activeTool === tool.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool(tool.key)
                  if (!isArrowTool(tool.key)) {
                    setArrowStart(null)
                  } else if (arrowStart?.type && arrowStart.type !== tool.key) {
                    setArrowStart(null)
                  }
                }}
              >
                {tool.label}
              </button>
            ))}
          </div>

          {activeTool === 'player' ? (
            <div className="form-group">
              <label htmlFor="scheme-team-color">Farba tímu</label>
              <select id="scheme-team-color" value={activeTeamColor} onChange={(event) => setActiveTeamColor(String(event.target.value || 'red'))}>
                <option value="red">Červená</option>
                <option value="blue">Modrá</option>
                <option value="white">Biela</option>
                <option value="yellow">Žltá</option>
              </select>
            </div>
          ) : null}

          <div className="scheme-actions">
            <button type="button" className="btn-edit" onClick={exportToPng}>Export PNG</button>
            <button type="button" className="btn-secondary" onClick={undoLastObject} disabled={sceneObjects.length === 0}>Späť</button>
            <button type="button" className="btn-secondary" onClick={removeSelectedObject} disabled={!selectedObjectId}>Odstrániť vybrané</button>
            <button type="button" className="manager-add-btn category-form-toggle-cancel" onClick={clearScene} disabled={sceneObjects.length === 0 && !arrowStart}>Vymazať všetko</button>
          </div>

          {arrowStart ? (
            <p className="manager-empty-text" style={{ margin: 0 }}>
              {arrowStart.type === 'arrowBallDashed'
                ? 'Šípka pohybu lopty: klikni na cieľový bod.'
                : 'Šípka pohybu hráča s loptou: klikni na cieľový bod.'}
            </p>
          ) : null}

          {exportDataUrl ? (
            <div className="scheme-preview">
              <p className="unified-muted" style={{ marginTop: 0 }}>Posledný export</p>
              <img src={exportDataUrl} alt="Exportovaná schéma" />
            </div>
          ) : null}

          <a ref={exportLinkRef} className="scheme-hidden-link" aria-hidden="true">download</a>
        </aside>

        <section className="card settings-placeholder-card scheme-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="scheme-canvas"
            width={DEFAULT_CANVAS.width}
            height={DEFAULT_CANVAS.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </section>
      </div>
    </div>
  )
}

export default SchemeTool
