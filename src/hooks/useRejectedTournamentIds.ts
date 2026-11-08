import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { registrationRepository } from '../database/repositories';
import { useCurrentPlayer } from './useCurrentPlayer';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/**
 * Ids of tournaments where the signed-in player was removed by an organizer
 * (registration status 'rejected'). Used to render banned entries in
 * tournament lists and details. Refreshes on mount and on screen focus.
 */
export function useRejectedTournamentIds(): Set<number> {
  const db = useSQLiteContext();
  const { player } = useCurrentPlayer();
  const [ids, setIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!player) {
      setIds(new Set());
      return;
    }
    try {
      setIds(new Set(await registrationRepository.listRejectedTournamentIds(db, player.id)));
    } catch {
      setIds(new Set());
    }
  }, [db, player]);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(() => void load());

  return ids;
}
