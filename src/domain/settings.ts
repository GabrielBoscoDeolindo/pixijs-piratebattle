import { GAME_CONFIG, type GameConfig } from '../game/config';

export interface GameOptions {
  durationSeconds: number;
  spawnIntervalSeconds: number;
  soundEnabled: boolean;
  soundVolume: number;
}

export type OptionsErrors = Partial<Record<keyof GameOptions, string>>;

export const OPTIONS_LIMITS = {
  durationSeconds: { minimum: 60, maximum: 180 },
  spawnIntervalSeconds: { minimum: 2, maximum: 15 },
  soundVolume: { minimum: 0, maximum: 1 },
} as const;

export const DEFAULT_OPTIONS: GameOptions = {
  durationSeconds: GAME_CONFIG.match.durationSeconds,
  spawnIntervalSeconds: GAME_CONFIG.spawn.intervalSeconds,
  soundEnabled: true,
  soundVolume: 0.45,
};

export function validateOptions(options: GameOptions): OptionsErrors {
  const errors: OptionsErrors = {};

  if (
    !Number.isFinite(options.durationSeconds) ||
    options.durationSeconds < OPTIONS_LIMITS.durationSeconds.minimum ||
    options.durationSeconds > OPTIONS_LIMITS.durationSeconds.maximum
  ) {
    errors.durationSeconds = 'Choose a duration between 60 and 180 seconds.';
  }

  if (
    !Number.isFinite(options.spawnIntervalSeconds) ||
    options.spawnIntervalSeconds < OPTIONS_LIMITS.spawnIntervalSeconds.minimum ||
    options.spawnIntervalSeconds > OPTIONS_LIMITS.spawnIntervalSeconds.maximum
  ) {
    errors.spawnIntervalSeconds = 'Choose a spawn interval between 2 and 15 seconds.';
  }

  if (
    !Number.isFinite(options.soundVolume) ||
    options.soundVolume < OPTIONS_LIMITS.soundVolume.minimum ||
    options.soundVolume > OPTIONS_LIMITS.soundVolume.maximum
  ) {
    errors.soundVolume = 'Volume must be between 0 and 100 percent.';
  }

  return errors;
}

export function createGameConfig(options: GameOptions): GameConfig {
  return {
    ...GAME_CONFIG,
    match: {
      ...GAME_CONFIG.match,
      durationSeconds: options.durationSeconds,
    },
    spawn: {
      ...GAME_CONFIG.spawn,
      intervalSeconds: options.spawnIntervalSeconds,
    },
  };
}
