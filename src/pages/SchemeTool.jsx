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
  { key: 'third', label: 'Tretina ihriska' },
  { key: 'blank', label: 'Plocha (bez čiar)' }
]

const TOOL_OPTIONS = [
  { key: 'select', label: 'Výber' },
  { key: 'player', label: 'Hráč' },
  { key: 'ball', label: 'Lopta' },
  { key: 'cone', label: 'Kužeľ' },
  { key: 'ladder', label: 'Koordinačný rebrík' },
  { key: 'miniGoal', label: 'Bránka' },
  { key: 'hurdle', label: 'Prekážka' },
  { key: 'arrowPlayerStraight', label: 'Pohyb hráča bez lopty' },
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
const isArrowTool = (toolKey) => toolKey === 'arrowPlayerStraight' || toolKey === 'arrowPlayerBall' || toolKey === 'arrowBallDashed'
const isAreaToolType = (type) => type === 'areaRect' || type === 'areaSquare' || type === 'areaCircle' || type === 'areaDiamond'
const isPlayerStyle = (value) => value === 'circle' || value === 'stickman'

const MIN_AREA_SIZE = 26

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

const getSourceCropRect = (surfaceKey, width, height) => {
  if (surfaceKey === 'half') {
    return {
      x: width * 0.5,
      y: 0,
      width: width * 0.5,
      height
    }
  }

  if (surfaceKey === 'third') {
    return {
      x: width * (2 / 3),
      y: 0,
      width: width / 3,
      height
    }
  }

  return {
    x: 0,
    y: 0,
    width,
    height
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

const drawFullTemplate = (ctx, sportKey, width, height) => {
  if (sportKey === 'basketball') {
    drawBasketballField(ctx, width, height)
  } else if (sportKey === 'hockey') {
    drawHockeyField(ctx, width, height)
  } else {
    drawFootballField(ctx, width, height)
  }
}

const drawField = (ctx, sportKey, surfaceKey, width, height) => {
  ctx.clearRect(0, 0, width, height)
  drawBlankSurface(ctx, sportKey, width, height)

  if (surfaceKey === 'blank') {
    return
  }

  if (surfaceKey === 'full') {
    drawFullTemplate(ctx, sportKey, width, height)
    return
  }

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) return

  drawBlankSurface(sourceCtx, sportKey, width, height)
  drawFullTemplate(sourceCtx, sportKey, width, height)

  const crop = getSourceCropRect(surfaceKey, width, height)
  ctx.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height
  )
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

const drawWavyArrow = (ctx, fromX, fromY, toX, toY, color) => {
  const dx = toX - fromX
  const dy = toY - fromY
  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance < 8) return

  const steps = Math.max(24, Math.floor(distance / 6))
  const amplitude = 8
  const frequency = (Math.PI * 2) / 26
  const nx = -dy / distance
  const ny = dx / distance

  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.beginPath()

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const baseX = fromX + dx * t
    const baseY = fromY + dy * t
    const wave = Math.sin(t * distance * frequency) * amplitude
    const px = baseX + nx * wave
    const py = baseY + ny * wave

    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  }

  ctx.stroke()

  drawArrow(ctx, fromX + dx * 0.93, fromY + dy * 0.93, toX, toY, color, false)
}

const buildAreaFromDrag = (toolType, startPoint, endPoint) => {
  const width = Math.max(MIN_AREA_SIZE, Math.abs(endPoint.x - startPoint.x))
  const height = Math.max(MIN_AREA_SIZE, Math.abs(endPoint.y - startPoint.y))
  const centerX = (startPoint.x + endPoint.x) / 2
  const centerY = (startPoint.y + endPoint.y) / 2

  if (toolType === 'areaRect') {
    return {
      type: 'areaRect',
      x: centerX,
      y: centerY,
      width,
      height,
      color: 'rgba(255, 243, 196, 0.98)',
      fillColor: 'rgba(255, 243, 196, 0.2)'
    }
  }

  if (toolType === 'areaSquare') {
    const size = Math.max(width, height)
    return {
      type: 'areaSquare',
      x: centerX,
      y: centerY,
      width: size,
      color: 'rgba(255, 243, 196, 0.98)',
      fillColor: 'rgba(255, 243, 196, 0.2)'
    }
  }

  if (toolType === 'areaCircle') {
    const radius = Math.max(MIN_AREA_SIZE / 2, Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2) / 2)
    return {
      type: 'areaCircle',
      x: centerX,
      y: centerY,
      radius,
      color: 'rgba(255, 243, 196, 0.98)',
      fillColor: 'rgba(255, 243, 196, 0.2)'
    }
  }

  const size = Math.max(width, height) / 2
  return {
    type: 'areaDiamond',
    x: centerX,
    y: centerY,
    size,
    color: 'rgba(255, 243, 196, 0.98)',
    fillColor: 'rgba(255, 243, 196, 0.2)'
  }
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

