import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { UserMinus } from 'lucide-react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { notificationRepository } from '../database/repositories';
import type { AppNotification } from '../types/admin';

/**
 * Surfaces a blocking alert after sign-in (or session restore) when the user
 * was removed from a tournament or eliminated from a match while offline.
 * Unread `removal`/`eliminated` notifications are listed and marked as read
 * when dismissed.
 */
export function RemovalAlert() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [removals, setRemovals] = useState<AppNotification[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRemovals([]);
      return;
    }
    Promise.all([
      notificationRepository.listUnreadByType(db, user.id, 'removal'),
      notificationRepository.listUnreadByType(db, user.id, 'eliminated'),
    ])
      .then(([removalRows, eliminatedRows]) => {
        if (!cancelled) setRemovals([...eliminatedRows, ...removalRows]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, user?.id]);

  async function dismiss() {
    const pending = removals;
    setRemovals([]);
    for (const notification of pending) {
      await notificationRepository.markRead(db, notification.id).catch(() => {});
    }
  }

  if (removals.length === 0) return null;

  return (
    <Modal
      footer={<Button onPress={() => void dismiss()}>Got it</Button>}
      onClose={() => void dismiss()}
      title={removals.some((n) => n.type === 'eliminated') ? 'You were eliminated' : 'Removed from tournament'}
      visible
    >
      <View className="gap-3">
        {removals.map((notification) => (
          <View className="flex-row items-start gap-3" key={notification.id}>
            <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#f9e4e2]">
              <UserMinus color="#a93232" size={16} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-bold text-[#17231f]">{notification.title}</Text>
              <Text className="mt-0.5 text-sm leading-5 text-[#4d5d55]">{notification.message}</Text>
            </View>
          </View>
        ))}
      </View>
    </Modal>
  );
}
