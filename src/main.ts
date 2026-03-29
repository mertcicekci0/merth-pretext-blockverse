import './style.css'
import { prepareWithSegments, layoutNextLine, type LayoutCursor } from '@chenglou/pretext'

// ── Constants ──────────────────────────────────────────────────
const COLS = 10
const ROWS = 20
const WALL_FONT = 'bold 14px "Space Mono", monospace'
const WALL_LINE_H = 19

let CELL = 32
let CANVAS_W = COLS * CELL
let CANVAS_H = ROWS * CELL

// ── Buzzwords ──────────────────────────────────────────────────
const WALL_COPY = [
  `blockchain smart-contract DeFi NFT Web3 DAO token consensus hash mining staking yield liquidity swap oracle bridge rollup L2 ZK-proof merkle ledger decentralized immutable trustless permissionless gas-fee protocol node validator epoch shard cross-chain airdrop governance vault mempool nonce proof-of-stake Solidity Rust WASM zero-knowledge dApp DEX AMM TVL APY flash-loan perpetual margin collateral liquidation on-chain`,
  `AI machine-learning neural-net transformer GPT LLM fine-tuning inference embedding vector-db RAG prompt attention diffusion agent multimodal RLHF tokenizer gradient backprop latent-space generative AGI compute benchmark FLOPS quantization distillation retrieval context-window agentic chain-of-thought few-shot zero-shot CoT function-calling`,
  `SaaS API microservice serverless K8s Docker CI/CD DevOps cloud edge CDN GraphQL REST webhook OAuth JWT SSO multi-tenant scalable observability pipeline schema deploy encryption protocol telemetry`,
  `pretext layout measure cursor segment wrap glyph inline reflow stream bidi kern space split signal static dynamic vector module bounce trail track render flow text snakes between every obstacle and keeps every word alive while the field recomposes`,
]

function buildWallText(): string {
  let text = ''
  for (let i = 0; i < 8; i++) text += WALL_COPY[i % WALL_COPY.length] + ' '
  return text.trim()
}

// ── Floating Background Glyphs ─────────────────────────────────
type FloatingGlyph = { char: string; x: number; y: number; speed: number; alpha: number }
const GLYPH_CHARS = ['.', ':', '·', '*', '+', '◆', '▪', '⬡', '⬢']
let floatingGlyphs: FloatingGlyph[] = []

function initFloatingGlyphs() {
  floatingGlyphs = []
  for (let i = 0; i < 50; i++) {
    floatingGlyphs.push({
      char: GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)],
      x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H,
      speed: 6 + Math.random() * 20, alpha: 0.06 + Math.random() * 0.14,
    })
  }
}

// ── Word Colors ────────────────────────────────────────────────
const WALL_COLORS = [
  '#5a7ea6', '#6b9bc0', '#7eb3d0', '#8ecae0',
  '#a0c4b0', '#7db892', '#5caa75',
  '#c9a0dc', '#a87bc5', '#8b5fb0',
  '#d4a76a', '#c98f50', '#d08090', '#c06070',
]
const ACCENT_COLORS = ['#ffe156', '#ff6b9d', '#4ecdc4', '#a8e6cf', '#ff8a5c', '#b088f9', '#ff4757', '#56c2ff']

function wordColor(word: string, time: number): { color: string; alpha: number } {
  let h = 0
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) | 0
  h = Math.abs(h)
  if (h % 7 === 0) {
    return { color: ACCENT_COLORS[h % ACCENT_COLORS.length], alpha: 0.6 + 0.25 * Math.sin(time * 0.002 + h) }
  }
  return { color: WALL_COLORS[h % WALL_COLORS.length], alpha: 0.5 + 0.1 * Math.sin(time * 0.001 + h * 0.5) }
}

// ── Piece Colors ───────────────────────────────────────────────
const COLORS = {
  yellow: { fill: '#ffe156', border: '#000', text: '#000' },
  pink:   { fill: '#ff6b9d', border: '#000', text: '#000' },
  blue:   { fill: '#4ecdc4', border: '#000', text: '#000' },
  green:  { fill: '#a8e6cf', border: '#000', text: '#000' },
  orange: { fill: '#ff8a5c', border: '#000', text: '#000' },
  purple: { fill: '#b088f9', border: '#000', text: '#000' },
  red:    { fill: '#ff4757', border: '#000', text: '#fff' },
}
type ColorKey = keyof typeof COLORS
type Piece = { shape: number[][]; colorKey: ColorKey; word: string }