const getAreaBounds = (item) => {
  if (item.type === 'areaRect') {
    const width = Number(item.width || 120)
    const height = Number(item.height || 80)
    return {
      left: item.x - width / 2,
      right: item.x + width / 2,
      top: item.y - height / 2,
      bottom: item.y + height / 2
    }
  }

  if (item.type === 'areaSquare') {
    const size = Number(item.width || 120)
    return {
      left: item.x - size / 2,
      right: item.x + size / 2,
      top: item.y - size / 2,
      bottom: item.y + size / 2
    }
  }

  if (item.type === 'areaCircle') {
    const radius = Number(item.radius || 62)
    return {
      left: item.x - radius,
      right: item.x + radius,
      top: item.y - radius,
      bottom: item.y + radius
    }
  }

  const size = Number(item.size || 86)
  return {
    left: item.x - size,
    right: item.x + size,
    top: item.y - size,
    bottom: item.y + size
  }
}

const getAreaResizeHandles = (item) => {
  const bounds = getAreaBounds(item)
  return [
    { key: 'nw', x: bounds.left, y: bounds.top },
    { key: 'ne', x: bounds.right, y: bounds.top },
    { key: 'sw', x: bounds.left, y: bounds.bottom },
    { key: 'se', x: bounds.right, y: bounds.bottom }
  ]
}

const drawAreaResizeHandles = (ctx, item) => {
  const handles = getAreaResizeHandles(item)
  ctx.save()
  handles.forEach((handle) => {
    ctx.beginPath()
    ctx.arc(handle.x, handle.y, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()
  })
  ctx.restore()
}

const hitAreaResizeHandle = (item, point) => {
  const handles = getAreaResizeHandles(item)
  const hit = handles.find((handle) => {
    const dx = point.x - handle.x
    const dy = point.y - handle.y
    return Math.sqrt(dx * dx + dy * dy) <= 12
  })
  return hit?.key || ''
}

const resizeAreaFromPoint = (item, point, handleKey = 'se') => {
  const isWest = String(handleKey || '').includes('w')
  const isNorth = String(handleKey || '').includes('n')
  const normalizedPoint = {
    x: item.x + (isWest ? -1 : 1) * Math.abs(point.x - item.x),
    y: item.y + (isNorth ? -1 : 1) * Math.abs(point.y - item.y)
  }

  const dx = Math.abs(normalizedPoint.x - item.x)
  const dy = Math.abs(normalizedPoint.y - item.y)

  if (item.type === 'areaRect') {
    return {
      ...item,
      width: Math.max(MIN_AREA_SIZE, dx * 2),
      height: Math.max(MIN_AREA_SIZE, dy * 2)
    }
  }

  if (item.type === 'areaSquare') {
    const size = Math.max(MIN_AREA_SIZE, Math.max(dx, dy) * 2)
    return {
      ...item,
      width: size
    }
  }

  if (item.type === 'areaCircle') {
    const radius = Math.max(MIN_AREA_SIZE / 2, Math.max(dx, dy))
    return {
      ...item,
      radius
    }
  }

  const size = Math.max(MIN_AREA_SIZE / 2, Math.max(dx, dy))
  return {
    ...item,
    size
  }
}

const drawLadder = (ctx, item, isSelected) => {
  const width = Number(item.width || 92)
  const height = Number(item.height || 42)
  const left = item.x - width / 2
  const top = item.y - height / 2

  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#f59e0b'

  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(left, top + height)
  ctx.moveTo(left + width, top)
  ctx.lineTo(left + width, top + height)
  ctx.stroke()

  const rungs = 4
  for (let i = 1; i <= rungs; i += 1) {
    const y = top + (height * i) / (rungs + 1)
    ctx.beginPath()
    ctx.moveTo(left + 5, y)
    ctx.lineTo(left + width - 5, y)
    ctx.stroke()
  }

  if (isSelected) {
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.strokeRect(left - 6, top - 6, width + 12, height + 12)
    ctx.setLineDash([])
  }
  ctx.restore()
}

const drawMiniGoal = (ctx, item, isSelected) => {
  const width = Number(item.width || 78)
  const height = Number(item.height || 40)
  const left = item.x - width / 2
  const top = item.y - height / 2

  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#f8fafc'
  ctx.strokeRect(left, top, width, height)

  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)'
  for (let i = 1; i < 5; i += 1) {
    const x = left + (width * i) / 5
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, top + height)
    ctx.stroke()
  }
  for (let i = 1; i < 3; i += 1) {
    const y = top + (height * i) / 3
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(left + width, y)
    ctx.stroke()
  }

  if (isSelected) {
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.strokeRect(left - 6, top - 6, width + 12, height + 12)
    ctx.setLineDash([])
  }
  ctx.restore()
}

