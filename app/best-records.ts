export const BEST_RECORD_KEYS = {
  score: "rakkasei-best-score",
  harvest: "rakkasei-best-harvest",
} as const;

export type BestRecords = {
  score: number;
  harvest: number;
};

export type BestRecordUpdate = BestRecords & {
  scoreUpdated: boolean;
  harvestUpdated: boolean;
};

type BestRecordStorage = Pick<Storage, "getItem" | "setItem">;

export function parseBestRecord(value: string | null): number {
  if (value === null || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export function getBestRecordUpdate(
  saved: BestRecords,
  current: BestRecords,
): BestRecordUpdate {
  const scoreUpdated = current.score > saved.score;
  const harvestUpdated = current.harvest > saved.harvest;
  return {
    score: scoreUpdated ? current.score : saved.score,
    harvest: harvestUpdated ? current.harvest : saved.harvest,
    scoreUpdated,
    harvestUpdated,
  };
}

export function loadBestRecords(storage: BestRecordStorage): BestRecords {
  return {
    score: parseBestRecord(storage.getItem(BEST_RECORD_KEYS.score)),
    harvest: parseBestRecord(storage.getItem(BEST_RECORD_KEYS.harvest)),
  };
}

export function saveBestRecordUpdate(
  storage: BestRecordStorage,
  update: BestRecordUpdate,
): void {
  if (update.scoreUpdated) {
    storage.setItem(BEST_RECORD_KEYS.score, String(update.score));
  }
  if (update.harvestUpdated) {
    storage.setItem(BEST_RECORD_KEYS.harvest, String(update.harvest));
  }
}
