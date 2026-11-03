/**
 * RF-12: ranking update applied whenever an organizer publishes a match
 * result. Uses a standard fixed-K Elo formula so ratings move more for an
 * upset (beating a higher-rated opponent) than for an expected result.
 */
const K_FACTOR = 32;

export interface EloUpdateResult {
  winnerRating: number;
  loserRating: number;
}

export function computeEloUpdate(winnerRating: number, loserRating: number): EloUpdateResult {
  const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;
  const nextWinnerRating = Math.max(0, Math.round(winnerRating + K_FACTOR * (1 - expectedWinner)));
  const nextLoserRating = Math.max(0, Math.round(loserRating - K_FACTOR * expectedLoser));
  return { winnerRating: nextWinnerRating, loserRating: nextLoserRating };
}