const PIECES: Piece[] = [
  { shape: [[1,1,1,1]],         colorKey: 'blue',   word: 'CHAIN' },
  { shape: [[1,1],[1,1]],       colorKey: 'yellow',  word: 'BLOCK' },
  { shape: [[0,1,0],[1,1,1]],   colorKey: 'purple',  word: 'NODE' },
  { shape: [[1,0],[1,0],[1,1]], colorKey: 'orange',  word: 'STACK' },
  { shape: [[0,1],[0,1],[1,1]], colorKey: 'pink',    word: 'HASH' },
  { shape: [[0,1,1],[1,1,0]],   colorKey: 'green',   word: 'SWAP' },
  { shape: [[1,1,0],[0,1,1]],   colorKey: 'red',     word: 'FORK' },
]

// ── Game State ─────────────────────────────────────────────────
type Cell = { colorKey: ColorKey; word: string } | null
const board: Cell[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null))

let current: Piece
let currentX = 0
let currentY = 0
let nextPiece: Piece
let holdPiece: Piece | null = null
let canHold = true
let score = 0
let linesCleared = 0
let level = 1
let combo = 0
let dropInterval = 800
let lastDrop = 0
let gameOver = false

let wallText = buildWallText()
let wallPrepared = prepareWithSegments(wallText, WALL_FONT)
let wallScrollY = 0
const WALL_SCROLL_SPEED = 8

let clearingRows: number[] = []
let clearAnimTimer = 0
const CLEAR_ANIM_DURATION = 400
let scrambleTimer = 0

// ── Canvas Setup ───────────────────────────────────────────────
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const nextCanvas = document.getElementById('next-piece') as HTMLCanvasElement
const nextCtx = nextCanvas.getContext('2d')!
const holdCanvas = document.getElementById('hold-piece') as HTMLCanvasElement
const holdCtx = holdCanvas.getContext('2d')!

// Mobile mini canvases
const nextCanvasM = document.getElementById('next-piece-m') as HTMLCanvasElement | null
const nextCtxM = nextCanvasM?.getContext('2d') ?? null
const holdCanvasM = document.getElementById('hold-piece-m') as HTMLCanvasElement | null
const holdCtxM = holdCanvasM?.getContext('2d') ?? null

function rebuildWall() {
  wallText = buildWallText()
  wallPrepared = prepareWithSegments(wallText, WALL_FONT)
}

// ── Responsive ─────────────────────────────────────────────────
const isMobile = () => window.innerWidth <= 640

function resize() {
  const container = document.getElementById('game-container')!
  const rect = container.getBoundingClientRect()
  // On mobile, canvas should fill width, fit remaining height
  const gapY = isMobile() ? 4 : 16
  const gapX = isMobile() ? 0 : 16
  CELL = Math.floor(Math.min((rect.width - gapX) / COLS, (rect.height - gapY) / ROWS))
  CELL = Math.max(CELL, 14)
  CANVAS_W = COLS * CELL
  CANVAS_H = ROWS * CELL
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  // On mobile, stretch canvas to full width
  if (isMobile()) {
    canvas.style.width = '100%'
    canvas.style.height = `${CANVAS_H}px`
  } else {
    canvas.style.width = ''
    canvas.style.height = ''
  }
  wallPrepared = prepareWithSegments(wallText, WALL_FONT)
  initFloatingGlyphs()
}
window.addEventListener('resize', resize)

// ── Occupied cells ─────────────────────────────────────────────
function getOccupiedSet(): Set<string> {
  const set = new Set<string>()
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) set.add(`${c},${r}`)
  if (current && !gameOver)
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) set.add(`${currentX + c},${currentY + r}`)
  return set
}

// ── Drawing: Reflowing Text Wall ───────────────────────────────
function drawReflowingTextWall(time: number) {
  const occupied = getOccupiedSet()
  const padX = 4, padY = 4
  const areaX = padX, areaW = CANVAS_W - padX * 2
  const scrollOff = wallScrollY % (WALL_LINE_H * 3)

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = padY - scrollOff

  ctx.save()
  ctx.font = WALL_FONT

  while (y < CANVAS_H + WALL_LINE_H) {
    const lineY = y, lineBottom = y + WALL_LINE_H
    const slots = getLineSlots(areaX, areaW, lineY, lineBottom, occupied)

    for (const slot of slots) {
      if (slot.right - slot.left < 20) continue
      let line = layoutNextLine(wallPrepared, cursor, slot.right - slot.left)
      if (line === null) {
        cursor = { segmentIndex: 0, graphemeIndex: 0 }
        line = layoutNextLine(wallPrepared, cursor, slot.right - slot.left)
        if (!line) break
      }
      drawLineWords(line.text, slot.left, lineY + WALL_LINE_H - 4, time)
      cursor = line.end
    }
    y += WALL_LINE_H
  }
  ctx.restore()
}

