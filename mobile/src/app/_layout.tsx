import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { AuthProvider, useAuth } from '~/lib/auth'
import { initDb } from '~/lib/db'
import { startSync } from '~/lib/sync'
import { isConfigured } from '~/lib/supabase'
import { colors } from '~/lib/theme'

function Splash({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: 6 }}>REDUX</Text>
      <Text style={{ color: colors.pale, fontSize: 14, marginTop: 4 }}>Surveyor</Text>
      {message ? (
        <Text style={{ color: colors.white, fontSize: 15, marginTop: 24, textAlign: 'center', lineHeight: 22 }}>{message}</Text>
      ) : (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 28 }} />
      )}
    </View>
  )
}

function Gate() {
  const { session, ready } = useAuth()
  const segments = useSegments()
  const onLogin = segments[0] === 'login'

  useEffect(() => {
    if (!ready) return
    if (!session && !onLogin) router.replace('/login')
    if (session && onLogin) router.replace('/')
  }, [ready, session, onLogin])

  useEffect(() => {
    if (session) startSync()
  }, [session])

  if (!ready) return <Splash />
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
  )
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    initDb().then(
      () => setDbReady(true),
      (e: unknown) => setDbError(e instanceof Error ? e.message : String(e)),
    )
  }, [])

  if (!isConfigured) {
    return <Splash message={'This build is missing its server settings.\nCopy mobile/.env.example to mobile/.env, fill in the two values and restart Expo.'} />
  }
  if (dbError) return <Splash message={`The phone's storage couldn't be opened. Restart the app.\n(${dbError})`} />
  if (!dbReady) return <Splash />

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Gate />
    </AuthProvider>
  )
}
