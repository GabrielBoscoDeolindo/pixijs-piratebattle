import { useQueryClient } from '@tanstack/react-query';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MatchRecord, StoredMatchResult } from './api/contracts';
import { submitMatch } from './api/matchesApi';
import { useUiSounds } from './audio/useUiSounds';
import { createGameConfig, type GameOptions } from './domain/settings';
import type { CompletedMatchSummary } from './screens/GameScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MenuScreen } from './screens/MenuScreen';
import { OptionsScreen } from './screens/OptionsScreen';
import { RankingScreen } from './screens/RankingScreen';
import { ResultScreen } from './screens/ResultScreen';
import {
  loadLastResult,
  loadOptions,
  loadPlayerIdentity,
  loadPendingMatches,
  removePendingMatch,
  saveLastResult,
  saveOptions,
  savePendingMatch,
} from './storage/gameStorage';

type AppScreen = 'menu' | 'options' | 'game' | 'ranking' | 'history' | 'result';

const ACTIVE_SCREEN_KEY = 'pirate-battle:active-screen:v1';
const GameScreen = lazy(async () => {
  const module = await import('./screens/GameScreen');
  return { default: module.GameScreen };
});

export function App() {
  const queryClient = useQueryClient();
  const pendingSyncInFlightRef = useRef(false);
  const [options, setOptions] = useState(loadOptions);
  const [player] = useState(loadPlayerIdentity);
  const [result, setResult] = useState<StoredMatchResult | null>(loadLastResult);
  const [screen, setScreen] = useState<AppScreen>(() => {
    return sessionStorage.getItem(ACTIVE_SCREEN_KEY) === 'result' && loadLastResult()
      ? 'result'
      : 'menu';
  });
  const gameConfig = useMemo(() => createGameConfig(options), [options]);
  useUiSounds({ enabled: options.soundEnabled, volume: options.soundVolume });

  useEffect(() => {
    if (screen === 'result') return;

    const syncPendingMatches = async () => {
      if (pendingSyncInFlightRef.current) return;
      pendingSyncInFlightRef.current = true;

      try {
        for (const pending of loadPendingMatches()) {
          try {
            const match: MatchRecord = {
              matchId: pending.matchId,
              playerId: pending.playerId,
              playerName: pending.playerName,
              completedAt: pending.completedAt,
              score: pending.score,
              durationSeconds: pending.durationSeconds,
              endReason: pending.endReason,
              config: pending.config,
            };
            await submitMatch(match);
            removePendingMatch(pending.matchId);
            const synced = { ...pending, submissionStatus: 'synced' as const };
            if (loadLastResult()?.matchId === pending.matchId) {
              saveLastResult(synced);
              setResult(synced);
            }
          } catch {
            savePendingMatch({ ...pending, submissionStatus: 'failed' });
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['ranking'] });
        await queryClient.invalidateQueries({ queryKey: ['match-history'] });
      } finally {
        pendingSyncInFlightRef.current = false;
      }
    };

    void syncPendingMatches();
    const handleOnline = () => void syncPendingMatches();
    const handleMockReady = () => void syncPendingMatches();
    window.addEventListener('online', handleOnline);
    window.addEventListener('pirate-battle:mock-ready', handleMockReady);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pirate-battle:mock-ready', handleMockReady);
    };
  }, [queryClient, screen]);

  const navigate = (nextScreen: AppScreen) => {
    sessionStorage.setItem(ACTIVE_SCREEN_KEY, nextScreen);
    setScreen(nextScreen);
  };

  const completeMatch = useCallback((summary: CompletedMatchSummary) => {
    const completed: StoredMatchResult = {
      matchId: crypto.randomUUID(),
      playerId: player.id,
      playerName: player.name,
      completedAt: new Date().toISOString(),
      score: summary.score,
      durationSeconds: summary.durationSeconds,
      endReason: summary.endReason,
      config: {
        durationSeconds: options.durationSeconds,
        spawnIntervalSeconds: options.spawnIntervalSeconds,
      },
      submissionStatus: 'pending',
    };

    savePendingMatch(completed);
    setResult(completed);
    navigate('result');
  }, [options, player]);

  if (screen === 'game') {
    return (
      <Suspense
        fallback={(
          <main className="game-screen">
            <div className="loading-panel" role="status">Preparing the battle…</div>
          </main>
        )}
      >
        <GameScreen
          config={gameConfig}
          soundEnabled={options.soundEnabled}
          soundVolume={options.soundVolume}
          onExit={() => navigate('menu')}
          onComplete={completeMatch}
        />
      </Suspense>
    );
  }

  if (screen === 'options') {
    return (
      <OptionsScreen
        options={options}
        onSave={(nextOptions: GameOptions) => {
          saveOptions(nextOptions);
          setOptions(nextOptions);
          navigate('menu');
        }}
        onBack={() => navigate('menu')}
      />
    );
  }

  if (screen === 'ranking') {
    return (
      <RankingScreen
        config={{
          durationSeconds: options.durationSeconds,
          spawnIntervalSeconds: options.spawnIntervalSeconds,
        }}
        onBack={() => navigate('menu')}
      />
    );
  }

  if (screen === 'history') {
    return <HistoryScreen player={player} onBack={() => navigate('menu')} />;
  }

  if (screen === 'result' && result) {
    return (
      <ResultScreen
        result={result}
        onResultUpdated={setResult}
        onPlayAgain={() => navigate('game')}
        onMenu={() => navigate('menu')}
      />
    );
  }

  return (
    <MenuScreen
      onPlay={() => navigate('game')}
      onOptions={() => navigate('options')}
      onRanking={() => navigate('ranking')}
      onHistory={() => navigate('history')}
    />
  );
}
