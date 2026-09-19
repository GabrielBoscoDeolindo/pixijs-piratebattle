import { useEffect, useRef, useState } from 'react';
import type { GameConfig } from '../game/config';
import type { MatchEndReason } from '../game/types';
import { PixiGame, type HudSnapshot } from '../rendering/PixiGame';
import { TouchControls } from '../components/TouchControls';
import { installGameTestController } from '../testing/browserTestApi';

type LoadingState = 'loading' | 'ready' | 'error';

interface GameScreenProps {
  config: GameConfig;
  soundEnabled: boolean;
  soundVolume: number;
  onExit: () => void;
  onComplete: (summary: CompletedMatchSummary) => void;
}

export interface CompletedMatchSummary {
  score: number;
  durationSeconds: number;
  endReason: MatchEndReason;
}

function createInitialHud(config: GameConfig): HudSnapshot {
  return {
    health: config.player.maxHealth,
    maxHealth: config.player.maxHealth,
    score: 0,
    fps: 0,
    entityCount: 0,
    p95FrameTimeMs: 0,
    phase: 'playing',
    remainingSeconds: config.match.durationSeconds,
    elapsedSeconds: 0,
    endReason: null,
    pauseReason: null,
  };
}

function formatClock(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function healthFillAsset(health: number, maxHealth: number): string {
  const ratio = health / maxHealth;
  if (ratio > 0.6) return '/ui/hud/health_fill_green.png';
  if (ratio > 0.3) return '/ui/hud/health_fill_amber.png';
  return '/ui/hud/health_fill_red.png';
}

function healthFillRightClip(health: number, maxHealth: number): number {
  const ratio = Math.max(0, Math.min(1, health / maxHealth));
  const fillStart = 29;
  const fillWidth = 197;
  const assetWidth = 256;
  const visibleBoundary = fillStart + fillWidth * ratio;
  return ((assetWidth - visibleBoundary) / assetWidth) * 100;
}

export function GameScreen({
  config,
  soundEnabled,
  soundVolume,
  onExit,
  onComplete,
}: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pauseDialogRef = useRef<HTMLElement>(null);
  const gameRef = useRef<PixiGame | null>(null);
  const completionReportedRef = useRef(false);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(config));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let removeTestController: (() => void) | undefined;
    const game = new PixiGame(
      config,
      (snapshot) => {
        if (active) setHud(snapshot);
      },
      { enabled: soundEnabled, volume: soundVolume },
    );
    gameRef.current = game;

    setLoadingState('loading');
    queueMicrotask(() => {
      if (!active) return;

      void game.initialize(host).then(
        () => {
          if (!active) return;
          if (import.meta.env.MODE === 'test') {
            removeTestController = installGameTestController(
              game.createTestController(),
            );
          }
          setLoadingState('ready');
        },
        (error: unknown) => {
          console.warn('Unable to initialize the game.', error);
          if (active) setLoadingState('error');
        },
      );
    });

    return () => {
      active = false;
      removeTestController?.();
      if (gameRef.current === game) gameRef.current = null;
      game.destroy();
    };
  }, [attempt, config, soundEnabled, soundVolume]);

  useEffect(() => {
    if (
      hud.phase !== 'finished' ||
      !hud.endReason ||
      completionReportedRef.current
    ) {
      return;
    }

    completionReportedRef.current = true;
    onComplete({
      score: hud.score,
      durationSeconds: hud.elapsedSeconds,
      endReason: hud.endReason,
    });
  }, [hud, onComplete]);

  useEffect(() => {
    if (hud.phase !== 'paused' || !pauseDialogRef.current) return;

    const dialog = pauseDialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
    );
    focusable[0]?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', trapFocus);
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [hud.phase]);

  return (
    <main className="game-screen">
      <section className="game-arena" aria-busy={loadingState === 'loading'}>
        <div className="canvas-host" ref={hostRef} />
        {loadingState === 'ready' && (
          <div className="combat-hud" aria-label="Match status">
            <div className="hud-health">
              <img className="hud-health__icon" src="/ui/hud/icon_heart.png" alt="" />
              <div className="hud-health__meter">
                <img
                  className="hud-health__fill"
                  src={healthFillAsset(hud.health, hud.maxHealth)}
                  alt=""
                  style={{
                    clipPath: `inset(0 ${healthFillRightClip(hud.health, hud.maxHealth)}% 0 0)`,
                  }}
                />
                <img
                  className="hud-health__frame"
                  src="/ui/hud/health_frame.png"
                  alt=""
                />
                <output aria-label="Player health">
                  {hud.health}/{hud.maxHealth}
                </output>
              </div>
            </div>
            <output className="fps-counter" aria-label="Frames per second">
              {hud.fps > 0
                ? <>
                    <span>{hud.fps} FPS</span>
                    <span className="fps-counter__details">
                      {' '}· {hud.entityCount} entities · p95 {hud.p95FrameTimeMs.toFixed(1)} ms
                    </span>
                  </>
                : '-- FPS'}
            </output>
            <div className="hud-right">
              <div className="hud-counter">
                <img src="/ui/hud/icon_score.png" alt="Score" />
                <output aria-label="Score">{hud.score}</output>
              </div>
              <div className="hud-counter">
                <img src="/ui/hud/icon_time.png" alt="Time" />
                <output aria-label="Time remaining">
                  {formatClock(hud.remainingSeconds)}
                </output>
              </div>
              <button
                className="pause-button"
                type="button"
                aria-label="Pause game"
                data-ui-sound="none"
                onClick={() => gameRef.current?.pause()}
              >
                <img src="/ui/controls/icon_pause.png" alt="" />
              </button>
            </div>
          </div>
        )}
        {hud.phase === 'paused' && (
          <div className="game-dialog-backdrop">
            <section
              ref={pauseDialogRef}
              className="game-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pause-title"
            >
              <h2 id="pause-title">Game Paused</h2>
              <p>
                {hud.pauseReason === 'focusLost'
                  ? 'The game paused because the window lost focus.'
                  : 'The battle is waiting for your command.'}
              </p>
              <button
                className="dialog-button"
                type="button"
                autoFocus
                data-ui-sound="none"
                onClick={() => gameRef.current?.resume()}
              >
                RESUME
              </button>
              <button className="dialog-link" type="button" data-ui-sound="close" onClick={onExit}>
                MAIN MENU
              </button>
            </section>
          </div>
        )}
        {loadingState === 'ready' && hud.phase === 'playing' && (
          <TouchControls
            onAction={(action, pressed) => {
              gameRef.current?.setTouchAction(action, pressed);
            }}
          />
        )}
        <p className="orientation-hint" role="status">
          Landscape orientation is recommended for battle.
        </p>
        {loadingState !== 'ready' && (
          <div className="loading-panel" role="status">
            {loadingState === 'loading' ? (
              <p>Loading the fleet…</p>
            ) : (
              <>
                <p>The game assets could not be loaded.</p>
                <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  Try again
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
