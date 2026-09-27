import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { tournamentRepository } from '../database/repositories';
import type { Tournament, TournamentFilters } from '../types/tournament';

export function useTournaments(filters: TournamentFilters = {}) {
  const db = useSQLiteContext();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const serializedFilters = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTournaments(await tournamentRepository.list(db, JSON.parse(serializedFilters) as TournamentFilters));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load tournaments.');
    } finally {
      setIsLoading(false);
    }
  }, [db, serializedFilters]);

  useEffect(() => {
    let isCurrent = true;

    tournamentRepository.list(db, JSON.parse(serializedFilters) as TournamentFilters).then(
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
  }, [db, serializedFilters]);

  return { tournaments, isLoading, error, refresh };
}