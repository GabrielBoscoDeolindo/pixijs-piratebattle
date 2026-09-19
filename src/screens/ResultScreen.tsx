import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { MatchRecord, StoredMatchResult } from '../api/contracts';
import { submitMatch } from '../api/matchesApi';
import {
  removePendingMatch,
  saveLastResult,
  savePendingMatch,
} from '../storage/gameStorage';
import { loadLastPerformance } from '../performance/PerformanceMonitor';

interface ResultScreenProps {
  result: StoredMatchResult;
  onResultUpdated: (result: StoredMatchResult) => void;
  onPlayAgain: () => void;
  onMenu: () => void;
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padStart(2, '0')}`;
}

function asMatchRecord(result: StoredMatchResult): MatchRecord {
  return {
    matchId: result.matchId,
    playerId: result.playerId,
    playerName: result.playerName,
    completedAt: result.completedAt,
    score: result.score,
    durationSeconds: result.durationSeconds,
    endReason: result.endReason,
    config: result.config,
  };
}

export function ResultScreen({
  result,
  onResultUpdated,
  onPlayAgain,
  onMenu,
}: ResultScreenProps) {
  const queryClient = useQueryClient();
  const initialSubmissionRef = useRef(false);
  const performance = loadLastPerformance();
  const mutation = useMutation({
    mutationFn: () => submitMatch(asMatchRecord(result)),
    onMutate: () => {
      const submitting = { ...result, submissionStatus: 'submitting' as const };
      savePendingMatch(submitting);
      onResultUpdated(submitting);
    },
    onSuccess: async () => {
      const synced = { ...result, submissionStatus: 'synced' as const };
      removePendingMatch(result.matchId);
      saveLastResult(synced);
      onResultUpdated(synced);
      await queryClient.invalidateQueries({ queryKey: ['ranking'] });
      await queryClient.invalidateQueries({ queryKey: ['match-history'] });
    },
    onError: () => {
      const failed = { ...result, submissionStatus: 'failed' as const };
      savePendingMatch(failed);
      onResultUpdated(failed);
    },
  });

  useEffect(() => {
    if (result.submissionStatus !== 'pending' || initialSubmissionRef.current) return;
    initialSubmissionRef.current = true;
    mutation.mutate();
  }, [mutation, result.submissionStatus]);

  const statusText = {
    pending: 'Waiting to submit',
    submitting: 'Submitting voyage…',
    synced: 'Voyage recorded',
    failed: 'Submission failed',
  }[result.submissionStatus];

  return (
    <main className="ui-scene">
      <section className="content-panel result-screen" aria-labelledby="result-screen-title">
        <h1 id="result-screen-title">
          {result.endReason === 'timeExpired' ? "Time's Up!" : 'Ship Sunk!'}
        </h1>
        <dl className="result-summary">
          <div><dt>Score</dt><dd>{result.score}</dd></div>
          <div><dt>Time played</dt><dd>{formatDuration(result.durationSeconds)}</dd></div>
          <div><dt>Reason</dt><dd>{result.endReason === 'timeExpired' ? 'Time expired' : 'Player destroyed'}</dd></div>
        </dl>
        <p className={`submission-status submission-status--${result.submissionStatus}`} role="status">{statusText}</p>
        {performance && (
          <details className="performance-summary">
            <summary>Performance details</summary>
            <p>
              {performance.averageFps} average FPS · p95 {performance.p95FrameTimeMs} ms · {performance.maximumEntities} max entities
            </p>
          </details>
        )}
        {result.submissionStatus === 'failed' && (
          <button className="retry-link" type="button" onClick={() => mutation.mutate()}>TRY AGAIN</button>
        )}
        <div className="screen-actions">
          <button className="text-button text-button--primary" type="button" onClick={onPlayAgain}>PLAY AGAIN</button>
          <button className="text-button" type="button" data-ui-sound="close" onClick={onMenu}>MAIN MENU</button>
        </div>
      </section>
    </main>
  );
}
