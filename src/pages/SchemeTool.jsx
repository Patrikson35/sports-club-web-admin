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
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'twoRectangles', label: 'Two Rectangles' },
  { key: 'threeRectangles', label: 'Three Rectangles' },
  { key: 'fullPitch', label: 'Full Pitch' },
  { key: 'blankCanvas', label: 'Blank Canvas' },
  { key: 'halfPitch', label: 'Half Pitch' },
  { key: 'penaltyBox', label: 'Penalty Box' }
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
  { key: 'arrowShotDouble', label: 'Strela (dvojitá šípka)' },
  { key: 'areaRect', label: 'Area: obdĺžnik' },
  { key: 'areaSquare', label: 'Area: štvorec' },
  { key: 'areaCircle', label: 'Area: kruh' },
  { key: 'areaDiamond', label: 'Area: diamant' },
  { key: 'text', label: 'Text' }
]

const TOOL_SHORT = {
  select: 'SEL',
  player: 'HR',
  ball: 'LP',
  cone: 'KZ',
  ladder: 'RB',
  miniGoal: 'BR',
  hurdle: 'PR',
  arrowPlayerStraight: 'PB',
  arrowPlayerBall: 'PL',
  arrowBallDashed: 'LP',
  arrowShotDouble: 'ST',
  areaRect: 'OR',
  areaSquare: 'ST',
  areaCircle: 'KR',
  areaDiamond: 'DM',
  text: 'TX'
}

const TOOL_ICON = {
  select: 'gesture_select',
  player: 'person',
  ball: 'sports_soccer',
  cone: 'change_history',
  ladder: 'grid_4x4',
  miniGoal: 'crop_16_9',
  hurdle: 'horizontal_rule',
  arrowPlayerStraight: 'arrow_right_alt',
  arrowPlayerBall: 'rebase_edit',
  arrowBallDashed: 'trending_flat',
  arrowShotDouble: 'keyboard_double_arrow_right',
  areaRect: 'rectangle',
  areaSquare: 'crop_square',
  areaCircle: 'circle',
  areaDiamond: 'diamond',
  text: 'title'
}

const PLAYER_PRESET_CONFIG = {
  redCircle: { label: 'Červený kruh', color: '#d3394a', shape: 'circle' },
  blueTriangle: { label: 'Modrý trojuholník', color: '#2f77d0', shape: 'triangle' },
  blueSquare: { label: 'Modrý štvorec', color: '#2f77d0', shape: 'square' },
  blackHexagon: { label: 'Čierny šesťuholník', color: '#111827', shape: 'hexagon' }
}

const MINI_BAR_SECTIONS = [
  {
    title: 'Hráči',
    items: [
      { kind: 'playerPreset', key: 'redCircle' },
      { kind: 'playerPreset', key: 'blueTriangle' },
      { kind: 'playerPreset', key: 'blueSquare' },
      { kind: 'playerPreset', key: 'blackHexagon' }
    ]
  },
  {
    title: 'Pohyby',
    items: [
      { kind: 'tool', key: 'arrowBallDashed' },
      { kind: 'tool', key: 'arrowPlayerBall' },
      { kind: 'tool', key: 'arrowPlayerStraight' },
      { kind: 'tool', key: 'arrowShotDouble' }
    ]
  },
  {
    title: 'Pomôcky',
    items: [
      { kind: 'tool', key: 'ball' },
      { kind: 'tool', key: 'cone' },
      { kind: 'tool', key: 'ladder' },
      { kind: 'tool', key: 'hurdle' }
    ]
  },
  {
    title: 'Area',
    items: [
      { kind: 'tool', key: 'areaRect' },
      { kind: 'tool', key: 'areaSquare' },
      { kind: 'tool', key: 'areaCircle' },
      { kind: 'tool', key: 'areaDiamond' }
    ]
  }
]

const DEFAULT_CANVAS = { width: 1100, height: 650 }
const HURDLE_DRAG_SPACING = 44

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const isArrowTool = (toolKey) => toolKey === 'arrowPlayerStraight' || toolKey === 'arrowPlayerBall' || toolKey === 'arrowBallDashed' || toolKey === 'arrowShotDouble'
const isAreaToolType = (type) => type === 'areaRect' || type === 'areaSquare' || type === 'areaCircle' || type === 'areaDiamond'
const isPlayerStyle = (value) => value === 'circle' || value === 'stickman'
const isRotatableAidType = (type) => type === 'ladder' || type === 'miniGoal' || type === 'hurdle'
const getArrowColor = (arrowType) => {
  if (arrowType === 'arrowBallDashed') return '#cbe0ff'
  if (arrowType === 'arrowPlayerStraight') return '#e8f2b7'
  if (arrowType === 'arrowShotDouble') return '#ffd1a0'
  return '#fff4a8'
}
const getRotationFromVector = (dx, dy) => ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360

const createHurdleItem = (id, x, y, rotation = 0) => ({
  id,
  type: 'hurdle',
  x,
  y,
  width: 62,
  height: 30,
  rotation
})

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

