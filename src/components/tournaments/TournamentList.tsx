import { FlatList, View } from 'react-native';
import type { Tournament, TournamentSummary } from '../../types/tournament';
import { FeedbackState } from '../ui/FeedbackState';
import { TournamentCard } from './TournamentCard';

interface TournamentListProps {
  tournaments: TournamentSummary[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onTournamentPress?: (tournament: Tournament) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function TournamentList({
  tournaments,
  isLoading = false,
  error,
  onRetry,
  onTournamentPress,
  emptyTitle = 'No tournaments found',
  emptyDescription = 'Try changing your search or filters.',
}: TournamentListProps) {
  if (isLoading) {
    return <FeedbackState kind="loading" title="Loading tournaments" description="Your tournament list is being updated." />;
  }

  if (error) {
    return (
      <FeedbackState
        kind="error"
        title="Could not load tournaments"
        description={error}
        actionLabel={onRetry ? 'Try again' : undefined}
        onAction={onRetry}
      />
    );
  }

  if (tournaments.length === 0) {
    return <FeedbackState kind="empty" title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="gap-3 pb-6"
      data={tournaments}
      keyExtractor={(tournament) => String(tournament.id)}
      renderItem={({ item }) => (
        <TournamentCard
          countryName={item.country_name}
          gameName={item.game_name}
          onPress={() => onTournamentPress?.(item)}
          organizerName={item.organizer_username}
          tournament={item}
        />
      )}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View className="h-0" />}
    />
  );
}
