import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../../auth/AuthProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  auditRepository,
  countryRepository,
  gameRepository,
  notificationRepository,
  reportRepository,
  settingsRepository,
  userRepository,
} from '../../database/repositories';
import { isAdminRole } from '../../tournaments/authorization';
import type { AppSetting, AuditLogSummary, ReportStatus, ReportSummary } from '../../types/admin';
import type { Country, Game } from '../../types/catalog';
import type { User, UserRole } from '../../types/user';

const roleOptions = [
  { label: 'User', value: 'user' as UserRole },
  { label: 'Organizer', value: 'organizer' as UserRole },
  { label: 'Admin', value: 'admin' as UserRole },
];

const reportStatusLabels: Record<ReportStatus, string> = {
  open: 'Open',
  reviewing: 'Reviewing',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

/** RF-16/RF-17: global administration panel — users/roles, catalogs, reports, global parameters and the audit log. Only renders for admins. */
export function AdminScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newGameName, setNewGameName] = useState('');
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [siteNoticeDraft, setSiteNoticeDraft] = useState('');

  const isAdmin = isAdminRole(user?.role);

  const load = useCallback(() => {
    if (!isAdmin) return;
    Promise.all([
      userRepository.list(db),
      gameRepository.listAll(db),
      countryRepository.list(db),
      reportRepository.list(db),
      settingsRepository.list(db),
      auditRepository.list(db),
    ]).then(([userRows, gameRows, countryRows, reportRows, settingRows, auditRows]) => {
      setUsers(userRows);
      setGames(gameRows);
      setCountries(countryRows);
      setReports(reportRows);
      setSettings(settingRows);
      setAuditLog(auditRows);
      setSiteNoticeDraft(settingRows.find((setting) => setting.key === 'site_notice')?.value ?? '');
      setIsLoading(false);
    }).catch((error: unknown) => {
      console.error('Failed to load admin data.', error);
      setIsLoading(false);
    });
  }, [db, isAdmin]);

  useEffect(() => load(), [load]);

  /** Every admin action goes through here so it is always audited (RF-17/T-104). */
  async function runAudited(action: string, entityType: string, entityId: number | null, details: string, work: () => Promise<void>) {
    try {
      await work();
      await auditRepository.log(db, { actor_user_id: user!.id, action, entity_type: entityType, entity_id: entityId, details });
      load();
    } catch (error) {
      console.error(`Admin action ${action} failed.`, error);
      Alert.alert('Error', 'The action could not be completed.');
    }
  }

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
        <Text className="py-5 text-2xl font-bold text-[#17231f]">Administration</Text>
        <FeedbackState
          kind="error"
          title="Access denied"
          description="Only administrators can open this section."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
        <Text className="py-5 text-2xl font-bold text-[#17231f]">Administration</Text>
        <FeedbackState kind="loading" title="Loading admin panel" />
      </SafeAreaView>
    );
  }

  const creationEnabled = settings.find((setting) => setting.key === 'tournament_creation_enabled')?.value === 'true';

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top']}>
      <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 py-5">
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-lg bg-[#e1e7e2]"
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color="#17231f" size={20} />
          </Pressable>
          <Text className="text-2xl font-bold text-[#17231f]">Administration</Text>
        </View>

        <AdminSection title={`Users & roles (${users.length})`}>
          {users.map((item) => (
            <View className="flex-row items-center gap-3 border-b border-[#e7ece8] py-2.5" key={item.id}>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>{item.username}</Text>
                <Text className="text-xs text-[#65736c]" numberOfLines={1}>{item.email}</Text>
              </View>
              <View className="w-32">
                <Select<UserRole>
                  accessibilityLabel={`Role for ${item.username}`}
                  onChange={(role) => void runAudited('update_role', 'user', item.id, `Role of ${item.username} set to ${role}`, async () => {
                    await userRepository.updateRole(db, item.id, role);
                    await notificationRepository.create(db, {
                      user_id: item.id,
                      type: 'admin',
                      title: 'Your role changed',
                      message: `An administrator set your role to ${role}.`,
                    });
                  })}
                  options={roleOptions}
                  value={item.role}
                />
              </View>
            </View>
          ))}
        </AdminSection>

        <AdminSection title={`Games (${games.length})`}>
          {games.map((game) => (
            <View className="flex-row items-center justify-between border-b border-[#e7ece8] py-2.5" key={game.id}>
              <Text className="text-sm font-semibold text-[#17231f]">{game.name}</Text>
              <Switch
                accessibilityLabel={`Active ${game.name}`}
                onValueChange={(active) => void runAudited(active ? 'activate_game' : 'deactivate_game', 'game', game.id, `Game ${game.name} ${active ? 'activated' : 'deactivated'}`, () => gameRepository.setActive(db, game.id, active))}
                thumbColor={game.is_active ? '#176b5b' : '#85928b'}
                trackColor={{ false: '#dfe7e1', true: '#bcd8cd' }}
                value={game.is_active}
              />
            </View>
          ))}
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Input onChangeText={setNewGameName} placeholder="New game name" value={newGameName} />
            </View>
            <Button
              onPress={() => {
                if (!newGameName.trim()) return;
                void runAudited('create_game', 'game', null, `Game ${newGameName.trim()} created`, async () => {
                  await gameRepository.create(db, newGameName.trim());
                  setNewGameName('');
                });
              }}
              variant="secondary"
            >
              Add
            </Button>
          </View>
        </AdminSection>

        <AdminSection title={`Countries (${countries.length})`}>
          <Text className="text-sm leading-5 text-[#65736c]">
            {countries.map((country) => country.name).join(', ')}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Input onChangeText={setNewCountryName} placeholder="Country name" value={newCountryName} />
            </View>
            <View className="w-20">
              <Input autoCapitalize="characters" maxLength={2} onChangeText={setNewCountryCode} placeholder="Code" value={newCountryCode} />
            </View>
            <Button
              onPress={() => {
                if (!newCountryName.trim() || newCountryCode.trim().length !== 2) return;
                void runAudited('create_country', 'country', null, `Country ${newCountryName.trim()} (${newCountryCode.trim().toUpperCase()}) created`, async () => {
                  await countryRepository.create(db, { name: newCountryName.trim(), code: newCountryCode.trim() });
                  setNewCountryName('');
                  setNewCountryCode('');
                });
              }}
              variant="secondary"
            >
              Add
            </Button>
          </View>
        </AdminSection>

        <AdminSection title={`Reports (${reports.filter((report) => report.status === 'open').length} open)`}>
          {reports.length === 0 ? (
            <Text className="text-sm text-[#65736c]">No reports have been filed.</Text>
          ) : (
            reports.map((report) => (
              <View className="border-b border-[#e7ece8] py-3" key={report.id}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="min-w-0 flex-1 text-sm font-semibold text-[#17231f]" numberOfLines={1}>
                    {report.tournament_name ?? 'General'} · by {report.reporter_username}
                  </Text>
                  <Badge label={reportStatusLabels[report.status]} tone={report.status === 'open' ? 'danger' : report.status === 'reviewing' ? 'warning' : 'neutral'} />
                </View>
                <Text className="mt-1 text-sm leading-5 text-[#4d5d55]">{report.reason}</Text>
                {report.status === 'open' || report.status === 'reviewing' ? (
                  <View className="mt-2 flex-row gap-2">
                    {report.status === 'open' ? (
                      <Button
                        className="flex-1"
                        onPress={() => void runAudited('review_report', 'report', report.id, `Report #${report.id} marked as reviewing`, () => reportRepository.updateStatus(db, report.id, 'reviewing'))}
                        variant="secondary"
                      >
                        Review
                      </Button>
                    ) : null}
                    <Button
                      className="flex-1"
                      onPress={() => void runAudited('resolve_report', 'report', report.id, `Report #${report.id} resolved`, () => reportRepository.updateStatus(db, report.id, 'resolved'))}
                      variant="secondary"
                    >
                      Resolve
                    </Button>
                    <Button
                      className="flex-1"
                      onPress={() => void runAudited('dismiss_report', 'report', report.id, `Report #${report.id} dismissed`, () => reportRepository.updateStatus(db, report.id, 'dismissed'))}
                      variant="quiet"
                    >
                      Dismiss
                    </Button>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </AdminSection>

        <AdminSection title="Global parameters">
          <View className="flex-row items-center justify-between py-2">
            <Text className="flex-1 text-sm font-semibold text-[#17231f]">Tournament creation enabled</Text>
            <Switch
              accessibilityLabel="Tournament creation enabled"
              onValueChange={(enabled) => void runAudited('update_setting', 'setting', null, `tournament_creation_enabled set to ${enabled}`, () => settingsRepository.set(db, 'tournament_creation_enabled', String(enabled)))}
              thumbColor={creationEnabled ? '#176b5b' : '#85928b'}
              trackColor={{ false: '#dfe7e1', true: '#bcd8cd' }}
              value={creationEnabled}
            />
          </View>
          <Input label="Site notice" onChangeText={setSiteNoticeDraft} placeholder="Message shown to every user" value={siteNoticeDraft} />
          <View className="mt-3">
            <Button
              onPress={() => void runAudited('update_setting', 'setting', null, `site_notice updated`, () => settingsRepository.set(db, 'site_notice', siteNoticeDraft.trim()))}
              variant="secondary"
            >
              Save notice
            </Button>
          </View>
        </AdminSection>

        <AdminSection title="Audit log">
          {auditLog.length === 0 ? (
            <Text className="text-sm text-[#65736c]">No administrative actions recorded yet.</Text>
          ) : (
            auditLog.map((entry) => (
              <View className="border-b border-[#e7ece8] py-2.5" key={entry.id}>
                <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>
                  {entry.action} · {entry.entity_type}#{entry.entity_id ?? '–'}
                </Text>
                <Text className="mt-0.5 text-xs text-[#65736c]" numberOfLines={2}>
                  {entry.actor_username ?? 'system'} · {entry.created_at}
                </Text>
                {entry.details ? <Text className="mt-0.5 text-xs text-[#4d5d55]">{entry.details}</Text> : null}
              </View>
            ))
          )}
        </AdminSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 px-4 py-4">
      <Text className="mb-2 text-base font-bold text-[#17231f]">{title}</Text>
      {children}
    </Card>
  );
}
