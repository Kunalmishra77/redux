import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '~/components/AppHeader'
import { Button, Card, Label, Notice } from '~/components/ui'
import { db } from '~/lib/db'
import { useDataVersion, useLocalQuery } from '~/lib/events'
import { ago } from '~/lib/format'
import { freeSpaceMb, reconcilePhotos } from '~/lib/photos'
import { drain, retryFailed, syncCounts, useSyncState } from '~/lib/sync'
import { colors, radius, space, type } from '~/lib/theme'

type PerSurvey = { survey_id: string; name: string | null; total: number; synced: number; pending: number; failed: number }
type Problem = { seq: number; label: string | null; last_error: string | null; attempts: number; status: string; kind: string }

const perSurvey = () =>
  db.getAllAsync<PerSurvey>(
    `SELECT s.id AS survey_id, s.property_name AS name,
       (SELECT count(*) FROM attachments a WHERE a.survey_id = s.id) AS total,
       (SELECT count(*) FROM attachments a WHERE a.survey_id = s.id AND a.status = 'synced') AS synced,
       (SELECT count(*) FROM outbox o WHERE o.survey_id = s.id AND o.status = 'pending') AS pending,
       (SELECT count(*) FROM outbox o WHERE o.survey_id = s.id AND o.status = 'failed') AS failed
     FROM surveys s
     WHERE EXISTS (SELECT 1 FROM outbox o WHERE o.survey_id = s.id)
     ORDER BY pending + failed DESC, s.scheduled_at DESC`,
  )

const problems = () =>
  db.getAllAsync<Problem>(
    `SELECT seq, label, last_error, attempts, status, kind FROM outbox
     WHERE status = 'failed' OR (status = 'pending' AND attempts > 0) ORDER BY seq`,
  )

/** C11 — sync status. "Needs attention" names the exact fitting and slot. */
export default function SyncScreen() {
  const insets = useSafeAreaInsets()
  const sync = useSyncState()
  const v = useDataVersion()
  const { data: c } = useLocalQuery(syncCounts, [sync.running])
  const { data: rows } = useLocalQuery(perSurvey, [sync.running])
  const { data: probs } = useLocalQuery(problems, [sync.running])
  const [orphans, setOrphans] = useState<{ orphans: number; bytes: number } | null>(null)
  const free = freeSpaceMb()

  useEffect(() => {
    reconcilePhotos().then(setOrphans, () => undefined)
  }, [v])

  const pct = c && c.photosTotal > 0 ? c.photosDone / c.photosTotal : 1
  const failed = (probs ?? []).filter((p) => p.status === 'failed')
  const retrying = (probs ?? []).filter((p) => p.status === 'pending')

  let headline = 'Everything is on the server'
  let icon: keyof typeof Ionicons.glyphMap = 'cloud-done'
  let tone: string = colors.success
  if (c && c.failed > 0) {
    headline = `${c.failed} item${c.failed === 1 ? '' : 's'} need${c.failed === 1 ? 's' : ''} attention`
    icon = 'warning'
    tone = colors.warning
  } else if (c && c.pending > 0) {
    headline = !sync.online ? `Offline — ${c.pending} saved on this phone` : sync.needsLogin ? 'Sign in to continue uploading' : 'Uploading'
    icon = !sync.online ? 'pause-circle' : 'arrow-up-circle'
    tone = colors.blue
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Sync" subtitle={`Last checked ${ago(sync.lastSyncAt)}`} back right={<View />} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 40 + insets.bottom }}>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name={icon} size={28} color={tone} />
            <Text style={[type.h2, { flex: 1 }]}>{headline}</Text>
          </View>
          {c && c.photosTotal > 0 ? (
            <View style={{ gap: 6 }}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={[type.small, { fontVariant: ['tabular-nums'] }]}>
                {c.photosDone} / {c.photosTotal} photos uploaded
              </Text>
            </View>
          ) : null}
          {sync.current ? <Text style={type.caption}>Now: {sync.current}</Text> : null}
          <Button
            title={sync.running ? 'Syncing…' : 'Sync now'}
            icon="sync"
            variant="blue"
            loading={sync.running}
            disabled={!sync.online && !sync.running}
            onPress={() => void drain()}
          />
          {!sync.online ? <Text style={[type.small, { textAlign: 'center' }]}>No signal. Your work is safe here and uploads by itself when signal returns.</Text> : null}
        </Card>

        {failed.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Label>Needs attention ({failed.length})</Label>
            {failed.map((p) => (
              <Card key={p.seq} style={{ gap: 6, borderColor: colors.warning }}>
                <Text style={type.h3}>{p.label ?? p.kind}</Text>
                <Text style={type.small}>{p.last_error ?? 'Upload failed.'}</Text>
                <Text style={type.caption}>Tried {p.attempts} times · saved on this phone</Text>
                <Button title="Retry" icon="refresh" variant="outline" compact onPress={() => void retryFailed(p.seq)} />
              </Card>
            ))}
          </View>
        ) : null}

        {retrying.length > 0 ? (
          <Notice
            tone="info"
            icon="time-outline"
            title={`${retrying.length} item${retrying.length === 1 ? '' : 's'} will retry shortly`}
            body={retrying[0]?.last_error ?? undefined}
            action={<Button title="Retry now" compact variant="outline" onPress={() => void retryFailed()} />}
          />
        ) : null}

        {(rows ?? []).length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Label>By visit</Label>
            <Card style={{ paddingVertical: space.sm }}>
              {(rows ?? []).map((r, i) => {
                const done = r.pending === 0 && r.failed === 0
                return (
                  <View key={r.survey_id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.surface }]}>
                    <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={[type.small, { fontVariant: ['tabular-nums'] }]}>
                      {r.synced} / {r.total} photos
                    </Text>
                    <Ionicons
                      name={r.failed ? 'warning' : done ? 'checkmark-circle' : 'arrow-up-circle'}
                      size={22}
                      color={r.failed ? colors.warning : done ? colors.success : colors.blue}
                    />
                  </View>
                )
              })}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Label>This phone</Label>
          <Card style={{ gap: 6 }}>
            <Text style={type.small}>Free storage: {free === null ? 'unknown' : `${(free / 1024).toFixed(1)} GB`}</Text>
            {free !== null && free < 500 ? (
              <Text style={{ color: colors.warning, fontSize: 14 }}>Phone storage is low. Upload when you get signal to free space.</Text>
            ) : null}
            <Text style={type.small}>
              Photos waiting on this phone: {c ? c.photosPending : 0}
              {orphans && orphans.orphans > 0 ? ` · ${orphans.orphans} unlinked photo${orphans.orphans === 1 ? '' : 's'} kept (never deleted automatically)` : ''}
            </Text>
            <Text style={type.caption}>A photo is removed from this phone only after the server confirms it has it.</Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.lime, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
})
