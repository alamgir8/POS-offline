import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { DataProvider } from '../contexts/DataContext';
import { SyncProvider } from '../contexts/SyncContext';
import '../../global.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SyncProvider>
        <DataProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <StatusBar style="auto" />
        </DataProvider>
      </SyncProvider>
    </AuthProvider>
  );
}