const drawHurdle = (ctx, item, isSelected) => {
  const width = Number(item.width || 62)
  const height = Number(item.height || 30)
  const left = item.x - width / 2
  const top = item.y - height / 2

  ctx.save()
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(left, top + height)
  ctx.lineTo(left, top + 8)
  ctx.lineTo(left + width, top + 8)
  ctx.lineTo(left + width, top + height)
  ctx.stroke()

  if (isSelected) {
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.strokeRect(left - 6, top - 6, width + 12, height + 12)
    ctx.setLineDash([])
  }
  ctx.restore()
}

const drawPlayerCircle = (ctx, item, isSelected) => {
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
}

const drawPlayerStickman = (ctx, item, isSelected) => {
  const color = item.color || TEAM_COLORS.red

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.arc(item.x, item.y - 13, 7, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(item.x, item.y - 6)
  ctx.lineTo(item.x, item.y + 12)
  ctx.moveTo(item.x - 10, item.y + 1)
  ctx.lineTo(item.x + 10, item.y + 1)
  ctx.moveTo(item.x, item.y + 12)
  ctx.lineTo(item.x - 9, item.y + 24)
  ctx.moveTo(item.x, item.y + 12)
  ctx.lineTo(item.x + 9, item.y + 24)
  ctx.stroke()

  if (item.number) {
    ctx.font = '700 12px "Segoe UI", Arial, sans-serif'
    ctx.fillStyle = '#101828'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(item.number), item.x, item.y + 37)
    ctx.textAlign = 'start'
  }

  if (isSelected) {
    ctx.beginPath()
    ctx.arc(item.x, item.y + 4, 26, 0, Math.PI * 2)
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

const drawSceneObjects = (ctx, objects, selectedId, playerStyle) => {
  objects.forEach((item) => {
    const isSelected = String(selectedId || '') === String(item.id || '')

    if (item.type === 'arrowPlayerStraight') {
      drawArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#e8f2b7', false)
      return
    }

    if (item.type === 'arrowPlayerBall') {
      drawWavyArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#f6f0ad')

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
      drawAreaShape(ctx, item, isSelected)
      if (isSelected) {
        drawAreaResizeHandles(ctx, item)
      }
      return
    }

    if (item.type === 'text') {
      ctx.font = '700 26px "Segoe UI", Arial, sans-serif'
      ctx.fillStyle = item.color || '#1f2b3a'
      ctx.fillText(String(item.text || 'Text'), item.x, item.y)
      return
    }

    if (item.type === 'player') {
      const itemStyle = isPlayerStyle(item.playerStyle) ? item.playerStyle : playerStyle
      if (itemStyle === 'stickman') {
        drawPlayerStickman(ctx, item, isSelected)
      } else {
        drawPlayerCircle(ctx, item, isSelected)
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

      return
    }

    if (item.type === 'ladder') {
      drawLadder(ctx, item, isSelected)
      return
    }

    if (item.type === 'miniGoal') {
      drawMiniGoal(ctx, item, isSelected)
      return
    }

    if (item.type === 'hurdle') {
      drawHurdle(ctx, item, isSelected)
    }
  })
}

const hitTest = (objects, point) => {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const item = objects[i]

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

    if (item.type === 'arrowPlayerStraight' || item.type === 'arrowPlayerBall' || item.type === 'arrowBallDashed') {
      const minX = Math.min(item.fromX, item.toX) - 12
      const maxX = Math.max(item.fromX, item.toX) + 12
      const minY = Math.min(item.fromY, item.toY) - 12
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

    if (item.type === 'ladder' || item.type === 'miniGoal' || item.type === 'hurdle') {
      const width = Number(item.width || (item.type === 'ladder' ? 92 : item.type === 'miniGoal' ? 78 : 62))
      const height = Number(item.height || (item.type === 'ladder' ? 42 : item.type === 'miniGoal' ? 40 : 30))
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
  const [activePlayerStyle, setActivePlayerStyle] = useState('circle')
  const [sceneObjects, setSceneObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [dragState, setDragState] = useState(null)
  const [resizeState, setResizeState] = useState(null)
  const [arrowStart, setArrowStart] = useState(null)
  const [areaDraft, setAreaDraft] = useState(null)
  const [exportDataUrl, setExportDataUrl] = useState('')

  const activeSportLabel = useMemo(() => SPORTS[sportKey]?.label || 'Šport', [sportKey])

  useEffect(() => {
    const isTypingContext = (eventTarget) => {
      if (!eventTarget || !(eventTarget instanceof HTMLElement)) return false
      const tagName = String(eventTarget.tagName || '').toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'button') {
        return true
      }
      return Boolean(eventTarget.isContentEditable)
    }

    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || String(event.key || '').toLowerCase() !== 'd') return
      if (isTypingContext(event.target)) return
      if (!selectedObjectId) return

      const selectedItem = sceneObjects.find((item) => String(item?.id || '') === String(selectedObjectId))
      if (!selectedItem) return

      event.preventDefault()

      const offset = 20
      const duplicatedId = createId()
      const duplicatedItem = { ...selectedItem, id: duplicatedId }

      if (duplicatedItem.type === 'arrowPlayerStraight' || duplicatedItem.type === 'arrowPlayerBall' || duplicatedItem.type === 'arrowBallDashed') {
        duplicatedItem.fromX = Number(duplicatedItem.fromX || 0) + offset
        duplicatedItem.fromY = Number(duplicatedItem.fromY || 0) + offset
        duplicatedItem.toX = Number(duplicatedItem.toX || 0) + offset
        duplicatedItem.toY = Number(duplicatedItem.toY || 0) + offset
      } else {
        duplicatedItem.x = Number(duplicatedItem.x || 0) + offset
        duplicatedItem.y = Number(duplicatedItem.y || 0) + offset
      }

      setSceneObjects((prev) => [...prev, duplicatedItem])
      setSelectedObjectId(duplicatedId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sceneObjects, selectedObjectId])

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
    drawSceneObjects(ctx, sceneObjects, selectedObjectId, activePlayerStyle)

    if (areaDraft?.toolType && areaDraft?.startPoint && areaDraft?.endPoint) {
      drawAreaShape(ctx, buildAreaFromDrag(areaDraft.toolType, areaDraft.startPoint, areaDraft.endPoint), true)
    }

    if (arrowStart) {
      ctx.beginPath()
      ctx.arc(arrowStart.x, arrowStart.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = arrowStart.type === 'arrowBallDashed' ? 'rgba(203, 224, 255, 0.95)' : 'rgba(246, 240, 173, 0.95)'
      ctx.fill()
      ctx.strokeStyle = '#101828'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [sportKey, surfaceKey, sceneObjects, selectedObjectId, arrowStart, areaDraft, activePlayerStyle])

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
          color: arrowType === 'arrowBallDashed' ? '#cbe0ff' : (arrowType === 'arrowPlayerStraight' ? '#e8f2b7' : '#fff4a8')
        }
      ])
      setArrowStart(null)
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
      base.playerStyle = activePlayerStyle
    }

    if (tool === 'ladder') {
      base.width = 92
      base.height = 42
    }

    if (tool === 'miniGoal') {
      base.width = 78
      base.height = 40
    }

    if (tool === 'hurdle') {
      base.width = 62
      base.height = 30
    }

    setSceneObjects((prev) => [...prev, base])
  }

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const point = getCanvasPoint(canvas, event)
    const isAreaTool = activeTool === 'areaRect' || activeTool === 'areaSquare' || activeTool === 'areaCircle' || activeTool === 'areaDiamond'

    if (isAreaTool) {
      setAreaDraft({ toolType: activeTool, startPoint: point, endPoint: point })
      setSelectedObjectId('')
      setDragState(null)
      setResizeState(null)
      return
    }

    const hit = hitTest(sceneObjects, point)

    if (activeTool === 'select') {
      if (hit) {
        setSelectedObjectId(hit.id)

        const resizeHandleKey = isAreaToolType(hit.type) ? hitAreaResizeHandle(hit, point) : ''
        if (resizeHandleKey) {
          setResizeState({ id: hit.id, handleKey: resizeHandleKey })
          setDragState(null)
          return
        }

        if (hit.type !== 'text') {
          if (isArrowTool(hit.type)) {
            setDragState({
              id: hit.id,
              mode: 'arrow',
              startPoint: point,
              fromX: Number(hit.fromX || 0),
              fromY: Number(hit.fromY || 0),
              toX: Number(hit.toX || 0),
              toY: Number(hit.toY || 0)
            })
          } else {
            setDragState({
              id: hit.id,
              mode: 'object',
              offsetX: point.x - hit.x,
              offsetY: point.y - hit.y
            })
          }
          setResizeState(null)
        } else {
          setDragState(null)
          setResizeState(null)
        }
      } else {
        setSelectedObjectId('')
        setDragState(null)
        setResizeState(null)
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
    if (areaDraft?.toolType) {
      const canvas = canvasRef.current
      if (!canvas) return
      const point = getCanvasPoint(canvas, event)
      setAreaDraft((prev) => (prev ? { ...prev, endPoint: point } : prev))
      return
    }

    if (resizeState?.id) {
      const canvas = canvasRef.current
      if (!canvas) return
      const point = getCanvasPoint(canvas, event)
      setSceneObjects((prev) => prev.map((item) => {
        if (item.id !== resizeState.id) return item
        if (!isAreaToolType(item.type)) return item
        return resizeAreaFromPoint(item, point, resizeState.handleKey)
      }))
      return
    }

    if (!dragState) return

    const canvas = canvasRef.current
    if (!canvas) return

    const point = getCanvasPoint(canvas, event)

    if (dragState.mode === 'arrow') {
      const dx = point.x - dragState.startPoint.x
      const dy = point.y - dragState.startPoint.y
      setSceneObjects((prev) => prev.map((item) => {
        if (item.id !== dragState.id) return item
        if (!isArrowTool(item.type)) return item

        const nextFromX = clamp(dragState.fromX + dx, 10, canvas.width - 10)
        const nextFromY = clamp(dragState.fromY + dy, 10, canvas.height - 10)
        const nextToX = clamp(dragState.toX + dx, 10, canvas.width - 10)
        const nextToY = clamp(dragState.toY + dy, 10, canvas.height - 10)

        return {
          ...item,
          fromX: nextFromX,
          fromY: nextFromY,
          toX: nextToX,
          toY: nextToY
        }
      }))
      return
    }

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
    if (areaDraft?.toolType && areaDraft?.startPoint && areaDraft?.endPoint) {
      const areaObject = buildAreaFromDrag(areaDraft.toolType, areaDraft.startPoint, areaDraft.endPoint)
      setSceneObjects((prev) => [
        ...prev,
        {
          id: createId(),
          ...areaObject
        }
      ])
      setAreaDraft(null)
    }

    if (dragState) {
      setDragState(null)
    }

    if (resizeState) {
      setResizeState(null)
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
    setAreaDraft(null)
    setResizeState(null)
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
                  if (!(tool.key === 'areaRect' || tool.key === 'areaSquare' || tool.key === 'areaCircle' || tool.key === 'areaDiamond')) {
                    setAreaDraft(null)
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

              <label htmlFor="scheme-player-style" style={{ marginTop: 10 }}>Vzhľad hráča</label>
              <select id="scheme-player-style" value={activePlayerStyle} onChange={(event) => setActivePlayerStyle(String(event.target.value || 'circle'))}>
                <option value="circle">Krúžky</option>
                <option value="stickman">Panáčikovia</option>
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
                : (arrowStart.type === 'arrowPlayerStraight'
                    ? 'Šípka pohybu hráča bez lopty: klikni na cieľový bod.'
                    : 'Šípka pohybu hráča s loptou: klikni na cieľový bod.')}
            </p>
          ) : null}

          {areaDraft?.toolType ? (
            <p className="manager-empty-text" style={{ margin: 0 }}>
              Area: podrž a ťahaj myšou pre veľkosť, potom pusti.
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
