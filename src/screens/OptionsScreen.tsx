import { useState, type FormEvent } from 'react';
import {
  OPTIONS_LIMITS,
  type GameOptions,
  validateOptions,
} from '../domain/settings';

interface OptionsScreenProps {
  options: GameOptions;
  onSave: (options: GameOptions) => void;
  onBack: () => void;
}

export function OptionsScreen({ options, onSave, onBack }: OptionsScreenProps) {
  const [draft, setDraft] = useState(options);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateOptions(draft) : {};

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateOptions(draft)).length > 0) return;
    onSave(draft);
  };

  return (
    <main className="ui-scene">
      <form className="content-panel options-form" onSubmit={submit} noValidate>
        <h1>Options</h1>
        <p className="screen-intro">Tune the next voyage. Active matches keep their original configuration.</p>

        <label className="field-label" htmlFor="session-time">Game session time</label>
        <div className="number-field">
          <input
            id="session-time"
            type="number"
            min={OPTIONS_LIMITS.durationSeconds.minimum}
            max={OPTIONS_LIMITS.durationSeconds.maximum}
            step="10"
            value={draft.durationSeconds}
            aria-describedby="session-help session-error"
            aria-invalid={Boolean(errors.durationSeconds)}
            onChange={(event) => setDraft({
              ...draft,
              durationSeconds: Number.isNaN(event.currentTarget.valueAsNumber)
                ? 0
                : event.currentTarget.valueAsNumber,
            })}
          />
          <span>seconds</span>
        </div>
        <p className="field-help" id="session-help">Allowed range: 60–180 seconds.</p>
        <p className="field-error" id="session-error" role="alert">{errors.durationSeconds}</p>

        <label className="field-label" htmlFor="spawn-time">Enemy spawn time</label>
        <div className="number-field">
          <input
            id="spawn-time"
            type="number"
            min={OPTIONS_LIMITS.spawnIntervalSeconds.minimum}
            max={OPTIONS_LIMITS.spawnIntervalSeconds.maximum}
            step="1"
            value={draft.spawnIntervalSeconds}
            aria-describedby="spawn-help spawn-error"
            aria-invalid={Boolean(errors.spawnIntervalSeconds)}
            onChange={(event) => setDraft({
              ...draft,
              spawnIntervalSeconds: Number.isNaN(event.currentTarget.valueAsNumber)
                ? 0
                : event.currentTarget.valueAsNumber,
            })}
          />
          <span>seconds</span>
        </div>
        <p className="field-help" id="spawn-help">Allowed range: 2–15 seconds.</p>
        <p className="field-error" id="spawn-error" role="alert">{errors.spawnIntervalSeconds}</p>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={draft.soundEnabled}
            onChange={(event) => setDraft({ ...draft, soundEnabled: event.currentTarget.checked })}
          />
          <span>Sound effects and ambience</span>
        </label>

        <label className="field-label" htmlFor="sound-volume">Sound volume</label>
        <input
          id="sound-volume"
          className="range-field"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={draft.soundVolume}
          disabled={!draft.soundEnabled}
          onChange={(event) => setDraft({
            ...draft,
            soundVolume: event.currentTarget.valueAsNumber,
          })}
        />

        <div className="screen-actions">
          <button className="text-button text-button--primary" type="submit">SAVE</button>
          <button className="text-button" type="button" data-ui-sound="close" onClick={onBack}>CANCEL</button>
        </div>
      </form>
    </main>
  );
}
