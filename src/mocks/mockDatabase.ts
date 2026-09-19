import type { MatchRecord } from '../api/contracts';

const CONFIRMED_MATCHES_KEY = 'pirate-battle:mock-confirmed-matches:v1';

const captains = [
  'Captain Anne',
  'Black Finn',
  'Red Morgan',
  'Silver Jack',
  'Captain Mira',
  'Storm Quinn',
  'Iron Mary',
  'Old Rowan',
];

const fixtureConfigs = [
  { durationSeconds: 60, spawnIntervalSeconds: 4 },
  { durationSeconds: 90, spawnIntervalSeconds: 6 },
  { durationSeconds: 120, spawnIntervalSeconds: 8 },
];

const fixtures: MatchRecord[] = fixtureConfigs.flatMap((config, configIndex) =>
  captains.map((name, index) => ({
    matchId: `fixture-${configIndex}-${index}`,
    playerId: `fixture-player-${index}`,
    playerName: name,
    completedAt: new Date(
      Date.UTC(2026, 8, 18 - index - configIndex),
    ).toISOString(),
    score: 17 - index + configIndex * 2,
    durationSeconds: config.durationSeconds - (index % 3) * 4,
    endReason: index % 3 === 0 ? 'playerDestroyed' : 'timeExpired',
    config,
  })),
);

function readConfirmedMatches(): MatchRecord[] {
  try {
    const stored = localStorage.getItem(CONFIRMED_MATCHES_KEY);
    return stored ? JSON.parse(stored) as MatchRecord[] : [];
  } catch {
    return [];
  }
}

function writeConfirmedMatches(matches: MatchRecord[]): void {
  localStorage.setItem(CONFIRMED_MATCHES_KEY, JSON.stringify(matches));
}

export function getAllMatches(): MatchRecord[] {
  return [...fixtures, ...readConfirmedMatches()];
}

export function confirmMatch(match: MatchRecord): MatchRecord {
  const confirmed = readConfirmedMatches();
  const existing = confirmed.find((candidate) => candidate.matchId === match.matchId);
  if (existing) return existing;

  confirmed.push(match);
  writeConfirmedMatches(confirmed);
  return match;
}

export function resetMockDatabase(): void {
  localStorage.removeItem(CONFIRMED_MATCHES_KEY);
}
