import { useEffect } from 'react';
import type { AudioSettings } from './AudioManager';

const UI_SOUND_PATHS = {
  click: '/audio/ui_click.wav',
  close: '/audio/ui_close.wav',
  hover: '/audio/ui_hover.wav',
} as const;

type UiSoundName = keyof typeof UI_SOUND_PATHS;

function findEnabledButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest('button');
  return button instanceof HTMLButtonElement && !button.disabled ? button : null;
}

export function useUiSounds({ enabled, volume }: AudioSettings): void {
  useEffect(() => {
    if (!enabled) return;

    const activeSounds = new Set<HTMLAudioElement>();
    const play = (name: UiSoundName, volumeMultiplier = 1) => {
      const audio = new Audio(UI_SOUND_PATHS[name]);
      audio.volume = Math.min(1, volume * volumeMultiplier);
      activeSounds.add(audio);
      const release = () => activeSounds.delete(audio);
      audio.addEventListener('ended', release, { once: true });
      audio.addEventListener('error', release, { once: true });
      void audio.play().catch(release);
    };

    const handleClick = (event: MouseEvent) => {
      const button = findEnabledButton(event.target);
      if (!button || button.dataset.uiSound === 'none') return;
      play(button.dataset.uiSound === 'close' ? 'close' : 'click', 0.72);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const button = findEnabledButton(event.target);
      if (
        !button ||
        button.dataset.uiSound === 'none' ||
        button.contains(event.relatedTarget as Node | null)
      ) return;
      play('hover', 0.38);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('pointerover', handlePointerOver, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('pointerover', handlePointerOver, true);
      for (const audio of activeSounds) {
        audio.pause();
        audio.currentTime = 0;
      }
      activeSounds.clear();
    };
  }, [enabled, volume]);
}