const getSurfaceCropConfig = (surfaceKey, width, height) => {
  if (surfaceKey === 'halfPitch') {
    return {
      x: width * 0.5,
      y: 0,
      width: width * 0.5,
      height,
      rotateVertical: true
    }
  }

  if (surfaceKey === 'squarePitch') {
    const side = Math.min(width, height)
    return {
      x: (width - side) / 2,
      y: (height - side) / 2,
      width: side,
      height: side,
      rotateVertical: false
    }
  }

  if (surfaceKey === 'penaltyBox') {
    return {
      x: width * 0.7,
      y: 0,
      width: width * 0.3,
      height,
      rotateVertical: true
    }
  }

  return {
    x: 0,
    y: 0,
    width,
    height,
    rotateVertical: false
  }
}

const drawRectanglesTemplate = (ctx, count, width, height) => {
  const outerPad = 24
  const gap = 12
  const drawHeight = height - outerPad * 2
  const drawWidth = width - outerPad * 2
  const rectWidth = (drawWidth - gap * (count - 1)) / count

  ctx.strokeStyle = 'rgba(245,249,252,0.96)'
  ctx.lineWidth = 3

  for (let i = 0; i < count; i += 1) {
    const x = outerPad + i * (rectWidth + gap)
    ctx.strokeRect(x, outerPad, rectWidth, drawHeight)
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

  if (surfaceKey === 'blankCanvas') {
    return
  }

  if (surfaceKey === 'rectangle') {
    drawRectanglesTemplate(ctx, 1, width, height)
    return
  }

  if (surfaceKey === 'twoRectangles') {
    drawRectanglesTemplate(ctx, 2, width, height)
    return
  }

  if (surfaceKey === 'threeRectangles') {
    drawRectanglesTemplate(ctx, 3, width, height)
    return
  }

  if (surfaceKey === 'fullPitch') {
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

  const crop = getSurfaceCropConfig(surfaceKey, width, height)

  if (crop.rotateVertical) {
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(
      sourceCanvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -height / 2,
      -width / 2,
      height,
      width
    )
    ctx.restore()
    return
  }

  ctx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
}

const getQuadraticPoint = (fromX, fromY, controlX, controlY, toX, toY, t) => {
  const inv = 1 - t
  return {
    x: inv * inv * fromX + 2 * inv * t * controlX + t * t * toX,
    y: inv * inv * fromY + 2 * inv * t * controlY + t * t * toY
  }
}

const drawArrow = (ctx, fromX, fromY, toX, toY, color, dashed = false, controlPoint = null) => {
  const angle = controlPoint
    ? Math.atan2(toY - controlPoint.y, toX - controlPoint.x)
    : Math.atan2(toY - fromY, toX - fromX)
  const headLength = 16

  ctx.strokeStyle = color
  ctx.lineWidth = 4
  if (dashed) {
    ctx.setLineDash([12, 8])
  }
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  if (controlPoint) {
    ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, toX, toY)
  } else {
    ctx.lineTo(toX, toY)
  }
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

const drawWavyArrow = (ctx, fromX, fromY, toX, toY, color, controlPoint = null) => {
  const dx = toX - fromX
  const dy = toY - fromY
  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance < 8) return

  const steps = Math.max(24, Math.floor(distance / 6))
  const amplitude = 8
  const frequency = (Math.PI * 2) / 26

  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.beginPath()

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    let baseX = fromX + dx * t
    let baseY = fromY + dy * t
    let tanX = dx
    let tanY = dy

    if (controlPoint) {
      const p = getQuadraticPoint(fromX, fromY, controlPoint.x, controlPoint.y, toX, toY, t)
      baseX = p.x
      baseY = p.y
      tanX = 2 * (1 - t) * (controlPoint.x - fromX) + 2 * t * (toX - controlPoint.x)
      tanY = 2 * (1 - t) * (controlPoint.y - fromY) + 2 * t * (toY - controlPoint.y)
    }

    const tanLength = Math.hypot(tanX, tanY) || 1
    const nx = -tanY / tanLength
    const ny = tanX / tanLength
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

  if (controlPoint) {
    const nearEnd = getQuadraticPoint(fromX, fromY, controlPoint.x, controlPoint.y, toX, toY, 0.93)
    drawArrow(ctx, nearEnd.x, nearEnd.y, toX, toY, color, false)
  } else {
    drawArrow(ctx, fromX + dx * 0.93, fromY + dy * 0.93, toX, toY, color, false)
  }
}

const drawDoubleArrow = (ctx, fromX, fromY, toX, toY, color, controlPoint = null) => {
  const offset = 5
  let tangentX = toX - fromX
  let tangentY = toY - fromY

  if (controlPoint) {
    const t = 0.5
    tangentX = 2 * (1 - t) * (controlPoint.x - fromX) + 2 * t * (toX - controlPoint.x)
    tangentY = 2 * (1 - t) * (controlPoint.y - fromY) + 2 * t * (toY - controlPoint.y)
  }

  const tangentLength = Math.hypot(tangentX, tangentY) || 1
  const nx = -tangentY / tangentLength
  const ny = tangentX / tangentLength

  const upper = {
    fromX: fromX + nx * offset,
    fromY: fromY + ny * offset,
    toX: toX + nx * offset,
    toY: toY + ny * offset,
    controlPoint: controlPoint
      ? {
          x: controlPoint.x + nx * offset,
          y: controlPoint.y + ny * offset
        }
      : null
  }

  const lower = {
    fromX: fromX - nx * offset,
    fromY: fromY - ny * offset,
    toX: toX - nx * offset,
    toY: toY - ny * offset,
    controlPoint: controlPoint
      ? {
          x: controlPoint.x - nx * offset,
          y: controlPoint.y - ny * offset
        }
      : null
  }

  drawArrow(ctx, upper.fromX, upper.fromY, upper.toX, upper.toY, color, false, upper.controlPoint)
  drawArrow(ctx, lower.fromX, lower.fromY, lower.toX, lower.toY, color, false, lower.controlPoint)
}

const drawSoccerBall = (ctx, x, y, isSelected) => {
  ctx.save()

  const shell = ctx.createRadialGradient(x - 3, y - 4, 2, x, y, 10)
  shell.addColorStop(0, '#ffffff')
  shell.addColorStop(1, '#e7edf3')

  ctx.beginPath()
  ctx.arc(x, y, 9, 0, Math.PI * 2)
  ctx.fillStyle = shell
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#111827'
  ctx.stroke()

  const patches = [
    { x: 0, y: -3.2, r: 1.6 },
    { x: 3.1, y: -0.2, r: 1.35 },
    { x: 1.8, y: 3.1, r: 1.35 },
    { x: -1.8, y: 3.1, r: 1.35 },
    { x: -3.1, y: -0.2, r: 1.35 }
  ]
  ctx.fillStyle = '#111827'
  patches.forEach((patch) => {
    ctx.beginPath()
    ctx.arc(x + patch.x, y + patch.y, patch.r, 0, Math.PI * 2)
    ctx.fill()
  })

  if (isSelected) {
    ctx.beginPath()
    ctx.arc(x, y, 14, 0, Math.PI * 2)
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

const drawTrainingCone = (ctx, x, y, isSelected) => {
  ctx.save()

  const shadow = ctx.createRadialGradient(x, y + 12, 2, x, y + 12, 18)
  shadow.addColorStop(0, 'rgba(17,24,39,0.26)')
  shadow.addColorStop(1, 'rgba(17,24,39,0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.ellipse(x, y + 12, 15, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  const body = ctx.createLinearGradient(x, y - 14, x, y + 13)
  body.addColorStop(0, '#ffbf5a')
  body.addColorStop(1, '#e78323')

  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(x, y - 15)
  ctx.lineTo(x - 10, y + 11)
  ctx.lineTo(x + 10, y + 11)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#fff6de'
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 1)
  ctx.lineTo(x + 6, y - 1)
  ctx.lineTo(x + 4.5, y + 3.7)
  ctx.lineTo(x - 4.5, y + 3.7)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#b96516'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(x, y - 15)
  ctx.lineTo(x - 10, y + 11)
  ctx.lineTo(x + 10, y + 11)
  ctx.closePath()
  ctx.stroke()

  if (isSelected) {
    ctx.beginPath()
    ctx.arc(x, y, 16, 0, Math.PI * 2)
    ctx.strokeStyle = '#101828'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

const getCurveControlFromTrail = (fromX, fromY, toX, toY, trail = []) => {
  if (!Array.isArray(trail) || trail.length < 3) return null

  const dx = toX - fromX
  const dy = toY - fromY
  const baseLength = Math.hypot(dx, dy)
  if (baseLength < 18) return null

  let bestPoint = null
  let bestDistance = 0

  trail.forEach((point) => {
    const px = Number(point?.x)
    const py = Number(point?.y)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return

    const distance = Math.abs(((dy * px) - (dx * py) + (toX * fromY) - (toY * fromX)) / baseLength)
    if (distance > bestDistance) {
      bestDistance = distance
      bestPoint = { x: px, y: py }
    }
  })

  if (!bestPoint || bestDistance < 16) return null

  return bestPoint
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

const toLocalPoint = (point, itemX, itemY, rotationDeg = 0) => {
  const angle = (Number(rotationDeg || 0) * Math.PI) / 180
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const dx = point.x - itemX
  const dy = point.y - itemY
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  }
}

const isPointInRotatedRect = (point, item, padding = 0) => {
  const width = Number(item.width || 0)
  const height = Number(item.height || 0)
  const local = toLocalPoint(point, item.x, item.y, item.rotation)
  return (
    local.x >= -(width / 2 + padding)
    && local.x <= (width / 2 + padding)
    && local.y >= -(height / 2 + padding)
    && local.y <= (height / 2 + padding)
  )
}

const getRotationHandlePoint = (item) => {
  const width = Number(item.width || 60)
  const height = Number(item.height || 30)
  const angle = (Number(item.rotation || 0) * Math.PI) / 180
  const localX = 0
  const localY = -(height / 2 + Math.max(22, Math.min(40, width * 0.22)))
  return {
    x: item.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: item.y + localX * Math.sin(angle) + localY * Math.cos(angle)
  }
}

const hitRotationHandle = (item, point) => {
  const handle = getRotationHandlePoint(item)
  const dx = point.x - handle.x
  const dy = point.y - handle.y
  return Math.sqrt(dx * dx + dy * dy) <= 13
}

const drawRotationHandle = (ctx, item) => {
  const angle = (Number(item.rotation || 0) * Math.PI) / 180
  const height = Number(item.height || 30)
  const anchorLocalY = -height / 2
  const anchor = {
    x: item.x - anchorLocalY * Math.sin(angle),
    y: item.y + anchorLocalY * Math.cos(angle)
  }
  const handle = getRotationHandlePoint(item)

  ctx.save()
  ctx.strokeStyle = '#1d4ed8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(anchor.x, anchor.y)
  ctx.lineTo(handle.x, handle.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(handle.x, handle.y, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#60a5fa'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#0f172a'
  ctx.stroke()
  ctx.restore()
}

const drawLadder = (ctx, item, isSelected) => {
  const cellCount = Math.max(2, Number(item.cells || 4))
  const width = Number(item.width || 128)
  const height = Number(item.height || 32)
  const left = -width / 2
  const top = -height / 2
  const cellSize = Math.min(height, width / cellCount)
  const totalCellsWidth = cellSize * cellCount
  const startX = -totalCellsWidth / 2
  const rotation = (Number(item.rotation || 0) * Math.PI) / 180

  ctx.save()
  ctx.translate(item.x, item.y)
  ctx.rotate(rotation)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#f59e0b'

  for (let i = 0; i < cellCount; i += 1) {
    const x = startX + i * cellSize
    ctx.strokeRect(x, -cellSize / 2, cellSize, cellSize)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)'
    ctx.fillRect(x, -cellSize / 2, cellSize, cellSize)
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
  const left = -width / 2
  const top = -height / 2
  const rotation = (Number(item.rotation || 0) * Math.PI) / 180

  ctx.save()
  ctx.translate(item.x, item.y)
  ctx.rotate(rotation)
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
  const left = -width / 2
  const top = -height / 2
  const rotation = (Number(item.rotation || 0) * Math.PI) / 180

  ctx.save()
  ctx.translate(item.x, item.y)
  ctx.rotate(rotation)
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

const rotateAidItem = (item, stepDeg) => {
  if (!isRotatableAidType(item.type)) return item
  const current = Number(item.rotation || 0)
  const next = ((current + stepDeg) % 360 + 360) % 360
  return {
    ...item,
    rotation: next
  }
}

const drawPlayerCircle = (ctx, item, isSelected) => {
  const color = item.color || TEAM_COLORS.red
  const shape = String(item.playerShape || 'circle')

  ctx.beginPath()
  if (shape === 'triangle') {
    ctx.moveTo(item.x, item.y - 17)
    ctx.lineTo(item.x - 15, item.y + 13)
    ctx.lineTo(item.x + 15, item.y + 13)
    ctx.closePath()
  } else if (shape === 'square') {
    ctx.rect(item.x - 15, item.y - 15, 30, 30)
  } else if (shape === 'hexagon') {
    const radius = 16
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const px = item.x + radius * Math.cos(angle)
      const py = item.y + radius * Math.sin(angle)
      if (i === 0) {
        ctx.moveTo(px, py)
      } else {
        ctx.lineTo(px, py)
      }
    }
    ctx.closePath()
  } else {
    ctx.arc(item.x, item.y, 16, 0, Math.PI * 2)
  }

  ctx.fillStyle = color
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
    const controlPoint = Number.isFinite(Number(item.controlX)) && Number.isFinite(Number(item.controlY))
      ? { x: Number(item.controlX), y: Number(item.controlY) }
      : null

    if (item.type === 'arrowPlayerStraight') {
      drawArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#e8f2b7', false, controlPoint)
      return
    }

    if (item.type === 'arrowPlayerBall') {
      drawWavyArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#f6f0ad', controlPoint)

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
      drawArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#cbe0ff', true, controlPoint)
      return
    }

    if (item.type === 'arrowShotDouble') {
      drawDoubleArrow(ctx, item.fromX, item.fromY, item.toX, item.toY, item.color || '#ffd1a0', controlPoint)
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
      drawSoccerBall(ctx, item.x, item.y, isSelected)
      return
    }

    if (item.type === 'cone') {
      drawTrainingCone(ctx, item.x, item.y, isSelected)
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

    if (isArrowTool(item.type)) {
      const hasControl = Number.isFinite(Number(item.controlX)) && Number.isFinite(Number(item.controlY))
      const controlX = hasControl ? Number(item.controlX) : null
      const controlY = hasControl ? Number(item.controlY) : null
      const minX = Math.min(item.fromX, item.toX, ...(hasControl ? [controlX] : [])) - 12
      const maxX = Math.max(item.fromX, item.toX, ...(hasControl ? [controlX] : [])) + 12
      const minY = Math.min(item.fromY, item.toY, ...(hasControl ? [controlY] : [])) - 12
      const maxY = Math.max(item.fromY, item.toY, ...(hasControl ? [controlY] : [])) + 12
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
      if (isRotatableAidType(item.type)) {
        if (isPointInRotatedRect(point, item, 8)) {
          return item
        }
        continue
      }

      const width = Number(item.width || 62)
      const height = Number(item.height || 30)
      if (
        point.x >= item.x - width / 2 - 8
        && point.x <= item.x + width / 2 + 8
        && point.y >= item.y - height / 2 - 8
        && point.y <= item.y + height / 2 + 8
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
  const hurdleDrawRef = useRef(null)

  const [sportKey, setSportKey] = useState('football')
  const [surfaceKey, setSurfaceKey] = useState('fullPitch')
  const [activeTool, setActiveTool] = useState('select')
  const [activeTeamColor, setActiveTeamColor] = useState('red')
  const [activePlayerStyle, setActivePlayerStyle] = useState('circle')
  const [activePlayerPreset, setActivePlayerPreset] = useState('')
  const [sceneObjects, setSceneObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [dragState, setDragState] = useState(null)
  const [resizeState, setResizeState] = useState(null)
  const [rotateState, setRotateState] = useState(null)
  const [arrowStart, setArrowStart] = useState(null)
  const [areaDraft, setAreaDraft] = useState(null)
  const [exportDataUrl, setExportDataUrl] = useState('')

  const activeSportLabel = useMemo(() => SPORTS[sportKey]?.label || 'Šport', [sportKey])
  const selectedObject = useMemo(
    () => sceneObjects.find((item) => String(item.id || '') === String(selectedObjectId || '')) || null,
    [sceneObjects, selectedObjectId]
  )

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
      const key = String(event.key || '')

      if ((key === 'Delete' || key === 'Backspace') && selectedObjectId) {
        if (isTypingContext(event.target)) return
        event.preventDefault()
        setSceneObjects((prev) => prev.filter((item) => String(item?.id || '') !== String(selectedObjectId)))
        setSelectedObjectId('')
        return
      }

      if (!(event.ctrlKey || event.metaKey) || String(event.key || '').toLowerCase() !== 'd') return
      if (isTypingContext(event.target)) return
      if (!selectedObjectId) return

      const selectedItem = sceneObjects.find((item) => String(item?.id || '') === String(selectedObjectId))
      if (!selectedItem) return

      event.preventDefault()

      const offset = 20
      const duplicatedId = createId()
      const duplicatedItem = { ...selectedItem, id: duplicatedId }

      if (isArrowTool(duplicatedItem.type)) {
        duplicatedItem.fromX = Number(duplicatedItem.fromX || 0) + offset
        duplicatedItem.fromY = Number(duplicatedItem.fromY || 0) + offset
        duplicatedItem.toX = Number(duplicatedItem.toX || 0) + offset
        duplicatedItem.toY = Number(duplicatedItem.toY || 0) + offset
        if (Number.isFinite(Number(duplicatedItem.controlX)) && Number.isFinite(Number(duplicatedItem.controlY))) {
          duplicatedItem.controlX = Number(duplicatedItem.controlX || 0) + offset
          duplicatedItem.controlY = Number(duplicatedItem.controlY || 0) + offset
        }
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

    if (selectedObject && isRotatableAidType(selectedObject.type)) {
      drawRotationHandle(ctx, selectedObject)
    }

    if (areaDraft?.toolType && areaDraft?.startPoint && areaDraft?.endPoint) {
      drawAreaShape(ctx, buildAreaFromDrag(areaDraft.toolType, areaDraft.startPoint, areaDraft.endPoint), true)
    }

    if (arrowStart?.type && Number.isFinite(arrowStart.fromX) && Number.isFinite(arrowStart.toX)) {
      const draftControlPoint = Number.isFinite(Number(arrowStart.controlX)) && Number.isFinite(Number(arrowStart.controlY))
        ? { x: Number(arrowStart.controlX), y: Number(arrowStart.controlY) }
        : null

      if (arrowStart.type === 'arrowPlayerBall') {
        drawWavyArrow(ctx, arrowStart.fromX, arrowStart.fromY, arrowStart.toX, arrowStart.toY, getArrowColor(arrowStart.type), draftControlPoint)
      } else if (arrowStart.type === 'arrowShotDouble') {
        drawDoubleArrow(ctx, arrowStart.fromX, arrowStart.fromY, arrowStart.toX, arrowStart.toY, getArrowColor(arrowStart.type), draftControlPoint)
      } else {
        drawArrow(
          ctx,
          arrowStart.fromX,
          arrowStart.fromY,
          arrowStart.toX,
          arrowStart.toY,
          getArrowColor(arrowStart.type),
          arrowStart.type === 'arrowBallDashed',
          draftControlPoint
        )
      }

      ctx.beginPath()
      ctx.arc(arrowStart.fromX, arrowStart.fromY, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.strokeStyle = '#101828'
      ctx.lineWidth = 1.4
      ctx.stroke()
    }
  }, [sportKey, surfaceKey, sceneObjects, selectedObjectId, selectedObject, arrowStart, areaDraft, activePlayerStyle])

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
          color: getArrowColor(arrowType)
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
      const preset = PLAYER_PRESET_CONFIG[activePlayerPreset]
      base.color = preset?.color || TEAM_COLORS[activeTeamColor] || TEAM_COLORS.red
      base.number = ''
      base.playerStyle = preset ? 'circle' : activePlayerStyle
      if (preset?.shape) {
        base.playerShape = preset.shape
      }
    }

    if (tool === 'ladder') {
      base.width = 128
      base.height = 32
      base.cells = 4
      base.rotation = 0
    }

    if (tool === 'miniGoal') {
      base.width = 78
      base.height = 40
      base.rotation = 0
    }

    if (tool === 'hurdle') {
      base.width = 62
      base.height = 30
      base.rotation = 0
    }

    setSceneObjects((prev) => [...prev, base])
  }

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (typeof canvas.setPointerCapture === 'function') {
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // No-op: pointer capture may fail on unsupported environments.
      }
    }

    const point = getCanvasPoint(canvas, event)
    const isAreaTool = activeTool === 'areaRect' || activeTool === 'areaSquare' || activeTool === 'areaCircle' || activeTool === 'areaDiamond'

    if (selectedObject && isRotatableAidType(selectedObject.type) && hitRotationHandle(selectedObject, point)) {
      setRotateState({ id: selectedObject.id })
      setDragState(null)
      setResizeState(null)
      return
    }

    if (isAreaTool) {
      setAreaDraft({ toolType: activeTool, startPoint: point, endPoint: point })
      setSelectedObjectId('')
      setDragState(null)
      setResizeState(null)
      setRotateState(null)
      setArrowStart(null)
      return
    }

    if (isArrowTool(activeTool)) {
      setArrowStart({
        type: activeTool,
        fromX: point.x,
        fromY: point.y,
        toX: point.x,
        toY: point.y,
        trail: [{ x: point.x, y: point.y }]
      })
      setSelectedObjectId('')
      setDragState(null)
      setResizeState(null)
      setRotateState(null)
      return
    }

    if (activeTool === 'hurdle') {
      const hurdleId = createId()
      setSceneObjects((prev) => [...prev, createHurdleItem(hurdleId, point.x, point.y, 0)])
      setSelectedObjectId(hurdleId)
      setDragState(null)
      setResizeState(null)
      setRotateState(null)
      setAreaDraft(null)
      setArrowStart(null)
      hurdleDrawRef.current = {
        firstId: hurdleId,
        originX: point.x,
        originY: point.y,
        directionX: null,
        directionY: null,
        placedCount: 0
      }
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
          setRotateState(null)
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
              toY: Number(hit.toY || 0),
              controlX: Number.isFinite(Number(hit.controlX)) ? Number(hit.controlX) : null,
              controlY: Number.isFinite(Number(hit.controlY)) ? Number(hit.controlY) : null
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
          setRotateState(null)
        } else {
          setDragState(null)
          setResizeState(null)
          setRotateState(null)
        }
      } else {
        setSelectedObjectId('')
        setDragState(null)
        setResizeState(null)
        setRotateState(null)
      }
      return
    }

    if (hit && !isArrowTool(activeTool)) {
      if (hit.type === 'ladder' || hit.type === 'miniGoal' || hit.type === 'hurdle') {
        setSelectedObjectId(hit.id)
        setDragState({
          id: hit.id,
          mode: 'object',
          offsetX: point.x - hit.x,
          offsetY: point.y - hit.y
        })
        setResizeState(null)
        setRotateState(null)
        return
      }

      setSelectedObjectId(hit.id)
      setRotateState(null)
      return
    }

    addObject(activeTool, point)
  }

  const paintHurdlesToPoint = (point) => {
    const state = hurdleDrawRef.current
    if (!state) return

    const originX = Number(state.originX || 0)
    const originY = Number(state.originY || 0)

    let directionX = state.directionX
    let directionY = state.directionY

    if (!Number.isFinite(directionX) || !Number.isFinite(directionY) || Math.hypot(directionX, directionY) < 0.0001) {
      const initialDx = point.x - originX
      const initialDy = point.y - originY
      const initialDistance = Math.hypot(initialDx, initialDy)
      if (initialDistance < 10) return

      directionX = initialDx / initialDistance
      directionY = initialDy / initialDistance
    }

    const projection = ((point.x - originX) * directionX) + ((point.y - originY) * directionY)
    const targetCount = Math.max(0, Math.floor(projection / HURDLE_DRAG_SPACING))
    const placedCount = Number.isFinite(Number(state.placedCount)) ? Number(state.placedCount) : 0
    const toCreate = targetCount - placedCount
    const rotation = (getRotationFromVector(directionX, directionY) + 90) % 360

    const newHurdles = []
    for (let i = 1; i <= toCreate; i += 1) {
      const step = placedCount + i
      const nextX = originX + directionX * step * HURDLE_DRAG_SPACING
      const nextY = originY + directionY * step * HURDLE_DRAG_SPACING
      newHurdles.push(createHurdleItem(createId(), nextX, nextY, rotation))
    }

    setSceneObjects((prev) => {
      let next = prev.map((item) => (String(item.id || '') === String(state.firstId)
        ? { ...item, rotation }
        : item))
      if (newHurdles.length > 0) {
        next = [...next, ...newHurdles]
      }
      return next
    })

    hurdleDrawRef.current = {
      ...state,
      directionX,
      directionY,
      placedCount: placedCount + Math.max(0, toCreate)
    }
  }

  const handlePointerMove = (event) => {
    if (areaDraft?.toolType) {
      const canvas = canvasRef.current
      if (!canvas) return
      const point = getCanvasPoint(canvas, event)
      setAreaDraft((prev) => (prev ? { ...prev, endPoint: point } : prev))
      return
    }

    if (arrowStart?.type) {
      const canvas = canvasRef.current
      if (!canvas) return
      const point = getCanvasPoint(canvas, event)
      setArrowStart((prev) => {
        if (!prev) return prev
        const nextToX = clamp(point.x, 8, canvas.width - 8)
        const nextToY = clamp(point.y, 8, canvas.height - 8)
        const nextTrail = [...(Array.isArray(prev.trail) ? prev.trail : []), { x: nextToX, y: nextToY }]
        const limitedTrail = nextTrail.length > 60 ? nextTrail.slice(nextTrail.length - 60) : nextTrail
        const control = getCurveControlFromTrail(prev.fromX, prev.fromY, nextToX, nextToY, limitedTrail)

        return {
          ...prev,
          toX: nextToX,
          toY: nextToY,
          trail: limitedTrail,
          controlX: control?.x,
          controlY: control?.y
        }
      })
      return
    }

    if (activeTool === 'hurdle' && hurdleDrawRef.current) {
      const canvas = canvasRef.current
      if (!canvas) return
      const point = getCanvasPoint(canvas, event)
      paintHurdlesToPoint(point)
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

    if (rotateState?.id) {
      const canvas = canvasRef.current
      if (!canvas) return
      const point = getCanvasPoint(canvas, event)
      setSceneObjects((prev) => prev.map((item) => {
        if (item.id !== rotateState.id) return item
        if (!isRotatableAidType(item.type)) return item

        const dx = point.x - item.x
        const dy = point.y - item.y
        const degrees = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360

        return {
          ...item,
          rotation: degrees
        }
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
          toY: nextToY,
          controlX: Number.isFinite(Number(dragState.controlX)) ? Number(dragState.controlX) + dx : item.controlX,
          controlY: Number.isFinite(Number(dragState.controlY)) ? Number(dragState.controlY) + dy : item.controlY
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

  const handlePointerUp = (event) => {
    const canvas = canvasRef.current

    if (canvas && activeTool === 'hurdle' && hurdleDrawRef.current) {
      const point = getCanvasPoint(canvas, event)
      paintHurdlesToPoint(point)
    }

    if (canvas && typeof canvas.releasePointerCapture === 'function') {
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // No-op: pointer capture may already be released.
      }
    }

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

    if (arrowStart?.type && Number.isFinite(arrowStart.fromX) && Number.isFinite(arrowStart.toX)) {
      const distance = Math.hypot(arrowStart.toX - arrowStart.fromX, arrowStart.toY - arrowStart.fromY)
      if (distance >= 8) {
        const controlPoint = getCurveControlFromTrail(
          arrowStart.fromX,
          arrowStart.fromY,
          arrowStart.toX,
          arrowStart.toY,
          Array.isArray(arrowStart.trail) ? arrowStart.trail : []
        )

        setSceneObjects((prev) => [
          ...prev,
          {
            id: createId(),
            type: arrowStart.type,
            fromX: arrowStart.fromX,
            fromY: arrowStart.fromY,
            toX: arrowStart.toX,
            toY: arrowStart.toY,
            color: getArrowColor(arrowStart.type),
            controlX: controlPoint?.x,
            controlY: controlPoint?.y
          }
        ])
      }
      setArrowStart(null)
    }

    if (dragState) {
      setDragState(null)
    }

    if (resizeState) {
      setResizeState(null)
    }

    if (rotateState) {
      setRotateState(null)
    }

    hurdleDrawRef.current = null
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
    setRotateState(null)
    hurdleDrawRef.current = null
  }

  const rotateSelectedAid = (stepDeg) => {
    if (!selectedObjectId) return
    setSceneObjects((prev) => prev.map((item) => {
      if (String(item.id || '') !== String(selectedObjectId)) return item
      return rotateAidItem(item, stepDeg)
    }))
  }

  const setSelectedAidRotation = (nextRotation) => {
    if (!selectedObjectId) return
    const normalized = ((Number(nextRotation || 0) % 360) + 360) % 360
    setSceneObjects((prev) => prev.map((item) => {
      if (String(item.id || '') !== String(selectedObjectId)) return item
      if (!isRotatableAidType(item.type)) return item
      return {
        ...item,
        rotation: normalized
      }
    }))
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

  const activateTool = (toolKey, options = {}) => {
    setActiveTool(toolKey)

    if (toolKey === 'player') {
      setActivePlayerPreset(String(options.playerPreset || ''))
      if (options.playerPreset) {
        setActivePlayerStyle('circle')
      }
    }

    if (!isArrowTool(toolKey)) {
      setArrowStart(null)
    } else if (arrowStart?.type && arrowStart.type !== toolKey) {
      setArrowStart(null)
    }
    if (!(toolKey === 'areaRect' || toolKey === 'areaSquare' || toolKey === 'areaCircle' || toolKey === 'areaDiamond')) {
      setAreaDraft(null)
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
        <section className="card settings-placeholder-card scheme-canvas-wrap">
          <div className="scheme-surface-strip" role="tablist" aria-label="Výber plochy ihriska">
            {SURFACE_OPTIONS.map((surface) => (
              <button
                key={surface.key}
                type="button"
                role="tab"
                aria-selected={surfaceKey === surface.key}
                className={`scheme-surface-btn ${surfaceKey === surface.key ? 'active' : ''}`}
                onClick={() => setSurfaceKey(surface.key)}
              >
                <span className={`scheme-surface-icon ${surface.key}`} aria-hidden="true" />
                <span className="scheme-surface-label">{surface.label}</span>
              </button>
            ))}
          </div>

            <div className="scheme-canvas-stage">
              <div className="scheme-minibar" role="toolbar" aria-label="Mini nástroje">
                {MINI_BAR_SECTIONS.map((section) => (
                  <div key={section.title} className="scheme-minibar-section">
                    <p className="scheme-minibar-section-title">{section.title}</p>
                    <div className="scheme-minibar-grid">
                      {section.items.map((item) => {
                        if (item.kind === 'playerPreset') {
                          const preset = PLAYER_PRESET_CONFIG[item.key]
                          if (!preset) return null
                          const isActive = activeTool === 'player' && activePlayerPreset === item.key

                          return (
                            <button
                              key={`mini-player-${item.key}`}
                              type="button"
                              className={`scheme-minibar-btn ${isActive ? 'active' : ''}`}
                              title={preset.label}
                              aria-label={preset.label}
                              onClick={() => activateTool('player', { playerPreset: item.key })}
                            >
                              <span className={`scheme-player-preset-glyph ${preset.shape}`} style={{ '--preset-color': preset.color }} aria-hidden="true" />
                            </button>
                          )
                        }

                        const tool = TOOL_OPTIONS.find((candidate) => candidate.key === item.key)
                        if (!tool) return null

                        return (
                          <button
                            key={`mini-${tool.key}`}
                            type="button"
                            className={`scheme-minibar-btn ${activeTool === tool.key ? 'active' : ''}`}
                            title={tool.label}
                            aria-label={tool.label}
                            onClick={() => activateTool(tool.key)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">{TOOL_ICON[tool.key] || TOOL_SHORT[tool.key] || 'apps'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

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
            </div>

          <div className="scheme-under-canvas">
            <div className="scheme-tool-row" role="toolbar" aria-label="Nástroje schémy">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  className={`btn-secondary scheme-tool-btn scheme-tool-btn--compact ${activeTool === tool.key ? 'active' : ''}`}
                  title={tool.label}
                  aria-label={tool.label}
                  onClick={() => activateTool(tool.key)}
                >
                  <span className="scheme-tool-icon material-symbols-outlined" aria-hidden="true">{TOOL_ICON[tool.key] || TOOL_SHORT[tool.key] || 'apps'}</span>
                  <span className="scheme-tool-label">{tool.label}</span>
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

            {selectedObject && isRotatableAidType(selectedObject.type) ? (
              <div className="form-group">
                <label>Otáčanie objektu</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => rotateSelectedAid(-15)}>↺ -15°</button>
                  <button type="button" className="btn-secondary" onClick={() => rotateSelectedAid(15)}>↻ +15°</button>
                </div>
                <label htmlFor="scheme-rotation" style={{ marginTop: 10 }}>Uhol (°)</label>
                <input
                  id="scheme-rotation"
                  type="range"
                  min="0"
                  max="345"
                  step="15"
                  value={Number(selectedObject.rotation || 0)}
                  onChange={(event) => setSelectedAidRotation(Number(event.target.value || 0))}
                />
              </div>
            ) : null}

            {arrowStart ? (
              <p className="manager-empty-text" style={{ margin: 0 }}>
                {arrowStart.type === 'arrowBallDashed'
                  ? 'Pohyb lopty: podrž a ťahaj myšou.'
                  : (arrowStart.type === 'arrowPlayerStraight'
                      ? 'Pohyb hráča bez lopty: podrž a ťahaj myšou.'
                      : (arrowStart.type === 'arrowShotDouble'
                          ? 'Strela: podrž a ťahaj myšou.'
                          : 'Pohyb hráča s loptou: podrž a ťahaj myšou.'))}
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
          </div>
        </section>
      </div>
    </div>
  )
}

export default SchemeTool
