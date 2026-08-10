import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUndergroundGravity,
  canPlace,
  createGroundBoard,
  createInitialState,
  createUndergroundBoard,
  findHarvestGroups,
  findUndergroundSlots,
  gameReducer,
  getLandedPairCells,
  predictGrowthTarget,
  resolveUndergroundBoard,
  resolveAfterLanding,
  resolveBoard,
  spawnPair,
  HARVEST_SCORE_PER_PEANUT,
} from "../app/game-logic.ts";

function makeState(overrides = {}) {
  return { ...createInitialState(() => 0), ...overrides };
}

function peanutCount(board) {
  return board.flat().filter(Boolean).length;
}

function placePeanuts(board, cells) {
  cells.forEach(([x, y]) => {
    board[y][x] = { type: "standard" };
  });
  return board;
}

function finishResolution(state) {
  let current = state;
  let guard = 0;
  while (current.pendingResolution) {
    guard += 1;
    assert.ok(guard < 30, "resolution should finish");
    current = current.harvestEffect
      ? gameReducer(current, {
          type: "FINISH_HARVEST",
          id: current.harvestEffect.id,
        })
      : current.growthEffect
        ? gameReducer(current, {
          type: "FINISH_GROWTH",
          id: current.growthEffect.id,
        })
        : gameReducer(current, {
            type: "ADVANCE_RESOLUTION",
            id: current.pendingResolution.id,
          });
  }
  return current;
}

test("underground groups use orthogonal connections and harvest every member", () => {
  const board = placePeanuts(createUndergroundBoard(), [
    [1, 5],
    [1, 4],
    [2, 4],
    [3, 4],
  ]);
  assert.equal(findHarvestGroups(board).length, 1);
  assert.equal(findHarvestGroups(board)[0].length, 4);

  const diagonal = placePeanuts(createUndergroundBoard(), [
    [0, 5],
    [1, 4],
    [2, 3],
  ]);
  assert.equal(findHarvestGroups(diagonal).length, 0);
});

test("underground gravity packs every column from the bottom", () => {
  const board = placePeanuts(createUndergroundBoard(), [
    [2, 0],
    [2, 3],
    [4, 2],
  ]);
  const result = applyUndergroundGravity(board);
  assert.ok(result[5][2]);
  assert.ok(result[4][2]);
  assert.ok(result[5][4]);
  assert.equal(result[0][2], null);
  assert.equal(result[3][2], null);
});

test("underground gravity can trigger a second harvest chain", () => {
  const board = placePeanuts(createUndergroundBoard(), [
    [0, 3],
    [1, 3],
    [2, 3],
    [0, 0],
    [1, 5],
    [2, 5],
  ]);
  const result = resolveUndergroundBoard(board);
  assert.equal(result.chains, 2);
  assert.equal(result.harvested, 6);
  assert.equal(peanutCount(result.board), 0);
});

test("a group of four clears and scores 400 points", () => {
  const board = createGroundBoard();
  board[11][0] = "yellow";
  board[11][1] = "yellow";
  board[10][0] = "yellow";
  board[10][1] = "yellow";

  const result = resolveBoard(board);
  assert.equal(result.chains, 1);
  assert.equal(result.points, 400);
  assert.equal(result.firstClearCells.length, 4);
  assert.equal(result.board.flat().filter(Boolean).length, 0);
});

test("separate groups clear simultaneously", () => {
  const board = createGroundBoard();
  for (let y = 8; y < 12; y += 1) {
    board[y][0] = "yellow";
    board[y][5] = "purple";
  }

  const result = resolveBoard(board);
  assert.equal(result.chains, 1);
  assert.equal(result.points, 800);
  assert.equal(result.firstClearCells.length, 8);
});

test("the first chain clears only groups completed by the landed pair", () => {
  const board = createGroundBoard();
  board[11][0] = "yellow";
  board[11][1] = "yellow";
  board[11][2] = "yellow";
  for (let y = 8; y < 12; y += 1) board[y][5] = "purple";

  const landedCells = [{ x: 3, y: 11, color: "yellow" }];
  board[11][3] = "yellow";
  const result = resolveAfterLanding(board, landedCells);

  assert.equal(result.chains, 1);
  assert.equal(result.points, 400);
  assert.equal(result.firstClearCells.length, 4);
  assert.equal(result.board.flat().filter((cell) => cell === "purple").length, 4);
});

