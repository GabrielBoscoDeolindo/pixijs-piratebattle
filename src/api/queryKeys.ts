import type { MatchConfigSnapshot } from './contracts';

export const queryKeys = {
  ranking: (config: MatchConfigSnapshot, page: number) => [
    'ranking',
    config.durationSeconds,
    config.spawnIntervalSeconds,
    page,
  ] as const,
  history: (playerId: string, page: number) => [
    'match-history',
    playerId,
    page,
  ] as const,
};
