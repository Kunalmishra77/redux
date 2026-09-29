import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '~/components/AppHeader'
import { StatusPill } from '~/components/StatusPill'
import { Button, Card, EmptyState, Label, Notice, Pill } from '~/components/ui'
import { useLocalQuery } from '~/lib/events'
import { dayLabelIST, timeIST } from '~/lib/format'
import { callPhone, openDirections } from '~/lib/nav'
import { addUnit, checkIn, effectiveStatus, getSurvey, listDrafts, listUnits, queueSubmit, surveySync, type LocalSurvey } from '~/lib/repo'
import { drain, useSyncState } from '~/lib/sync'
import { colors, radius, space, TOUCH, type } from '~/lib/theme'

export default function SurveyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: s, loading } = useLocalQuery(() => getSurvey(id), [id])
  const insets = useSafeAreaInsets()

  if (!s) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader title="Visit" back />
        {loading ? null : <EmptyState icon="alert-circle-outline" title="This visit isn't on this phone" body="Go back and pull down to refresh the list." />}
      </View>
    )
  }

  const status = effectiveStatus(s)
  const checkedIn = status !== 'scheduled'

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title={s.property_name ?? 'Visit'} subtitle={`${dayLabelIST(s.scheduled_at)} · ${timeIST(s.scheduled_at)}`} back />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 140 + insets.bottom }}>
        <PropertyCard s={s} />
        {status === 'submitted' ? (
          <Notice tone="success" icon="checkmark-circle" title="Survey submitted" body="The office can now build the quotation. This visit is read-only." />
        ) : null}
        {!checkedIn ? <CheckInCard s={s} /> : <CheckedInStrip s={s} />}
        {checkedIn ? <Units s={s} /> : null}
      </ScrollView>
      {checkedIn ? <BottomBar s={s} /> : null}
    </View>
  )
}

function PropertyCard({ s }: { s: LocalSurvey }) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill text={s.customer_type === 'hotel' ? 'Hotel' : 'Home'} icon={s.customer_type === 'hotel' ? 'business' : 'home'} />
        <StatusPill s={s} />
      </View>
      <View style={styles.row}>
        <Ionicons name="location-outline" size={20} color={colors.blue} />
        <Text style={[type.body, { flex: 1 }]}>{s.address}</Text>
      </View>
      {s.contact_name ? (
        <View style={styles.row}>
          <Ionicons name="person-outline" size={20} color={colors.blue} />
          <Text style={[type.body, { flex: 1 }]}>{s.contact_name}</Text>
        </View>
      ) : null}
      <Text style={type.caption}>Free assessment — no charge to the customer.</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Navigate" icon="navigate-outline" variant="outline" compact style={{ flex: 1 }} onPress={() => void openDirections(s)} />
        {s.contact_phone ? (
          <Button title="Call" icon="call-outline" variant="outline" compact style={{ flex: 1 }} onPress={() => void callPhone(s.contact_phone!)} />
        ) : null}
      </View>
    </Card>
  )
}

/** C5 — check-in. Live GPS accuracy; weak GPS is flagged, never blocks (BR-S3). */
function CheckInCard({ s }: { s: LocalSurvey }) {
  const [fix, setFix] = useState<Location.LocationObject | null>(null)
  const [perm, setPerm] = useState<'asking' | 'granted' | 'denied'>('asking')
  const [waitedLong, setWaitedLong] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null
    let alive = true
    ;(async () => {
      const p = await Location.requestForegroundPermissionsAsync()
      if (!alive) return
      if (!p.granted) {
        setPerm('denied')
        return
      }
      setPerm('granted')
      const last = await Location.getLastKnownPositionAsync().catch(() => null)
      if (alive && last) setFix((f) => f ?? last)
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, timeInterval: 2000, distanceInterval: 0 }, (l) => alive && setFix(l))
    })()
    const t = setTimeout(() => setWaitedLong(true), 15_000)
    return () => {
      alive = false
      clearTimeout(t)
      sub?.remove()
    }
  }, [])

  const acc = fix?.coords.accuracy ?? null
  const good = acc !== null && acc <= 50

  async function doCheckIn() {
    if (!fix) return
    setBusy(true)
    try {
      await checkIn(s, {
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracy: acc,
        mocked: Boolean((fix as { mocked?: boolean }).mocked),
      })
      void drain()
    } catch (e) {
      Alert.alert("Couldn't check in", e instanceof Error ? e.message : 'Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      <Label>Check in</Label>
      <Text style={type.body}>Check in when you reach the property. It records where and when you started.</Text>
      {perm === 'denied' ? (
        <Notice
          tone="warning"
          icon="location-outline"
          title="Location permission is off"
          body="Check-in needs your location. Turn it on in Settings → Apps → Expo Go → Permissions → Location."
        />
      ) : (
        <View style={[styles.gps, { backgroundColor: !fix ? colors.surface : good ? colors.successBg : colors.warningBg }]}>
          <Ionicons
            name={!fix ? 'locate-outline' : good ? 'checkmark-circle' : 'warning'}
            size={24}
            color={!fix ? colors.muted : good ? colors.success : colors.warning}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.gpsTitle, { color: !fix ? colors.muted : good ? colors.success : colors.warning }]}>
              {!fix ? 'Finding your location…' : good ? `GPS good · ±${Math.round(acc!)} m` : `Weak GPS · ±${acc === null ? '?' : Math.round(acc)} m`}
            </Text>
            {fix && !good ? <Text style={{ color: colors.warning, fontSize: 14 }}>Checking in anyway — the office sees the accuracy.</Text> : null}
            {!fix && waitedLong ? <Text style={{ color: colors.muted, fontSize: 14 }}>Indoors this can take a while. Step near a window.</Text> : null}
          </View>
        </View>
      )}
      <Button
        title={fix ? 'Check in' : 'Waiting for GPS…'}
        icon="location"
        disabled={!fix}
        loading={busy}
        onPress={doCheckIn}
        style={{ minHeight: 64 }}
      />
    </Card>
  )
}

