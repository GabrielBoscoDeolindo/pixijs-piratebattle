import type {
  MatchListParams,
  MatchRecord,
  PaginatedResponse,
  RankingEntry,
} from './contracts';
import { httpClient } from './httpClient';

export async function fetchRanking(
  params: MatchListParams,
): Promise<PaginatedResponse<RankingEntry>> {
  const response = await httpClient.get<PaginatedResponse<RankingEntry>>(
    '/ranking',
    { params },
  );
  return response.data;
}

export async function fetchMatchHistory(params: {
  playerId: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<MatchRecord>> {
  const response = await httpClient.get<PaginatedResponse<MatchRecord>>(
    '/matches',
    { params },
  );
  return response.data;
}

export async function submitMatch(match: MatchRecord): Promise<MatchRecord> {
  const response = await httpClient.post<MatchRecord>('/matches', match, {
    headers: { 'Idempotency-Key': match.matchId },
  });
  return response.data;
}