function drawLineWords(text: string, x: number, y: number, time: number) {
  const tokens = text.split(/(\s+)/)
  let cx = x
  for (const token of tokens) {
    const trimmed = token.trim()
    if (!trimmed) { cx += ctx.measureText(token).width; continue }
    const wc = wordColor(trimmed, time)
    let jx = 0, jy = 0
    if (scrambleTimer > 0) {
      jx = (Math.random() - 0.5) * scrambleTimer * 0.06
      jy = (Math.random() - 0.5) * scrambleTimer * 0.04
    }
    ctx.fillStyle = wc.color
    ctx.globalAlpha = wc.alpha
    ctx.fillText(trimmed, cx + jx, y + jy)
    ctx.globalAlpha = 1
    cx += ctx.measureText(token).width
  }
}

function getLineSlots(areaX: number, areaW: number, top: number, bottom: number, occupied: Set<string>): { left: number; right: number }[] {
  const rowStart = Math.floor(top / CELL), rowEnd = Math.floor((bottom - 1) / CELL)
  const blockedCols = new Set<number>()
  for (let r = rowStart; r <= rowEnd; r++) {
    if (r < 0 || r >= ROWS) continue
    for (let c = 0; c < COLS; c++) if (occupied.has(`${c},${r}`)) blockedCols.add(c)
  }
  const slots: { left: number; right: number }[] = []
  let ss = -1
  for (let c = 0; c <= COLS; c++) {
    const px = areaX + (c / COLS) * areaW
    if (c < COLS && !blockedCols.has(c)) { if (ss < 0) ss = px }
    else { if (ss >= 0) { slots.push({ left: ss, right: px }); ss = -1 } }
  }
  return slots
}

// ── Drawing: Floating Glyphs ───────────────────────────────────
function updateAndDrawGlyphs(dt: number) {
  ctx.save()
  ctx.font = '16px "Space Mono", monospace'
  for (const g of floatingGlyphs) {
    g.y += g.speed * dt
    if (g.y > CANVAS_H + 10) { g.y = -10; g.x = 10 + Math.random() * (CANVAS_W - 20) }
    ctx.fillStyle = '#75d7e6'; ctx.globalAlpha = g.alpha
    ctx.fillText(g.char, g.x, g.y)
  }
  ctx.globalAlpha = 1; ctx.restore()
}

