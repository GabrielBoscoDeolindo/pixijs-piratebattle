import type { GameConfig } from '../config';
import type { ChaserState, PlayerState } from '../types';
import { steerEnemy } from './navigationSystem';

export function updateChaser(
  chaser: ChaserState,
  player: PlayerState,
  deltaSeconds: number,
  config: GameConfig,
): void {
  steerEnemy(
    chaser,
    player,
    deltaSeconds,
    config.chaser.moveSpeed,
    config.chaser.rotationSpeed,
    true,
    config,
  );
}
