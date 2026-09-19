export interface AudioSettings {
  enabled: boolean;
  volume: number;
}

type SoundName =
  | 'frontFire'
  | 'broadside'
  | 'explosion'
  | 'woodHit'
  | 'start'
  | 'pause'
  | 'resume'
  | 'timeWarning'
  | 'score'
  | 'collision'
  | 'healthLow'
  | 'complete'
  | 'gameOver';

const SOUND_PATHS: Record<SoundName, readonly string[]> = {
  frontFire: [
    '/audio/cannon_fire_1.wav',
    '/audio/cannon_fire_2.wav',
    '/audio/cannon_fire_3.wav',
  ],
  broadside: ['/audio/cannon_broadside.wav'],
  explosion: [
    '/audio/ship_explosion_1.wav',
    '/audio/ship_explosion_2.wav',
  ],
  woodHit: [
    '/audio/ship_wood_hit_1.wav',
    '/audio/ship_wood_hit_2.wav',
  ],
  start: ['/audio/game_start.wav'],
  pause: ['/audio/game_pause.wav'],
  resume: ['/audio/game_resume.wav'],
  timeWarning: ['/audio/time_warning.wav'],
  score: ['/audio/score_point.wav'],
  collision: ['/audio/ship_collision.wav'],
  healthLow: ['/audio/health_low.wav'],
  complete: ['/audio/game_complete.wav'],
  gameOver: ['/audio/game_over.wav'],
};

export class AudioManager {
  private readonly ambience: HTMLAudioElement | null;
  private readonly activeEffects = new Set<HTMLAudioElement>();
  private readonly soundIndexes = new Map<SoundName, number>();

  constructor(private readonly settings: AudioSettings) {
    if (!settings.enabled) {
      this.ambience = null;
      return;
    }

    this.ambience = new Audio('/audio/ocean_ambience_loop.wav');
    this.ambience.loop = true;
    this.ambience.volume = settings.volume * 0.38;
    this.ambience.preload = 'auto';
  }

  start(): void {
    if (!this.ambience) return;
    void this.ambience.play().catch(() => undefined);
  }

  pause(): void {
    this.ambience?.pause();
  }

  resume(): void {
    this.start();
  }

  play(name: SoundName, volumeMultiplier = 1): void {
    if (!this.settings.enabled) return;

    const paths = SOUND_PATHS[name];
    const soundIndex = this.soundIndexes.get(name) ?? 0;
    this.soundIndexes.set(name, soundIndex + 1);
    const audio = new Audio(paths[soundIndex % paths.length]);
    audio.volume = Math.min(1, this.settings.volume * volumeMultiplier);
    this.activeEffects.add(audio);
    const release = () => this.activeEffects.delete(audio);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    void audio.play().catch(release);
  }

  destroy(): void {
    if (this.ambience) {
      this.ambience.pause();
      this.ambience.currentTime = 0;
    }

    for (const audio of this.activeEffects) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.activeEffects.clear();
  }
}