// ── Drawing: Game Cells ────────────────────────────────────────
function drawCell(x: number, y: number, colorKey: ColorKey, word: string, alpha = 1) {
  const c = COLORS[colorKey], px = x * CELL, py = y * CELL
  ctx.save(); ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 3, py + 3, CELL, CELL)
  ctx.fillStyle = c.fill; ctx.fillRect(px, py, CELL, CELL)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px, py, CELL, 3); ctx.fillRect(px, py, 3, CELL)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px, py + CELL - 3, CELL, 3); ctx.fillRect(px + CELL - 3, py, 3, CELL)
  ctx.strokeStyle = c.border; ctx.lineWidth = 2.5; ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1)
  ctx.fillStyle = c.text
  ctx.font = `bold ${Math.max(8, CELL * 0.3)}px "Space Mono", monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(word.slice(0, Math.max(2, Math.floor(CELL / 9))), px + CELL / 2, py + CELL / 2)
  ctx.restore()
}

function drawBoard() {
  for (let r = 0; r < ROWS; r++) {
    const cl = clearingRows.includes(r)
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c]
      if (cell) drawCell(c, r, cell.colorKey, cell.word, cl ? clearAnimTimer / CLEAR_ANIM_DURATION : 1)
    }
  }
}

function drawGhost() {
  if (!current || clearingRows.length > 0) return
  let gy = currentY
  while (isValid(current.shape, currentX, gy + 1)) gy++
  if (gy === currentY) return
  ctx.save(); ctx.globalAlpha = 0.18
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        const px = (currentX + c) * CELL, py = (gy + r) * CELL
        ctx.fillStyle = COLORS[current.colorKey].fill; ctx.fillRect(px, py, CELL, CELL)
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2)
      }
  ctx.restore()
}

function drawCurrentPiece() {
  if (!current || clearingRows.length > 0) return
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) drawCell(currentX + c, currentY + r, current.colorKey, current.word)
}

function drawGrid() {
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5
  for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, CANVAS_H); ctx.stroke() }
  for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(CANVAS_W, r * CELL); ctx.stroke() }
  ctx.restore()
}

function drawMiniPiece(cvs: HTMLCanvasElement, context: CanvasRenderingContext2D, piece: Piece | null) {
  context.clearRect(0, 0, cvs.width, cvs.height)
  context.fillStyle = '#16213e'; context.fillRect(0, 0, cvs.width, cvs.height)
  if (!piece) return
  const shape = piece.shape, rows = shape.length, cols = shape[0].length
  const mc = Math.floor(Math.min(cvs.width / (cols + 1), cvs.height / (rows + 1)))
  const ox = Math.floor((cvs.width - cols * mc) / 2), oy = Math.floor((cvs.height - rows * mc) / 2)
  const c = COLORS[piece.colorKey]
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++)
      if (shape[r][col]) {
        const px = ox + col * mc, py = oy + r * mc
        context.fillStyle = 'rgba(0,0,0,0.4)'; context.fillRect(px + 2, py + 2, mc, mc)
        context.fillStyle = c.fill; context.fillRect(px, py, mc, mc)
        context.fillStyle = 'rgba(255,255,255,0.3)'; context.fillRect(px, py, mc, 2); context.fillRect(px, py, 2, mc)
        context.fillStyle = 'rgba(0,0,0,0.2)'; context.fillRect(px, py + mc - 2, mc, 2); context.fillRect(px + mc - 2, py, 2, mc)
        context.strokeStyle = '#000'; context.lineWidth = 2; context.strokeRect(px + 0.5, py + 0.5, mc - 1, mc - 1)
      }
}

function drawNextPiece() {
  drawMiniPiece(nextCanvas, nextCtx, nextPiece)
  if (nextCanvasM && nextCtxM) drawMiniPiece(nextCanvasM, nextCtxM, nextPiece)
}
function drawHoldPiece() {
  drawMiniPiece(holdCanvas, holdCtx, holdPiece)
  if (holdCanvasM && holdCtxM) drawMiniPiece(holdCanvasM, holdCtxM, holdPiece)
}

function drawGameOver() {
  ctx.save()
  ctx.fillStyle = 'rgba(26, 26, 46, 0.88)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  const boxW = CANVAS_W * 0.82, boxH = 190
  const boxX = (CANVAS_W - boxW) / 2, boxY = (CANVAS_H - boxH) / 2
  ctx.fillStyle = '#000'; ctx.fillRect(boxX + 6, boxY + 6, boxW, boxH)
  ctx.fillStyle = '#ffe156'; ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeRect(boxX, boxY, boxW, boxH)
  ctx.fillStyle = '#000'
  ctx.font = `bold ${Math.max(20, CELL * 0.8)}px "Space Grotesk", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('GAME OVER', CANVAS_W / 2, boxY + 50)
  ctx.font = `bold ${Math.max(13, CELL * 0.45)}px "Space Mono", monospace`
  ctx.fillText(`SCORE: ${score}`, CANVAS_W / 2, boxY + 95)
  const btnY = boxY + boxH - 55
  ctx.fillStyle = '#000'; ctx.fillRect(boxX + 22, btnY + 2, boxW - 40, 36)
  ctx.fillStyle = '#ff6b9d'; ctx.fillRect(boxX + 20, btnY, boxW - 40, 36)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.strokeRect(boxX + 20, btnY, boxW - 40, 36)
  ctx.fillStyle = '#000'; ctx.font = `bold ${Math.max(10, CELL * 0.33)}px "Space Mono", monospace`
  ctx.fillText(isMobile() ? 'TAP TO RESTART' : 'PRESS ENTER TO RESTART', CANVAS_W / 2, btnY + 18)
  ctx.restore()
}

// ── Piece Logic ────────────────────────────────────────────────
function randomPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)]
  return { ...p, shape: p.shape.map(r => [...r]) }
}

function spawnPiece() {
  current = nextPiece; nextPiece = randomPiece()
  currentX = Math.floor((COLS - current.shape[0].length) / 2); currentY = 0
  canHold = true
  if (!isValid(current.shape, currentX, currentY)) gameOver = true
  drawNextPiece()
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length, cols = shape[0].length
  const r: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0))
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) r[col][rows - 1 - row] = shape[row][col]
  return r
}

