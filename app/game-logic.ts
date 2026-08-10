export const GROUND_ROWS = 12;
export const UNDERGROUND_ROWS = 6;
export const COLS = 6;

export const FLOWER_COLORS = ["yellow", "pink", "purple"] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];
export type GroundCell = FlowerColor | null;
export type GroundBoard = GroundCell[][];

export type PeanutType = "standard";
export type Peanut = { type: PeanutType };
export type UndergroundCell = Peanut | null;
export type UndergroundBoard = UndergroundCell[][];

export type GameStatus = "playing" | "gameover";
export type Pair = readonly [FlowerColor, FlowerColor];

export type ActivePair = {
  colors: Pair;
  x: number;
  y: number;
  rotation: 0 | 1 | 2 | 3;
};

export type PairCell = {
  x: number;
  y: number;
  color: FlowerColor;
};

export type ClearedCell = PairCell;

export type ResolveResult = {
  board: GroundBoard;
  points: number;
  chains: number;
  firstClearCells: ClearedCell[];
  steps: ResolutionStep[];
};

export type ResolutionStep = {
  clearCells: ClearedCell[];
  boardAfterClear: GroundBoard;
  boardAfterGravity: GroundBoard;
};

export type GrowthTarget = {
  column: number;
  row: number;
  sourceX: number;
  sourceY: number;
};

export type GrowthEffect = GrowthTarget & { id: number };

export type PendingResolution = {
  id: number;
  steps: ResolutionStep[];
  stepIndex: number;
  phase: "clear" | "gravity";
  growthTarget: GrowthTarget | null;
};

export type GameState = {
  groundBoard: GroundBoard;
  undergroundBoard: UndergroundBoard;
  activePair: ActivePair | null;
  nextPair: Pair;
  score: number;
  chainCount: number;
  gameStatus: GameStatus;
  growthEffect: GrowthEffect | null;
  growthSequence: number;
  pendingGameOver: boolean;
  pendingResolution: PendingResolution | null;
  resolutionSequence: number;
};

export type GameAction =
  | { type: "TICK" }
  | { type: "MOVE"; dx: -1 | 1 }
  | { type: "ROTATE" }
  | { type: "HARD_DROP" }
  | { type: "ADVANCE_RESOLUTION"; id: number }
  | { type: "FINISH_GROWTH"; id: number }
  | { type: "RESET" };

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

export function createGroundBoard(): GroundBoard {
  return Array.from({ length: GROUND_ROWS }, () =>
    Array<GroundCell>(COLS).fill(null),
  );
}

export function createUndergroundBoard(): UndergroundBoard {
  return Array.from({ length: UNDERGROUND_ROWS }, () =>
    Array<UndergroundCell>(COLS).fill(null),
  );
}

export function randomPair(random = Math.random): Pair {
  const pick = () =>
    FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)] ?? "yellow";
  return [pick(), pick()];
}

export function spawnPair(colors: Pair): ActivePair {
  return { colors, x: 2, y: 1, rotation: 0 };
}

export function getPairCells(pair: ActivePair): PairCell[] {
  const offset = OFFSETS[pair.rotation];
  return [
    { x: pair.x, y: pair.y, color: pair.colors[0] },
    { x: pair.x + offset.x, y: pair.y + offset.y, color: pair.colors[1] },
  ];
}

export function canPlace(board: GroundBoard, pair: ActivePair): boolean {
  return getPairCells(pair).every(
    ({ x, y }) =>
      x >= 0 &&
      x < COLS &&
      y >= 0 &&
      y < GROUND_ROWS &&
      board[y][x] === null,
  );
}

function findClearGroups(board: GroundBoard): ClearedCell[][] {
  const groups: ClearedCell[][] = [];
  const visited = new Set<string>();
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (let y = 0; y < GROUND_ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const color = board[y][x];
      const startKey = `${x},${y}`;
      if (!color || visited.has(startKey)) continue;

      const group: ClearedCell[] = [];
      const queue: Array<[number, number]> = [[x, y]];
      visited.add(startKey);

      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        group.push({ x: cx, y: cy, color });
        for (const [dx, dy] of directions) {
          const nx = cx + dx;
          const ny = cy + dy;
          const key = `${nx},${ny}`;
          if (
            nx >= 0 &&
            nx < COLS &&
            ny >= 0 &&
            ny < GROUND_ROWS &&
            !visited.has(key) &&
            board[ny][nx] === color
          ) {
            visited.add(key);
            queue.push([nx, ny]);
          }
        }
      }

      if (group.length >= 4) {
        groups.push(group);
      }
    }
  }

  return groups;
}

function findTriggeredClearCells(
  board: GroundBoard,
  triggerCells: Array<Pick<PairCell, "x" | "y">>,
): ClearedCell[] {
  const triggerKeys = new Set(triggerCells.map(({ x, y }) => `${x},${y}`));
  return findClearGroups(board)
    .filter((group) =>
      group.some(({ x, y }) => triggerKeys.has(`${x},${y}`)),
    )
    .flat();
}

