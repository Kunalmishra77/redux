import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '~/components/AppHeader'
import { Button, Card, EmptyState, Pill } from '~/components/ui'
import { useLocalQuery } from '~/lib/events'
import { uuid } from '~/lib/ids'
import { TREATMENT_LABEL } from '~/lib/labels'
import { effectiveStatus, getSurvey, getUnit, listFittings, SLOTS, type FittingRow } from '~/lib/repo'
import { colors, space, type } from '~/lib/theme'

export default function UnitScreen() {
  const { id, unitId } = useLocalSearchParams<{ id: string; unitId: string }>()
  const insets = useSafeAreaInsets()
  const { data: s } = useLocalQuery(() => getSurvey(id), [id])
  const { data: unit } = useLocalQuery(() => getUnit(unitId), [unitId])
  const { data: fittings } = useLocalQuery(() => listFittings(id, unitId), [id, unitId])
  const word = s?.unit_label ?? 'Room'
  const canEdit = s ? ['checked_in', 'in_progress'].includes(effectiveStatus(s)) : false

  function addFitting() {
    router.push({ pathname: '/survey/[id]/fitting', params: { id, unitId, fittingId: uuid() } })
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title={`${word} ${unit?.label ?? ''}`} subtitle={s?.property_name} back />
      <FlatList
        data={fittings ?? []}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 + insets.bottom }}
        renderItem={({ item }) => <FittingCard f={item} />}
        ListEmptyComponent={
          fittings ? (
            <EmptyState
              icon="water-outline"
              title="No fittings recorded yet"
              body="Add each tap, mixer, shower, diverter and aerator in this room — four photos each."
            />
          ) : null
        }
      />
      {canEdit ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
          <Button title="Add fitting" icon="add-circle" onPress={addFitting} />
        </View>
      ) : null}
    </View>
  )
}

function FittingCard({ f }: { f: FittingRow }) {
  const complete = f.photos >= 4
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>{f.type_name}</Text>
          <Text style={type.small}>{[f.brand_name, f.model, f.finish_name].filter(Boolean).join(' · ') || 'Brand not recorded'}</Text>
        </View>
        {f.recommended ? <Pill text={TREATMENT_LABEL[f.recommended] ?? f.recommended} tone={f.recommended === 'replace_eurobrass' ? 'neutral' : 'lime'} /> : null}
      </View>
      <View style={styles.slots}>
        {SLOTS.map((slot, i) => (
          <View key={slot} style={[styles.slot, i < f.photos ? styles.slotOn : null]}>
            <Ionicons name={i < f.photos ? 'checkmark' : 'camera-outline'} size={14} color={i < f.photos ? colors.white : colors.blue} />
          </View>
        ))}
        <Text style={[type.caption, { marginLeft: 6 }]}>{complete ? '4/4 photos' : `${f.photos}/4 photos`}</Text>
        <View style={{ flex: 1 }} />
        {f.unsynced > 0 ? (
          <Pill text={`${f.unsynced} on phone`} tone="warning" icon="phone-portrait-outline" />
        ) : (
          <Pill text="Uploaded" tone="success" icon="cloud-done-outline" />
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slot: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOn: { backgroundColor: colors.blue, borderStyle: 'solid' },
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
  },
})
