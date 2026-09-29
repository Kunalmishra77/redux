import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native'
import { AppHeader } from '~/components/AppHeader'
import { StatusPill } from '~/components/StatusPill'
import { Button, Card, EmptyState, Notice } from '~/components/ui'
import { useAuth } from '~/lib/auth'
import { useLocalQuery } from '~/lib/events'
import { ago, dayKeyIST, dayLabelIST, timeIST } from '~/lib/format'
import { openDirections } from '~/lib/nav'
import { lastPullAt, pullAll } from '~/lib/pull'
import { effectiveStatus, isOpen, listSurveys, type LocalSurvey } from '~/lib/repo'
import { useSyncState } from '~/lib/sync'
import { colors, space, type } from '~/lib/theme'

function unitWord(s: LocalSurvey, n: number) {
  const w = s.unit_label === 'Bathroom' ? 'bathroom' : 'room'
  return `${n} ${w}${n === 1 ? '' : 's'}`
}

export default function Visits() {
  const { name, signOut } = useAuth()
  const sync = useSyncState()
  const { data: surveys, loading } = useLocalQuery(listSurveys)
  const { data: pulledAt } = useLocalQuery(lastPullAt)
  const [refreshing, setRefreshing] = useState(false)
  const [pullProblem, setPullProblem] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await pullAll()
      setPullProblem(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setPullProblem(
        msg === 'signed_out'
          ? 'Your session has ended — sign in again. Nothing on this phone is lost.'
          : "Couldn't refresh from the server. You're seeing the list saved on this phone. On home Wi-Fi, try mobile data or Private DNS \"dns.google\".",
      )
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Refresh on open when the saved list is older than 5 minutes
    lastPullAt().then((t) => {
      if (!t || Date.now() - new Date(t).getTime() > 5 * 60_000) void refresh()
    })
  }, [refresh])

  const sections = useMemo(() => {
    const all = surveys ?? []
    const open = all.filter(isOpen)
    const done = all.filter((s) => !isOpen(s)).reverse().slice(0, 8)
    const byDay = new Map<string, { title: string; data: LocalSurvey[] }>()
    for (const s of open) {
      const k = dayKeyIST(s.scheduled_at)
      if (!byDay.has(k)) byDay.set(k, { title: dayLabelIST(s.scheduled_at), data: [] })
      byDay.get(k)!.data.push(s)
    }
    const out = [...byDay.values()]
    if (done.length) out.push({ title: 'Recently submitted', data: done })
    return out
  }, [surveys])

  const openCount = (surveys ?? []).filter(isOpen).length
  const first = name?.split(' ')[0]

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title={first ? `Hi, ${first}` : 'My visits'} subtitle={`${openCount} visit${openCount === 1 ? '' : 's'} to do · updated ${ago(pulledAt ?? null)}`} />
      <SectionList
        sections={sections}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 48, gap: space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.blue]} />}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            {pullProblem ? <Notice tone="warning" icon="cloud-offline-outline" title="Showing saved list" body={pullProblem} /> : null}
            {sync.needsLogin ? (
              <Notice tone="warning" icon="lock-closed-outline" title="Sign in to keep uploading" body="Your saved work is safe on this phone." />
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={[type.label, { marginTop: space.md }]}>{section.title}</Text>}
        renderItem={({ item: s }) => <VisitCard s={s} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="calendar-outline"
              title="No visits assigned yet"
              body="When the office books a free survey for you, it appears here. Pull down to check again."
              action={<Button title="Check for visits" variant="outline" icon="refresh" onPress={refresh} loading={refreshing} />}
            />
          )
        }
        ListFooterComponent={
          <Pressable
            onPress={() =>
              Alert.alert('Sign out?', 'Anything not yet uploaded stays on this phone and uploads after you sign in again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
            style={styles.signout}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 15 }}>Sign out</Text>
          </Pressable>
        }
      />
    </View>
  )
}

function VisitCard({ s }: { s: LocalSurvey }) {
  const status = effectiveStatus(s)
  const open = isOpen(s)
  const sameName = !s.customer_name || s.customer_name === s.property_name
  return (
    <Card onPress={() => router.push(`/survey/${s.id}`)} style={{ gap: space.sm }}>
      <View style={styles.cardTop}>
        <Text style={styles.time}>{timeIST(s.scheduled_at)}</Text>
        <StatusPill s={s} />
      </View>
      <Text style={type.h2} numberOfLines={2}>
        {s.property_name}
      </Text>
      {!sameName ? <Text style={type.small}>{s.customer_name}</Text> : null}
      <View style={styles.meta}>
        <Ionicons name={s.customer_type === 'hotel' ? 'business-outline' : 'home-outline'} size={16} color={colors.muted} />
        <Text style={type.small} numberOfLines={1}>
          {s.customer_type === 'hotel' ? 'Hotel' : 'Home'} · {s.fittings > 0 ? `${unitWord(s, s.units)} · ${s.fittings} fittings` : s.address}
        </Text>
      </View>
      {open ? (
        <View style={styles.actions}>
          <Button title="Navigate" icon="navigate-outline" variant="outline" compact style={{ flex: 1 }} onPress={() => void openDirections(s)} />
          <Button
            title={status === 'scheduled' ? 'Check in' : 'Continue'}
            icon={status === 'scheduled' ? 'location-outline' : 'arrow-forward'}
            variant={status === 'scheduled' ? 'primary' : 'blue'}
            compact
            style={{ flex: 1 }}
            onPress={() => router.push(`/survey/${s.id}`)}
          />
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 15, fontWeight: '700', color: colors.blue, fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  signout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 56 },
})
