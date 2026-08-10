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

function Flower({ color, small = false }: { color: FlowerColor; small?: boolean }) {
  return (
    <span
      className={`flower flower--${color}${small ? " flower--small" : ""}`}
      aria-label={`${color === "yellow" ? "黄色" : color === "pink" ? "ピンク" : "紫"}の花`}
      role="img"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <i className="flower__petal" key={index} />
      ))}
      <i className="flower__center" />
    </span>
  );
}

function GroundCell({ flower }: { flower: GroundCellData }) {
  return <div className="field-cell">{flower && <Flower color={flower} />}</div>;
}

function PeanutPiece({
  peanut,
  preview = false,
  appearing = false,
}: {
  peanut: Peanut;
  preview?: boolean;
  appearing?: boolean;
}) {
  return (
    <span
      className={`peanut peanut--${peanut.type}${preview ? " peanut--preview" : ""}${appearing ? " peanut--appearing" : ""}`}
      aria-label={preview ? "生成予定の落花生" : "落花生"}
      role="img"
      data-peanut={preview ? "preview" : "grown"}
    >
      <i className="peanut__lobe peanut__lobe--top" />
      <i className="peanut__lobe peanut__lobe--bottom" />
      <i className="peanut__seam" />
      <i className="peanut__eye peanut__eye--left" />
      <i className="peanut__eye peanut__eye--right" />
      <i className="peanut__mouth" />
    </span>
  );
}

type GrowthStyle = CSSProperties & {
  "--growth-column": number;
  "--growth-source-row": number;
  "--growth-target-row": number;
};

function getGrowthStyle(target: GrowthTarget): GrowthStyle {
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
      650,
    );
    return () => window.clearTimeout(timer);
  }, [state.growthEffect]);

  useEffect(() => {
    if (!state.pendingResolution) return;
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

  return (
    <main className="game-shell">
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
          <div className="cloud cloud--one" />
          <div className="cloud cloud--two" />
          <div className="ground-grid">
            {displayBoard.flatMap((row, y) =>
              row.map((flower, x) => (
                <GroundCell flower={flower} key={`ground-${x}-${y}`} />
              )),
            )}
          </div>
        </div>

        <div className="earth-line" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>

        <div className="field-soil" aria-label="地下 6列6段 落花生エリア">
          <div className="soil-detail soil-detail--root" />
          <div className="soil-detail soil-detail--stone" />
          <div className="underground-grid">
            {state.undergroundBoard.flatMap((row, y) =>
              row.map((peanut, x) => (
                <div className="field-cell field-cell--soil" key={`soil-${x}-${y}`}>
                  {peanut && (
                    <PeanutPiece
                      peanut={peanut}
                      appearing={
                        state.growthEffect?.column === x &&
                        state.growthEffect.row === y
                      }
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
            style={getGrowthStyle(state.growthEffect)}
            aria-hidden="true"
            data-growth-effect
          >
            <i className="growth-guide__stem" />
          </div>
        )}

        <span className="sr-only" aria-live="polite">
          {state.growthEffect ? "地下に落花生ができました" : ""}
        </span>

        {state.gameStatus === "gameover" && (
          <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
            <div className="gameover__panel">
              <span className="gameover__sprout" aria-hidden="true">🌱</span>
              <h1 id="gameover-title">ゲームオーバー</h1>
              <p>SCORE <strong>{state.score.toLocaleString("ja-JP")}</strong></p>
              <button type="button" onClick={() => dispatch({ type: "RESET" })}>
                もういちど
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="harvest-count" aria-label="収穫した落花生 0個">
        <span>収穫</span><strong>🥜 × 0</strong>
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
