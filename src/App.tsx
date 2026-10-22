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
import { AppNavigation } from './navigation/AppNavigation';

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
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="dark" />
          <DatabaseIntegrationCheck />
          <AppNavigation />
        </NavigationContainer>
      </AuthProvider>
    </SQLiteProvider>
  );
}

function DatabaseIntegrationCheck() {
  const db = useSQLiteContext();

  useEffect(() => {
    if (!__DEV__) return;
    void runDatabaseIntegrationChecks(db)
      .then(() => runAuthIntegrationChecks(db))
      .then(() => runTournamentManagementIntegrationChecks(db))
      .then(
        () => console.info('Database, authentication and tournament management integration checks passed.'),
        (error: unknown) => console.error('SQLite integration checks failed.', error),
      );
  }, [db]);

  return null;
}