function applyGravity(board: GroundBoard): {
  board: GroundBoard;
  movedCells: Array<Pick<PairCell, "x" | "y">>;
} {
  const result = createGroundBoard();
  const movedCells: Array<Pick<PairCell, "x" | "y">> = [];
  for (let x = 0; x < COLS; x += 1) {
    const flowers: Array<{ color: FlowerColor; sourceY: number }> = [];
    for (let y = GROUND_ROWS - 1; y >= 0; y -= 1) {
      const cell = board[y][x];
      if (cell) flowers.push({ color: cell, sourceY: y });
    }
    flowers.forEach(({ color, sourceY }, index) => {
      const destinationY = GROUND_ROWS - 1 - index;
      result[destinationY][x] = color;
      if (sourceY !== destinationY) {
        movedCells.push({ x, y: destinationY });
      }
    });
  }
  return { board: result, movedCells };
}

function resolveFromFirstClear(
  board: GroundBoard,
  initialClear: ClearedCell[],
): ResolveResult {
  let current = board.map((row) => [...row]);
  let points = 0;
  let chains = 0;
  let firstClearCells: ClearedCell[] = [];
  const steps: ResolutionStep[] = [];
  let clear = initialClear;

  while (clear.length > 0) {
    chains += 1;
    if (chains === 1) firstClearCells = clear;
    points += clear.length * 100 * chains;
    clear.forEach(({ x, y }) => {
      current[y][x] = null;
    });
    const boardAfterClear = current.map((row) => [...row]);
    const gravity = applyGravity(current);
    current = gravity.board;
    steps.push({
      clearCells: clear,
      boardAfterClear,
      boardAfterGravity: current.map((row) => [...row]),
    });
    clear = findTriggeredClearCells(current, gravity.movedCells);
  }

  return { board: current, points, chains, firstClearCells, steps };
}

export function resolveBoard(board: GroundBoard): ResolveResult {
  return resolveFromFirstClear(board, findClearGroups(board).flat());
}

export function resolveAfterLanding(
  board: GroundBoard,
  landedCells: PairCell[],
): ResolveResult {
  return resolveFromFirstClear(
    board,
    findTriggeredClearCells(board, landedCells),
  );
}

export function hardDropPair(board: GroundBoard, pair: ActivePair): ActivePair {
  let dropped = pair;
  while (canPlace(board, { ...dropped, y: dropped.y + 1 })) {
    dropped = { ...dropped, y: dropped.y + 1 };
  }
  return dropped;
}

export function getLandedPairCells(
  board: GroundBoard,
  pair: ActivePair,
): PairCell[] {
  const cells = getPairCells(pair);
  if (pair.rotation === 0 || pair.rotation === 2) return cells;

  return cells.map((cell) => {
    let y = cell.y;
    while (y + 1 < GROUND_ROWS && board[y + 1][cell.x] === null) {
      y += 1;
    }
    return { ...cell, y };
  });
}

function lockPairCells(board: GroundBoard, cells: PairCell[]): GroundBoard {
  const locked = board.map((row) => [...row]);
  cells.forEach(({ x, y, color }) => {
    locked[y][x] = color;
  });
  return locked;
}

export function findUndergroundSlot(
  board: UndergroundBoard,
  column: number,
): number | null {
  for (let row = UNDERGROUND_ROWS - 1; row >= 0; row -= 1) {
    if (board[row][column] === null) return row;
  }
  return null;
}

export function selectGrowthTarget(
  landedCells: PairCell[],
  firstClearCells: ClearedCell[],
  undergroundBoard: UndergroundBoard,
): GrowthTarget | null {
  const clearedKeys = new Set(
    firstClearCells.map(({ x, y }) => `${x},${y}`),
  );
  // getPairCells() always returns the rotation-center flower first.
  const source = landedCells.find(({ x, y }) => clearedKeys.has(`${x},${y}`));
  if (!source) return null;

  const row = findUndergroundSlot(undergroundBoard, source.x);
  if (row === null) return null;
  return {
    column: source.x,
    row,
    sourceX: source.x,
    sourceY: source.y,
  };
}

export function addPeanut(
  board: UndergroundBoard,
  target: GrowthTarget,
): UndergroundBoard {
  const result = board.map((row) => [...row]);
  result[target.row][target.column] = { type: "standard" };
  return result;
}

export function predictGrowthTarget(
  groundBoard: GroundBoard,
  undergroundBoard: UndergroundBoard,
  activePair: ActivePair | null,
): GrowthTarget | null {
  if (!activePair) return null;
  const dropped = hardDropPair(groundBoard, activePair);
  const landedCells = getLandedPairCells(groundBoard, dropped);
  const resolved = resolveAfterLanding(
    lockPairCells(groundBoard, landedCells),
    landedCells,
  );
  return selectGrowthTarget(
    landedCells,
    resolved.firstClearCells,
    undergroundBoard,
  );
}