function CheckedInStrip({ s }: { s: LocalSurvey }) {
  return (
    <View style={styles.strip}>
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      <Text style={{ color: colors.ink, fontSize: 15, flex: 1 }}>
        Checked in{s.checked_in_at ? ` at ${timeIST(s.checked_in_at)}` : ''}
        {s.checkin_accuracy_m !== null && s.checkin_accuracy_m > 50 ? ' · weak GPS flagged' : ''}
      </Text>
    </View>
  )
}

/** C6 — units with per-unit progress. "+ Add room" is prominent: room lists are often wrong. */
function Units({ s }: { s: LocalSurvey }) {
  const { data: units } = useLocalQuery(() => listUnits(s.id, s.property_id), [s.id])
  const { data: drafts } = useLocalQuery(() => listDrafts(s.id), [s.id])
  const [adding, setAdding] = useState(false)
  const word = s.unit_label
  const readOnly = !['checked_in', 'in_progress'].includes(effectiveStatus(s))

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>{word === 'Room' ? 'Rooms' : 'Bathrooms'}</Label>
        <Text style={type.caption}>{units?.length ?? 0} listed</Text>
      </View>

      {(drafts ?? []).map((d) => (
        <Notice
          key={d.fitting_id}
          tone="warning"
          icon="camera-outline"
          title={`Unfinished fitting · ${d.photos}/4 photos`}
          body="Its photos are saved on this phone. Finish it so it can upload."
          action={
            d.unit_id ? (
              <Button
                title="Finish this fitting"
                compact
                variant="outline"
                onPress={() => router.push({ pathname: '/survey/[id]/fitting', params: { id: s.id, unitId: d.unit_id!, fittingId: d.fitting_id } })}
              />
            ) : undefined
          }
        />
      ))}

      {(units ?? []).length === 0 ? (
        <Card>
          <Text style={type.body}>No {word.toLowerCase()}s listed for this property yet. Add each one as you walk through.</Text>
        </Card>
      ) : (
        <View style={styles.grid}>
          {(units ?? []).map((u) => {
            const done = u.fittings > 0 && u.complete === u.fittings
            return (
              <Pressable
                key={u.id}
                onPress={() => router.push({ pathname: '/survey/[id]/unit/[unitId]', params: { id: s.id, unitId: u.id } })}
                style={({ pressed }) => [styles.unit, done && { borderColor: colors.success }, pressed && { backgroundColor: colors.select }]}
              >
                <View style={[styles.ring, { borderColor: u.fittings === 0 ? colors.line : done ? colors.success : colors.blue }]}>
                  <Text style={[styles.ringText, { color: done ? colors.success : colors.blue }]}>{u.fittings}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.unitLabel} numberOfLines={1}>
                    {word} {u.label}
                  </Text>
                  <Text style={type.caption} numberOfLines={1}>
                    {u.fittings === 0 ? 'Not started' : `${u.fittings} fitting${u.fittings === 1 ? '' : 's'}`}
                    {u.is_local === 1 ? ' · added on site' : ''}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}

      {!readOnly ? <Button title={`Add ${word.toLowerCase()}`} icon="add-circle-outline" variant="outline" onPress={() => setAdding(true)} /> : null}
      <AddUnitModal
        visible={adding}
        word={word}
        onClose={() => setAdding(false)}
        onAdd={async (label, floor) => {
          const unitId = await addUnit(s, label, floor)
          setAdding(false)
          void drain()
          router.push({ pathname: '/survey/[id]/unit/[unitId]', params: { id: s.id, unitId } })
        }}
      />
    </View>
  )
}

function AddUnitModal(props: { visible: boolean; word: string; onClose: () => void; onAdd: (label: string, floor: string | null) => Promise<void> }) {
  const [label, setLabel] = useState('')
  const [floor, setFloor] = useState('')
  const insets = useSafeAreaInsets()
  const hotel = props.word === 'Room'
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,27,45,0.45)' }} onPress={props.onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <Text style={type.h2}>Add {props.word.toLowerCase()}</Text>
        <Text style={[type.small, { marginTop: 4 }]}>{hotel ? 'Use the number on the door, e.g. 204.' : 'e.g. Master bath, Guest bath, Kids bath.'}</Text>
        <TextInput
          autoFocus
          value={label}
          onChangeText={setLabel}
          placeholder={hotel ? 'Room number' : 'Bathroom name'}
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        {hotel ? (
          <TextInput value={floor} onChangeText={setFloor} placeholder="Floor (optional)" placeholderTextColor={colors.faint} style={styles.input} />
        ) : null}
        <Button
          title={`Add ${props.word.toLowerCase()}`}
          icon="add"
          disabled={label.trim().length === 0}
          style={{ marginTop: space.lg }}
          onPress={async () => {
            await props.onAdd(label.trim(), floor.trim() || null)
            setLabel('')
            setFloor('')
          }}
        />
      </View>
    </Modal>
  )
}

/** Submit is blocked while anything is unsynced (BR-S6) — and the bar says exactly why. */
function BottomBar({ s }: { s: LocalSurvey }) {
  const insets = useSafeAreaInsets()
  const sync = useSyncState()
  const { data: st } = useLocalQuery(() => surveySync(s.id), [s.id])
  const status = effectiveStatus(s)
  const [busy, setBusy] = useState(false)

  let reason: string | null = null
  if (s.fittings === 0) reason = 'Record at least one fitting to submit.'
  else if (st && st.failed > 0) reason = `${st.failed} item${st.failed === 1 ? '' : 's'} need attention — open Sync.`
  else if (st && st.pending > 0)
    reason = st.photosTotal > st.photosSynced ? `Uploading photos ${st.photosSynced}/${st.photosTotal} — submit unlocks when all are up.` : 'Saving to the server…'
  if (!sync.online && reason === null && s.fittings > 0) reason = 'No signal — submit needs a connection.'

  return (
    <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
      {status === 'submitted' || status === 'submitting' ? (
        <Button title="Quote preview" icon="pricetags-outline" variant="blue" onPress={() => router.push({ pathname: '/survey/[id]/quote', params: { id: s.id } })} />
      ) : (
        <>
          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              title="Quote"
              icon="pricetags-outline"
              variant="outline"
              disabled={s.fittings === 0}
              style={{ flex: 0.8 }}
              onPress={() => router.push({ pathname: '/survey/[id]/quote', params: { id: s.id } })}
            />
            <Button
              title="Submit survey"
              icon="cloud-upload-outline"
              disabled={reason !== null}
              loading={busy}
              style={{ flex: 1.2 }}
              onPress={() =>
                Alert.alert('Submit this survey?', 'The office will build the quotation from it. You cannot add fittings afterwards.', [
                  { text: 'Not yet', style: 'cancel' },
                  {
                    text: 'Submit',
                    onPress: async () => {
                      setBusy(true)
                      try {
                        await queueSubmit(s)
                        await drain()
                      } catch (e) {
                        Alert.alert('Not submitted yet', e instanceof Error ? e.message : 'Try again.')
                      } finally {
                        setBusy(false)
                      }
                    },
                  },
                ])
              }
            />
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  gps: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, borderRadius: radius.md },
  gpsTitle: { fontSize: 16, fontWeight: '700' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.successBg,
    padding: space.md,
    borderRadius: radius.md,
  },
  grid: { gap: space.sm },
  unit: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  ring: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unitLabel: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space.xl },
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: 18,
    color: colors.ink,
    marginTop: space.md,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  reason: { fontSize: 14, color: colors.muted, textAlign: 'center' },
})

