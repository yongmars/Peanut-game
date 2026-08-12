"use client";

import {
  useCallback,
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
import {
  BGM_ASSETS,
  BGM_SETTINGS,
  getBgmTrackForLevel,
  parseBgmEnabled,
  type BgmTrack,
} from "./bgm";
import { parseTutorialSeen, TUTORIAL_STORAGE_KEY } from "./tutorial";
import { shouldAutoPause } from "./pause-state";
import {
  usePausableInterval,
  usePausableTimeout,
} from "./use-pausable-timer";

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

function MusicToggle({
  enabled,
  onToggle,
  compact = false,
  disabled = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`music-toggle${compact ? " music-toggle--compact" : ""}`}
      aria-label={`BGMを${enabled ? "オフ" : "オン"}にする`}
      aria-pressed={enabled}
      onClick={onToggle}
      disabled={disabled}
    >
      <span aria-hidden="true">♪</span>
      {!compact && <small>BGM {enabled ? "ON" : "OFF"}</small>}
    </button>
  );
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

type ScreenState = "title" | "tutorial" | "playing" | "paused" | "gameOver";
type TutorialReturn = "title" | "startGame";
type PauseConfirmation = "restart" | "title" | null;

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
  const musicPlayer = useRef<HTMLAudioElement | null>(null);
  const musicFadeTimer = useRef<number | null>(null);
  const [levelUpDisplay, setLevelUpDisplay] = useState<number | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>("title");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<BgmTrack>("farm");
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [tutorialReturn, setTutorialReturn] = useState<TutorialReturn>("title");
  const [pauseConfirmation, setPauseConfirmation] = useState<PauseConfirmation>(null);
  const [bestRecords, setBestRecords] = useState<BestRecords>({
    score: 0,
    harvest: 0,
  });
  const [bestUpdates, setBestUpdates] = useState<BestUpdateFlags>({
    score: false,
    harvest: false,
  });
  const levelSetting = getLevelSetting(state.harvestCount);

  const clearMusicFade = useCallback(() => {
    if (musicFadeTimer.current === null) return;
    window.clearInterval(musicFadeTimer.current);
    musicFadeTimer.current = null;
  }, []);

  const stopMusic = useCallback(() => {
    clearMusicFade();
    const audio = musicPlayer.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = BGM_SETTINGS.volume;
  }, [clearMusicFade]);

  const pauseGame = useCallback(() => {
    if (screenState !== "playing" || state.gameStatus !== "playing") return;
    touchStart.current = null;
    clearMusicFade();
    musicPlayer.current?.pause();
    setPauseConfirmation(null);
    setScreenState("paused");
  }, [clearMusicFade, screenState, state.gameStatus]);

  const resumeGame = () => {
    setPauseConfirmation(null);
    setScreenState("playing");
  };

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
        setMusicEnabled(
          parseBgmEnabled(
            window.localStorage.getItem(BGM_SETTINGS.storageKey),
          ),
        );
        setTutorialSeen(
          parseTutorialSeen(
            window.localStorage.getItem(TUTORIAL_STORAGE_KEY),
          ),
        );
      } catch {
        // Storage can be unavailable in privacy-restricted environments.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [screenState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (shouldAutoPause(screenState, document.visibilityState)) pauseGame();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pauseGame, screenState]);

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
      stopMusic();
      setCurrentTrack("farm");
      setScreenState("gameOver");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    bestRecords,
    screenState,
    state.gameStatus,
    state.harvestCount,
    state.score,
    stopMusic,
  ]);

  useEffect(() => {
    const audio = musicPlayer.current;
    if (!audio || screenState !== "playing") return;

    clearMusicFade();
    if (!musicEnabled) {
      audio.pause();
      return;
    }

    const source = BGM_ASSETS[currentTrack];
    if (audio.getAttribute("src") !== source) {
      audio.src = source;
      audio.load();
    }
    audio.volume = 0;
    void audio.play().then(() => {
      const steps = Math.max(1, Math.round(BGM_SETTINGS.fadeMs / 25));
      let step = 0;
      musicFadeTimer.current = window.setInterval(() => {
        step += 1;
        audio.volume = Math.min(
          BGM_SETTINGS.volume,
          BGM_SETTINGS.volume * (step / steps),
        );
        if (step >= steps) clearMusicFade();
      }, BGM_SETTINGS.fadeMs / steps);
    }).catch(() => {
      audio.volume = BGM_SETTINGS.volume;
    });

    return clearMusicFade;
  }, [clearMusicFade, currentTrack, musicEnabled, screenState]);

  useEffect(() => {
    if (screenState !== "playing" || !musicEnabled) return;
    const nextTrack = getBgmTrackForLevel(levelSetting.level);
    if (nextTrack === currentTrack) return;

    const audio = musicPlayer.current;
    if (!audio) return;
    clearMusicFade();
    const startVolume = audio.volume;
    const steps = Math.max(1, Math.round(BGM_SETTINGS.fadeMs / 25));
    let step = 0;
    musicFadeTimer.current = window.setInterval(() => {
      step += 1;
      audio.volume = Math.max(0, startVolume * (1 - step / steps));
      if (step < steps) return;
      clearMusicFade();
      audio.pause();
      audio.src = BGM_ASSETS[nextTrack];
      audio.currentTime = 0;
      audio.load();
      setCurrentTrack(nextTrack);
    }, BGM_SETTINGS.fadeMs / steps);

    return clearMusicFade;
  }, [
    clearMusicFade,
    currentTrack,
    levelSetting.level,
    musicEnabled,
    screenState,
  ]);

  usePausableInterval(
    () => dispatch({ type: "TICK" }),
    levelSetting.dropIntervalMs,
    screenState === "playing",
  );

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
    return () => {
      window.clearTimeout(showTimer);
    };
  }, [state.harvestCount]);

  usePausableTimeout(
    () => setLevelUpDisplay(null),
    LEVEL_UP_DISPLAY_MS,
    screenState === "playing" && levelUpDisplay !== null,
    levelUpDisplay,
  );

  const growthDelayMs = state.growthEffect
    ? 650 + Math.max(
      0,
      Math.max(...state.growthEffect.batches.map(({ rows }) => rows.length)) - 1,
    ) * 140
    : 0;
  usePausableTimeout(
    () => {
      if (state.growthEffect) {
        dispatch({ type: "FINISH_GROWTH", id: state.growthEffect.id });
      }
    },
    growthDelayMs,
    screenState === "playing" && Boolean(state.growthEffect),
    state.growthEffect?.id ?? null,
  );

  usePausableTimeout(
    () => {
      if (state.harvestEffect) {
        dispatch({ type: "FINISH_HARVEST", id: state.harvestEffect.id });
      }
    },
    520,
    screenState === "playing" && Boolean(state.harvestEffect),
    state.harvestEffect?.id ?? null,
  );

  const resolutionTimer = state.pendingResolution &&
    state.pendingResolution.phase !== "growth" &&
    state.pendingResolution.phase !== "harvest"
      ? state.pendingResolution
      : null;
  usePausableTimeout(
    () => {
      if (resolutionTimer) {
        dispatch({ type: "ADVANCE_RESOLUTION", id: resolutionTimer.id });
      }
    },
    resolutionTimer?.phase === "clear" ? 450 : 320,
    screenState === "playing" && resolutionTimer !== null,
    resolutionTimer ? `${resolutionTimer.id}:${resolutionTimer.phase}` : null,
  );

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

  const toggleMusic = () => {
    const nextEnabled = !musicEnabled;
    setMusicEnabled(nextEnabled);
    try {
      window.localStorage.setItem(
        BGM_SETTINGS.storageKey,
        String(nextEnabled),
      );
    } catch {
      // The in-memory setting still works when storage is unavailable.
    }
    if (!nextEnabled) {
      clearMusicFade();
      musicPlayer.current?.pause();
    }
  };

  const startNewGame = () => {
    clearMusicFade();
    setCurrentTrack("farm");
    const audio = musicPlayer.current;
    if (audio) {
      audio.pause();
      audio.src = BGM_ASSETS.farm;
      audio.currentTime = 0;
      audio.volume = 0;
      audio.load();
      if (musicEnabled) void audio.play().catch(() => undefined);
    }
    dispatch({ type: "RESET" });
    previousHarvestCount.current = 0;
    setLevelUpDisplay(null);
    setBestUpdates({ score: false, harvest: false });
    setPauseConfirmation(null);
    setScreenState("playing");
  };

  const returnToTitle = () => {
    stopMusic();
    setCurrentTrack("farm");
    setPauseConfirmation(null);
    setScreenState("title");
  };

  const handlePlay = () => {
    if (tutorialSeen) {
      startNewGame();
      return;
    }
    setTutorialReturn("startGame");
    setScreenState("tutorial");
  };

  const openTutorial = () => {
    setTutorialReturn("title");
    setScreenState("tutorial");
  };

  const completeTutorial = () => {
    setTutorialSeen(true);
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    } catch {
      // The tutorial can still be completed when storage is unavailable.
    }
    if (tutorialReturn === "startGame") {
      startNewGame();
      return;
    }
    setScreenState("title");
  };

  const bgmPlayer = (
    // This audio element contains background music only, with no speech to caption.
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio
      key="bgm-player"
      ref={musicPlayer}
      className="bgm-player"
      src={BGM_ASSETS[currentTrack]}
      preload="auto"
      loop
      data-bgm-track={currentTrack}
    />
  );

  if (screenState === "tutorial") {
    return (
      <>
        {bgmPlayer}
        <main
          className="tutorial-screen"
          style={{
            "--field-background-image": `url("${GAME_ASSETS.background}")`,
          } as GameShellStyle}
        >
          <section className="tutorial-panel" aria-labelledby="tutorial-title">
            <header className="tutorial-panel__heading">
              <img src={GAME_ASSETS.mascot} alt="" draggable={false} />
              <div>
                <span>HOW TO PLAY</span>
                <h1 id="tutorial-title">あそびかた</h1>
              </div>
            </header>

            <ol className="tutorial-rules">
              <li>
                <div className="tutorial-icon tutorial-icon--flowers" aria-hidden="true">
                  {Object.values(FLOWER_ASSETS).map((asset) => (
                    <img src={asset} alt="" draggable={false} key={asset} />
                  ))}
                </div>
                <div><strong>① 花をつなげよう</strong><p>同じ色を上下左右に4つ以上つなげると消えるよ。</p></div>
              </li>
              <li>
                <div className="tutorial-icon" aria-hidden="true">
                  <img src={GAME_ASSETS.peanut.normal} alt="" draggable={false} />
                </div>
                <div><strong>② 連鎖で落花生！</strong><p>1連鎖 🥜×1 / 2連鎖 🥜×2 / 3連鎖 🥜×3</p></div>
              </li>
              <li>
                <div className="tutorial-icon" aria-hidden="true">
                  <img src={GAME_ASSETS.peanut.happy} alt="" draggable={false} />
                </div>
                <div><strong>③ 地下で収穫！</strong><p>落花生を上下左右に3つ以上つなげて収穫しよう。</p></div>
              </li>
              <li>
                <div className="tutorial-icon tutorial-icon--level" aria-hidden="true">LEVEL<br />UP!</div>
                <div><strong>④ だんだんスピードアップ！</strong><p>収穫が増えるとLEVELが上がり、落下が速くなるよ。</p></div>
              </li>
            </ol>

            <section className="tutorial-controls" aria-label="操作方法">
              <strong>操作方法</strong>
              <div>
                <span>タップ：回転</span>
                <span>左右スワイプ：移動</span>
                <span>下スワイプ：高速落下</span>
                <span>上スワイプ：操作なし</span>
              </div>
              <small>画面下のボタンでも操作できます。</small>
            </section>

            <button type="button" className="tutorial-panel__done" onClick={completeTutorial}>
              わかった！
            </button>
          </section>
        </main>
      </>
    );
  }

  if (screenState === "title") {
    return (
      <>
        {bgmPlayer}
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
          <div className="title-screen__secondary-actions">
            <MusicToggle enabled={musicEnabled} onToggle={toggleMusic} />
            <button type="button" onClick={openTutorial}>あそびかた</button>
          </div>
          <button
            type="button"
            className="title-screen__play"
            onClick={handlePlay}
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
      </>
    );
  }

  return (
    <>
      {bgmPlayer}
      <main
        className={`game-shell${screenState === "paused" ? " game-shell--paused" : ""}`}
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
        <section className="hud__actions" aria-label="ゲーム設定">
          <MusicToggle
            enabled={musicEnabled}
            onToggle={toggleMusic}
            compact
            disabled={screenState !== "playing"}
          />
          <button
            type="button"
            className="pause-button"
            aria-label="一時停止"
            onClick={pauseGame}
            disabled={screenState !== "playing" || state.gameStatus !== "playing"}
          >
            <span aria-hidden="true">⏸</span>
          </button>
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
                  onClick={returnToTitle}
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
        <button type="button" className="control-button control-button--arrow" aria-label="左に移動" disabled={screenState !== "playing"} onClick={() => dispatch({ type: "MOVE", dx: -1 })}>
          <span aria-hidden="true">←</span><small>ひだり</small>
        </button>
        <button type="button" className="control-button" aria-label="時計回りに回転" disabled={screenState !== "playing"} onClick={() => dispatch({ type: "ROTATE" })}>
          <span aria-hidden="true">↻</span><small>回転</small>
        </button>
        <button type="button" className="control-button control-button--drop" aria-label="高速落下" disabled={screenState !== "playing"} onClick={() => dispatch({ type: "HARD_DROP" })}>
          <span aria-hidden="true">⇣</span><small>高速落下</small>
        </button>
        <button type="button" className="control-button control-button--arrow" aria-label="右に移動" disabled={screenState !== "playing"} onClick={() => dispatch({ type: "MOVE", dx: 1 })}>
          <span aria-hidden="true">→</span><small>みぎ</small>
        </button>
      </nav>

      {screenState === "paused" && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <section className="pause-panel">
            {pauseConfirmation === null ? (
              <>
                <img src={GAME_ASSETS.mascot} alt="" draggable={false} />
                <h1 id="pause-title">いったん休憩</h1>
                <div className="pause-panel__actions">
                  <button type="button" onClick={resumeGame}>つづける</button>
                  <button type="button" className="pause-panel__secondary" onClick={() => setPauseConfirmation("restart")}>はじめから</button>
                  <button type="button" className="pause-panel__secondary" onClick={() => setPauseConfirmation("title")}>タイトルへ</button>
                </div>
              </>
            ) : (
              <>
                <h1 id="pause-title">
                  {pauseConfirmation === "restart"
                    ? "はじめからやり直しますか？"
                    : "タイトルへ戻りますか？"}
                </h1>
                <div className="pause-panel__confirm-actions">
                  <button
                    type="button"
                    onClick={pauseConfirmation === "restart" ? startNewGame : returnToTitle}
                  >
                    {pauseConfirmation === "restart" ? "やり直す" : "タイトルへ"}
                  </button>
                  <button type="button" className="pause-panel__secondary" onClick={() => setPauseConfirmation(null)}>キャンセル</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <p className="keyboard-hint">← → 移動 ・ ↑ / X 回転 ・ SPACE 高速落下</p>
      </main>
    </>
  );
}
