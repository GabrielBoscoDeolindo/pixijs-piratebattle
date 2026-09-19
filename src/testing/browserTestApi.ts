import type { PixiGameTestController } from '../rendering/PixiGame';
import { resetMockDatabase } from '../mocks/mockDatabase';
import {
  clearMockScenarioRuntime,
  setMockNetworkScenario,
  type MockNetworkScenario,
} from '../mocks/scenarios';

export interface PirateBattleBrowserTestApi {
  mockReady: boolean;
  game: PixiGameTestController | null;
  setNetworkScenario: (scenario: MockNetworkScenario) => void;
  setAssetFailure: (enabled: boolean) => void;
  resetBrowserState: () => void;
}

declare global {
  interface Window {
    __PIRATE_BATTLE_TEST__?: PirateBattleBrowserTestApi;
  }
}

function createApi(): PirateBattleBrowserTestApi {
  return {
    mockReady: false,
    game: null,
    setNetworkScenario: setMockNetworkScenario,
    setAssetFailure: (enabled) => {
      sessionStorage.setItem(
        'pirate-battle:test-asset-failure:v1',
        String(enabled),
      );
    },
    resetBrowserState: () => {
      resetMockDatabase();
      localStorage.clear();
      sessionStorage.clear();
      clearMockScenarioRuntime();
    },
  };
}

export function getBrowserTestApi(): PirateBattleBrowserTestApi {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('The browser test API is only available in test mode.');
  }

  window.__PIRATE_BATTLE_TEST__ ??= createApi();
  return window.__PIRATE_BATTLE_TEST__;
}

export function installGameTestController(
  controller: PixiGameTestController,
): () => void {
  const api = getBrowserTestApi();
  api.game = controller;

  return () => {
    if (api.game === controller) api.game = null;
  };
}
