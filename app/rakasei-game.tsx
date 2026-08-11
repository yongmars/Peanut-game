"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  COLS,
  createInitialState,
  gameReducer,
  getLevelSetting,
  getLevelUpLevel,
  getPairCells,
  GROUND_ROWS,
  predictGrowthTarget,
  type FlowerColor,
  type GroundCell as GroundCellData,
  type GrowthTarget,
  type Peanut,
} from "./game-logic";
import { FLOWER_ASSETS, GAME_ASSETS, getPeanutAsset } from "./game-assets";
import { getTouchGesture } from "./touch-controls";
import {
  getBestRecordUpdate,
  loadBestRecords,
  saveBestRecordUpdate,
  type BestRecords,
} from "./best-records";

const LEVEL_UP_DISPLAY_MS = 1_200;

const FLOWER_LABELS: Record<FlowerColor, string> = {
  yellow: "黄色",
  pink: "ピンク",
  blue: "青",
  purple: "紫",
};

function Flower({ color, small = false }: { color: FlowerColor; small?: boolean }) {
  return (
    <img
      className={`flower flower--${color}${small ? " flower--small" : ""}`}
      src={FLOWER_ASSETS[color]}
      alt={`${FLOWER_LABELS[color]}の花`}
      draggable={false}
    />
  );
}

function GroundCell({ flower }: { flower: GroundCellData }) {
  return <div className="field-cell">{flower && <Flower color={flower} />}</div>;
}

function PeanutPiece({
  peanut,
  preview = false,
  appearingIndex = -1,
  harvesting = false,
}: {
  peanut: Peanut;
  preview?: boolean;
  appearingIndex?: number;
  harvesting?: boolean;
}) {
  const appearing = appearingIndex >= 0;
  return (
    <img
      className={`peanut peanut--${peanut.type}${preview ? " peanut--preview" : ""}${appearing ? " peanut--appearing" : ""}${harvesting ? " peanut--harvesting" : ""}`}
      src={getPeanutAsset(harvesting)}
      style={
        appearing
          ? ({ "--peanut-index": appearingIndex } as CSSProperties)
          : undefined
      }
      alt={preview ? "生成予定の落花生" : harvesting ? "収穫される笑顔の落花生" : "落花生"}
      draggable={false}
      data-peanut={preview ? "preview" : "grown"}
    />
  );
}

type GrowthStyle = CSSProperties & {
  "--growth-column": number;
  "--growth-source-row": number;
  "--growth-target-row": number;
};

type GameShellStyle = CSSProperties & {
  "--field-background-image": string;
  "--level-up-display-duration"?: string;
};

type ScreenState = "title" | "playing" | "gameOver";

type BestUpdateFlags = {
  score: boolean;
  harvest: boolean;
};

function getGrowthStyle(target: Pick<GrowthTarget, "column" | "sourceY" | "row">): GrowthStyle {
  return {
    "--growth-column": target.column,
    "--growth-source-row": target.sourceY,
    "--growth-target-row": target.row,
  };
}

