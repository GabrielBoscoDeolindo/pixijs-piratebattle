import type { Vector2 } from './types';

const FULL_TURN = Math.PI * 2;

export function forwardFromRotation(rotation: number): Vector2 {
  return {
    x: -Math.sin(rotation),
    y: Math.cos(rotation),
  };
}

export function rotationToward(from: Vector2, to: Vector2): number {
  return Math.atan2(-(to.x - from.x), to.y - from.y);
}

export function rotateToward(
  current: number,
  target: number,
  maximumStep: number,
): number {
  const difference = smallestAngleDifference(current, target);

  if (Math.abs(difference) <= maximumStep) return target;
  return current + Math.sign(difference) * maximumStep;
}

export function smallestAngleDifference(from: number, to: number): number {
  const angle = to - from;
  return ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
}
