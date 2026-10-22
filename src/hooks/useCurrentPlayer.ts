import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../auth/AuthProvider';
import { playerRepository } from '../database/repositories';
import type { Player } from '../types/player';

/**
 * Resolves the `players` row linked to the signed-in user, creating one on
 * first use. Player-scoped features (rankings, registrations, followed
 * tournaments) are keyed by player id rather than user id.
 */
export function useCurrentPlayer(): { player: Player | null; isLoading: boolean } {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    const resolvePlayer = user
      ? playerRepository.getOrCreateByUserId(db, user.id, user.username)
      : Promise.resolve(null);

    resolvePlayer.then(
      (result) => {
        if (isCurrent) {
          setPlayer(result);
          setIsLoading(false);
        }
      },
      () => {
        if (isCurrent) {
          setPlayer(null);
          setIsLoading(false);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [db, user]);

  return { player, isLoading };
}
