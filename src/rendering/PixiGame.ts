import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  TilingSprite,
} from 'pixi.js';
import { AudioManager, type AudioSettings } from '../audio/AudioManager';
import type { GameConfig } from '../game/config';
import {
  GameSession,
  type GameSessionTestSetup,
  type GameSessionTestSnapshot,
} from '../game/GameSession';
import type {
  EffectState,
  EnemyState,
  MatchEndReason,
  MatchPhase,
  PauseReason,
} from '../game/types';
import {
  KeyboardInput,
  type ContinuousInputAction,
} from '../input/KeyboardInput';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';

const PLAYER_TEXTURE_URL = '/game/ships/player.png';
const WATER_TEXTURE_URL = '/game/water.png';
const ISLAND_TEXTURE_URL = '/game/island.png';
const CANNON_BALL_TEXTURE_URL = '/game/projectiles/cannon_ball.png';
const CHASER_TEXTURE_URL = '/game/ships/chaser.png';
const SHOOTER_TEXTURE_URL = '/game/ships/shooter.png';
const EXPLOSION_TEXTURE_URLS = [
  '/game/effects/explosion_1.png',
  '/game/effects/explosion_2.png',
  '/game/effects/explosion_3.png',
] as const;
const FIRE_TEXTURE_URLS = [
  '/game/effects/fire_1.png',
  '/game/effects/fire_2.png',
] as const;
const CAMERA_SHAKE = {
  maximumOffsetPixels: 16,
  decayPerSecond: 2.6,
  damageTrauma: 0.45,
  explosionTrauma: 0.72,
} as const;

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  score: number;
  fps: number;
  entityCount: number;
  p95FrameTimeMs: number;
  phase: MatchPhase;
  remainingSeconds: number;
  elapsedSeconds: number;
  endReason: MatchEndReason | null;
  pauseReason: PauseReason | null;
}

interface EnemyView {
  container: Container;
  sprite: Sprite;
  healthBar: Graphics;
}

export interface PixiGameTestController {
  advance: (seconds: number) => GameSessionTestSnapshot;
  setup: (setup: GameSessionTestSetup) => GameSessionTestSnapshot;
  snapshot: () => GameSessionTestSnapshot;
}

export class PixiGame {
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly enemyLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly effectLayer = new Container();
  private readonly session: GameSession;
  private readonly audio: AudioManager;
  private readonly input = new KeyboardInput();
  private readonly performanceMonitor = new PerformanceMonitor();
  private readonly manualSimulation = import.meta.env.MODE === 'test';
  private readonly projectileSprites = new Map<number, Sprite>();
  private readonly enemyViews = new Map<number, EnemyView>();
  private readonly effectSprites = new Map<number, Sprite>();
  private playerSprite: Sprite | null = null;
  private playerHealthBar: Graphics | null = null;
  private cannonBallTexture: Texture | null = null;
  private chaserTexture: Texture | null = null;
  private shooterTexture: Texture | null = null;
  private explosionTextures: Texture[] = [];
  private fireTextures: Texture[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private initialized = false;
  private destroyed = false;
  private lastScore = -1;
  private lastHealth = -1;
  private lastRemainingSecond = -1;
  private lastPhase: MatchPhase | null = null;
  private fpsPublishElapsed = 0;
  private worldBaseX = 0;
  private worldBaseY = 0;
  private shakeTrauma = 0;
  private shakeElapsed = 0;

  constructor(
    private readonly config: GameConfig,
    private readonly onHudChange?: (snapshot: HudSnapshot) => void,
    audioSettings: AudioSettings = { enabled: true, volume: 0.45 },
  ) {
    this.config = structuredClone(config);
    this.session = new GameSession(this.config);
    this.audio = new AudioManager(audioSettings);
  }

  async initialize(host: HTMLDivElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      backgroundColor: 0x0a7591,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    });
    this.initialized = true;

    if (
      this.manualSimulation &&
      sessionStorage.getItem('pirate-battle:test-asset-failure:v1') === 'true'
    ) {
      throw new Error('Simulated asset-loading failure.');
    }

    if (this.destroyed) {
      this.app.destroy({ removeView: true });
      return;
    }

