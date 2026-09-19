import type { InputState } from '../game/types';

const CONTROL_KEYS = new Set([
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyD',
  'KeyQ',
  'KeyE',
  'Space',
  'Escape',
]);

export interface KeyboardSnapshot extends InputState {
  pauseRequested: boolean;
}

export type ContinuousInputAction = keyof InputState;

const EMPTY_INPUT: InputState = {
  forward: false,
  turnLeft: false,
  turnRight: false,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
};

export class KeyboardInput {
  private readonly pressedKeys = new Set<string>();
  private readonly touchState: InputState = { ...EMPTY_INPUT };
  private pauseRequested = false;

  constructor(private readonly target: Window = window) {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.clear);
  }

  getState(): KeyboardSnapshot {
    const snapshot = {
      forward: this.hasAny('ArrowUp', 'KeyW') || this.touchState.forward,
      turnLeft: this.hasAny('ArrowLeft', 'KeyA') || this.touchState.turnLeft,
      turnRight: this.hasAny('ArrowRight', 'KeyD') || this.touchState.turnRight,
      fireFront: this.hasAny('Space') || this.touchState.fireFront,
      fireLeft: this.hasAny('KeyQ') || this.touchState.fireLeft,
      fireRight: this.hasAny('KeyE') || this.touchState.fireRight,
      pauseRequested: this.pauseRequested,
    };
    this.pauseRequested = false;
    return snapshot;
  }

  reset(): void {
    this.clear();
    Object.assign(this.touchState, EMPTY_INPUT);
  }

  setTouchAction(action: ContinuousInputAction, pressed: boolean): void {
    this.touchState[action] = pressed;
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.clear);
    this.pressedKeys.clear();
    Object.assign(this.touchState, EMPTY_INPUT);
    this.pauseRequested = false;
  }

  private hasAny(...codes: string[]): boolean {
    return codes.some((code) => this.pressedKeys.has(code));
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!CONTROL_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.code === 'Escape' && !event.repeat) {
      this.pauseRequested = true;
      return;
    }
    this.pressedKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!CONTROL_KEYS.has(event.code)) return;
    event.preventDefault();
    this.pressedKeys.delete(event.code);
  };

  private readonly clear = (): void => {
    this.pressedKeys.clear();
  };
}