function isValid(shape: number[][], px: number, py: number): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = px + c, ny = py + r
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false
        if (ny >= 0 && board[ny][nx]) return false
      }
  return true
}

function lockPiece() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        const ny = currentY + r, nx = currentX + c
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS)
          board[ny][nx] = { colorKey: current.colorKey, word: current.word }
      }
  checkLines()
}

function checkLines() {
  clearingRows = []
  for (let r = 0; r < ROWS; r++) if (board[r].every(c => c !== null)) clearingRows.push(r)
  if (clearingRows.length > 0) { clearAnimTimer = CLEAR_ANIM_DURATION; scrambleTimer = CLEAR_ANIM_DURATION; combo++ }
  else { combo = 0; spawnPiece() }
  updateUI()
}

function finishClearLines() {
  const cleared = clearingRows.length
  for (const r of clearingRows.sort((a, b) => b - a)) { board.splice(r, 1); board.unshift(Array(COLS).fill(null)) }
  const pts = [0, 100, 300, 500, 800]
  score += ((pts[cleared] || 800) * level) + (combo > 1 ? combo * 50 : 0)
  linesCleared += cleared; level = Math.floor(linesCleared / 10) + 1
  dropInterval = Math.max(80, 800 - (level - 1) * 65)
  clearingRows = []; rebuildWall(); updateUI(); spawnPiece()
}

function holdCurrentPiece() {
  if (!canHold) return
  canHold = false
  const original = PIECES.find(p => p.word === current.word)!
  if (holdPiece) {
    const tmp = holdPiece
    holdPiece = { ...original, shape: original.shape.map(r => [...r]) }
    current = { ...tmp, shape: tmp.shape.map(r => [...r]) }
    currentX = Math.floor((COLS - current.shape[0].length) / 2); currentY = 0
  } else { holdPiece = { ...original, shape: original.shape.map(r => [...r]) }; spawnPiece() }
  drawHoldPiece()
}

function updateUI() {
  document.getElementById('score')!.textContent = String(score).padStart(5, '0')
  document.getElementById('level')!.textContent = String(level).padStart(2, '0')
  document.getElementById('lines')!.textContent = String(linesCleared).padStart(3, '0')
  // Mobile duplicates
  const sm = document.getElementById('score-m')
  if (sm) sm.textContent = String(score).padStart(5, '0')
  const lm = document.getElementById('level-m')
  if (lm) lm.textContent = String(level).padStart(2, '0')

  const el = document.getElementById('combo-display')!
  el.textContent = combo > 0 ? `${combo}x` : '0x'
  el.style.color = combo > 1 ? '#ff6b9d' : '#ffe156'
  if (combo > 1) { el.style.transform = 'scale(1.2)'; setTimeout(() => { el.style.transform = 'scale(1)' }, 200) }
}

// ── Game Loop ──────────────────────────────────────────────────
let prevTime = 0

function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - prevTime) / 1000, 0.1)
  prevTime = timestamp
  wallScrollY += WALL_SCROLL_SPEED * dt
  if (scrambleTimer > 0) scrambleTimer = Math.max(0, scrambleTimer - dt * 1000)
  if (clearingRows.length > 0) { clearAnimTimer -= dt * 1000; if (clearAnimTimer <= 0) finishClearLines() }
  if (!gameOver && clearingRows.length === 0) {
    if (timestamp - lastDrop > dropInterval) {
      if (isValid(current.shape, currentX, currentY + 1)) currentY++
      else lockPiece()
      lastDrop = timestamp
    }
  }

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.fillStyle = '#0e1225'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  updateAndDrawGlyphs(dt)
  drawReflowingTextWall(timestamp)
  drawGrid()
  drawBoard()
  if (!gameOver) { drawGhost(); drawCurrentPiece() }
  else drawGameOver()
  requestAnimationFrame(gameLoop)
}

// ── Actions ────────────────────────────────────────────────────
function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms)
}

function doAction(action: string) {
  if (gameOver) { if (action === 'restart') resetGame(); return }
  if (clearingRows.length > 0) return
  switch (action) {
    case 'left': if (isValid(current.shape, currentX - 1, currentY)) { currentX--; haptic() } break
    case 'right': if (isValid(current.shape, currentX + 1, currentY)) { currentX++; haptic() } break
    case 'down':
      if (isValid(current.shape, currentX, currentY + 1)) { currentY++; score += 1; updateUI(); haptic(5) } break
    case 'rotate': {
      const rotated = rotate(current.shape)
      for (const off of [0, -1, 1, -2, 2])
        if (isValid(rotated, currentX + off, currentY)) { current.shape = rotated; currentX += off; haptic(15); break }
      break
    }
    case 'drop': {
      let d = 0; while (isValid(current.shape, currentX, currentY + 1)) { currentY++; d++ }
      score += d * 2; updateUI(); lockPiece(); lastDrop = performance.now(); haptic(25); break
    }
    case 'hold': holdCurrentPiece(); haptic(15); break
  }
}

