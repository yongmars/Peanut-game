"use client";

import { useEffect, useMemo, useReducer } from "react";
import {
  COLS,
  createInitialState,
  gameReducer,
  getPairCells,
  GROUND_ROWS,
  type Cell,
  type FlowerColor,
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

function GroundCell({ flower }: { flower: Cell }) {
  return <div className="field-cell">{flower && <Flower color={flower} />}</div>;
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

        <div className="field-soil" aria-label="地下 6列6段 今後の落花生エリア">
          <div className="soil-detail soil-detail--root" />
          <div className="soil-detail soil-detail--stone" />
          <div className="underground-grid">
            {state.undergroundBoard.flatMap((row, y) =>
              row.map((cell, x) => (
                <div className="field-cell field-cell--soil" key={`soil-${x}-${y}`}>
                  {cell && <Flower color={cell} />}
                </div>
              )),
            )}
          </div>
        </div>

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