test("multiple groups completed by the same pair clear in one chain stage", () => {
  const board = createGroundBoard();
  for (let y = 8; y < 11; y += 1) {
    board[y][2] = "yellow";
    board[y][3] = "pink";
  }
  board[11][2] = "yellow";
  board[11][3] = "pink";

  const result = resolveAfterLanding(board, [
    { x: 2, y: 11, color: "yellow" },
    { x: 3, y: 11, color: "pink" },
  ]);

  assert.equal(result.chains, 1);
  assert.equal(result.points, 800);
  assert.equal(result.firstClearCells.length, 8);
});

test("only a group containing a flower moved by gravity becomes chain two", () => {
  const board = createGroundBoard();
  for (let y = 8; y < 12; y += 1) board[y][0] = "yellow";
  board[7][0] = "pink";
  board[11][1] = "pink";
  board[11][2] = "pink";
  board[11][3] = "pink";
  for (let y = 8; y < 12; y += 1) board[y][5] = "purple";

  const result = resolveAfterLanding(board, [
    { x: 0, y: 8, color: "yellow" },
  ]);

  assert.equal(result.chains, 2);
  assert.equal(result.points, 1200);
  assert.equal(result.board.flat().filter((cell) => cell === "purple").length, 4);
});

test("gravity can create a second chain without changing Phase 1 scoring", () => {
  const board = createGroundBoard();
  for (let y = 8; y < 12; y += 1) board[y][0] = "yellow";
  board[7][0] = "pink";
  board[11][1] = "pink";
  board[11][2] = "pink";
  board[11][3] = "pink";

  const result = resolveBoard(board);
  assert.equal(result.chains, 2);
  assert.equal(result.points, 1200);
  assert.equal(result.firstClearCells.length, 4);
  assert.equal(result.board.flat().filter(Boolean).length, 0);
});

test("a pair cannot spawn through occupied cells", () => {
  const board = createGroundBoard();
  const pair = spawnPair(["yellow", "pink"]);
  assert.equal(canPlace(board, pair), true);
  board[0][2] = "purple";
  assert.equal(canPlace(board, pair), false);
});

test("an unsupported flower in a horizontal pair falls independently", () => {
  const board = createGroundBoard();
  board[11][2] = "purple";
  const pair = { colors: ["yellow", "pink"], x: 2, y: 10, rotation: 1 };

  assert.deepEqual(getLandedPairCells(board, pair), [
    { x: 2, y: 10, color: "yellow" },
    { x: 3, y: 11, color: "pink" },
  ]);

  const result = gameReducer(makeState({ groundBoard: board, activePair: pair }), {
    type: "HARD_DROP",
  });
  assert.equal(result.groundBoard[10][2], "yellow");
  assert.equal(result.groundBoard[11][3], "pink");
});

test("horizontal split landing also works when the partner is on the left", () => {
  const board = createGroundBoard();
  board[11][3] = "purple";
  const pair = { colors: ["yellow", "pink"], x: 3, y: 10, rotation: 3 };

  assert.deepEqual(getLandedPairCells(board, pair), [
    { x: 3, y: 10, color: "yellow" },
    { x: 2, y: 11, color: "pink" },
  ]);
});

test("vertical pairs keep their two flowers together when landing", () => {
  const board = createGroundBoard();
  board[11][2] = "purple";

  assert.deepEqual(
    getLandedPairCells(board, {
      colors: ["yellow", "pink"],
      x: 2,
      y: 10,
      rotation: 0,
    }),
    [
      { x: 2, y: 10, color: "yellow" },
      { x: 2, y: 9, color: "pink" },
    ],
  );
  assert.deepEqual(
    getLandedPairCells(board, {
      colors: ["yellow", "pink"],
      x: 2,
      y: 9,
      rotation: 2,
    }),
    [
      { x: 2, y: 9, color: "yellow" },
      { x: 2, y: 10, color: "pink" },
    ],
  );
});