function resetGame() {
  for (let r = 0; r < ROWS; r++) board[r].fill(null)
  score = 0; linesCleared = 0; level = 1; combo = 0
  dropInterval = 800; gameOver = false; holdPiece = null; clearingRows = []
  scrambleTimer = 0; wallScrollY = 0
  rebuildWall(); updateUI(); nextPiece = randomPiece(); spawnPiece(); drawHoldPiece()
}

// ── Keyboard Input ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft': e.preventDefault(); doAction('left'); break
    case 'ArrowRight': e.preventDefault(); doAction('right'); break
    case 'ArrowDown': e.preventDefault(); doAction('down'); break
    case 'ArrowUp': e.preventDefault(); doAction('rotate'); break
    case ' ': e.preventDefault(); doAction('drop'); break
    case 'c': case 'C': doAction('hold'); break
    case 'Enter': if (gameOver) doAction('restart'); break
  }
})

// ── Mobile Button Controls with Auto-Repeat ────────────────────
const REPEAT_ACTIONS = new Set(['left', 'right', 'down'])
const REPEAT_DELAY = 180   // ms before repeat starts
const REPEAT_INTERVAL = 60 // ms between repeats

let repeatTimer: number | null = null
let repeatAction: string | null = null

function startRepeat(action: string) {
  stopRepeat()
  doAction(action)
  repeatAction = action
  repeatTimer = window.setTimeout(() => {
    repeatTimer = window.setInterval(() => {
      if (repeatAction === action) doAction(action)
    }, REPEAT_INTERVAL)
  }, REPEAT_DELAY)
}

function stopRepeat() {
  if (repeatTimer !== null) { clearTimeout(repeatTimer); clearInterval(repeatTimer); repeatTimer = null }
  repeatAction = null
}

document.querySelectorAll('.mc-btn').forEach(btn => {
  const action = (btn as HTMLElement).dataset.action!

  btn.addEventListener('touchstart', (e) => {
    e.preventDefault()
    ;(btn as HTMLElement).classList.add('pressed')
    if (REPEAT_ACTIONS.has(action)) startRepeat(action)
    else doAction(action)
  }, { passive: false })

  btn.addEventListener('touchend', (e) => {
    e.preventDefault()
    ;(btn as HTMLElement).classList.remove('pressed')
    if (REPEAT_ACTIONS.has(action)) stopRepeat()
  })

  btn.addEventListener('touchcancel', () => {
    ;(btn as HTMLElement).classList.remove('pressed')
    stopRepeat()
  })
})

// ── Swipe Gesture on Game Canvas ───────────────────────────────
let touchStartX = 0
let touchStartY = 0
let touchStartTime = 0
let touchMoved = false
const SWIPE_THRESHOLD = 30
const TAP_THRESHOLD = 15

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault()
  const t = e.touches[0]
  touchStartX = t.clientX; touchStartY = t.clientY
  touchStartTime = Date.now(); touchMoved = false
}, { passive: false })

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  const t = e.touches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
    doAction(dx > 0 ? 'right' : 'left')
    touchStartX = t.clientX; touchStartY = t.clientY; touchMoved = true
  } else if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
    doAction('down')
    touchStartY = t.clientY; touchMoved = true
  }
}, { passive: false })

canvas.addEventListener('touchend', (e) => {
  e.preventDefault()
  const elapsed = Date.now() - touchStartTime
  if (!touchMoved && elapsed < 300) {
    // Quick tap on canvas
    const t = e.changedTouches[0]
    const dx = Math.abs(t.clientX - touchStartX)
    const dy = Math.abs(t.clientY - touchStartY)
    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
      if (gameOver) doAction('restart')
      else doAction('rotate')
    }
  }
}, { passive: false })

// ── Init ───────────────────────────────────────────────────────
nextPiece = randomPiece()
spawnPiece()
resize()
updateUI()
drawHoldPiece()
initFloatingGlyphs()
requestAnimationFrame(gameLoop)
