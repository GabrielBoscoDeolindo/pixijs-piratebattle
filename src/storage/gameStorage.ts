import type {
  PlayerIdentity,
  StoredMatchResult,
} from '../api/contracts';
import {
  DEFAULT_OPTIONS,
  type GameOptions,
  validateOptions,
} from '../domain/settings';

const STORAGE_KEYS = {
  options: 'pirate-battle:options:v1',
  player: 'pirate-battle:player:v1',
  lastResult: 'pirate-battle:last-result:v1',
  pendingMatches: 'pirate-battle:pending-matches:v1',
} as const;

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadOptions(): GameOptions {
  const stored = readJson<GameOptions>(STORAGE_KEYS.options);
  if (!stored) return DEFAULT_OPTIONS;

  const candidate = { ...DEFAULT_OPTIONS, ...stored };
  return Object.keys(validateOptions(candidate)).length === 0
    ? candidate
    : DEFAULT_OPTIONS;
}

export function saveOptions(options: GameOptions): void {
  writeJson(STORAGE_KEYS.options, options);
}

export function loadPlayerIdentity(): PlayerIdentity {
  const stored = readJson<PlayerIdentity>(STORAGE_KEYS.player);
  if (stored?.id && stored.name) return stored;

  const id = crypto.randomUUID();
  const player = {
    id,
    name: `Captain ${id.slice(0, 4).toUpperCase()}`,
  };
  writeJson(STORAGE_KEYS.player, player);
  return player;
}

export function loadLastResult(): StoredMatchResult | null {
  const result = readJson<StoredMatchResult>(STORAGE_KEYS.lastResult);
  return result?.submissionStatus === 'submitting'
    ? { ...result, submissionStatus: 'pending' }
    : result;
}

export function saveLastResult(result: StoredMatchResult): void {
  writeJson(STORAGE_KEYS.lastResult, result);
}

export function loadPendingMatches(): StoredMatchResult[] {
  return (readJson<StoredMatchResult[]>(STORAGE_KEYS.pendingMatches) ?? []).map(
    (result) =>
      result.submissionStatus === 'submitting'
        ? { ...result, submissionStatus: 'pending' }
        : result,
  );
}

export function savePendingMatch(result: StoredMatchResult): void {
  const matches = loadPendingMatches();
  const index = matches.findIndex((match) => match.matchId === result.matchId);

  if (index >= 0) matches[index] = result;
  else matches.push(result);

  writeJson(STORAGE_KEYS.pendingMatches, matches);
  saveLastResult(result);
}

export function removePendingMatch(matchId: string): void {
  writeJson(
    STORAGE_KEYS.pendingMatches,
    loadPendingMatches().filter((match) => match.matchId !== matchId),
  );
}
