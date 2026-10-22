import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { tournamentRepository } from '../database/repositories';
import type { TournamentFilters, TournamentSummary } from '../types/tournament';

export interface UseTournamentsOptions extends TournamentFilters {
  /**
   * 'following' lists tournaments the given `followedByPlayerId` is
   * registered for instead of the general catalog. Defaults to 'list'.
   */
  mode?: 'list' | 'following';
  followedByPlayerId?: number | null;
}

function fetchTournaments(
  db: ReturnType<typeof useSQLiteContext>,
  mode: 'list' | 'following',
  followedByPlayerId: number | null | undefined,
  filters: TournamentFilters,
): Promise<TournamentSummary[]> {
  if (mode === 'following') {
    return followedByPlayerId
      ? tournamentRepository.listFollowed(db, followedByPlayerId, filters)
      : Promise.resolve([]);
  }
  return tournamentRepository.list(db, filters);
}

export function useTournaments(options: UseTournamentsOptions = {}) {
  const db = useSQLiteContext();
  const { mode = 'list', followedByPlayerId, ...filters } = options;
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const serializedFilters = JSON.stringify(filters);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      setTournaments(await fetchTournaments(db, mode, followedByPlayerId, filters));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load tournaments.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;
    const parsedFilters = JSON.parse(serializedFilters) as TournamentFilters;

    fetchTournaments(db, mode, followedByPlayerId, parsedFilters).then(
      (rows) => {
        if (isCurrent) {
          setTournaments(rows);
          setIsLoading(false);
        }
      },
      (cause: unknown) => {
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : 'Unable to load tournaments.');
          setIsLoading(false);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [db, mode, followedByPlayerId, serializedFilters]);

  return { tournaments, isLoading, error, refresh };
}