test("the pivot flower creates one peanut in its own column", () => {
  const groundBoard = createGroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";

  const result = finishResolution(gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["yellow", "pink"], x: 3, y: 11, rotation: 1 },
    }),
    { type: "HARD_DROP" },
  ));

  assert.equal(peanutCount(result.undergroundBoard), 1);
  assert.deepEqual(result.undergroundBoard[5][3], { type: "standard" });
  assert.equal(result.growthEffect, null);
  assert.equal(result.score, 400);
});

test("the partner flower supplies the column when only it clears", () => {
  const groundBoard = createGroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";

  const result = finishResolution(gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["pink", "yellow"], x: 4, y: 11, rotation: 3 },
    }),
    { type: "HARD_DROP" },
  ));

  assert.equal(peanutCount(result.undergroundBoard), 1);
  assert.deepEqual(result.undergroundBoard[5][3], { type: "standard" });
  assert.equal(result.growthEffect, null);
});

test("the pivot column wins when both dropped flowers clear", () => {
  const groundBoard = createGroundBoard();
  for (let y = 8; y < 11; y += 1) {
    groundBoard[y][2] = "yellow";
    groundBoard[y][3] = "pink";
  }

  const result = finishResolution(gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["yellow", "pink"], x: 2, y: 11, rotation: 1 },
    }),
    { type: "HARD_DROP" },
  ));

  assert.equal(result.chainCount, 1);
  assert.equal(result.score, 800);
  assert.equal(peanutCount(result.undergroundBoard), 1);
  assert.deepEqual(result.undergroundBoard[5][2], { type: "standard" });
});

test("two chains create three peanuts and harvest the connected group", () => {
  const groundBoard = createGroundBoard();
  for (let y = 9; y < 12; y += 1) groundBoard[y][0] = "yellow";
  groundBoard[11][1] = "pink";
  groundBoard[11][2] = "pink";
  groundBoard[11][3] = "pink";

  const result = finishResolution(gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["yellow", "pink"], x: 0, y: 8, rotation: 0 },
    }),
    { type: "HARD_DROP" },
  ));

  assert.equal(result.chainCount, 2);
  assert.equal(result.score, 1200 + 3 * HARVEST_SCORE_PER_PEANUT);
  assert.equal(peanutCount(result.undergroundBoard), 0);
  assert.equal(result.harvestCount, 3);
  assert.equal(result.undergroundChainCount, 1);
});

test("three chains create one, two, and three peanuts in their causal columns", () => {
  const groundBoard = createGroundBoard();
  for (let y = 9; y < 12; y += 1) groundBoard[y][0] = "yellow";
  groundBoard[7][0] = "pink";
  for (let x = 1; x <= 3; x += 1) {
    groundBoard[11][x] = "pink";
    groundBoard[10][x] = "purple";
  }
  groundBoard[11][4] = "purple";

  const initial = gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["yellow", "yellow"], x: 0, y: 8, rotation: 1 },
    }),
    { type: "HARD_DROP" },
  );

  assert.equal(initial.pendingResolution?.steps.length, 3);
  assert.deepEqual(
    initial.pendingResolution?.steps.map((step) => step.growthSource?.x),
    [0, 0, 1],
  );

  const result = finishResolution(initial);
  assert.equal(result.chainCount, 3);
  assert.equal(peanutCount(result.undergroundBoard), 0);
  assert.equal(result.harvestCount, 6);
});

