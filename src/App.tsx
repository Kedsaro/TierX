import '../global.css';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './auth/AuthProvider';
import { DATABASE_NAME } from './database/schema';
import { initializeDatabase } from './database/db';
import { runDatabaseIntegrationChecks } from './database/integrationChecks';
import { runAuthIntegrationChecks } from './auth/integrationChecks';
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
    void runDatabaseIntegrationChecks(db).then(() => runAuthIntegrationChecks(db)).then(
      () => console.info('Database and authentication integration checks passed.'),
      (error: unknown) => console.error('SQLite integration checks failed.', error),
    );
  }, [db]);

  return null;
}