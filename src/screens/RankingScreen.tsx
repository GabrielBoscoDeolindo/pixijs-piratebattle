import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchRanking } from '../api/matchesApi';
import { queryKeys } from '../api/queryKeys';
import type { MatchConfigSnapshot } from '../api/contracts';

interface RankingScreenProps {
  config: MatchConfigSnapshot;
  onBack: () => void;
}

export function RankingScreen({ config, onBack }: RankingScreenProps) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.ranking(config, page),
    queryFn: () => fetchRanking({ ...config, page, pageSize: 5 }),
    placeholderData: keepPreviousData,
  });

  return (
    <main className="ui-scene">
      <section className="content-panel data-screen" aria-labelledby="ranking-title">
        <div className="screen-heading">
          <div>
            <h1 id="ranking-title">Ranking</h1>
            <p>{config.durationSeconds}s voyage · {config.spawnIntervalSeconds}s spawn</p>
          </div>
          {query.isFetching && <span className="refresh-indicator">Updating…</span>}
        </div>

        {query.isPending && <p className="screen-state" role="status">Loading captains…</p>}
        {query.isError && (
          <div className="screen-state" role="alert">
            <p>Ranking could not be loaded.</p>
            <button type="button" onClick={() => void query.refetch()}>TRY AGAIN</button>
          </div>
        )}
        {query.data?.items.length === 0 && <p className="screen-state">No completed voyages for this configuration.</p>}
        {query.data && query.data.items.length > 0 && (
          <ol className="ranking-list" start={(query.data.page - 1) * query.data.pageSize + 1}>
            {query.data.items.map((entry) => (
              <li key={entry.matchId}>
                <strong><span className="rank-number">#{entry.rank}</span>{entry.playerName}</strong>
                <span>{entry.score} pts</span>
              </li>
            ))}
          </ol>
        )}

        <Pagination
          page={query.data?.page ?? page}
          totalPages={query.data?.totalPages ?? 1}
          disabled={query.isPending}
          onPage={setPage}
        />
        <button className="text-button screen-back" type="button" data-ui-sound="close" onClick={onBack}>MAIN MENU</button>
      </section>
    </main>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, disabled, onPage }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>PREVIOUS</button>
      <span>Page {page} of {totalPages}</span>
      <button type="button" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>NEXT</button>
    </nav>
  );
}