test("the reducer displays clear and gravity as separate chain stages", () => {
  const groundBoard = createGroundBoard();
  for (let y = 9; y < 12; y += 1) groundBoard[y][0] = "yellow";
  groundBoard[11][1] = "pink";
  groundBoard[11][2] = "pink";
  groundBoard[11][3] = "pink";

  let state = gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["yellow", "pink"], x: 0, y: 8, rotation: 0 },
    }),
    { type: "HARD_DROP" },
  );

  assert.equal(state.pendingResolution?.phase, "clear");
  assert.equal(state.groundBoard.flat().filter((cell) => cell === "yellow").length, 4);

  state = gameReducer(state, {
    type: "ADVANCE_RESOLUTION",
    id: state.pendingResolution.id,
  });
  assert.equal(state.chainCount, 1);
  assert.equal(state.pendingResolution?.phase, "growth");
  assert.equal(state.growthEffect?.chain, 1);
  assert.deepEqual(state.growthEffect?.rows, [5]);
  assert.equal(state.groundBoard[7][0], "pink");
  assert.equal(state.groundBoard[11][0], null);

  state = gameReducer(state, {
    type: "FINISH_GROWTH",
    id: state.growthEffect.id,
  });
  assert.equal(state.pendingResolution?.phase, "gravity");

  state = gameReducer(state, {
    type: "ADVANCE_RESOLUTION",
    id: state.pendingResolution.id,
  });
  assert.equal(state.pendingResolution?.stepIndex, 1);
  assert.equal(state.pendingResolution?.phase, "clear");
  assert.equal(state.groundBoard[11][0], "pink");

  state = gameReducer(state, {
    type: "ADVANCE_RESOLUTION",
    id: state.pendingResolution.id,
  });
  assert.equal(state.chainCount, 2);
  assert.equal(state.score, 1200);
  assert.equal(state.groundBoard.flat().filter(Boolean).length, 0);
  assert.equal(state.pendingResolution?.phase, "growth");
  assert.equal(state.growthEffect?.column, 0);
  assert.deepEqual(state.growthEffect?.rows, [4, 3]);
});

test("harvest animation removes peanuts, updates totals, and resumes ground resolution", () => {
  const groundBoard = createGroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";
  const undergroundBoard = placePeanuts(createUndergroundBoard(), [
    [3, 5],
    [3, 4],
  ]);
  let state = gameReducer(
    makeState({
      groundBoard,
      undergroundBoard,
      activePair: { colors: ["yellow", "pink"], x: 3, y: 11, rotation: 1 },
    }),
    { type: "HARD_DROP" },
  );

  state = gameReducer(state, {
    type: "ADVANCE_RESOLUTION",
    id: state.pendingResolution.id,
  });
  assert.equal(state.growthEffect?.rows.length, 1);
  assert.equal(peanutCount(state.undergroundBoard), 3);

  state = gameReducer(state, {
    type: "FINISH_GROWTH",
    id: state.growthEffect.id,
  });
  assert.equal(state.pendingResolution?.phase, "harvest");
  assert.equal(state.harvestEffect?.cells.length, 3);
  assert.equal(peanutCount(state.undergroundBoard), 3);
  assert.equal(gameReducer(state, { type: "MOVE", dx: -1 }), state);

  state = gameReducer(state, {
    type: "FINISH_HARVEST",
    id: state.harvestEffect.id,
  });
  assert.equal(peanutCount(state.undergroundBoard), 0);
  assert.equal(state.harvestCount, 3);
  assert.equal(state.score, 400 + 3 * HARVEST_SCORE_PER_PEANUT);
  assert.equal(state.pendingResolution?.phase, "gravity");

  const resumed = finishResolution(state);
  assert.equal(resumed.activePair?.x, 2);
  assert.equal(gameReducer(resumed, { type: "MOVE", dx: -1 }).activePair?.x, 1);
});

test("the reducer counts consecutive underground harvests", () => {
  const undergroundBoard = placePeanuts(createUndergroundBoard(), [
    [0, 3],
    [1, 3],
    [2, 3],
    [0, 0],
    [1, 5],
    [2, 5],
  ]);
  let state = makeState({
    undergroundBoard,
    activePair: null,
    growthEffect: {
      id: 1,
      chain: 1,
      column: 0,
      rows: [3],
      sourceX: 0,
      sourceY: 8,
    },
    growthSequence: 1,
    pendingResolution: {
      id: 1,
      steps: [],
      stepIndex: 0,
      phase: "growth",
    },
  });

  state = gameReducer(state, { type: "FINISH_GROWTH", id: 1 });
  assert.equal(state.harvestEffect?.chain, 1);
  assert.equal(state.harvestEffect?.cells.length, 3);

  state = gameReducer(state, {
    type: "FINISH_HARVEST",
    id: state.harvestEffect.id,
  });
  assert.equal(state.harvestEffect?.chain, 2);
  assert.equal(state.undergroundChainCount, 2);

  state = gameReducer(state, {
    type: "FINISH_HARVEST",
    id: state.harvestEffect.id,
  });
  assert.equal(state.harvestEffect, null);
  assert.equal(state.harvestCount, 6);
  assert.equal(state.undergroundChainCount, 2);
  assert.equal(state.score, 6 * HARVEST_SCORE_PER_PEANUT);
});