export function createInitialState(random = Math.random): GameState {
  const first = randomPair(random);
  return {
    groundBoard: createGroundBoard(),
    undergroundBoard: createUndergroundBoard(),
    activePair: spawnPair(first),
    nextPair: randomPair(random),
    score: 0,
    chainCount: 0,
    gameStatus: "playing",
    growthEffect: null,
    growthSequence: 0,
    pendingGameOver: false,
    pendingResolution: null,
    resolutionSequence: 0,
  };
}

function finishTurn(
  state: GameState,
  board: GroundBoard,
  growthTarget: GrowthTarget | null,
): GameState {
  const undergroundBoard = growthTarget
    ? addPeanut(state.undergroundBoard, growthTarget)
    : state.undergroundBoard;
  const nextActive = spawnPair(state.nextPair);
  const canSpawn = canPlace(board, nextActive);
  const growthSequence = growthTarget
    ? state.growthSequence + 1
    : state.growthSequence;

  return {
    ...state,
    groundBoard: board,
    undergroundBoard,
    activePair: canSpawn ? nextActive : null,
    nextPair: randomPair(),
    gameStatus: growthTarget || canSpawn ? "playing" : "gameover",
    growthEffect: growthTarget
      ? { ...growthTarget, id: growthSequence }
      : null,
    growthSequence,
    pendingGameOver: Boolean(growthTarget && !canSpawn),
    pendingResolution: null,
  };
}

function settlePair(state: GameState, pair: ActivePair): GameState {
  const landedCells = getLandedPairCells(state.groundBoard, pair);
  const lockedBoard = lockPairCells(state.groundBoard, landedCells);
  const resolved = resolveAfterLanding(
    lockedBoard,
    landedCells,
  );
  const growthTarget = selectGrowthTarget(
    landedCells,
    resolved.firstClearCells,
    state.undergroundBoard,
  );
  if (resolved.steps.length === 0) {
    return finishTurn(
      { ...state, chainCount: 0 },
      lockedBoard,
      null,
    );
  }

  const resolutionSequence = state.resolutionSequence + 1;
  return {
    ...state,
    groundBoard: lockedBoard,
    activePair: null,
    chainCount: 0,
    pendingResolution: {
      id: resolutionSequence,
      steps: resolved.steps,
      stepIndex: 0,
      phase: "clear",
      growthTarget,
    },
    resolutionSequence,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESET") return createInitialState();

  if (action.type === "FINISH_GROWTH") {
    if (!state.growthEffect || state.growthEffect.id !== action.id) return state;
    return {
      ...state,
      growthEffect: null,
      pendingGameOver: false,
      gameStatus: state.pendingGameOver ? "gameover" : "playing",
    };
  }

  if (action.type === "ADVANCE_RESOLUTION") {
    const pending = state.pendingResolution;
    if (!pending || pending.id !== action.id) return state;
    const step = pending.steps[pending.stepIndex];

    if (pending.phase === "clear") {
      const chain = pending.stepIndex + 1;
      return {
        ...state,
        groundBoard: step.boardAfterClear,
        score: state.score + step.clearCells.length * 100 * chain,
        chainCount: chain,
        pendingResolution: { ...pending, phase: "gravity" },
      };
    }

    const nextIndex = pending.stepIndex + 1;
    if (nextIndex < pending.steps.length) {
      return {
        ...state,
        groundBoard: step.boardAfterGravity,
        pendingResolution: {
          ...pending,
          stepIndex: nextIndex,
          phase: "clear",
        },
      };
    }

    return finishTurn(state, step.boardAfterGravity, pending.growthTarget);
  }

  if (
    state.gameStatus !== "playing" ||
    !state.activePair ||
    state.growthEffect ||
    state.pendingResolution
  ) {
    return state;
  }

  const pair = state.activePair;

  if (action.type === "MOVE") {
    const moved = { ...pair, x: pair.x + action.dx };
    return canPlace(state.groundBoard, moved)
      ? { ...state, activePair: moved }
      : state;
  }

  if (action.type === "ROTATE") {
    const rotation = ((pair.rotation + 1) % 4) as ActivePair["rotation"];
    for (const kick of [0, -1, 1]) {
      const rotated = { ...pair, rotation, x: pair.x + kick };
      if (canPlace(state.groundBoard, rotated)) {
        return { ...state, activePair: rotated };
      }
    }
    return state;
  }

  if (action.type === "HARD_DROP") {
    return settlePair(state, hardDropPair(state.groundBoard, pair));
  }

  const movedDown = { ...pair, y: pair.y + 1 };
  return canPlace(state.groundBoard, movedDown)
    ? { ...state, activePair: movedDown }
    : settlePair(state, pair);
}
