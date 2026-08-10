"use client";

import { useEffect, useMemo, useReducer, type CSSProperties } from "react";
import {
  COLS,
  createInitialState,
  gameReducer,
  getPairCells,
  GROUND_ROWS,
  predictGrowthTarget,
  type FlowerColor,
  type GroundCell as GroundCellData,
  type GrowthTarget,
  type Peanut,
} from "./game-logic";
import { FLOWER_ASSETS, GAME_ASSETS, getPeanutAsset } from "./game-assets";

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

  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: "TICK" }), 720);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!state.growthEffect) return;
    const id = state.growthEffect.id;
    const timer = window.setTimeout(
      () => dispatch({ type: "FINISH_GROWTH", id }),
      650 + Math.max(0, state.growthEffect.rows.length - 1) * 140,
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
  }, []);

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

  return (
    <main
      className="game-shell"
      style={{
        "--field-background-image": `url("${GAME_ASSETS.background}")`,
      } as GameShellStyle}
    >
      <header className="hud" aria-label="ゲーム情報">
        <section className="hud__score" aria-label={`スコア ${state.score}`}>
          <span className="hud__label">SCORE</span>
          <strong>{state.score.toLocaleString("ja-JP")}</strong>
        </section>
        <div className="mini-logo" aria-hidden="true">
          <span>らっかせい！</span>
          <i />
        </div>
        <section className="hud__next" aria-label="次の花">
          <span className="hud__label">NEXT</span>
          <div className="next-pair">
            <Flower color={state.nextPair[0]} small />
            <Flower color={state.nextPair[1]} small />
          </div>
        </section>
      </header>

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

        <div className="earth-line" aria-hidden="true" />

        <div className="field-soil" aria-label="地下 6列6段 落花生エリア">
          <div className="underground-grid">
            {state.undergroundBoard.flatMap((row, y) =>
              row.map((peanut, x) => (
                <div className="field-cell field-cell--soil" key={`soil-${x}-${y}`}>
                  {peanut && (
                    <PeanutPiece
                      peanut={peanut}
                      appearingIndex={
                        state.growthEffect?.column === x
                          ? state.growthEffect.rows.indexOf(y)
                          : -1
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

        {state.growthEffect && (
          <div
            className="growth-guide growth-guide--active"
            style={getGrowthStyle({
              column: state.growthEffect.column,
              sourceY: state.growthEffect.sourceY,
              row: Math.min(...state.growthEffect.rows),
            })}
            aria-hidden="true"
            data-growth-effect
          >
            <i className="growth-guide__stem" />
          </div>
        )}

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

        <span className="sr-only" aria-live="polite">
          {state.growthEffect ? "地下に落花生ができました" : ""}
        </span>

        {state.gameStatus === "gameover" && (
          <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
            <div className="gameover__panel">
              <h1 id="gameover-title">ゲームオーバー</h1>
              <div className="gameover__result">
                <img
                  className="gameover__mascot"
                  src={GAME_ASSETS.mascot}
                  alt="らっかせいのマスコット"
                  draggable={false}
                />
                <p>SCORE <strong>{state.score.toLocaleString("ja-JP")}</strong></p>
              </div>
              <button type="button" onClick={() => dispatch({ type: "RESET" })}>
                もういちど
              </button>
            </div>
          </div>
        )}
      </section>

      <div
        className="harvest-count"
        aria-label={`収穫した落花生 ${state.harvestCount}個`}
      >
        <span>収穫</span><strong>🥜 × {state.harvestCount}</strong>
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