export function RakaseiGame() {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => createInitialState(() => 0),
  );
  const touchStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const previousHarvestCount = useRef(state.harvestCount);
  const [levelUpDisplay, setLevelUpDisplay] = useState<number | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>("title");
  const [bestRecords, setBestRecords] = useState<BestRecords>({
    score: 0,
    harvest: 0,
  });
  const [bestUpdates, setBestUpdates] = useState<BestUpdateFlags>({
    score: false,
    harvest: false,
  });
  const levelSetting = getLevelSetting(state.harvestCount);

  const handleTouchStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      screenState !== "playing" ||
      state.gameStatus !== "playing" ||
      event.pointerType !== "touch" ||
      !event.isPrimary
    ) return;
    touchStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTouchEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const start = touchStart.current;
    if (
      screenState !== "playing" ||
      state.gameStatus !== "playing" ||
      event.pointerType !== "touch" ||
      !start ||
      start.pointerId !== event.pointerId
    ) return;
    touchStart.current = null;

    const gesture = getTouchGesture(
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (gesture === "move-left") dispatch({ type: "MOVE", dx: -1 });
    if (gesture === "move-right") dispatch({ type: "MOVE", dx: 1 });
    if (gesture === "hard-drop") dispatch({ type: "HARD_DROP" });
    if (gesture === "rotate") dispatch({ type: "ROTATE" });
  };

  useEffect(() => {
    if (screenState !== "title") return;
    const timer = window.setTimeout(() => {
      try {
        setBestRecords(loadBestRecords(window.localStorage));
      } catch {
        // Storage can be unavailable in privacy-restricted environments.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [screenState]);

  useEffect(() => {
    if (screenState !== "playing" || state.gameStatus !== "gameover") return;
    const timer = window.setTimeout(() => {
      const update = getBestRecordUpdate(bestRecords, {
        score: state.score,
        harvest: state.harvestCount,
      });
      try {
        saveBestRecordUpdate(window.localStorage, update);
      } catch {
        // The current result screen still works when storage is unavailable.
      }
      setBestRecords({ score: update.score, harvest: update.harvest });
      setBestUpdates({
        score: update.scoreUpdated,
        harvest: update.harvestUpdated,
      });
      setScreenState("gameOver");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    bestRecords,
    screenState,
    state.gameStatus,
    state.harvestCount,
    state.score,
  ]);

  useEffect(() => {
    if (screenState !== "playing") return;
    const timer = window.setInterval(
      () => dispatch({ type: "TICK" }),
      levelSetting.dropIntervalMs,
    );
    return () => window.clearInterval(timer);
  }, [levelSetting.dropIntervalMs, screenState]);

  useEffect(() => {
    const levelUp = getLevelUpLevel(
      previousHarvestCount.current,
      state.harvestCount,
    );
    previousHarvestCount.current = state.harvestCount;

    if (levelUp === null) {
      if (state.harvestCount !== 0) return;
      const resetTimer = window.setTimeout(() => setLevelUpDisplay(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const showTimer = window.setTimeout(() => setLevelUpDisplay(levelUp), 0);
    const hideTimer = window.setTimeout(
      () => setLevelUpDisplay(null),
      LEVEL_UP_DISPLAY_MS,
    );
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [state.harvestCount]);

  useEffect(() => {
    if (!state.growthEffect) return;
    const id = state.growthEffect.id;
    const longestBatch = Math.max(
      ...state.growthEffect.batches.map(({ rows }) => rows.length),
    );
    const timer = window.setTimeout(
      () => dispatch({ type: "FINISH_GROWTH", id }),
      650 + Math.max(0, longestBatch - 1) * 140,
    );
    return () => window.clearTimeout(timer);
  }, [state.growthEffect]);

  useEffect(() => {
    if (!state.harvestEffect) return;
    const id = state.harvestEffect.id;
    const timer = window.setTimeout(
      () => dispatch({ type: "FINISH_HARVEST", id }),
      520,
    );
    return () => window.clearTimeout(timer);
  }, [state.harvestEffect]);

  useEffect(() => {
    if (
      !state.pendingResolution ||
      state.pendingResolution.phase === "growth" ||
      state.pendingResolution.phase === "harvest"
    ) return;
    const { id, phase } = state.pendingResolution;
    const timer = window.setTimeout(
      () => dispatch({ type: "ADVANCE_RESOLUTION", id }),
      phase === "clear" ? 450 : 320,
    );
    return () => window.clearTimeout(timer);
  }, [state.pendingResolution]);

  useEffect(() => {
    if (screenState !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const controls: Record<string, () => void> = {
        ArrowLeft: () => dispatch({ type: "MOVE", dx: -1 }),
        ArrowRight: () => dispatch({ type: "MOVE", dx: 1 }),
        ArrowDown: () => dispatch({ type: "TICK" }),
        ArrowUp: () => dispatch({ type: "ROTATE" }),
        x: () => dispatch({ type: "ROTATE" }),
        X: () => dispatch({ type: "ROTATE" }),
        " ": () => dispatch({ type: "HARD_DROP" }),
      };
      const control = controls[event.key];
      if (control) {
        event.preventDefault();
        control();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screenState]);

  const displayBoard = useMemo(() => {
    const board = state.groundBoard.map((row) => [...row]);
    if (state.activePair) {
      getPairCells(state.activePair).forEach(({ x, y, color }) => {
        if (y >= 0 && y < GROUND_ROWS && x >= 0 && x < COLS) board[y][x] = color;
      });
    }
    return board;
  }, [state.activePair, state.groundBoard]);

  const growthPreview = useMemo(
    () =>
      state.gameStatus === "playing" &&
      !state.growthEffect &&
      !state.pendingResolution
        ? predictGrowthTarget(
            state.groundBoard,
            state.undergroundBoard,
            state.activePair,
          )
        : null,
    [
      state.activePair,
      state.gameStatus,
      state.groundBoard,
      state.growthEffect,
      state.pendingResolution,
      state.undergroundBoard,
    ],
  );

  const harvestKeys = useMemo(
    () =>
      new Set(
        state.harvestEffect?.cells.map(({ x, y }) => `${x},${y}`) ?? [],
      ),
    [state.harvestEffect],
  );

  const appearingPeanutIndices = useMemo(
    () =>
      new Map(
        state.growthEffect?.batches.flatMap(({ column, rows }) =>
          rows.map((row, index) => [`${column},${row}`, index] as const),
        ) ?? [],
      ),
    [state.growthEffect],
  );

  const startNewGame = () => {
    dispatch({ type: "RESET" });
    previousHarvestCount.current = 0;
    setLevelUpDisplay(null);
    setBestUpdates({ score: false, harvest: false });
    setScreenState("playing");
  };

  if (screenState === "title") {
    return (
      <main
        className="title-screen"
        style={{
          "--field-background-image": `url("${GAME_ASSETS.background}")`,
        } as GameShellStyle}
      >
        <section className="title-screen__content" aria-labelledby="title-logo">
          <img
            id="title-logo"
            className="title-screen__logo"
            src={GAME_ASSETS.title}
            alt="らっかせい！"
            draggable={false}
          />
          <p className="title-screen__tagline">花をつなげて、地中でポコッ！</p>
          <div className="title-screen__records" aria-label="ベスト記録">
            <p>
              <span>BEST SCORE</span>
              <strong>{bestRecords.score.toLocaleString("ja-JP")}</strong>
            </p>
            <p>
              <span>BEST HARVEST</span>
              <strong><span aria-hidden="true">🥜</span> × {bestRecords.harvest}</strong>
            </p>
          </div>
          <button
            type="button"
            className="title-screen__play"
            onClick={startNewGame}
          >
            あそぶ
          </button>
          <img
            className="title-screen__mascot"
            src={GAME_ASSETS.mascot}
            alt="落花生のマスコット"
            draggable={false}
          />
        </section>
      </main>
    );
  }

  return (
    <main
      className="game-shell"
      style={{
        "--field-background-image": `url("${GAME_ASSETS.background}")`,
        "--level-up-display-duration": `${LEVEL_UP_DISPLAY_MS}ms`,
      } as GameShellStyle}
    >
      <header className="hud" aria-label="ゲーム情報">
        <section className="hud__score" aria-label={`スコア ${state.score}`}>
          <span className="hud__label">SCORE</span>
          <strong>{state.score.toLocaleString("ja-JP")}</strong>
        </section>
        <section
          className="hud__level"
          aria-label={`レベル ${levelSetting.level}`}
        >
          <span className="hud__label">LEVEL</span>
          <strong>{levelSetting.level}</strong>
        </section>
        <section
          className="hud__harvest"
          aria-label={`収穫した落花生 ${state.harvestCount}個`}
        >
          <span className="hud__label">収穫</span>
          <strong><span aria-hidden="true">🥜</span> × {state.harvestCount}</strong>
        </section>
        <section className="hud__next" aria-label="次の花">
          <span className="hud__label">NEXT</span>
          <div className="next-pair">
            <Flower color={state.nextPair[0]} small />
            <Flower color={state.nextPair[1]} small />
          </div>
        </section>
      </header>

      <div
        className="field-touch-zone"
        aria-label="タッチ操作エリア。タップで回転、左右スワイプで移動、下スワイプで高速落下"
        onPointerDown={handleTouchStart}
        onPointerUp={handleTouchEnd}
        onPointerCancel={() => {
          touchStart.current = null;
        }}
      >
      <section className="field-wrap" aria-label="ゲームフィールド">
        <div className="field-sky" aria-label="地上 6列12段">
          <div className="ground-grid">
            {displayBoard.flatMap((row, y) =>
              row.map((flower, x) => (
                <GroundCell flower={flower} key={`ground-${x}-${y}`} />
              )),
            )}
          </div>
        </div>

        <div className="earth-line" aria-hidden="true">
          <img
            className="leaf-border"
            src={GAME_ASSETS.leafBorder}
            alt=""
            draggable={false}
          />
        </div>

        <div className="field-soil" aria-label="地下 6列6段 落花生エリア">
          <div className="underground-grid">
            {state.undergroundBoard.flatMap((row, y) =>
              row.map((peanut, x) => (
                <div className="field-cell field-cell--soil" key={`soil-${x}-${y}`}>
                  {peanut && (
                    <PeanutPiece
                      peanut={peanut}
                      appearingIndex={
                        appearingPeanutIndices.get(`${x},${y}`) ?? -1
                      }
                      harvesting={harvestKeys.has(`${x},${y}`)}
                    />
                  )}
                </div>
              )),
            )}
          </div>
        </div>

        {growthPreview && (
          <div
            className="growth-guide growth-guide--preview"
            style={getGrowthStyle(growthPreview)}
            aria-hidden="true"
            data-growth-preview
          >
            <i className="growth-guide__stem" />
            <span className="growth-guide__target">
              <PeanutPiece peanut={{ type: "standard" }} preview />
            </span>
          </div>
        )}

        {state.growthEffect?.batches.map((batch) => (
          <div
            className="growth-guide growth-guide--active"
            style={getGrowthStyle({
              column: batch.column,
              sourceY: batch.sourceY,
              row: Math.min(...batch.rows),
            })}
            aria-hidden="true"
            data-growth-effect
            key={`${state.growthEffect.id}-${batch.sourceX}-${batch.sourceY}`}
          >
            <i className="growth-guide__stem" />
          </div>
        ))}

        {state.pendingResolution && state.chainCount >= 2 && (
          <div className="chain-callout" key={state.chainCount} aria-live="polite">
            {state.chainCount}れんさ！
          </div>
        )}

        {state.harvestEffect && (
          <div
            className={`harvest-callout${
              state.harvestEffect.cells.length >= 6 ||
              state.harvestEffect.chain >= 2
                ? " harvest-callout--large"
                : ""
            }`}
            aria-live="polite"
          >
            {state.harvestEffect.cells.length >= 6 ||
            state.harvestEffect.chain >= 2
              ? "大収穫！"
              : "収穫！"}
          </div>
        )}

        {levelUpDisplay !== null && (
          <div
            className="level-up-callout"
            key={levelUpDisplay}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            LEVEL {levelUpDisplay}
          </div>
        )}

        <span className="sr-only" aria-live="polite">
          {state.growthEffect ? "地下に落花生ができました" : ""}
        </span>

        {screenState === "gameOver" && (
          <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
            <div className="gameover__panel">
              <div className="gameover__heading">
                <img
                  className="gameover__mascot"
                  src={GAME_ASSETS.mascot}
                  alt="落花生のマスコット"
                  draggable={false}
                />
                <h1 id="gameover-title">おしまい！</h1>
              </div>
              <div className="gameover__results">
                <p>
                  <span>今日の収穫</span>
                  <strong><span aria-hidden="true">🥜</span> × {state.harvestCount}</strong>
                </p>
                <p>
                  <span>SCORE</span>
                  <strong>{state.score.toLocaleString("ja-JP")}</strong>
                </p>
              </div>
              {(bestUpdates.score || bestUpdates.harvest) && (
                <div className="gameover__updates" aria-live="polite">
                  {bestUpdates.score && <span>ベストスコア更新！</span>}
                  {bestUpdates.harvest && <span>ベスト収穫更新！</span>}
                </div>
              )}
              <div className="gameover__actions">
                <button type="button" onClick={startNewGame}>
                  もういちど
                </button>
                <button
                  type="button"
                  className="gameover__title-button"
                  onClick={() => setScreenState("title")}
                >
                  タイトルへ
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      </div>

      <nav className="controls" aria-label="ゲーム操作">
        <button type="button" className="control-button control-button--arrow" aria-label="左に移動" onClick={() => dispatch({ type: "MOVE", dx: -1 })}>
          <span aria-hidden="true">←</span><small>ひだり</small>
        </button>
        <button type="button" className="control-button" aria-label="時計回りに回転" onClick={() => dispatch({ type: "ROTATE" })}>
          <span aria-hidden="true">↻</span><small>回転</small>
        </button>
        <button type="button" className="control-button control-button--drop" aria-label="高速落下" onClick={() => dispatch({ type: "HARD_DROP" })}>
          <span aria-hidden="true">⇣</span><small>高速落下</small>
        </button>
        <button type="button" className="control-button control-button--arrow" aria-label="右に移動" onClick={() => dispatch({ type: "MOVE", dx: 1 })}>
          <span aria-hidden="true">→</span><small>みぎ</small>
        </button>
      </nav>

      <p className="keyboard-hint">← → 移動 ・ ↑ / X 回転 ・ SPACE 高速落下</p>
    </main>
  );
}
