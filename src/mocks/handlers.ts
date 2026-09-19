import { delay, http, HttpResponse } from 'msw';
import type {
  MatchRecord,
  PaginatedResponse,
  RankingEntry,
} from '../api/contracts';
import { confirmMatch, getAllMatches } from './mockDatabase';
import {
  consumeMockEvent,
  getMockNetworkScenario,
  nextMockSequence,
} from './scenarios';

const TEST_TIMEOUT_MS = 1_200;
const DEMO_TIMEOUT_MS = 5_500;

async function applyLatency(resource: string): Promise<void> {
  const scenario = getMockNetworkScenario();
  if (scenario === 'slow') await delay(400);
  if (scenario === 'variableLatency') {
    const sequence = nextMockSequence(resource);
    await delay(80 + (sequence % 4) * 90);
  }
  if (scenario === 'outOfOrder') {
    const sequence = nextMockSequence(resource);
    await delay(sequence % 2 === 1 ? 450 : 40);
  }
  if (scenario === 'timeout') {
    await delay(import.meta.env.MODE === 'test' ? TEST_TIMEOUT_MS : DEMO_TIMEOUT_MS);
  }
}

function commonFailure(): Response | null {
  const scenario = getMockNetworkScenario();
  if (scenario === 'offline') return HttpResponse.error();
  if (scenario === 'http400') {
    return HttpResponse.json({ message: 'Invalid mock request.' }, { status: 400 });
  }
  if (scenario === 'http500') {
    return HttpResponse.json({ message: 'Mock service unavailable.' }, { status: 500 });
  }
  return null;
}

function readPositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

export const handlers = [
  http.get('/api/ranking', async ({ request }) => {
    await applyLatency('ranking');
    const failure = commonFailure();
    if (failure) return failure;
    if (getMockNetworkScenario() === 'rankingError') {
      return HttpResponse.json({ message: 'Ranking unavailable.' }, { status: 503 });
    }

    const url = new URL(request.url);
    const page = readPositiveInteger(url.searchParams.get('page'), 1);
    const pageSize = readPositiveInteger(url.searchParams.get('pageSize'), 5);
    const durationSeconds = Number(url.searchParams.get('durationSeconds'));
    const spawnIntervalSeconds = Number(
      url.searchParams.get('spawnIntervalSeconds'),
    );

    const source = getMockNetworkScenario() === 'empty' ? [] : getAllMatches();
    const ranked: RankingEntry[] = source
      .filter(
        (match) =>
          match.config.durationSeconds === durationSeconds &&
          match.config.spawnIntervalSeconds === spawnIntervalSeconds,
      )
      .sort(
        (first, second) =>
          second.score - first.score ||
          first.durationSeconds - second.durationSeconds ||
          first.completedAt.localeCompare(second.completedAt) ||
          first.matchId.localeCompare(second.matchId),
      )
      .map((match, index) => ({ ...match, rank: index + 1 }));

    return HttpResponse.json(paginate(ranked, page, pageSize));
  }),

  http.get('/api/matches', async ({ request }) => {
    await applyLatency('history');
    const failure = commonFailure();
    if (failure) return failure;
    if (getMockNetworkScenario() === 'historyError') {
      return HttpResponse.json({ message: 'History unavailable.' }, { status: 503 });
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    const page = readPositiveInteger(url.searchParams.get('page'), 1);
    const pageSize = readPositiveInteger(url.searchParams.get('pageSize'), 5);

    const source = getMockNetworkScenario() === 'empty' ? [] : getAllMatches();
    const matches = source
      .filter((match) => match.playerId === playerId)
      .sort((first, second) => second.completedAt.localeCompare(first.completedAt));

    return HttpResponse.json(paginate(matches, page, pageSize));
  }),

  http.post('/api/matches', async ({ request }) => {
    await applyLatency('submission');
    const failure = commonFailure();
    if (failure) return failure;
    if (getMockNetworkScenario() === 'submitUnavailable') {
      return HttpResponse.json({ message: 'Submission unavailable.' }, { status: 503 });
    }

    const match = await request.json() as MatchRecord;
    const existing = getAllMatches().find(
      (candidate) => candidate.matchId === match.matchId,
    );
    const confirmed = confirmMatch(match);

    if (
      getMockNetworkScenario() === 'submitTimeoutAfterCommit' &&
      consumeMockEvent(`submit-timeout:${match.matchId}`)
    ) {
      await delay(import.meta.env.MODE === 'test' ? TEST_TIMEOUT_MS : DEMO_TIMEOUT_MS);
    }

    return HttpResponse.json(confirmed, { status: existing ? 200 : 201 });
  }),
];
