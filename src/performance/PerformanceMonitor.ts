import type { MatchConfigSnapshot } from '../api/contracts';

const LAST_PERFORMANCE_KEY = 'pirate-battle:last-performance:v1';
const MAX_FRAME_SAMPLES = 20_000;

export interface GamePerformanceSummary {
  capturedAt: string;
  activeDurationSeconds: number;
  averageFps: number;
  p95FrameTimeMs: number;
  maximumEntities: number;
  frameSamples: number;
  viewport: string;
  pixelRatio: number;
  hardwareConcurrency: number | null;
  userAgent: string;
  config: MatchConfigSnapshot;
}

interface LivePerformanceSnapshot {
  averageFps: number;
  p95FrameTimeMs: number;
  maximumEntities: number;
}

export class PerformanceMonitor {
  private readonly frameTimes: number[] = [];
  private totalFrameTime = 0;
  private maximumEntities = 0;
  private completed = false;

  record(frameTimeMs: number, entityCount: number): void {
    if (this.completed || frameTimeMs <= 0 || !Number.isFinite(frameTimeMs)) return;

    this.maximumEntities = Math.max(this.maximumEntities, entityCount);
    if (this.frameTimes.length < MAX_FRAME_SAMPLES) {
      this.frameTimes.push(frameTimeMs);
      this.totalFrameTime += frameTimeMs;
    }
  }

  snapshot(): LivePerformanceSnapshot {
    const sampleCount = this.frameTimes.length;
    const averageFrameTime = sampleCount > 0
      ? this.totalFrameTime / sampleCount
      : 0;

    return {
      averageFps: averageFrameTime > 0 ? 1000 / averageFrameTime : 0,
      p95FrameTimeMs: percentile95(this.frameTimes),
      maximumEntities: this.maximumEntities,
    };
  }

  finish(
    activeDurationSeconds: number,
    config: MatchConfigSnapshot,
  ): GamePerformanceSummary {
    this.completed = true;
    const live = this.snapshot();
    const summary: GamePerformanceSummary = {
      capturedAt: new Date().toISOString(),
      activeDurationSeconds,
      averageFps: round(live.averageFps),
      p95FrameTimeMs: round(live.p95FrameTimeMs),
      maximumEntities: live.maximumEntities,
      frameSamples: this.frameTimes.length,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      userAgent: navigator.userAgent,
      config,
    };

    try {
      localStorage.setItem(LAST_PERFORMANCE_KEY, JSON.stringify(summary));
    } catch {
      // Profiling data is diagnostic only and must never interrupt gameplay.
    }

    return summary;
  }
}

export function loadLastPerformance(): GamePerformanceSummary | null {
  try {
    const stored = localStorage.getItem(LAST_PERFORMANCE_KEY);
    return stored ? JSON.parse(stored) as GamePerformanceSummary : null;
  } catch {
    return null;
  }
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((first, second) => first - second);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
