import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ContinuousInputAction } from '../input/KeyboardInput';

interface TouchControlsProps {
  onAction: (action: ContinuousInputAction, pressed: boolean) => void;
}

interface TouchButtonProps {
  action: ContinuousInputAction;
  label: string;
  icon: string;
  onAction: TouchControlsProps['onAction'];
}

function TouchButton({ action, label, icon, onAction }: TouchButtonProps) {
  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onAction(action, true);
  };
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onAction(action, false);
  };

  return (
    <button
      data-ui-sound="none"
      className="touch-button"
      type="button"
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => onAction(action, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img src={`/ui/controls/${icon}.png`} alt="" />
    </button>
  );
}

interface AutoSailButtonProps {
  active: boolean;
  onToggle: () => void;
}

function AutoSailButton({ active, onToggle }: AutoSailButtonProps) {
  return (
    <button
      data-ui-sound="none"
      className={`touch-button touch-button--auto${active ? ' is-active' : ''}`}
      type="button"
      aria-label="Auto sail"
      aria-pressed={active}
      onClick={onToggle}
    >
      <img src="/ui/controls/icon_forward.png" alt="" />
      <span>AUTO</span>
    </button>
  );
}

export function TouchControls({ onAction }: TouchControlsProps) {
  const [autoSail, setAutoSail] = useState(false);

  const toggleAutoSail = () => {
    setAutoSail((current) => {
      const next = !current;
      onAction('forward', next);
      return next;
    });
  };

  return (
    <div className="touch-controls" aria-label="Touch game controls">
      <div className="touch-controls__movement">
        <TouchButton action="turnLeft" label="Turn left" icon="icon_turn_left" onAction={onAction} />
        <AutoSailButton active={autoSail} onToggle={toggleAutoSail} />
        <TouchButton action="turnRight" label="Turn right" icon="icon_turn_right" onAction={onAction} />
      </div>
      <div className="touch-controls__weapons">
        <TouchButton action="fireLeft" label="Fire left broadside" icon="icon_fire_left" onAction={onAction} />
        <TouchButton action="fireFront" label="Fire front cannon" icon="icon_fire_front" onAction={onAction} />
        <TouchButton action="fireRight" label="Fire right broadside" icon="icon_fire_right" onAction={onAction} />
      </div>
    </div>
  );
}
