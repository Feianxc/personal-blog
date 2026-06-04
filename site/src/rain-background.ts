type Mood = 'cover' | 'signals' | 'feed' | 'evidence' | 'archive'

type InteractionTarget = {
  x: number
  y: number
  radius: number
  color?: SignalRgb
  energy?: number
}

type SignalRgb = [number, number, number]

type InteractionMode = 'idle' | 'cover' | 'feed' | 'route' | 'action'

type QuietZone = {
  x: number
  y: number
  width: number
  height: number
}

type ImpulseKind = 'hover' | 'click' | 'section'

type Impulse = {
  x: number
  y: number
  strength: number
  kind: ImpulseKind
  age: number
}

type ImpulseInput = {
  x: number
  y: number
  strength: number
  kind: ImpulseKind
}

type Lane = {
  x: number
  width: number
  alpha: number
  phase: number
  speed: number
}

type Node = {
  laneIndex: number
  y: number
  radius: number
  alpha: number
  pulse: number
  label?: string
}

type Bridge = {
  fromLane: number
  toLane: number
  y: number
  alpha: number
  label?: string
}

type Packet = {
  laneIndex: number
  y: number
  speed: number
  size: number
  alpha: number
  phase: number
}

type Glyph = {
  laneIndex: number
  y: number
  speed: number
  alpha: number
  phase: number
  value: string
}

type Vec2 = {
  x: number
  y: number
}

type PhysicsPoint = {
  x: number
  y: number
  px: number
  py: number
  restX: number
  restY: number
  pinned: boolean
  phase: number
}

type PhysicsConstraint = {
  a: number
  b: number
  rest: number
  axis: 'x' | 'y' | 'd'
}

type SignalSheet = {
  x: number
  y: number
  width: number
  height: number
  columns: number
  rows: number
  alpha: number
  phase: number
  curl: number
  seed: number
}

type DepthBloom = {
  xRatio: number
  yRatio: number
  radius: number
  alpha: number
  phase: number
}

type SignalRibbon = {
  yRatio: number
  amplitude: number
  width: number
  alpha: number
  phase: number
  speed: number
  tilt: number
}

type Options = {
  reducedMotion?: boolean
}

type MoodConfig = {
  grid: number
  line: number
  glow: number
  scanner: number
  labels: number
  laneCount: number
  nodeCount: number
  bridgeWeight: number
  packetWeight: number
  glyphWeight: number
  laneJitter: number
  packetSpeedBias: number
  scannerVelocity: number
  labelPool: string[]
  bridgePool: string[]
}

type RainBackgroundController = {
  setMood: (mood: Mood) => void
  setInteraction: (target: InteractionTarget) => void
  setInteractionMode: (mode: InteractionMode) => void
  clearInteraction: () => void
  setScrollEnergy: (value: number) => void
  setQuietZones: (zones: QuietZone[]) => void
  pushImpulse: (input: ImpulseInput) => void
  destroy: () => void
}

const moodMap: Record<Mood, MoodConfig> = {
  cover: {
    grid: 0.2,
    line: 1.04,
    glow: 1.08,
    scanner: 1.12,
    labels: 0.82,
    laneCount: 10,
    nodeCount: 6,
    bridgeWeight: 1.24,
    packetWeight: 1.08,
    glyphWeight: 1.18,
    laneJitter: 54,
    packetSpeedBias: 1,
    scannerVelocity: 1.28,
    labelPool: ['AGENT', 'CODX', 'CLD', 'PROBE', 'TRACE', 'QUEUE', 'SYNC', 'ROOT'],
    bridgePool: ['probe', 'sync', 'route', 'gate'],
  },
  feed: {
    grid: 0.15,
    line: 0.84,
    glow: 0.86,
    scanner: 0.76,
    labels: 0.56,
    laneCount: 11,
    nodeCount: 7,
    bridgeWeight: 0.92,
    packetWeight: 1.62,
    glyphWeight: 0.92,
    laneJitter: 34,
    packetSpeedBias: 1.28,
    scannerVelocity: 1.04,
    labelPool: ['LOG', 'STEP', 'PATCH', 'QUEUE', 'TRACE', 'DELTA', 'STACK', 'FLOW'],
    bridgePool: ['scan', 'pulse', 'merge', 'shift'],
  },
  signals: {
    grid: 0.16,
    line: 0.78,
    glow: 0.82,
    scanner: 0.7,
    labels: 0.62,
    laneCount: 9,
    nodeCount: 7,
    bridgeWeight: 1.08,
    packetWeight: 1.34,
    glyphWeight: 0.86,
    laneJitter: 26,
    packetSpeedBias: 1.1,
    scannerVelocity: 0.92,
    labelPool: ['AXIS', 'AGENT', 'FIELD', 'TOOL', 'FLOW', 'NODE', 'TRACE', 'LINK'],
    bridgePool: ['axis', 'route', 'signal', 'bind'],
  },
  evidence: {
    grid: 0.12,
    line: 0.68,
    glow: 0.72,
    scanner: 0.58,
    labels: 0.48,
    laneCount: 8,
    nodeCount: 6,
    bridgeWeight: 1,
    packetWeight: 0.92,
    glyphWeight: 0.76,
    laneJitter: 26,
    packetSpeedBias: 0.9,
    scannerVelocity: 0.88,
    labelPool: ['FIELD', 'RTU', '485', 'BUS', 'STEP', 'TEST', 'READ', 'WRITE'],
    bridgePool: ['lock', 'test', 'link', 'pass'],
  },
  archive: {
    grid: 0.12,
    line: 0.54,
    glow: 0.52,
    scanner: 0.44,
    labels: 0.42,
    laneCount: 9,
    nodeCount: 6,
    bridgeWeight: 1.42,
    packetWeight: 0.92,
    glyphWeight: 1.02,
    laneJitter: 18,
    packetSpeedBias: 0.78,
    scannerVelocity: 0.78,
    labelPool: ['INDEX', 'ARCH', 'ENTRY', 'MAP', 'NOTE', 'FIELD', 'ROOT', 'PATH'],
    bridgePool: ['index', 'route', 'bind', 'link'],
  },
}

