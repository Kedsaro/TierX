import '../global.css';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './auth/AuthProvider';
import { DATABASE_NAME } from './database/schema';
import { initializeDatabase } from './database/db';
import { getDatabaseKey, migrateLegacyDatabase } from './database/encryption';
import { runDatabaseIntegrationChecks } from './database/integrationChecks';
import { runAuthIntegrationChecks } from './auth/integrationChecks';
import { runTournamentManagementIntegrationChecks } from './tournaments/integrationChecks';
import { runRegistrationIntegrationChecks } from './tournaments/registrationIntegrationChecks';
import { runEventsIntegrationChecks } from './tournaments/eventsIntegrationChecks';
import { runProfileIntegrationChecks } from './profile/integrationChecks';
import { runAdminIntegrationChecks } from './admin/integrationChecks';
import { AppNavigation } from './navigation/AppNavigation';
import { RemovalAlert } from './notifications/RemovalAlert';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f4f6f2',
    card: '#ffffff',
    primary: '#176b5b',
    text: '#17231f',
    border: '#e1e7e2',
  },
};

export default function App() {
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);

  useEffect(() => {
    let active = true;
    getDatabaseKey()
      .then((key) => migrateLegacyDatabase(key))
      .catch((error) => console.error('Database preparation failed.', error))
      .finally(() => {
        if (active) setIsDatabaseReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isDatabaseReady) return null;

  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={(database) =>
        // Fast refresh closes the DB mid-init — swallow that dev-only rejection.
        initializeDatabase(database).catch((error) => {
          if (String(error).includes('closed resource')) return;
          throw error;
        })
      }
    >
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="dark" />
          <DatabaseIntegrationCheck />
          <AppNavigation />
          <RemovalAlert />
        </NavigationContainer>
      </AuthProvider>
    </SQLiteProvider>
  );
}

function DatabaseIntegrationCheck() {
  const db = useSQLiteContext();

  useEffect(() => {
    if (!__DEV__) return;
    const runAll = () =>
      runDatabaseIntegrationChecks(db)
        .then(() => runAuthIntegrationChecks(db))
        .then(() => runTournamentManagementIntegrationChecks(db))
        .then(() => runRegistrationIntegrationChecks(db))
        .then(() => runEventsIntegrationChecks(db))
        .then(() => runProfileIntegrationChecks(db))
        .then(() => runAdminIntegrationChecks(db));

    // During fast refresh the provider reopens the DB while a previous check
    // run is still in flight, producing transient prepareAsync rejections —
    // retry once, and keep the failure as a warning instead of an error overlay.
    void runAll()
      .catch(() => new Promise((resolve) => setTimeout(resolve, 1500)).then(runAll))
      .then(
        () => console.info('Database, authentication, tournament management, registration, events/bracket, profile and admin integration checks passed.'),
        (error: unknown) => console.warn('SQLite integration checks skipped/failed (dev-only).', error),
      );
  }, [db]);

  return null;
}