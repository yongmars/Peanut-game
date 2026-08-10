import assert from "node:assert/strict";
import test from "node:test";
import {
  canPlace,
  createBoard,
  GROUND_ROWS,
  resolveBoard,
  spawnPair,
} from "../app/game-logic.ts";

test("a group of four clears and scores 400 points", () => {
  const board = createBoard(GROUND_ROWS);
  board[11][0] = "yellow";
  board[11][1] = "yellow";
  board[10][0] = "yellow";
  board[10][1] = "yellow";

  const result = resolveBoard(board);
  assert.equal(result.chains, 1);
  assert.equal(result.points, 400);
  assert.equal(result.board.flat().filter(Boolean).length, 0);
});

test("separate groups clear simultaneously", () => {
  const board = createBoard(GROUND_ROWS);
  for (let y = 8; y < 12; y += 1) {
    board[y][0] = "yellow";
    board[y][5] = "purple";
  }

  const result = resolveBoard(board);
  assert.equal(result.chains, 1);
  assert.equal(result.points, 800);
});

test("gravity can create a second chain", () => {
  const board = createBoard(GROUND_ROWS);
  for (let y = 8; y < 12; y += 1) board[y][0] = "yellow";
  board[7][0] = "pink";
  board[11][1] = "pink";
  board[11][2] = "pink";
  board[11][3] = "pink";

  const result = resolveBoard(board);
  assert.equal(result.chains, 2);
  assert.equal(result.points, 1200);
  assert.equal(result.board.flat().filter(Boolean).length, 0);
});

test("a pair cannot spawn through occupied cells", () => {
  const board = createBoard(GROUND_ROWS);
  const pair = spawnPair(["yellow", "pink"]);
  assert.equal(canPlace(board, pair), true);
  board[0][2] = "purple";
  assert.equal(canPlace(board, pair), false);
});
