export interface MatchResultInput {
  playerOneId: number | null;
  playerTwoId: number | null;
  scoreOneText: string;
  scoreTwoText: string;
}

export interface MatchResultErrors {
  scoreOne?: string;
  scoreTwo?: string;
  general?: string;
}

export interface ParsedMatchResult {
  scoreOne: number;
  scoreTwo: number;
  winnerId: number;
  loserId: number;
}

/**
 * RF-12: validates a score submitted for a match before it can be
 * published. Both participants must already be assigned, both scores must
 * be whole numbers >= 0, and a match cannot end in a tie (a winner must be
 * determinable) since rankings require a clear winner/loser.
 */
export function validateMatchResult(input: MatchResultInput): { errors: MatchResultErrors; result: ParsedMatchResult | null } {
  const errors: MatchResultErrors = {};

  if (!input.playerOneId || !input.playerTwoId) {
    errors.general = 'Both participants must be assigned before recording a result.';
    return { errors, result: null };
  }

  const scoreOne = Number(input.scoreOneText);
  if (!input.scoreOneText.trim() || !Number.isInteger(scoreOne) || scoreOne < 0) {
    errors.scoreOne = 'Enter a whole number greater than or equal to 0.';
  }
  const scoreTwo = Number(input.scoreTwoText);
  if (!input.scoreTwoText.trim() || !Number.isInteger(scoreTwo) || scoreTwo < 0) {
    errors.scoreTwo = 'Enter a whole number greater than or equal to 0.';
  }
  if (errors.scoreOne || errors.scoreTwo) {
    return { errors, result: null };
  }

  if (scoreOne === scoreTwo) {
    errors.general = 'This match cannot end in a tie: enter a final score with a clear winner.';
    return { errors, result: null };
  }

  const winnerId = scoreOne > scoreTwo ? input.playerOneId : input.playerTwoId;
  const loserId = scoreOne > scoreTwo ? input.playerTwoId : input.playerOneId;
  return { errors: {}, result: { scoreOne, scoreTwo, winnerId, loserId } };
}