    this.app.canvas.setAttribute('aria-label', 'Pirate Battle game arena');
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    window.addEventListener('blur', this.pauseAutomatically);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    const [
      waterTexture,
      islandTexture,
      playerTexture,
      cannonBallTexture,
      chaserTexture,
      shooterTexture,
      explosionTextures,
      fireTextures,
    ] = await Promise.all([
      Assets.load<Texture>(WATER_TEXTURE_URL),
      Assets.load<Texture>(ISLAND_TEXTURE_URL),
      Assets.load<Texture>(PLAYER_TEXTURE_URL),
      Assets.load<Texture>(CANNON_BALL_TEXTURE_URL),
      Assets.load<Texture>(CHASER_TEXTURE_URL),
      Assets.load<Texture>(SHOOTER_TEXTURE_URL),
      Promise.all(
        EXPLOSION_TEXTURE_URLS.map((url) => Assets.load<Texture>(url)),
      ),
      Promise.all(FIRE_TEXTURE_URLS.map((url) => Assets.load<Texture>(url))),
    ]);

    if (this.destroyed) return;

    this.createArena(waterTexture, islandTexture);
    this.cannonBallTexture = cannonBallTexture;
    this.chaserTexture = chaserTexture;
    this.shooterTexture = shooterTexture;
    this.explosionTextures = explosionTextures;
    this.fireTextures = fireTextures;
    this.createPlayer(playerTexture);
    this.syncEnemyViews();
    this.publishHudSnapshot(true);
    this.resizeObserver = new ResizeObserver(this.fitWorld);
    this.resizeObserver.observe(host);
    this.fitWorld();
    this.app.ticker.add(this.tick);
    this.audio.start();
    this.audio.play('start', 0.72);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.input.destroy();
    this.audio.destroy();
    this.resizeObserver?.disconnect();
    window.removeEventListener('blur', this.pauseAutomatically);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (!this.initialized) return;

