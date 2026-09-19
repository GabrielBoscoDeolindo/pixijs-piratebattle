import type { MatchEndReason } from '../game/types';

export interface MatchConfigSnapshot {
  durationSeconds: number;
  spawnIntervalSeconds: number;
}

export interface PlayerIdentity {
  id: string;
  name: string;
}

export interface MatchRecord {
  matchId: string;
  playerId: string;
  playerName: string;
  completedAt: string;
  score: number;
  durationSeconds: number;
  endReason: MatchEndReason;
  config: MatchConfigSnapshot;
}

export type SubmissionStatus = 'pending' | 'submitting' | 'synced' | 'failed';

export interface StoredMatchResult extends MatchRecord {
  submissionStatus: SubmissionStatus;
}

export interface RankingEntry extends MatchRecord {
  rank: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface MatchListParams extends MatchConfigSnapshot {
  page: number;
  pageSize: number;
}
