import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles.css';
import { getBrowserTestApi } from './testing/browserTestApi';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      retryDelay: import.meta.env.MODE === 'test' ? 50 : undefined,
    },
    mutations: {
      retry: 1,
      retryDelay: import.meta.env.MODE === 'test' ? 50 : undefined,
    },
  },
});

async function startMockApi(): Promise<void> {
  try {
    const { mockWorker } = await import('./mocks/browser');
    await mockWorker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
  } catch (error) {
    console.warn('Mock APIs are unavailable; local gameplay can continue.', error);
  }
}

void startMockApi().finally(() => {
  if (import.meta.env.MODE === 'test') getBrowserTestApi().mockReady = true;
  window.dispatchEvent(new Event('pirate-battle:mock-ready'));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
