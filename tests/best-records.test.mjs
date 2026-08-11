import assert from "node:assert/strict";
import test from "node:test";
import {
  BEST_RECORD_KEYS,
  getBestRecordUpdate,
  loadBestRecords,
  parseBestRecord,
  saveBestRecordUpdate,
} from "../app/best-records.ts";

test("best record storage uses stable local keys", () => {
  assert.deepEqual(BEST_RECORD_KEYS, {
    score: "rakkasei-best-score",
    harvest: "rakkasei-best-harvest",
  });
});

test("missing or invalid saved records are treated as zero", () => {
  assert.equal(parseBestRecord(null), 0);
  assert.equal(parseBestRecord(""), 0);
  assert.equal(parseBestRecord("not-a-number"), 0);
  assert.equal(parseBestRecord("-5"), 0);
  assert.equal(parseBestRecord("12450"), 12450);
  assert.equal(parseBestRecord("37.9"), 37);
});

test("only records exceeded by the current game are updated", () => {
  assert.deepEqual(
    getBestRecordUpdate(
      { score: 10_000, harvest: 30 },
      { score: 12_450, harvest: 28 },
    ),
    {
      score: 12_450,
      harvest: 30,
      scoreUpdated: true,
      harvestUpdated: false,
    },
  );
  assert.deepEqual(
    getBestRecordUpdate(
      { score: 12_450, harvest: 37 },
      { score: 12_450, harvest: 37 },
    ),
    {
      score: 12_450,
      harvest: 37,
      scoreUpdated: false,
      harvestUpdated: false,
    },
  );
});

test("best score and harvest persist independently and reload", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  saveBestRecordUpdate(storage, {
    score: 12_450,
    harvest: 37,
    scoreUpdated: true,
    harvestUpdated: true,
  });
  assert.deepEqual(loadBestRecords(storage), { score: 12_450, harvest: 37 });

  saveBestRecordUpdate(storage, {
    score: 12_450,
    harvest: 42,
    scoreUpdated: false,
    harvestUpdated: true,
  });
  assert.deepEqual(loadBestRecords(storage), { score: 12_450, harvest: 42 });
});