const pointer = {
  x: window.innerWidth * 0.68,
  y: window.innerHeight * 0.3,
  active: false,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function randomItem<T>(items: T[], random = Math.random) {
  return items[Math.floor(random() * items.length)]
}

function hashString(input: string) {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function createRainBackground(
  canvas: HTMLCanvasElement,
  options: Options = {},
): RainBackgroundController {
  if (options.reducedMotion) {
    return {
      setMood: () => {},
      setInteraction: () => {},
      setInteractionMode: () => {},
      clearInteraction: () => {},
      setScrollEnergy: () => {},
      setQuietZones: () => {},
      pushImpulse: () => {},
      destroy: () => {},
    }
  }

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return {
      setMood: () => {},
      setInteraction: () => {},
      setInteractionMode: () => {},
      clearInteraction: () => {},
      setScrollEnergy: () => {},
      setQuietZones: () => {},
      pushImpulse: () => {},
      destroy: () => {},
    }
  }

  const context = ctx

  let width = 0
  let height = 0
  let dpr = 1
  let rafId = 0
  let currentMood: Mood = 'cover'
  let interaction: InteractionTarget | null = null
  let interactionMode: InteractionMode = 'idle'
  let quietZones: QuietZone[] = []
  let visibilityScale = 1
  let impulses: Impulse[] = []
  let moodPulse = 1
  let sectionPulse = 0
  let scrollEnergy = 0
  let scrollEnergyTarget = 0
  let lastPaintTime = 0
  let activityUntil = performance.now() + 1800
  let idleSince = 0
  let isSuspended = document.hidden
  let lanes: Lane[] = []
  let nodes: Node[] = []
  let bridges: Bridge[] = []
  let packets: Packet[] = []
  let glyphs: Glyph[] = []
  let membranePoints: PhysicsPoint[] = []
  let membraneConstraints: PhysicsConstraint[] = []
  let signalSheets: SignalSheet[] = []
  let depthBlooms: DepthBloom[] = []
  let signalRibbons: SignalRibbon[] = []

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    dpr = getAdaptiveDpr()

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    buildTopology()
  }

  function getAdaptiveDpr() {
    const rawDpr = window.devicePixelRatio || 1
    const baseCap = width < 640 ? 1.18 : width < 960 ? 1.35 : 1.55
    const pixelBudget = width < 640 ? 900_000 : width < 1280 ? 1_600_000 : 2_250_000
    const budgetCap = Math.sqrt(pixelBudget / Math.max(width * height, 1))

    return clamp(Math.min(rawDpr, baseCap, budgetCap), 0.9, baseCap)
  }

  function buildTopology() {
    const mood = moodMap[currentMood]
    const laneCount = Math.max(
      5,
      Math.round(
        mood.laneCount * (width < 640 ? 0.78 : width < 960 ? 0.9 : 1),
      ),
    )
    const nodeCount = Math.max(
      4,
      Math.round(
        mood.nodeCount * (width < 640 ? 0.82 : width < 960 ? 0.92 : 1),
      ),
    )
    const jitterRange =
      (width < 640 ? mood.laneJitter * 0.7 : mood.laneJitter) *
      (width < 960 ? 0.84 : 1)
    const random = createSeededRandom(
      hashString(`${currentMood}:${Math.round(width)}:${Math.round(height)}`),
    )
    lanes = []
    nodes = []
    bridges = []
    packets = []
    glyphs = []
    membranePoints = []
    membraneConstraints = []
    signalSheets = []
    depthBlooms = []
    signalRibbons = []

    for (let index = 0; index < laneCount; index += 1) {
      const base = (index + 1) / (laneCount + 1)
      const jitter = (random() - 0.5) * jitterRange
      lanes.push({
        x: clamp(base * width + jitter, 56, width - 56),
        width: 1 + random() * 0.8,
        alpha: 0.18 + random() * 0.32,
        phase: random() * Math.PI * 2,
        speed: (64 + random() * 62) * mood.packetSpeedBias,
      })
    }

    lanes.sort((a, b) => a.x - b.x)

    lanes.forEach((lane, laneIndex) => {
      for (let index = 0; index < nodeCount; index += 1) {
        const band = (index + 1) / (nodeCount + 1)
        const y = band * height + (random() - 0.5) * 84
        const showLabel =
          index === 0 ||
          (laneIndex + index) %
            (currentMood === 'archive'
              ? 2
              : currentMood === 'feed'
                ? 4
                : 3) ===
            0
        nodes.push({
          laneIndex,
          y: clamp(y, 72, height - 72),
          radius: 2.4 + random() * 2.8,
          alpha: 0.3 + random() * 0.4,
          pulse: random() * Math.PI * 2,
          label: showLabel ? randomItem(mood.labelPool, random) : undefined,
        })
      }

      const packetCount = Math.max(
        1,
        Math.round((laneIndex % 2 === 0 ? 2 : 1) * mood.packetWeight),
      )
      for (let index = 0; index < packetCount; index += 1) {
        packets.push({
          laneIndex,
          y: random() * height,
          speed: lane.speed * (0.72 + random() * 0.38),
          size: 8 + random() * 14,
          alpha: 0.28 + random() * 0.38,
          phase: random() * Math.PI * 2,
        })
      }

      const glyphCount = Math.max(
        0,
        Math.round(
          (laneIndex % 3 === 0 ? 2 : 1) *
            mood.glyphWeight *
            (width < 640 ? 0.42 : width < 960 ? 0.68 : 1),
        ),
      )

      for (let index = 0; index < glyphCount; index += 1) {
        glyphs.push({
          laneIndex,
          y: random() * height,
          speed: lane.speed * (0.18 + random() * 0.22),
          alpha: 0.1 + random() * 0.18,
          phase: random() * Math.PI * 2,
          value: randomItem([...mood.labelPool, ...mood.bridgePool], random),
        })
      }
    })

    for (let laneIndex = 0; laneIndex < lanes.length - 1; laneIndex += 1) {
      const bridgeCount = Math.max(
        1,
        Math.round((laneIndex % 2 === 0 ? 2 : 1) * mood.bridgeWeight),
      )
      for (let index = 0; index < bridgeCount; index += 1) {
        const y =
          ((index + 1) / (bridgeCount + 1)) * height + (random() - 0.5) * 120
        bridges.push({
          fromLane: laneIndex,
          toLane: laneIndex + 1,
          y: clamp(y, 96, height - 96),
          alpha: 0.12 + random() * 0.16,
          label:
            random() > (currentMood === 'archive' ? 0.42 : 0.55)
              ? randomItem(mood.bridgePool, random)
              : undefined,
        })
      }
    }

    buildSignalMembrane(random)
    buildSignalSheets(random)
    buildAtmosphericDepth(random)
  }

  function buildAtmosphericDepth(random: () => number) {
    const bloomCount = width < 640 ? 4 : currentMood === 'cover' ? 7 : 5
    const ribbonCount = width < 640 ? 3 : currentMood === 'cover' ? 7 : 5

    for (let index = 0; index < bloomCount; index += 1) {
      depthBlooms.push({
        xRatio: 0.06 + random() * 0.88,
        yRatio: 0.06 + random() * 0.76,
        radius: clamp(
          Math.max(width, height) * (0.18 + random() * 0.22),
          160,
          520,
        ),
        alpha: 0.028 + random() * 0.052,
        phase: random() * Math.PI * 2,
      })
    }

    for (let index = 0; index < ribbonCount; index += 1) {
      signalRibbons.push({
        yRatio: 0.12 + random() * 0.76,
        amplitude: (24 + random() * 74) * (width < 640 ? 0.55 : 1),
        width: (18 + random() * 52) * (width < 640 ? 0.6 : 1),
        alpha: 0.028 + random() * 0.056,
        phase: random() * Math.PI * 2,
        speed: 0.12 + random() * 0.22,
        tilt: (random() - 0.5) * 0.24,
      })
    }
  }

  function buildSignalMembrane(random: () => number) {
    const columns = width < 640 ? 12 : width < 960 ? 18 : 27
    const rows = width < 640 ? 7 : width < 960 ? 10 : 14
    const left =
      currentMood === 'archive'
        ? width * 0.06
        : currentMood === 'feed'
          ? width * 0.14
          : width < 640
            ? width * 0.08
            : width * 0.34
    const top = currentMood === 'cover' ? height * 0.06 : height * 0.11
    const spanX =
      currentMood === 'cover'
        ? width * (width < 640 ? 0.86 : 0.72)
        : width * (width < 640 ? 0.88 : 0.78)
    const spanY =
      currentMood === 'cover'
        ? height * (width < 640 ? 0.48 : 0.64)
        : height * (width < 640 ? 0.56 : 0.7)
    const columnStep = spanX / Math.max(columns - 1, 1)
    const rowStep = spanY / Math.max(rows - 1, 1)

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const falloff = row / Math.max(rows - 1, 1)
        const restX =
          left +
          column * columnStep +
          (random() - 0.5) * columnStep * 0.16 +
          Math.sin(column * 0.7 + row * 0.34) * 4
        const restY =
          top +
          row * rowStep +
          (random() - 0.5) * rowStep * 0.14 +
          Math.sin(column * 0.42) * falloff * 7
        const pinned =
          row === 0 && column % (width < 640 ? 4 : 3) === 0 ||
          column === 0 && row < 3

        membranePoints.push({
          x: restX,
          y: restY,
          px: restX,
          py: restY,
          restX,
          restY,
          pinned,
          phase: random() * Math.PI * 2,
        })
      }
    }

    const addConstraint = (a: number, b: number, axis: PhysicsConstraint['axis']) => {
      const from = membranePoints[a]
      const to = membranePoints[b]
      if (!from || !to) return

      membraneConstraints.push({
        a,
        b,
        rest: Math.hypot(to.restX - from.restX, to.restY - from.restY),
        axis,
      })
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column
        if (column > 0) addConstraint(index, index - 1, 'x')
        if (row > 0) addConstraint(index, index - columns, 'y')
        if (column > 0 && row > 0 && (column + row) % 2 === 0) {
          addConstraint(index, index - columns - 1, 'd')
        }
      }
    }
  }

  function buildSignalSheets(random: () => number) {
    const sheetCount =
      width < 640 ? 1 : currentMood === 'cover' ? 4 : currentMood === 'archive' ? 3 : 2
    const baseWidth = clamp(width * (width < 640 ? 0.34 : 0.18), 92, 250)
    const baseHeight = clamp(height * (width < 640 ? 0.16 : 0.2), 100, 230)

    for (let index = 0; index < sheetCount; index += 1) {
      const coverBias = currentMood === 'cover' ? 0.16 : 0
      const x =
        width *
          (0.08 +
            random() * 0.8 +
            (index % 2 === 0 ? coverBias : -coverBias * 0.42)) -
        baseWidth * 0.5
      const y =
        height *
          (0.1 + random() * (currentMood === 'cover' ? 0.52 : 0.72)) -
        baseHeight * 0.5

      signalSheets.push({
        x: clamp(x, -baseWidth * 0.38, width - baseWidth * 0.36),
        y: clamp(y, 12, height - baseHeight * 0.42),
        width: baseWidth * (0.78 + random() * 0.46),
        height: baseHeight * (0.78 + random() * 0.5),
        columns: width < 640 ? 4 : 5,
        rows: width < 640 ? 5 : 7,
        alpha: 0.22 + random() * 0.34,
        phase: random() * Math.PI * 2,
        curl: 0.7 + random() * 1.4,
        seed: random() * 1000,
      })
    }
  }

  function getQuietFactor(x: number, y: number) {
    let maxFactor = 0

    for (let index = 0; index < quietZones.length; index += 1) {
      const zone = quietZones[index]
      if (!zone) continue

      const expand = 42
      if (
        x < zone.x - expand - 120 ||
        x > zone.x + zone.width + expand + 120 ||
        y < zone.y - expand - 120 ||
        y > zone.y + zone.height + expand + 120
      ) {
        continue
      }

      const left = zone.x - expand
      const right = zone.x + zone.width + expand
      const top = zone.y - expand
      const bottom = zone.y + zone.height + expand
      const dx = x < left ? left - x : x > right ? x - right : 0
      const dy = y < top ? top - y : y > bottom ? y - bottom : 0
      const distance = Math.hypot(dx, dy)
      const proximity = clamp(1 - distance / 96, 0, 1)
      maxFactor = Math.max(maxFactor, proximity)

      if (maxFactor >= 0.98) break
    }

    return maxFactor
  }

  function markActive(duration = 1400) {
    activityUntil = Math.max(activityUntil, performance.now() + duration)
    idleSince = 0
    ensureFrame()
  }

  function getInteractionEnergy() {
    const targetEnergy = interaction?.energy ?? 1

    return clamp(
      (interaction ? targetEnergy : 0) +
        scrollEnergy * 0.72 +
        scrollEnergyTarget * 0.42 +
        sectionPulse * 0.86 +
        moodPulse * 0.2 +
        impulses.length * 0.035 +
        (interactionMode === 'route' ? 0.24 : interactionMode === 'cover' ? 0.18 : 0),
      0,
      1.65,
    )
  }

  function colorToRgba(color: SignalRgb | undefined, alpha: number) {
    const [red, green, blue] = color ?? [169, 218, 246]

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }

  function getActiveSignalColor(): SignalRgb | undefined {
    return interaction?.color
  }

  function sampleWind(
    x: number,
    y: number,
    timeSeconds: number,
    mood: MoodConfig,
    scale = 1,
  ): Vec2 {
    const macro =
      Math.sin(y * 0.0037 + timeSeconds * (0.72 + scrollEnergy * 0.34)) +
      Math.cos(x * 0.0029 - timeSeconds * 0.58 + moodPulse * 0.5)
    const micro = Math.sin((x + y) * 0.0062 + timeSeconds * 1.28) * 0.42
    const directionalBias =
      currentMood === 'archive'
        ? -0.34
        : currentMood === 'feed'
          ? 0.16
          : currentMood === 'cover'
            ? 0.28
            : 0
    const angle = macro * 0.7 + micro + directionalBias
    const baseStrength =
      (11 +
        scrollEnergy * 42 +
        moodPulse * 8 +
        sectionPulse * 24 +
        (interactionMode === 'route' ? 10 : interactionMode === 'cover' ? 7 : 0)) *
      mood.glow *
      visibilityScale *
      scale
    let windX = Math.cos(angle) * baseStrength
    let windY =
      (Math.sin(angle * 1.18 + timeSeconds * 0.16) * 0.42 +
        Math.cos(x * 0.002 + timeSeconds * 0.36) * 0.16) *
      baseStrength

    if (pointer.active) {
      const dx = x - pointer.x
      const dy = y - pointer.y
      const distance = Math.max(Math.hypot(dx, dy), 1)
      const influence = clamp(1 - distance / (width < 640 ? 190 : 320), 0, 1)

      if (influence > 0) {
        windX += (-dy / distance) * influence * 34 * scale
        windY += (dx / distance) * influence * 19 * scale
      }
    }

    if (interaction) {
      const dx = x - interaction.x
      const dy = y - interaction.y
      const distance = Math.max(Math.hypot(dx, dy), 1)
      const influence = clamp(
        1 - distance / Math.max(interaction.radius * 1.7, 150),
        0,
        1,
      )

      if (influence > 0) {
        const modeStrength =
          interactionMode === 'route'
            ? 46
            : interactionMode === 'feed'
              ? 38
              : interactionMode === 'cover'
                ? 52
                : 26
        windX += (-dy / distance) * influence * modeStrength * scale
        windY += (dx / distance) * influence * modeStrength * 0.52 * scale
      }
    }

    impulses.forEach((impulse) => {
      const duration =
        impulse.kind === 'click' ? 0.72 : impulse.kind === 'section' ? 0.96 : 0.48
      const progress = clamp(impulse.age / duration, 0, 1)
      const fade = 1 - progress
      const dx = x - impulse.x
      const dy = y - impulse.y
      const distance = Math.max(Math.hypot(dx, dy), 1)
      const radius =
        impulse.kind === 'section'
          ? 120 + progress * 360
          : impulse.kind === 'click'
            ? 46 + progress * 260
            : 40 + progress * 170
      const wave = clamp(1 - Math.abs(distance - radius) / 120, 0, 1) * fade

      if (wave > 0) {
        windX += (dx / distance) * wave * impulse.strength * 62 * scale
        windY += (dy / distance) * wave * impulse.strength * 32 * scale
      }
    })

    return { x: windX, y: windY }
  }

  function drawGrid(timeSeconds: number, mood: MoodConfig) {
    const horizontal = 108
    const vertical = width < 640 ? 72 : 96
    const drift = (timeSeconds * (8 + scrollEnergy * 24 + moodPulse * 3.4)) % horizontal
    const gridBoost = 1 + scrollEnergy * 0.52 + moodPulse * 0.18
    const horizontalAlpha = 0.0075 * mood.grid * visibilityScale * gridBoost
    const verticalAlpha =
      0.0048 *
      mood.grid *
      visibilityScale *
      gridBoost *
      (currentMood === 'cover' ? 0.72 : 0.88)

    context.save()
    context.lineWidth = 1

    for (let y = -horizontal + drift; y <= height + horizontal; y += horizontal) {
      context.strokeStyle = `rgba(142, 194, 232, ${horizontalAlpha})`
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.stroke()
    }

    for (let x = 0; x <= width + vertical; x += vertical) {
      context.strokeStyle = `rgba(142, 194, 232, ${verticalAlpha})`
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, height)
      context.stroke()
    }

    context.restore()
  }

  function drawAtmosphericDepth(timeSeconds: number, mood: MoodConfig) {
    if (depthBlooms.length === 0) return

    const energy = getInteractionEnergy()
    const color = getActiveSignalColor()
    const pulse = 0.82 + Math.sin(timeSeconds * 0.36 + moodPulse) * 0.08

    context.save()
    context.globalCompositeOperation = 'screen'
    context.filter = width < 640 ? 'blur(18px)' : 'blur(30px)'

    depthBlooms.forEach((bloom, index) => {
      const driftX =
        Math.sin(timeSeconds * 0.11 + bloom.phase + index) *
        width *
        0.018
      const driftY =
        Math.cos(timeSeconds * 0.09 + bloom.phase) *
        height *
        0.018
      const x = bloom.xRatio * width + driftX
      const y = bloom.yRatio * height + driftY
      const radius = bloom.radius * (0.92 + energy * 0.08)
      const alpha =
        bloom.alpha *
        mood.glow *
        visibilityScale *
        pulse *
        (1 + scrollEnergy * 0.26 + sectionPulse * 0.22)
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius)

      gradient.addColorStop(0, colorToRgba(color, alpha * 1.8))
      gradient.addColorStop(0.42, colorToRgba(color, alpha * 0.72))
      gradient.addColorStop(1, colorToRgba(color, 0))

      context.fillStyle = gradient
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    })

    context.filter = 'none'
    context.globalCompositeOperation = 'lighter'

    const glassAlpha =
      (0.018 + energy * 0.018 + sectionPulse * 0.012) *
      mood.glow *
      visibilityScale
    const glass = context.createLinearGradient(0, height * 0.08, width, height * 0.82)
    glass.addColorStop(0, `rgba(236, 246, 252, 0)`)
    glass.addColorStop(0.46, `rgba(236, 246, 252, ${glassAlpha})`)
    glass.addColorStop(0.58, colorToRgba(color, glassAlpha * 1.8))
    glass.addColorStop(1, `rgba(236, 246, 252, 0)`)

    context.fillStyle = glass
    context.beginPath()
    context.moveTo(width * -0.08, height * 0.06)
    context.lineTo(width * 0.72, height * -0.02)
    context.lineTo(width * 1.08, height * 0.52)
    context.lineTo(width * 0.12, height * 0.76)
    context.closePath()
    context.fill()

    context.restore()
  }

  function drawSignalRibbons(timeSeconds: number, mood: MoodConfig) {
    if (signalRibbons.length === 0) return

    const energy = getInteractionEnergy()
    const color = getActiveSignalColor()
    const visibleRibbons =
      width < 640
        ? signalRibbons.slice(0, 3)
        : signalRibbons.slice(0, energy > 0.75 ? signalRibbons.length : Math.min(5, signalRibbons.length))

    context.save()
    context.globalCompositeOperation = 'lighter'
    context.lineCap = 'round'
    context.lineJoin = 'round'

    visibleRibbons.forEach((ribbon, index) => {
      const phase = timeSeconds * ribbon.speed + ribbon.phase
      const y =
        ribbon.yRatio * height +
        Math.sin(phase) * ribbon.amplitude +
        Math.cos(timeSeconds * 0.17 + index) * 18
      const x0 = -width * 0.18
      const x1 = width * 0.28
      const x2 = width * 0.68
      const x3 = width * 1.16
      const tilt = ribbon.tilt * height
      const quiet = getQuietFactor(width * 0.52, y)
      const alpha =
        ribbon.alpha *
        mood.glow *
        visibilityScale *
        (1 - quiet * 0.34) *
        (0.78 + energy * 1.18 + scrollEnergy * 0.46 + sectionPulse * 0.38)
      const gradient = context.createLinearGradient(x0, y, x3, y + tilt)

      if (alpha < 0.01) return

      gradient.addColorStop(0, colorToRgba(color, 0))
      gradient.addColorStop(0.22, colorToRgba(color, alpha * 0.62))
      gradient.addColorStop(0.52, `rgba(236, 246, 252, ${alpha})`)
      gradient.addColorStop(0.76, colorToRgba(color, alpha * 0.52))
      gradient.addColorStop(1, colorToRgba(color, 0))

      context.strokeStyle = gradient
      context.lineWidth = ribbon.width
      context.beginPath()
      context.moveTo(x0, y + Math.sin(phase + 0.4) * 20)
      context.bezierCurveTo(
        x1,
        y - ribbon.amplitude * 0.46,
        x2,
        y + ribbon.amplitude * 0.58 + tilt,
        x3,
        y + tilt,
      )
      context.stroke()

      context.strokeStyle = `rgba(236, 246, 252, ${alpha * 0.42})`
      context.lineWidth = Math.max(0.7, ribbon.width * 0.055)
      context.setLineDash([width < 640 ? 42 : 68, width < 640 ? 62 : 96])
      context.lineDashOffset = -timeSeconds * (26 + energy * 40) - index * 24
      context.beginPath()
      context.moveTo(x0, y + Math.sin(phase + 0.4) * 20)
      context.bezierCurveTo(
        x1,
        y - ribbon.amplitude * 0.46,
        x2,
        y + ribbon.amplitude * 0.58 + tilt,
        x3,
        y + tilt,
      )
      context.stroke()
      context.setLineDash([])
    })

    context.restore()
  }

  function drawScanner(timeSeconds: number, mood: MoodConfig) {
    const sweepVelocity =
      (110 + scrollEnergy * 220 + sectionPulse * 72) * mood.scannerVelocity
    const sweep = (timeSeconds * sweepVelocity) % (width + height * 0.65)
    const beamBoost = 1 + scrollEnergy * 0.7 + sectionPulse * 0.42
    context.save()
    context.translate(sweep - height * 0.65, 0)
    context.rotate(-Math.PI / 8)

    const beam = context.createLinearGradient(0, 0, 0, height * 1.5)
    beam.addColorStop(0, 'rgba(180, 225, 255, 0)')
    beam.addColorStop(0.46, `rgba(180, 225, 255, ${0.03 * mood.scanner * visibilityScale * beamBoost})`)
    beam.addColorStop(0.5, `rgba(230, 243, 255, ${0.07 * mood.scanner * visibilityScale * beamBoost})`)
    beam.addColorStop(0.54, `rgba(180, 225, 255, ${0.03 * mood.scanner * visibilityScale * beamBoost})`)
    beam.addColorStop(1, 'rgba(180, 225, 255, 0)')

    context.fillStyle = beam
    context.fillRect(0, -height * 0.3, 72, height * 1.8)
    context.restore()
  }

  function drawTelemetrySweep(timeSeconds: number, mood: MoodConfig) {
    const scanCycle = (timeSeconds * (0.08 + mood.scannerVelocity * 0.018)) % 1
    const yBase = -80 + scanCycle * (height + 160)
    const packetCycle = (timeSeconds * (0.55 + mood.packetSpeedBias * 0.08)) % 1
    const pulse = (Math.sin(timeSeconds * 2.4 + moodPulse * 1.2) + 1) * 0.5
    const alpha =
      (0.032 + pulse * 0.028 + scrollEnergy * 0.024 + sectionPulse * 0.036) *
      mood.scanner *
      visibilityScale

    if (alpha < 0.004) return

    context.save()
    context.globalCompositeOperation = 'lighter'
    context.lineWidth = 1
    context.setLineDash([12, 24])
    context.lineDashOffset = -timeSeconds * (72 + scrollEnergy * 120)

    for (let index = 0; index < 3; index += 1) {
      const y = yBase + (index - 1) * 18
      const laneAlpha = alpha * (index === 1 ? 1 : 0.52)
      const sweep = context.createLinearGradient(0, y, width, y)
      sweep.addColorStop(0, 'rgba(110, 198, 232, 0)')
      sweep.addColorStop(0.18, `rgba(110, 198, 232, ${laneAlpha * 0.46})`)
      sweep.addColorStop(0.5, `rgba(235, 246, 252, ${laneAlpha})`)
      sweep.addColorStop(0.82, `rgba(110, 198, 232, ${laneAlpha * 0.46})`)
      sweep.addColorStop(1, 'rgba(110, 198, 232, 0)')

      context.strokeStyle = sweep
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.stroke()
    }

    context.setLineDash([])

    const packetX = -120 + packetCycle * (width + 240)
    const packetY =
      height *
      (0.18 +
        ((Math.sin(timeSeconds * 0.33 + moodPulse) + 1) * 0.5) * 0.64)
    const packet = context.createLinearGradient(packetX - 96, packetY, packetX + 96, packetY)
    packet.addColorStop(0, 'rgba(235, 246, 252, 0)')
    packet.addColorStop(0.42, `rgba(235, 246, 252, ${alpha * 2.4})`)
    packet.addColorStop(1, 'rgba(110, 198, 232, 0)')

    context.strokeStyle = packet
    context.lineWidth = 1.4
    context.beginPath()
    context.moveTo(packetX - 96, packetY)
    context.lineTo(packetX + 96, packetY)
    context.stroke()

    context.fillStyle = `rgba(235, 246, 252, ${alpha * 1.8})`
    context.fillRect(packetX + 18, packetY - 2, 18, 4)
    context.restore()
  }

  function drawLanes(timeSeconds: number, mood: MoodConfig) {
    lanes.forEach((lane, laneIndex) => {
      const quiet = getQuietFactor(lane.x, height * 0.5)
      const quietScale = 1 - quiet * 0.56
      const laneGlow = interaction
        ? clamp(1 - Math.abs(lane.x - interaction.x) / Math.max(interaction.radius * 1.3, 120), 0, 1)
        : 0
      const modeBoost =
        interactionMode === 'feed'
          ? 0.14
          : interactionMode === 'route'
            ? 0.09
            : interactionMode === 'cover'
              ? 0.06
              : 0
      const alpha =
        lane.alpha *
        mood.line *
        quietScale *
        visibilityScale *
        (1 +
          laneGlow * 0.52 +
          scrollEnergy * 0.24 +
          sectionPulse * 0.18 +
          modeBoost +
          (mood.line - 0.42) * 0.18)
      const shimmer = Math.sin(timeSeconds * 1.8 + lane.phase) * 0.08 + 0.08
      const laneWind = sampleWind(lane.x, height * 0.5, timeSeconds, mood, 0.16)

      context.save()
      context.lineWidth = lane.width
      context.setLineDash([26, currentMood === 'cover' ? 58 : 44])
      context.lineDashOffset = -(
        timeSeconds *
          lane.speed *
          (0.38 + scrollEnergy * 0.28 + (interactionMode === 'feed' ? 0.08 : interactionMode === 'route' ? 0.06 : 0)) +
        laneIndex * 28
      )

      const gradient = context.createLinearGradient(
        lane.x + laneWind.x * 0.22,
        0,
        lane.x + laneWind.x * 0.22,
        height,
      )
      gradient.addColorStop(0, `rgba(120, 176, 220, ${0.018 * alpha})`)
      gradient.addColorStop(0.15, `rgba(120, 176, 220, ${0.14 * alpha})`)
      gradient.addColorStop(0.5, `rgba(190, 232, 255, ${0.32 * alpha + shimmer * 0.62})`)
      gradient.addColorStop(0.85, `rgba(120, 176, 220, ${0.13 * alpha})`)
      gradient.addColorStop(1, `rgba(120, 176, 220, ${0.014 * alpha})`)
      context.strokeStyle = gradient
      const laneStep = width < 640 ? 116 : 92
      context.beginPath()
      for (let y = -48, pointIndex = 0; y <= height + 48; y += laneStep, pointIndex += 1) {
        const wind = sampleWind(lane.x, y, timeSeconds, mood, 0.2)
        const sway =
          Math.sin(timeSeconds * 0.86 + lane.phase + laneIndex * 0.4 + y * 0.008) *
          (3.2 + scrollEnergy * 7.2 + sectionPulse * 3)
        const x = lane.x + wind.x * 0.34 + sway
        const yy = y + wind.y * 0.08

        if (pointIndex === 0) {
          context.moveTo(x, yy)
        } else {
          context.lineTo(x, yy)
        }
      }
      context.stroke()
      context.restore()
    })
  }

  function drawBridges(timeSeconds: number, mood: MoodConfig) {
    bridges.forEach((bridge, bridgeIndex) => {
      const from = lanes[bridge.fromLane]
      const to = lanes[bridge.toLane]
      if (!from || !to) return

      const midX = (from.x + to.x) * 0.5
      const quiet = getQuietFactor(midX, bridge.y)
      const quietScale = 1 - quiet * 0.62
      const interactionBoost = interaction
        ? clamp(
            1 - Math.hypot(midX - interaction.x, bridge.y - interaction.y) / Math.max(interaction.radius * 1.2, 120),
            0,
            1,
          )
        : 0
      const modeBoost = interactionMode === 'route' ? 0.42 : interactionMode === 'cover' ? 0.1 : 0
      const alpha =
        bridge.alpha *
        mood.line *
        quietScale *
        visibilityScale *
        (1 +
          interactionBoost * 0.5 +
          scrollEnergy * 0.22 +
          modeBoost +
          (mood.bridgeWeight - 0.7) * 0.22)
      const pulse = (Math.sin(timeSeconds * 2.6 + bridgeIndex * 1.1) + 1) * 0.5
      const fromWind = sampleWind(from.x, bridge.y, timeSeconds, mood, 0.12)
      const toWind = sampleWind(to.x, bridge.y, timeSeconds, mood, 0.12)
      const midWind = sampleWind(midX, bridge.y, timeSeconds, mood, 0.08)
      const fromX = from.x + fromWind.x * 0.32
      const toX = to.x + toWind.x * 0.32
      const bridgeY = bridge.y + midWind.y * 0.12

      context.save()
      context.strokeStyle = `rgba(164, 208, 240, ${0.14 * alpha})`
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(fromX, bridgeY)
      context.quadraticCurveTo(midX + midWind.x * 0.42, bridgeY + midWind.y * 0.2, toX, bridgeY)
      context.stroke()

      context.fillStyle = `rgba(214, 236, 250, ${(0.08 + pulse * 0.08) * alpha})`
      context.fillRect(fromX, bridgeY - 0.5, (toX - fromX) * pulse, 1)

      if (bridge.label) {
        context.font = '10px "Azeret Mono", monospace'
        context.fillStyle = `rgba(200, 225, 244, ${0.22 * mood.labels * alpha})`
        context.fillText(bridge.label, fromX + 12, bridgeY - 6)
      }
      context.restore()
    })
  }

  function drawInteractionField(timeSeconds: number, mood: MoodConfig) {
    if (!interaction) return
    const currentInteraction = interaction
    const color = getActiveSignalColor()

    context.save()

    if (interactionMode === 'route') {
      const nearbyLanes = lanes.filter(
        (lane) =>
          Math.abs(lane.x - currentInteraction.x) <=
          Math.max(currentInteraction.radius * 0.96, 120),
      )
      const shimmer = (Math.sin(timeSeconds * 6.2) + 1) * 0.5

      nearbyLanes.forEach((lane, index) => {
        const offset = (index - (nearbyLanes.length - 1) / 2) * 18
        const y = currentInteraction.y + offset
        const beam = context.createLinearGradient(
          lane.x,
          y,
          currentInteraction.x + currentInteraction.radius * 0.7,
          y,
        )
        beam.addColorStop(0, colorToRgba(color, 0))
        beam.addColorStop(0.32, colorToRgba(color, 0.18 * mood.scanner))
        beam.addColorStop(0.62, `rgba(236, 245, 252, ${0.24 + shimmer * 0.12})`)
        beam.addColorStop(1, colorToRgba(color, 0))

        context.strokeStyle = beam
        context.lineWidth = 1.1
        context.beginPath()
        context.moveTo(lane.x, y)
        context.lineTo(currentInteraction.x + currentInteraction.radius * 0.7, y)
        context.stroke()
      })
    } else if (interactionMode === 'feed') {
      const wake = context.createLinearGradient(
        currentInteraction.x,
        currentInteraction.y - currentInteraction.radius * 1.12,
        currentInteraction.x,
        currentInteraction.y + currentInteraction.radius * 1.12,
      )
      wake.addColorStop(0, colorToRgba(color, 0))
      wake.addColorStop(0.24, colorToRgba(color, 0.13 * mood.scanner))
      wake.addColorStop(0.5, `rgba(236, 245, 252, ${0.16 + scrollEnergy * 0.12})`)
      wake.addColorStop(0.76, colorToRgba(color, 0.13 * mood.scanner))
      wake.addColorStop(1, colorToRgba(color, 0))

      context.strokeStyle = wake
      context.lineWidth = 2.2
      context.beginPath()
      context.moveTo(
        currentInteraction.x,
        currentInteraction.y - currentInteraction.radius * 1.12,
      )
      context.lineTo(
        currentInteraction.x,
        currentInteraction.y + currentInteraction.radius * 1.12,
      )
      context.stroke()
    } else if (interactionMode === 'cover') {
      context.strokeStyle = colorToRgba(color, 0.16 + mood.scanner * 0.07)
      context.lineWidth = 1
      context.beginPath()
      context.arc(
        currentInteraction.x,
        currentInteraction.y,
        currentInteraction.radius * (0.88 + Math.sin(timeSeconds * 2.6) * 0.05),
        -Math.PI * 0.22,
        Math.PI * 0.84,
      )
      context.stroke()
    }

    context.restore()
  }

  function drawSignalGates(timeSeconds: number, mood: MoodConfig) {
    const anchors: Array<{ x: number; y: number; radius: number; strength: number }> = []

    if (interaction) {
      anchors.push({
        x: interaction.x,
        y: interaction.y,
        radius: interaction.radius,
        strength:
          interactionMode === 'route'
            ? 0.86
            : interactionMode === 'feed'
              ? 0.66
              : 0.48,
      })
    }

    if (sectionPulse > 0.04) {
      anchors.push({
        x:
          currentMood === 'archive'
            ? width * 0.28
            : currentMood === 'feed'
              ? width * 0.5
              : width * 0.72,
        y:
          currentMood === 'cover'
            ? height * 0.3
            : currentMood === 'feed'
              ? height * 0.42
              : height * 0.54,
        radius: clamp(Math.min(width, height) * 0.18, 120, 220),
        strength: sectionPulse * 0.72,
      })
    }

    if (anchors.length === 0) return

    context.save()
    context.lineWidth = 1

    anchors.forEach((anchor, anchorIndex) => {
      const quiet = getQuietFactor(anchor.x, anchor.y)
      const quietScale = 1 - quiet * 0.5
      const spin = timeSeconds * (interactionMode === 'route' ? 1.26 : 0.76) + anchorIndex
      const strength = anchor.strength * mood.glow * quietScale * visibilityScale
      const color = getActiveSignalColor()

      for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
        const radius =
          anchor.radius *
          (0.34 +
            ringIndex * 0.22 +
            Math.sin(timeSeconds * 1.7 + ringIndex) * 0.015)
        const alpha = (0.13 - ringIndex * 0.026) * strength
        const start = spin + ringIndex * 1.28
        const span = Math.PI * (0.42 + ringIndex * 0.08)

        context.strokeStyle = colorToRgba(color, alpha * 1.08)
        context.beginPath()
        context.arc(anchor.x, anchor.y, radius, start, start + span)
        context.stroke()

        context.strokeStyle = colorToRgba(color, alpha * 0.62)
        context.beginPath()
        context.arc(
          anchor.x,
          anchor.y,
          radius * 1.08,
          start + Math.PI,
          start + Math.PI + span * 0.7,
        )
        context.stroke()
      }

      const cross = context.createLinearGradient(
        anchor.x - anchor.radius * 0.62,
        anchor.y,
        anchor.x + anchor.radius * 0.62,
        anchor.y,
      )
      cross.addColorStop(0, colorToRgba(color, 0))
      cross.addColorStop(0.5, colorToRgba(color, 0.09 * strength))
      cross.addColorStop(1, colorToRgba(color, 0))
      context.strokeStyle = cross
      context.beginPath()
      context.moveTo(anchor.x - anchor.radius * 0.62, anchor.y)
      context.lineTo(anchor.x + anchor.radius * 0.62, anchor.y)
      context.stroke()
    })

    context.restore()
  }

  function drawNodes(timeSeconds: number, mood: MoodConfig) {
    nodes.forEach((node, nodeIndex) => {
      const lane = lanes[node.laneIndex]
      if (!lane) return

      const quiet = getQuietFactor(lane.x, node.y)
      const quietScale = 1 - quiet * 0.6
      const interactionBoost = interaction
        ? clamp(
            1 - Math.hypot(lane.x - interaction.x, node.y - interaction.y) / Math.max(interaction.radius, 120),
            0,
            1,
          )
        : 0
      const pulse = (Math.sin(timeSeconds * 2.2 + node.pulse + nodeIndex * 0.3) + 1) * 0.5
      const alpha =
        node.alpha *
        mood.glow *
        quietScale *
        visibilityScale *
        (1 + interactionBoost * 0.62 + scrollEnergy * 0.2 + moodPulse * 0.12)
      const radius = node.radius + pulse * 1.4 + interactionBoost * 1.2
      const wind = sampleWind(lane.x, node.y, timeSeconds, mood, 0.13)
      const nodeX = lane.x + wind.x * 0.26
      const nodeY = node.y + wind.y * 0.1

      const glow = context.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, radius * 6)
      glow.addColorStop(0, `rgba(218, 238, 252, ${0.34 * alpha})`)
      glow.addColorStop(0.35, `rgba(160, 206, 238, ${0.16 * alpha})`)
      glow.addColorStop(1, 'rgba(160, 206, 238, 0)')
      context.fillStyle = glow
      context.beginPath()
      context.arc(nodeX, nodeY, radius * 6, 0, Math.PI * 2)
      context.fill()

      context.fillStyle = `rgba(226, 240, 250, ${0.62 * alpha})`
      context.beginPath()
      context.arc(nodeX, nodeY, radius, 0, Math.PI * 2)
      context.fill()

      if (node.label) {
        context.font = '10px "Azeret Mono", monospace'
        context.fillStyle = `rgba(206, 228, 244, ${0.18 * mood.labels * alpha})`
        context.fillText(node.label, nodeX + 10, nodeY - 8)
      }
    })
  }

  function drawPackets(timeSeconds: number, mood: MoodConfig) {
    packets.forEach((packet) => {
      const lane = lanes[packet.laneIndex]
      if (!lane) return

      const quiet = getQuietFactor(lane.x, packet.y)
      const quietScale = 1 - quiet * 0.56
      const interactionBoost = interaction
        ? clamp(
            1 - Math.hypot(lane.x - interaction.x, packet.y - interaction.y) / Math.max(interaction.radius * 1.2, 120),
            0,
            1,
          )
        : 0
      const alpha =
        packet.alpha *
        mood.glow *
        quietScale *
        visibilityScale *
        (1 +
          interactionBoost * 0.58 +
          scrollEnergy * 0.34 +
          (interactionMode === 'route' ? 0.12 : 0) +
          (mood.packetWeight - 0.7) * 0.34)
      const widthTrail = 2 + interactionBoost * 1.2
      const trailLength =
        packet.size *
        (1.6 + Math.sin(timeSeconds * 2.4 + packet.phase) * 0.16 + scrollEnergy * 0.22)
      const headWind = sampleWind(lane.x, packet.y + packet.size, timeSeconds, mood, 0.16)
      const tailWind = sampleWind(lane.x, packet.y - trailLength, timeSeconds, mood, 0.16)
      const headX = lane.x + headWind.x * 0.34
      const headY = packet.y + packet.size + headWind.y * 0.08
      const tailX = lane.x + tailWind.x * 0.34
      const tailY = packet.y - trailLength + tailWind.y * 0.08

      const trail = context.createLinearGradient(tailX, tailY, headX, headY)
      trail.addColorStop(0, 'rgba(170, 222, 255, 0)')
      trail.addColorStop(0.38, `rgba(170, 222, 255, ${0.16 * alpha})`)
      trail.addColorStop(1, `rgba(224, 240, 252, ${0.84 * alpha})`)

      context.strokeStyle = trail
      context.lineWidth = widthTrail
      context.beginPath()
      context.moveTo(tailX, tailY)
      context.lineTo(headX, headY)
      context.stroke()

      const head = context.createRadialGradient(headX, headY, 0, headX, headY, 10 + interactionBoost * 10)
      head.addColorStop(0, `rgba(235, 244, 252, ${0.76 * alpha})`)
      head.addColorStop(1, 'rgba(235, 244, 252, 0)')
      context.fillStyle = head
      context.beginPath()
      context.arc(headX, headY, 6 + interactionBoost * 3, 0, Math.PI * 2)
      context.fill()
    })
  }

  function drawGlyphs(timeSeconds: number, mood: MoodConfig) {
    context.save()
    context.font = '10px "Azeret Mono", "Cascadia Code", monospace'
    context.textBaseline = 'middle'

    glyphs.forEach((glyph, glyphIndex) => {
      const lane = lanes[glyph.laneIndex]
      if (!lane) return

      const quiet = getQuietFactor(lane.x, glyph.y)
      const quietScale = 1 - quiet * 0.74
      const phase =
        (Math.sin(timeSeconds * 1.4 + glyph.phase + glyphIndex * 0.2) + 1) * 0.5
      const interactionBoost = interaction
        ? clamp(
            1 -
              Math.hypot(lane.x - interaction.x, glyph.y - interaction.y) /
                Math.max(interaction.radius * 1.3, 140),
            0,
            1,
          )
        : 0
      const alpha =
        glyph.alpha *
        mood.labels *
        quietScale *
        visibilityScale *
        (0.72 + phase * 0.36 + interactionBoost * 0.78 + scrollEnergy * 0.18)

      if (alpha < 0.012) return

      const wind = sampleWind(lane.x, glyph.y, timeSeconds, mood, 0.18)
      const glyphX = lane.x + 8 + Math.sin(glyph.phase) * 6 + wind.x * 0.3
      const glyphY = glyph.y + wind.y * 0.08

      context.fillStyle = `rgba(201, 227, 244, ${alpha})`
      context.fillText(glyph.value, glyphX, glyphY)

      if (interactionBoost > 0.2) {
        context.fillStyle = `rgba(239, 247, 252, ${alpha * 0.36})`
        context.fillRect(glyphX - 9, glyphY - 8, 1, 16)
      }
    })

    context.restore()
  }

  function drawWindStreams(timeSeconds: number, mood: MoodConfig) {
    const energy = getInteractionEnergy()
    const idleAlpha = currentMood === 'cover' ? 0.2 : 0.13
    const streamAlpha = clamp(idleAlpha + energy * 0.44, 0.08, 0.86) * visibilityScale

    if (streamAlpha < 0.06) return

    const color = getActiveSignalColor()
    const streamCount = width < 640 ? 5 : energy > 0.7 ? 14 : 9

    context.save()
    context.globalCompositeOperation = 'lighter'
    context.lineWidth = width < 640 ? 0.72 : 0.95

    for (let index = 0; index < streamCount; index += 1) {
      const random = createSeededRandom(hashString(`${currentMood}:wind:${index}`))
      const laneBias = (index + 0.5) / streamCount
      const drift = (timeSeconds * (0.08 + energy * 0.06) + random()) % 1
      const startX =
        (interaction ? interaction.x - interaction.radius * 1.25 : width * (0.1 + laneBias * 0.78)) +
        (random() - 0.5) * (interaction ? interaction.radius * 0.9 : width * 0.16) +
        Math.sin(timeSeconds * 0.42 + index) * (12 + energy * 18)
      const startY =
        (interaction ? interaction.y - interaction.radius * 0.82 : height * (0.1 + ((random() + drift) % 1) * 0.72)) +
        Math.sin(timeSeconds * 0.9 + index) * 28
      const windA = sampleWind(startX, startY, timeSeconds, mood, 0.34)
      const midX = startX + windA.x * (1.2 + energy * 0.55) + 54 + random() * 58
      const midY = startY + windA.y * 0.74 + (random() - 0.5) * 70
      const windB = sampleWind(midX, midY, timeSeconds, mood, 0.28)
      const endX = midX + windB.x * (1.2 + energy * 0.4) + 56
      const endY = midY + windB.y * 0.62 + Math.sin(timeSeconds + index * 0.8) * 28
      const quiet = getQuietFactor(midX, midY)
      const alpha = streamAlpha * (1 - quiet * 0.48) * (0.34 + random() * 0.44)
      const gradient = context.createLinearGradient(startX, startY, endX, endY)

      gradient.addColorStop(0, colorToRgba(color, 0))
      gradient.addColorStop(0.42, colorToRgba(color, alpha))
      gradient.addColorStop(0.74, `rgba(236, 246, 252, ${alpha * 0.72})`)
      gradient.addColorStop(1, colorToRgba(color, 0))

      context.strokeStyle = gradient
      context.beginPath()
      context.moveTo(startX, startY)
      context.bezierCurveTo(
        startX + windA.x * 0.8,
        startY + windA.y * 0.42,
        midX - windB.x * 0.32,
        midY - windB.y * 0.22,
        endX,
        endY,
      )
      context.stroke()
    }

    context.restore()
  }

  function drawQuietZoneEdges(timeSeconds: number, mood: MoodConfig) {
    const energy = getInteractionEnergy()
    const alpha = clamp(0.045 + energy * 0.08 + sectionPulse * 0.08, 0.035, 0.18) * visibilityScale

    if (alpha < 0.035 || quietZones.length === 0) return

    context.save()
    context.globalCompositeOperation = 'lighter'
    context.lineWidth = 1
    context.setLineDash([8, 16])
    context.lineDashOffset = -timeSeconds * (18 + energy * 24)

    quietZones.slice(0, width < 640 ? 5 : 8).forEach((zone, index) => {
      if (
        zone.y > height + 80 ||
        zone.y + zone.height < -80 ||
        zone.x > width + 80 ||
        zone.x + zone.width < -80
      ) {
        return
      }

      const edgeAlpha = alpha * (0.7 + Math.sin(timeSeconds * 0.7 + index) * 0.18) * mood.glow
      const inset = 7
      const radius = clamp(Math.min(zone.width, zone.height) * 0.08, 10, 24)
      const x = zone.x - inset
      const y = zone.y - inset
      const w = zone.width + inset * 2
      const h = zone.height + inset * 2

      context.strokeStyle = colorToRgba(getActiveSignalColor(), edgeAlpha)
      context.beginPath()
      context.roundRect(x, y, w, h, radius)
      context.stroke()
    })

    context.setLineDash([])
    context.restore()
  }

  function updateSignalMembrane(dt: number, timeSeconds: number, mood: MoodConfig) {
    if (membranePoints.length === 0) return

    const powerScale = width < 640 ? 0.48 : width < 960 ? 0.72 : 1

    membranePoints.forEach((point) => {
      const anchorDriftX = Math.sin(timeSeconds * 0.7 + point.phase) * 2.4
      const anchorDriftY = Math.cos(timeSeconds * 0.58 + point.phase) * 1.6

      if (point.pinned) {
        point.px = point.x
        point.py = point.y
        point.x += (point.restX + anchorDriftX - point.x) * 0.22
        point.y += (point.restY + anchorDriftY - point.y) * 0.22
        return
      }

      const vx = (point.x - point.px) * 0.92
      const vy = (point.y - point.py) * 0.9
      const wind = sampleWind(point.x, point.y, timeSeconds, mood, 0.84 * powerScale)
      const quiet = getQuietFactor(point.x, point.y)
      const quietScale = 1 - quiet * 0.4
      const lift =
        Math.sin(timeSeconds * 1.18 + point.phase + point.restX * 0.004) *
        (0.18 + scrollEnergy * 0.42 + sectionPulse * 0.28)

      point.px = point.x
      point.py = point.y
      point.x +=
        vx +
        (point.restX - point.x) * 0.026 +
        wind.x * dt * 0.24 * quietScale +
        lift * 0.46
      point.y +=
        vy +
        (point.restY - point.y) * 0.032 +
        wind.y * dt * 0.16 * quietScale -
        lift * 0.34
    })

    const iterations = width < 640 ? 1 : 2

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      membraneConstraints.forEach((constraint) => {
        const a = membranePoints[constraint.a]
        const b = membranePoints[constraint.b]
        if (!a || !b) return

        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.max(Math.hypot(dx, dy), 0.001)
        const difference = (distance - constraint.rest) / distance
        const stiffness = constraint.axis === 'd' ? 0.18 : 0.42
        const offsetX = dx * difference * stiffness
        const offsetY = dy * difference * stiffness

        if (!a.pinned) {
          a.x += offsetX
          a.y += offsetY
        }

        if (!b.pinned) {
          b.x -= offsetX
          b.y -= offsetY
        }
      })
    }
  }

  function drawSignalSheets(timeSeconds: number, mood: MoodConfig) {
    if (signalSheets.length === 0) return

    context.save()
    context.globalCompositeOperation = 'lighter'

    signalSheets.forEach((sheet, sheetIndex) => {
      const centerX = sheet.x + sheet.width * 0.5
      const centerY = sheet.y + sheet.height * 0.5
      const quiet = getQuietFactor(centerX, centerY)
      const quietScale = 1 - quiet * 0.72
      const alpha =
        sheet.alpha *
        quietScale *
        visibilityScale *
        (0.64 + mood.glow * 0.48 + sectionPulse * 0.28 + scrollEnergy * 0.34)
      const sheetColor = getActiveSignalColor()

      if (alpha < 0.018) return

      const points: Vec2[][] = []

      for (let row = 0; row < sheet.rows; row += 1) {
        const rowPoints: Vec2[] = []
        for (let column = 0; column < sheet.columns; column += 1) {
          rowPoints.push(getSheetPoint(sheet, column, row, timeSeconds, mood))
        }
        points.push(rowPoints)
      }

      for (let row = 0; row < sheet.rows - 1; row += 1) {
        for (let column = 0; column < sheet.columns - 1; column += 1) {
          const pointA = points[row]?.[column]
          const pointB = points[row]?.[column + 1]
          const pointC = points[row + 1]?.[column + 1]
          const pointD = points[row + 1]?.[column]
          if (!pointA || !pointB || !pointC || !pointD) continue

          const cellPulse =
            (Math.sin(timeSeconds * 1.1 + sheet.phase + row * 0.4 + column * 0.3) + 1) *
            0.5
          context.fillStyle = colorToRgba(sheetColor, (0.014 + cellPulse * 0.013) * alpha)
          context.beginPath()
          context.moveTo(pointA.x, pointA.y)
          context.lineTo(pointB.x, pointB.y)
          context.lineTo(pointC.x, pointC.y)
          context.lineTo(pointD.x, pointD.y)
          context.closePath()
          context.fill()
        }
      }

      context.lineWidth = width < 640 ? 0.55 : 0.8
      context.strokeStyle = colorToRgba(sheetColor, 0.078 * alpha)

      for (let row = 0; row < sheet.rows; row += 1) {
        const rowPoints = points[row]
        if (!rowPoints) continue

        context.beginPath()
        rowPoints.forEach((point, pointIndex) => {
          if (pointIndex === 0) {
            context.moveTo(point.x, point.y)
          } else {
            context.lineTo(point.x, point.y)
          }
        })
        context.stroke()
      }

      for (let column = 0; column < sheet.columns; column += 1) {
        context.beginPath()
        for (let row = 0; row < sheet.rows; row += 1) {
          const point = points[row]?.[column]
          if (!point) continue
          if (row === 0) {
            context.moveTo(point.x, point.y)
          } else {
            context.lineTo(point.x, point.y)
          }
        }
        context.stroke()
      }

      const brightRow = Math.floor(
        ((timeSeconds * (0.28 + scrollEnergy * 0.2) + sheetIndex * 0.37) % 1) *
          (sheet.rows - 1),
      )
      const brightPoints = points[brightRow]

      if (brightPoints) {
        context.strokeStyle = colorToRgba(sheetColor, 0.15 * alpha)
        context.lineWidth = width < 640 ? 0.8 : 1.1
        context.beginPath()
        brightPoints.forEach((point, pointIndex) => {
          if (pointIndex === 0) {
            context.moveTo(point.x, point.y)
          } else {
            context.lineTo(point.x, point.y)
          }
        })
        context.stroke()
      }
    })

    context.restore()
  }

  function getSheetPoint(
    sheet: SignalSheet,
    column: number,
    row: number,
    timeSeconds: number,
    mood: MoodConfig,
  ): Vec2 {
    const xRatio = column / Math.max(sheet.columns - 1, 1)
    const yRatio = row / Math.max(sheet.rows - 1, 1)
    const baseX = sheet.x + sheet.width * xRatio
    const baseY = sheet.y + sheet.height * yRatio
    const wind = sampleWind(baseX, baseY, timeSeconds, mood, 0.18)
    const curl =
      Math.sin(timeSeconds * 0.82 + sheet.phase + xRatio * 3.2 + yRatio * 2.4) *
      sheet.curl
    const shear =
      Math.sin(timeSeconds * 0.46 + sheet.seed + yRatio * 5.6) *
      (6 + scrollEnergy * 8 + sectionPulse * 7)
    const lift =
      Math.cos(timeSeconds * 0.72 + sheet.phase + xRatio * 4.2) *
      (4 + scrollEnergy * 6)

    return {
      x: baseX + wind.x * 0.28 + shear * yRatio + curl * 4,
      y: baseY + wind.y * 0.1 - lift * (1 - Math.abs(xRatio - 0.5) * 0.7),
    }
  }

  function drawSignalMembrane(timeSeconds: number, mood: MoodConfig) {
    if (membranePoints.length === 0 || membraneConstraints.length === 0) return

    const interactionEnergy = getInteractionEnergy()
    const activeColor = getActiveSignalColor()
    const baseAlpha =
      (currentMood === 'cover' ? 0.148 : currentMood === 'archive' ? 0.108 : 0.092) *
      mood.glow *
      visibilityScale *
      (width < 640 ? 0.5 : 1) *
      (1 + scrollEnergy * 0.56 + sectionPulse * 0.5 + interactionEnergy * 0.34)

    context.save()
    context.globalCompositeOperation = 'lighter'

    membraneConstraints.forEach((constraint, constraintIndex) => {
      if (constraint.axis === 'd' && constraintIndex % 4 !== 0) return

      const from = membranePoints[constraint.a]
      const to = membranePoints[constraint.b]
      if (!from || !to) return

      const midX = (from.x + to.x) * 0.5
      const midY = (from.y + to.y) * 0.5
      const quiet = getQuietFactor(midX, midY)
      const axisAlpha =
        constraint.axis === 'd' ? 0.36 : constraint.axis === 'x' ? 0.84 : 0.58
      const pulse =
        (Math.sin(timeSeconds * 1.2 + constraintIndex * 0.11 + moodPulse) + 1) * 0.5
      const restDelta = Math.abs(Math.hypot(to.x - from.x, to.y - from.y) - constraint.rest) /
        Math.max(constraint.rest, 1)
      const interactionBoost = interaction
        ? clamp(
            1 - Math.hypot(midX - interaction.x, midY - interaction.y) / Math.max(interaction.radius * 1.35, 150),
            0,
            1,
          )
        : 0
      const edgeBoost = quiet > 0.16 && quiet < 0.92 ? 0.28 : 0
      const alpha =
        baseAlpha *
        axisAlpha *
        (1 - quiet * 0.48) *
        (0.58 + pulse * 0.52 + restDelta * 1.8 + interactionBoost * 0.72 + edgeBoost)

      if (alpha < 0.004) return

      context.strokeStyle = colorToRgba(activeColor, alpha)
      context.lineWidth = constraint.axis === 'd' ? 0.45 : 0.74 + interactionBoost * 0.34
      context.beginPath()
      context.moveTo(from.x, from.y)
      context.lineTo(to.x, to.y)
      context.stroke()
    })

    context.lineWidth = width < 640 ? 0.8 : 1.15

    for (let index = 0; index < membraneConstraints.length; index += 17) {
      const constraint = membraneConstraints[index]
      if (!constraint || constraint.axis !== 'x') continue

      const from = membranePoints[constraint.a]
      const to = membranePoints[constraint.b]
      if (!from || !to) continue

      const progress = (timeSeconds * 0.18 + index * 0.013) % 1
      const x = from.x + (to.x - from.x) * progress
      const y = from.y + (to.y - from.y) * progress
      const quiet = getQuietFactor(x, y)
      const interactionBoost = interaction
        ? clamp(1 - Math.hypot(x - interaction.x, y - interaction.y) / Math.max(interaction.radius * 1.6, 160), 0, 1)
        : 0
      const alpha = baseAlpha * (1 - quiet * 0.62) * (1.8 + interactionBoost * 1.6)

      context.strokeStyle = interactionBoost > 0.08
        ? colorToRgba(activeColor, alpha)
        : `rgba(238, 248, 252, ${alpha})`
      context.beginPath()
      context.moveTo(x - 8, y)
      context.lineTo(x + 18, y + Math.sin(timeSeconds + index) * 2)
      context.stroke()
    }

    context.restore()
  }

  function drawImpulses() {
    impulses.forEach((impulse) => {
      const duration = impulse.kind === 'click' ? 0.72 : impulse.kind === 'section' ? 0.96 : 0.48
      const progress = clamp(impulse.age / duration, 0, 1)
      const fade = 1 - progress
      const radius =
        impulse.kind === 'click'
          ? 30 + progress * 220 * impulse.strength
          : impulse.kind === 'section'
            ? 120 + progress * 280 * impulse.strength
            : 46 + progress * 130 * impulse.strength

      const fill = context.createRadialGradient(impulse.x, impulse.y, 0, impulse.x, impulse.y, radius)
      fill.addColorStop(0, `rgba(220, 239, 252, ${0.12 * fade * impulse.strength})`)
      fill.addColorStop(0.36, `rgba(173, 215, 244, ${0.05 * fade * impulse.strength})`)
      fill.addColorStop(1, 'rgba(173, 215, 244, 0)')
      context.fillStyle = fill
      context.beginPath()
      context.arc(impulse.x, impulse.y, radius, 0, Math.PI * 2)
      context.fill()

      context.strokeStyle = `rgba(220, 239, 252, ${0.18 * fade * impulse.strength})`
      context.lineWidth = impulse.kind === 'click' ? 1.6 : 1
      context.beginPath()
      context.arc(impulse.x, impulse.y, radius * (0.62 + progress * 0.18), 0, Math.PI * 2)
      context.stroke()
    })
  }

  function drawInteractionLens() {
    if (!interaction) return

    const lens = context.createRadialGradient(
      interaction.x,
      interaction.y,
      interaction.radius * 0.08,
      interaction.x,
      interaction.y,
      interaction.radius,
    )
    const color = getActiveSignalColor()

    lens.addColorStop(0, colorToRgba(color, 0.14))
    lens.addColorStop(0.34, colorToRgba(color, 0.086))
    lens.addColorStop(1, colorToRgba(color, 0))

    context.fillStyle = lens
    context.beginPath()
    context.arc(interaction.x, interaction.y, interaction.radius, 0, Math.PI * 2)
    context.fill()

    context.strokeStyle = colorToRgba(color, 0.18)
    context.lineWidth = 1.1
    context.beginPath()
    context.arc(interaction.x, interaction.y, interaction.radius * 0.72, 0, Math.PI * 2)
    context.stroke()
  }

  function updatePackets(dt: number, timeSeconds: number, mood: MoodConfig) {
    packets.forEach((packet, packetIndex) => {
      const flowBoost =
        1 +
        scrollEnergy * 1.12 +
        (interactionMode === 'feed' ? 0.18 : interactionMode === 'route' ? 0.12 : 0) +
        (mood.packetWeight - 0.7) * 0.16

      packet.y += packet.speed * flowBoost * dt
      packet.y += Math.sin(timeSeconds * 2 + packet.phase + packetIndex * 0.2) * 0.25

      if (packet.y - packet.size > height + 28) {
        packet.y = -packet.size - Math.random() * 120
      }
    })
  }

  function updateGlyphs(dt: number, timeSeconds: number, mood: MoodConfig) {
    glyphs.forEach((glyph, glyphIndex) => {
      const lane = lanes[glyph.laneIndex]
      const laneSpeed = lane?.speed ?? 80
      const flowBoost =
        1 +
        scrollEnergy * 0.5 +
        (interactionMode === 'route' ? 0.18 : interactionMode === 'feed' ? 0.12 : 0)

      glyph.y += (glyph.speed + laneSpeed * 0.02) * flowBoost * dt
      glyph.y += Math.sin(timeSeconds * 1.2 + glyph.phase + glyphIndex * 0.12) * 0.08

      if (glyph.y > height + 28) {
        glyph.y = -18 - Math.random() * 90
        glyph.value = randomItem([...mood.labelPool, ...mood.bridgePool])
      }
    })
  }

  let previousTime = performance.now()

  function ensureFrame() {
    if (rafId || isSuspended || document.hidden) return

    previousTime = performance.now()
    lastPaintTime = 0
    rafId = window.requestAnimationFrame(frame)
  }

  function frame(now: number) {
    if (isSuspended || document.hidden) {
      rafId = 0
      return
    }

    const activeFrame =
      now < activityUntil ||
      interaction !== null ||
      interactionMode !== 'idle' ||
      impulses.length > 0 ||
      scrollEnergy > 0.015 ||
      scrollEnergyTarget > 0.015 ||
      sectionPulse > 0.02 ||
      moodPulse > 0.08
    const calmMode = document.body.classList.contains('is-signal-calm')
    const idleStopDelay = calmMode ? 1800 : 2600

    if (!activeFrame) {
      idleSince ||= now

      if (now - idleSince > idleStopDelay) {
        rafId = 0
        lastPaintTime = 0
        return
      }
    } else {
      idleSince = 0
    }

    const targetInterval = activeFrame
      ? width < 640
        ? 1000 / 36
        : calmMode
          ? 1000 / 30
          : 1000 / 60
      : calmMode
        ? 1000 / 8
        : 1000 / 16

    if (lastPaintTime > 0 && now - lastPaintTime < targetInterval) {
      rafId = window.requestAnimationFrame(frame)
      return
    }

    lastPaintTime = now

    const dt = Math.min((now - previousTime) / 1000, 0.05)
    previousTime = now

    const mood = moodMap[currentMood]
    const timeSeconds = now / 1000
    const detailedFrame = activeFrame || !calmMode

    if (detailedFrame) {
      updatePackets(dt, timeSeconds, mood)
      updateGlyphs(dt, timeSeconds, mood)
      updateSignalMembrane(dt, timeSeconds, mood)
    }
    scrollEnergy += (scrollEnergyTarget - scrollEnergy) * 0.12

    context.clearRect(0, 0, width, height)
    drawAtmosphericDepth(timeSeconds, mood)
    drawGrid(timeSeconds, mood)
    drawScanner(timeSeconds, mood)
    drawSignalRibbons(timeSeconds, mood)
    if (detailedFrame) {
      drawSignalSheets(timeSeconds, mood)
      drawWindStreams(timeSeconds, mood)
    }
    drawSignalMembrane(timeSeconds, mood)
    drawQuietZoneEdges(timeSeconds, mood)
    if (detailedFrame) {
      drawTelemetrySweep(timeSeconds, mood)
      drawLanes(timeSeconds, mood)
      drawBridges(timeSeconds, mood)
      drawGlyphs(timeSeconds, mood)
      drawPackets(timeSeconds, mood)
      drawInteractionField(timeSeconds, mood)
      drawSignalGates(timeSeconds, mood)
      drawNodes(timeSeconds, mood)
      drawImpulses()
      drawInteractionLens()
    }

    context.fillStyle = `rgba(176, 214, 240, ${0.018 * mood.grid * visibilityScale})`
    context.fillRect(0, 0, width, 1)

    impulses = impulses
      .map((impulse) => ({ ...impulse, age: impulse.age + dt }))
      .filter((impulse) => impulse.age < (impulse.kind === 'section' ? 0.96 : impulse.kind === 'click' ? 0.72 : 0.48))

    moodPulse = Math.max(0, moodPulse - dt * 0.6)
    sectionPulse = Math.max(0, sectionPulse - dt * 1.2)
    scrollEnergyTarget = Math.max(0, scrollEnergyTarget - dt * 0.42)
    visibilityScale += (1 - visibilityScale) * 0.06

    rafId = window.requestAnimationFrame(frame)
  }

  function handlePointerMove(event: PointerEvent) {
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.active = true
    markActive(900)
  }

  function handlePointerDown(event: PointerEvent) {
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.active = true
    markActive(1500)

    if (
      event.target instanceof Element &&
      event.target.closest('[data-interactive-lens]')
    ) {
      return
    }

    pushImpulse({ x: event.clientX, y: event.clientY, strength: 0.82, kind: 'click' })
  }

  function handlePointerLeave() {
    pointer.active = false
  }

  function handleVisibility() {
    isSuspended = document.hidden

    if (document.hidden) {
      visibilityScale = 0.18
      if (rafId) {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      }
      return
    }

    visibilityScale = 1
    previousTime = performance.now()
    lastPaintTime = 0
    idleSince = 0
    markActive(1200)

    ensureFrame()
  }

  function handleSignalMode(event: Event) {
    const detail = (event as CustomEvent<{ mode?: string }>).detail

    if (detail?.mode === 'calm') {
      activityUntil = performance.now() + 220
      scrollEnergyTarget = 0
      scrollEnergy = 0
      impulses = []
      interaction = null
      interactionMode = 'idle'
    } else if (detail?.mode === 'storm') {
      markActive(1800)
    }
  }

  function pushImpulse(input: ImpulseInput) {
    markActive(input.kind === 'section' ? 1700 : input.kind === 'click' ? 1300 : 900)

    impulses.push({
      x: input.x,
      y: input.y,
      strength: clamp(input.strength, 0.18, 1.2),
      kind: input.kind,
      age: 0,
    })

    if (input.kind === 'section') {
      sectionPulse = 1
    }

    if (impulses.length > 14) {
      impulses = impulses.slice(-14)
    }
  }

  resize()

  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointerleave', handlePointerLeave)
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('feian:signal-mode', handleSignalMode)

  rafId = window.requestAnimationFrame(frame)

  return {
    setMood(mood: Mood) {
      if (currentMood === mood) return
      currentMood = mood
      buildTopology()
      moodPulse = 1
      markActive(1200)
    },
    setInteraction(target: InteractionTarget) {
      interaction = target
      markActive(1100)
    },
    setInteractionMode(mode: InteractionMode) {
      interactionMode = mode
      if (mode !== 'idle') markActive(1100)
    },
    clearInteraction() {
      interaction = null
      ensureFrame()
    },
    setScrollEnergy(value: number) {
      scrollEnergyTarget = clamp(value, 0, 1.2)
      if (value > 0.02) {
        markActive(900)
      } else {
        ensureFrame()
      }
    },
    setQuietZones(zones: QuietZone[]) {
      quietZones = zones.filter((zone) => (
        zone.width > 8 &&
        zone.height > 8 &&
        zone.y < height + 220 &&
        zone.y + zone.height > -220 &&
        zone.x < width + 220 &&
        zone.x + zone.width > -220
      ))
    },
    pushImpulse,
    destroy() {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerleave', handlePointerLeave)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('feian:signal-mode', handleSignalMode)
    },
  }
}