    this.app.ticker.remove(this.tick);
    this.projectileSprites.clear();
    this.enemyViews.clear();
    this.effectSprites.clear();
    this.app.destroy({ removeView: true }, { children: true });
  }

  private createArena(waterTexture: Texture, islandTexture: Texture): void {
    const { width, height } = this.config.arena;
    const water = new TilingSprite({ texture: waterTexture, width, height });
    water.tileScale.set(2);

    const border = new Graphics()
      .rect(2, 2, width - 4, height - 4)
      .stroke({ color: 0xb7edf1, width: 4, alpha: 0.7 });

    this.world.addChild(water, border);

    for (const island of this.config.islands) {
      const islandSprite = new Sprite(islandTexture);
      islandSprite.anchor.set(0.5);
      islandSprite.position.set(island.x, island.y);
      islandSprite.width = island.spriteSize;
      islandSprite.height = island.spriteSize;
      this.world.addChild(islandSprite);
    }

    this.world.addChild(this.enemyLayer, this.projectileLayer);
  }

  private createPlayer(texture: Texture): void {
    this.playerSprite = new Sprite(texture);
    this.playerSprite.anchor.set(0.5);
    this.playerSprite.scale.set(0.88);
    this.world.addChild(this.playerSprite);
    this.playerHealthBar = new Graphics();
    this.world.addChild(this.playerHealthBar);
    this.world.addChild(this.effectLayer);
    this.syncPlayerSprite();
  }

  private readonly tick = (): void => {
    const deltaSeconds = this.app.ticker.deltaMS / 1000;
    const input = this.input.getState();

    this.handlePauseInput(input.pauseRequested);

    if (!this.manualSimulation) this.session.update(deltaSeconds, input);
    this.syncPlayerSprite();
    this.syncEnemyViews();
    this.syncProjectileSprites();
    this.syncEffectSprites();
    this.performanceMonitor.record(
      this.app.ticker.deltaMS,
      1 +
        this.session.state.enemies.length +
        this.session.state.projectiles.length +
        this.session.state.effects.length,
    );
    this.fpsPublishElapsed += deltaSeconds;
    const shouldPublishFps = this.fpsPublishElapsed >= 0.5;
    if (shouldPublishFps) this.fpsPublishElapsed = 0;
    this.publishHudSnapshot(shouldPublishFps);
    this.updateScreenShake(deltaSeconds);
  };

  createTestController(): PixiGameTestController {
    if (!this.manualSimulation) {
      throw new Error('The deterministic game controller is only available in test mode.');
    }

    return {
      advance: (seconds) => this.advanceForTest(seconds),
      setup: (setup) => {
        this.session.configureForTest(setup);
        this.synchronizeAfterTestStep();
        return this.session.createTestSnapshot();
      },
      snapshot: () => this.session.createTestSnapshot(),
    };
  }

  pause(): void {
    if (this.session.state.match.phase !== 'playing') return;
    this.session.pause('manual');
    this.input.reset();
    this.audio.pause();
    this.audio.play('pause', 0.68);
    this.publishHudSnapshot(true);
  }

  resume(): void {
    if (this.session.state.match.phase !== 'paused') return;
    this.session.resume();
    this.input.reset();
    this.audio.resume();
    this.audio.play('resume', 0.68);
    this.publishHudSnapshot(true);
  }

  setTouchAction(action: ContinuousInputAction, pressed: boolean): void {
    if (this.session.state.match.phase !== 'playing') return;
    this.input.setTouchAction(action, pressed);
  }

  private advanceForTest(seconds: number): GameSessionTestSnapshot {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 240) {
      throw new Error('Test time must be between 0 and 240 seconds.');
    }

    let remaining = seconds;
    const fixedStep = 1 / 60;
    while (remaining > 0) {
      const step = Math.min(fixedStep, remaining);
      const input = this.input.getState();
      this.handlePauseInput(input.pauseRequested);
      this.session.update(step, input);
      remaining -= step;
    }

    this.synchronizeAfterTestStep();
    return this.session.createTestSnapshot();
  }

  private synchronizeAfterTestStep(): void {
    this.syncPlayerSprite();
    this.syncEnemyViews();
    this.syncProjectileSprites();
    this.syncEffectSprites();
    this.publishHudSnapshot(true);
  }

  private handlePauseInput(pauseRequested: boolean): void {
    if (!pauseRequested) return;
    if (this.session.state.match.phase === 'playing') {
      this.pause();
    } else if (this.session.state.match.phase === 'paused') {
      this.resume();
    }
  }

  private readonly pauseAutomatically = (): void => {
    if (this.session.state.match.phase !== 'playing') return;
    this.session.pause('focusLost');
    this.input.reset();
    this.audio.pause();
    this.audio.play('pause', 0.58);
    this.publishHudSnapshot(true);
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.pauseAutomatically();
    }
  };

  private syncPlayerSprite(): void {
    if (!this.playerSprite) return;
    const { player } = this.session.state;
    this.playerSprite.position.set(player.x, player.y);
    this.playerSprite.rotation = player.rotation;
    this.playerSprite.tint = this.getDamageTint(
      player.health / this.config.player.maxHealth,
    );

    if (this.playerHealthBar) {
      this.playerHealthBar.position.set(player.x, player.y - 62);
      this.drawHealthBar(
        this.playerHealthBar,
        player.health / this.config.player.maxHealth,
        0x39c968,
        72,
      );
    }
  }

  private syncEnemyViews(): void {
    if (!this.chaserTexture || !this.shooterTexture) return;

    const activeIds = new Set<number>();

    for (const enemy of this.session.state.enemies) {
      activeIds.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);

      if (!view) {
        view = this.createEnemyView(enemy);
        this.enemyViews.set(enemy.id, view);
        this.enemyLayer.addChild(view.container);
      }

      view.container.position.set(enemy.x, enemy.y);
      view.sprite.rotation = enemy.rotation;
      view.sprite.tint = this.getDamageTint(enemy.health / enemy.maxHealth);
      this.drawHealthBar(
        view.healthBar,
        enemy.health / enemy.maxHealth,
        enemy.health / enemy.maxHealth > 0.4 ? 0x39c968 : 0xe34235,
        64,
      );
    }

    for (const [id, view] of this.enemyViews) {
      if (activeIds.has(id)) continue;
      view.container.destroy({ children: true });
      this.enemyViews.delete(id);
    }
  }

  private createEnemyView(enemy: EnemyState): EnemyView {
    const container = new Container();
    const texture = enemy.kind === 'chaser'
      ? this.chaserTexture!
      : this.shooterTexture!;
    const sprite = new Sprite(texture);
    const healthBar = new Graphics();

    sprite.anchor.set(0.5);
    sprite.scale.set(0.82);
    healthBar.position.set(0, -63);
    sprite.rotation = enemy.rotation;
    container.addChild(sprite, healthBar);

    return { container, sprite, healthBar };
  }

  private syncEffectSprites(): void {
    if (this.explosionTextures.length === 0 || this.fireTextures.length === 0) {
      return;
    }

    const activeIds = new Set<number>();

    for (const effect of this.session.state.effects) {
      activeIds.add(effect.id);
      let sprite = this.effectSprites.get(effect.id);

      if (!sprite) {
        sprite = this.createEffectSprite(effect);
        this.effectSprites.set(effect.id, sprite);
        this.effectLayer.addChild(sprite);
        if (effect.kind === 'explosion') {
          this.audio.play('explosion', 0.9);
          this.addScreenShake(CAMERA_SHAKE.explosionTrauma);
        }
      }

      const textures = this.getEffectTextures(effect);
      const progress = effect.age / effect.duration;
      const frameIndex = Math.min(
        textures.length - 1,
        Math.floor(progress * textures.length),
      );
      sprite.texture = textures[frameIndex];
      sprite.position.set(effect.x, effect.y);
      sprite.rotation = effect.rotation;
      sprite.alpha = 1 - Math.max(0, progress - 0.72) / 0.28;
    }

    for (const [id, sprite] of this.effectSprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      this.effectSprites.delete(id);
    }
  }

  private createEffectSprite(effect: EffectState): Sprite {
    const sprite = new Sprite(this.getEffectTextures(effect)[0]);
    sprite.anchor.set(0.5);
    sprite.scale.set(
      effect.kind === 'explosion' ? 1.15 : effect.kind === 'muzzle' ? 0.55 : 0.42,
    );
    sprite.position.set(effect.x, effect.y);
    sprite.rotation = effect.rotation;
    return sprite;
  }

  private getEffectTextures(effect: EffectState): Texture[] {
    if (effect.kind === 'muzzle') return this.fireTextures;
    if (effect.kind === 'impact') return [this.explosionTextures[0]];
    return this.explosionTextures;
  }

  private drawHealthBar(
    graphics: Graphics,
    ratio: number,
    fillColor: number,
    width: number,
  ): void {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    graphics
      .clear()
      .roundRect(-width / 2 - 3, -6, width + 6, 12, 6)
      .fill({ color: 0x142633, alpha: 0.9 })
      .roundRect(-width / 2, -3, width * clampedRatio, 6, 3)
      .fill(fillColor);
  }

  private getDamageTint(healthRatio: number): number {
    if (healthRatio > 0.66) return 0xffffff;
    if (healthRatio > 0.33) return 0xffcf8a;
    return 0xff7566;
  }

  private publishHudSnapshot(force = false): void {
    const { player, score, match } = this.session.state;
    const remainingSecond = Math.ceil(match.remainingSeconds);
    if (
      !force &&
      score === this.lastScore &&
      player.health === this.lastHealth &&
      remainingSecond === this.lastRemainingSecond &&
      match.phase === this.lastPhase
    ) {
      return;
    }

    if (this.lastHealth >= 0 && player.health < this.lastHealth) {
      const damageTaken = this.lastHealth - player.health;
      this.audio.play(
        damageTaken >= this.config.chaser.collisionDamage ? 'collision' : 'woodHit',
        0.8,
      );
      if (
        this.lastHealth > this.config.player.maxHealth * 0.3 &&
        player.health <= this.config.player.maxHealth * 0.3 &&
        player.health > 0
      ) {
        this.audio.play('healthLow', 0.82);
      }
      const damageRatio = damageTaken / this.config.player.maxHealth;
      this.addScreenShake(
        CAMERA_SHAKE.damageTrauma + Math.min(0.3, damageRatio),
      );
    }
    if (this.lastScore >= 0 && score > this.lastScore) {
      this.audio.play('score', 0.72);
    }
    if (
      this.lastRemainingSecond > 10 &&
      remainingSecond <= 10 &&
      remainingSecond > 0
    ) {
      this.audio.play('timeWarning', 0.8);
    }
    if (this.lastPhase !== 'finished' && match.phase === 'finished') {
      this.performanceMonitor.finish(match.elapsedSeconds, {
        durationSeconds: this.config.match.durationSeconds,
        spawnIntervalSeconds: this.config.spawn.intervalSeconds,
      });
      this.audio.pause();
      this.audio.play(
        match.endReason === 'timeExpired' ? 'complete' : 'gameOver',
      );
    }

    this.lastScore = score;
    this.lastHealth = player.health;
    this.lastRemainingSecond = remainingSecond;
    this.lastPhase = match.phase;
    const performance = this.performanceMonitor.snapshot();
    this.onHudChange?.({
      health: player.health,
      maxHealth: this.config.player.maxHealth,
      score,
      fps: Math.round(this.app.ticker.FPS),
      entityCount:
        1 +
        this.session.state.enemies.length +
        this.session.state.projectiles.length +
        this.session.state.effects.length,
      p95FrameTimeMs: performance.p95FrameTimeMs,
      phase: match.phase,
      remainingSeconds: match.remainingSeconds,
      elapsedSeconds: match.elapsedSeconds,
      endReason: match.endReason,
      pauseReason: match.pauseReason,
    });
  }

  private syncProjectileSprites(): void {
    if (!this.cannonBallTexture) return;

    const activeIds = new Set<number>();
    let broadsideSoundPlayed = false;

    for (const projectile of this.session.state.projectiles) {
      activeIds.add(projectile.id);
      let sprite = this.projectileSprites.get(projectile.id);

      if (!sprite) {
        sprite = new Sprite(this.cannonBallTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(1.4);
        sprite.tint = projectile.owner === 'enemy' ? 0xff6a45 : 0xffffff;
        const isBroadside =
          projectile.weapon === 'leftBroadside' ||
          projectile.weapon === 'rightBroadside';
        if (!isBroadside || !broadsideSoundPlayed) {
          this.audio.play(
            isBroadside ? 'broadside' : 'frontFire',
            projectile.owner === 'enemy' ? 0.55 : 0.8,
          );
        }
        if (isBroadside) broadsideSoundPlayed = true;
        this.projectileSprites.set(projectile.id, sprite);
        this.projectileLayer.addChild(sprite);
      }

      sprite.position.set(projectile.x, projectile.y);
    }

    for (const [id, sprite] of this.projectileSprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      this.projectileSprites.delete(id);
    }
  }

  private readonly fitWorld = (): void => {
    const { width, height } = this.config.arena;
    const scale = Math.min(
      this.app.screen.width / width,
      this.app.screen.height / height,
    );

    this.world.scale.set(scale);
    this.worldBaseX = (this.app.screen.width - width * scale) / 2;
    this.worldBaseY = (this.app.screen.height - height * scale) / 2;
    this.world.position.set(this.worldBaseX, this.worldBaseY);
  };

  private addScreenShake(trauma: number): void {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + trauma);
  }

  private updateScreenShake(deltaSeconds: number): void {
    if (this.shakeTrauma <= 0) {
      this.world.position.set(this.worldBaseX, this.worldBaseY);
      return;
    }

    const safeDelta = Math.min(deltaSeconds, 0.05);
    this.shakeElapsed += safeDelta;
    const intensity = this.shakeTrauma * this.shakeTrauma;
    const maximumOffset = CAMERA_SHAKE.maximumOffsetPixels * intensity;
    const offsetX = Math.sin(this.shakeElapsed * 83) * maximumOffset;
    const offsetY = Math.sin(this.shakeElapsed * 101 + 1.7) * maximumOffset * 0.72;

    this.world.position.set(
      this.worldBaseX + offsetX,
      this.worldBaseY + offsetY,
    );
    this.shakeTrauma = Math.max(
      0,
      this.shakeTrauma - CAMERA_SHAKE.decayPerSecond * safeDelta,
    );
  }
}
