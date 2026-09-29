import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalQuery } from '~/lib/events'
import { syncCounts, useSyncState } from '~/lib/sync'
import { colors, space } from '~/lib/theme'

/**
 * "Did it save?" is the surveyor's main anxiety — the answer is permanently in the header
 * (05-screens-surveyor-app.md, global rules).
 */
export function SyncChip() {
  const s = useSyncState()
  const { data: c } = useLocalQuery(syncCounts, [s.running, s.online])
  let icon: keyof typeof Ionicons.glyphMap = 'checkmark-circle'
  let text = 'All synced'
  let bg: string = 'rgba(114,242,13,0.18)'
  let fg: string = colors.lime
  const saved = c ? c.pending + c.failed : 0
  if (c && c.failed > 0) {
    icon = 'warning'
    text = `${c.failed} need${c.failed === 1 ? 's' : ''} attention`
    bg = colors.warningBg
    fg = colors.warning
  } else if (!s.online && saved > 0) {
    icon = 'pause-circle'
    text = `Offline — ${saved} saved`
    bg = 'rgba(255,255,255,0.14)'
    fg = colors.white
  } else if (!s.online) {
    icon = 'cloud-offline'
    text = 'Offline'
    bg = 'rgba(255,255,255,0.14)'
    fg = colors.white
  } else if (s.needsLogin && saved > 0) {
    icon = 'lock-closed'
    text = `${saved} waiting · sign in`
    bg = colors.warningBg
    fg = colors.warning
  } else if (c && c.pending > 0) {
    icon = 'arrow-up-circle'
    text = c.photosTotal > 0 ? `Uploading ${c.photosDone}/${c.photosTotal}` : `Syncing ${c.pending}`
    bg = 'rgba(255,255,255,0.14)'
    fg = colors.white
  }
  return (
    <Pressable
      onPress={() => router.push('/sync')}
      accessibilityLabel={`Sync status: ${text}`}
      hitSlop={8}
      style={({ pressed }) => [styles.chip, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={16} color={fg} />
      <Text style={[styles.chipText, { color: fg === colors.lime ? colors.white : fg }]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  )
}

export function AppHeader({
  title,
  subtitle,
  back,
  right,
  children,
}: {
  title: string
  subtitle?: string | null
  back?: boolean
  right?: ReactNode
  children?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const s = useSyncState()
  return (
    <View style={{ backgroundColor: colors.blue }}>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel="Back"
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed && { backgroundColor: 'rgba(255,255,255,0.12)' }]}
          >
            <Ionicons name="arrow-back" size={26} color={colors.white} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ?? <SyncChip />}
      </View>
      {children}
      {!s.online ? (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.ink} />
          <Text style={styles.offlineText}>No signal — everything you do is saved on this phone and uploads later.</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { color: colors.white, fontSize: 21, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { color: colors.pale, fontSize: 14, marginTop: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 190 },
  chipText: { fontSize: 13, fontWeight: '700' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningBg, paddingHorizontal: space.lg, paddingVertical: 8 },
  offlineText: { color: colors.ink, fontSize: 13, flex: 1 },
})
