export type MockNetworkScenario =
  | 'success'
  | 'empty'
  | 'slow'
  | 'variableLatency'
  | 'outOfOrder'
  | 'offline'
  | 'timeout'
  | 'rankingError'
  | 'historyError'
  | 'http400'
  | 'http500'
  | 'submitTimeoutAfterCommit'
  | 'submitUnavailable';

export const MOCK_SCENARIO_KEY = 'pirate-battle:mock-scenario:v1';
const MOCK_SEQUENCE_PREFIX = 'pirate-battle:mock-sequence:';
const MOCK_CONSUMED_PREFIX = 'pirate-battle:mock-consumed:';

const scenarios = new Set<MockNetworkScenario>([
  'success',
  'empty',
  'slow',
  'variableLatency',
  'outOfOrder',
  'offline',
  'timeout',
  'rankingError',
  'historyError',
  'http400',
  'http500',
  'submitTimeoutAfterCommit',
  'submitUnavailable',
]);

export function getMockNetworkScenario(): MockNetworkScenario {
  const stored = localStorage.getItem(MOCK_SCENARIO_KEY);
  return stored && scenarios.has(stored as MockNetworkScenario)
    ? stored as MockNetworkScenario
    : 'success';
}

export function setMockNetworkScenario(scenario: MockNetworkScenario): void {
  localStorage.setItem(MOCK_SCENARIO_KEY, scenario);
  clearMockScenarioRuntime();
}

export function nextMockSequence(resource: string): number {
  const key = `${MOCK_SEQUENCE_PREFIX}${resource}`;
  const next = Number(sessionStorage.getItem(key) ?? 0) + 1;
  sessionStorage.setItem(key, String(next));
  return next;
}

export function consumeMockEvent(event: string): boolean {
  const key = `${MOCK_CONSUMED_PREFIX}${event}`;
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, 'true');
  return true;
}

export function clearMockScenarioRuntime(): void {
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (
      key?.startsWith(MOCK_SEQUENCE_PREFIX) ||
      key?.startsWith(MOCK_CONSUMED_PREFIX)
    ) {
      sessionStorage.removeItem(key);
    }
  }
}
