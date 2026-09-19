import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchMatchHistory } from '../api/matchesApi';
import { queryKeys } from '../api/queryKeys';
import type { PlayerIdentity } from '../api/contracts';
import { Pagination } from './RankingScreen';

interface HistoryScreenProps {
  player: PlayerIdentity;
  onBack: () => void;
}

export function HistoryScreen({ player, onBack }: HistoryScreenProps) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.history(player.id, page),
    queryFn: () => fetchMatchHistory({ playerId: player.id, page, pageSize: 5 }),
    placeholderData: keepPreviousData,
  });

  return (
    <main className="ui-scene">
      <section className="content-panel data-screen" aria-labelledby="history-title">
        <div className="screen-heading">
          <div>
            <h1 id="history-title">Match History</h1>
            <p>{player.name}</p>
          </div>
          {query.isFetching && <span className="refresh-indicator">Updating…</span>}
        </div>

        {query.isPending && <p className="screen-state" role="status">Loading voyages…</p>}
        {query.isError && (
          <div className="screen-state" role="alert">
            <p>Match history could not be loaded.</p>
            <button type="button" onClick={() => void query.refetch()}>TRY AGAIN</button>
          </div>
        )}
        {query.data?.items.length === 0 && <p className="screen-state">No completed voyages yet.</p>}
        {query.data && query.data.items.length > 0 && (
          <ul className="history-list">
            {query.data.items.map((match) => (
              <li key={match.matchId}>
                <div><strong>{match.score} pts</strong><time>{new Date(match.completedAt).toLocaleDateString()}</time></div>
                <div><span>{Math.round(match.durationSeconds)}s played</span><span>{match.endReason === 'timeExpired' ? 'Time expired' : 'Ship destroyed'}</span></div>
              </li>
            ))}
          </ul>
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
