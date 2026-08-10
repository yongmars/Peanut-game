export const GROUND_ROWS = 12;
export const UNDERGROUND_ROWS = 6;
export const COLS = 6;

export const FLOWER_COLORS = ["yellow", "pink", "purple"] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];
export type Cell = FlowerColor | null;
export type Board = Cell[][];
export type GameStatus = "playing" | "gameover";

export type Pair = readonly [FlowerColor, FlowerColor];

export type ActivePair = {
  colors: Pair;
  x: number;
  y: number;
  rotation: 0 | 1 | 2 | 3;
};

export type GameState = {
  groundBoard: Board;
  undergroundBoard: Board;
  activePair: ActivePair | null;
  nextPair: Pair;
  score: number;
  chainCount: number;
  gameStatus: GameStatus;
};

export type GameAction =
  | { type: "TICK" }
  | { type: "MOVE"; dx: -1 | 1 }
  | { type: "ROTATE" }
  | { type: "HARD_DROP" }
  | { type: "RESET" };

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

export function createBoard(rows: number): Board {
  return Array.from({ length: rows }, () => Array<Cell>(COLS).fill(null));
}

export function randomPair(random = Math.random): Pair {
  const pick = () =>
    FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)] ?? "yellow";
  return [pick(), pick()];
}

export function spawnPair(colors: Pair): ActivePair {
  return { colors, x: 2, y: 1, rotation: 0 };
}

export function getPairCells(pair: ActivePair) {
  const offset = OFFSETS[pair.rotation];
  return [
    { x: pair.x, y: pair.y, color: pair.colors[0] },
    { x: pair.x + offset.x, y: pair.y + offset.y, color: pair.colors[1] },
  ];
}

export function canPlace(board: Board, pair: ActivePair): boolean {
  return getPairCells(pair).every(
    ({ x, y }) =>
      x >= 0 &&
      x < COLS &&
      y >= 0 &&
      y < GROUND_ROWS &&
      board[y][x] === null,
  );
}

function findClearCells(board: Board): Set<string> {
  const clear = new Set<string>();
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

      const group: Array<[number, number]> = [];
      const queue: Array<[number, number]> = [[x, y]];
      visited.add(startKey);

      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        group.push([cx, cy]);
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
        group.forEach(([gx, gy]) => clear.add(`${gx},${gy}`));
      }
    }
  }

  return clear;
}

function applyGravity(board: Board): Board {
  const result = createBoard(GROUND_ROWS);
  for (let x = 0; x < COLS; x += 1) {
    const flowers: FlowerColor[] = [];
    for (let y = GROUND_ROWS - 1; y >= 0; y -= 1) {
      const cell = board[y][x];
      if (cell) flowers.push(cell);
    }
    flowers.forEach((flower, index) => {
      result[GROUND_ROWS - 1 - index][x] = flower;
    });
  }
  return result;
}

export function resolveBoard(board: Board): {
  board: Board;
  points: number;
  chains: number;
} {
  let current = board.map((row) => [...row]);
  let points = 0;
  let chains = 0;

  while (true) {
    const clear = findClearCells(current);
    if (clear.size === 0) break;
    chains += 1;
    points += clear.size * 100 * chains;
    clear.forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      current[y][x] = null;
    });
    current = applyGravity(current);
  }

  return { board: current, points, chains };
}

export function createInitialState(random = Math.random): GameState {
  const first = randomPair(random);
  const activePair = spawnPair(first);
  return {
    groundBoard: createBoard(GROUND_ROWS),
    undergroundBoard: createBoard(UNDERGROUND_ROWS),
    activePair,
    nextPair: randomPair(random),
    score: 0,
    chainCount: 0,
    gameStatus: "playing",
  };
}

function settlePair(state: GameState, pair: ActivePair): GameState {
  const locked = state.groundBoard.map((row) => [...row]);
  getPairCells(pair).forEach(({ x, y, color }) => {
    locked[y][x] = color;
  });

  const resolved = resolveBoard(locked);
  const nextActive = spawnPair(state.nextPair);
  const canSpawn = canPlace(resolved.board, nextActive);

  return {
    ...state,
    groundBoard: resolved.board,
    activePair: canSpawn ? nextActive : null,
    nextPair: randomPair(),
    score: state.score + resolved.points,
    chainCount: resolved.chains,
    gameStatus: canSpawn ? "playing" : "gameover",
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESET") return createInitialState();
  if (state.gameStatus !== "playing" || !state.activePair) return state;

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
    let dropped = pair;
    while (canPlace(state.groundBoard, { ...dropped, y: dropped.y + 1 })) {
      dropped = { ...dropped, y: dropped.y + 1 };
    }
    return settlePair(state, dropped);
  }

  const movedDown = { ...pair, y: pair.y + 1 };
  return canPlace(state.groundBoard, movedDown)
    ? { ...state, activePair: movedDown }
    : settlePair(state, pair);
}