test("peanuts stack from the bottom and a full column produces none", () => {
  const groundBoard = createGroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";
  const pair = { colors: ["yellow", "pink"], x: 3, y: 11, rotation: 1 };
  const undergroundBoard = createUndergroundBoard();
  undergroundBoard[5][3] = { type: "standard" };

  const stacked = finishResolution(gameReducer(
    makeState({ groundBoard, undergroundBoard, activePair: pair }),
    { type: "HARD_DROP" },
  ));
  assert.deepEqual(stacked.undergroundBoard[4][3], { type: "standard" });
  assert.equal(stacked.harvestCount, 0);

  const fullUnderground = createUndergroundBoard();
  for (let row = 0; row < 6; row += 1) {
    fullUnderground[row][3] = { type: "standard" };
  }
  const full = finishResolution(gameReducer(
    makeState({ groundBoard, undergroundBoard: fullUnderground, activePair: pair }),
    { type: "HARD_DROP" },
  ));
  assert.equal(peanutCount(full.undergroundBoard), 6);
  assert.equal(full.growthEffect, null);
  assert.equal(full.gameStatus, "playing");
});

test("a peanut batch uses only the underground slots that remain", () => {
  const undergroundBoard = createUndergroundBoard();
  for (let row = 1; row < 6; row += 1) {
    undergroundBoard[row][0] = { type: "standard" };
  }
  assert.deepEqual(findUndergroundSlots(undergroundBoard, 0, 3), [0]);
});

test("prediction uses the same landing column and hides for non-clears", () => {
  const groundBoard = createGroundBoard();
  const undergroundBoard = createUndergroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";

  const target = predictGrowthTarget(
    groundBoard,
    undergroundBoard,
    { colors: ["yellow", "pink"], x: 3, y: 1, rotation: 1 },
  );
  assert.deepEqual(target, { column: 3, row: 5, sourceX: 3, sourceY: 11 });
  assert.equal(
    predictGrowthTarget(createGroundBoard(), undergroundBoard, spawnPair(["yellow", "pink"])),
    null,
  );
});

test("prediction uses the independently dropped flower position", () => {
  const groundBoard = createGroundBoard();
  const undergroundBoard = createUndergroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";
  groundBoard[10][4] = "purple";
  groundBoard[11][4] = "purple";

  const target = predictGrowthTarget(
    groundBoard,
    undergroundBoard,
    { colors: ["pink", "yellow"], x: 4, y: 1, rotation: 3 },
  );

  assert.deepEqual(target, { column: 3, row: 5, sourceX: 3, sourceY: 11 });
});

test("growth pauses input until its matching animation finishes", () => {
  const groundBoard = createGroundBoard();
  groundBoard[11][0] = "yellow";
  groundBoard[11][1] = "yellow";
  groundBoard[11][2] = "yellow";
  let grown = gameReducer(
    makeState({
      groundBoard,
      activePair: { colors: ["yellow", "pink"], x: 3, y: 11, rotation: 1 },
    }),
    { type: "HARD_DROP" },
  );
  grown = gameReducer(grown, {
    type: "ADVANCE_RESOLUTION",
    id: grown.pendingResolution.id,
  });

  const frozen = gameReducer(grown, { type: "MOVE", dx: -1 });
  assert.equal(frozen.activePair?.x, grown.activePair?.x);
  const resumed = gameReducer(grown, {
    type: "FINISH_GROWTH",
    id: grown.growthEffect.id,
  });
  assert.equal(resumed.growthEffect, null);
  assert.equal(resumed.pendingResolution?.phase, "gravity");
  assert.equal(resumed.gameStatus, "playing");
  const finished = finishResolution(resumed);
  assert.equal(gameReducer(finished, { type: "MOVE", dx: -1 }).activePair?.x, 1);
});
