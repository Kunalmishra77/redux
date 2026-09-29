import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { priceAssessment, TREATMENTS, type Treatment } from '@/lib/services/assessment-pricing'
import { AppHeader } from '~/components/AppHeader'
import { SelectField } from '~/components/SelectField'
import { Button, Chip, Label, Notice } from '~/components/ui'
import { useLocalQuery } from '~/lib/events'
import { inr } from '~/lib/format'
import { uuid } from '~/lib/ids'
import { TREATMENT_LABEL } from '~/lib/labels'
import { capturePhoto, discardReplacedDraft, freeSpaceMb, type CaptureSource } from '~/lib/photos'
import {
  getDraftPhotos,
  getMasters,
  getSurvey,
  getUnit,
  recentIds,
  saveDraftPhoto,
  saveFitting,
  SLOT_LABEL,
  SLOTS,
  type Slot,
} from '~/lib/repo'
import { drain } from '~/lib/sync'
import { colors, radius, space, TOUCH, type } from '~/lib/theme'

/** C7/C8 — fitting capture. The core screen: a fitting recorded in under 60 seconds. */
export default function FittingCapture() {
  const { id, unitId, fittingId } = useLocalSearchParams<{ id: string; unitId: string; fittingId: string }>()
  const insets = useSafeAreaInsets()
  const { data: s } = useLocalQuery(() => getSurvey(id), [id])
  const { data: unit } = useLocalQuery(() => getUnit(unitId), [unitId])
  const { data: m } = useLocalQuery(getMasters, [])
  const { data: drafts } = useLocalQuery(() => getDraftPhotos(fittingId), [fittingId])
  const { data: recentTypes } = useLocalQuery(() => recentIds('fitting_type_id'), [])
  const { data: recentBrands } = useLocalQuery(() => recentIds('brand_id'), [])
  const { data: recentFinishes } = useLocalQuery(() => recentIds('finish_id'), [])

  const [typeId, setTypeId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [finishId, setFinishId] = useState<string | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [rec, setRec] = useState<Treatment | null>(null)
  const [targetFinishId, setTargetFinishId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [partNote, setPartNote] = useState('')
  const [busySlot, setBusySlot] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)

  // A fresh fitting starts from the surveyor's last choices — 40 basin mixers in a row is normal
  useEffect(() => {
    if (recentTypes && typeId === null && recentTypes[0]) setTypeId(recentTypes[0])
    if (recentBrands && brandId === null && recentBrands[0]) setBrandId(recentBrands[0])
    if (recentFinishes && finishId === null && recentFinishes[0]) setFinishId(recentFinishes[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentTypes, recentBrands, recentFinishes])

  const partFlag = m?.flags.find((f) => f.code === 'part_unavailable')
  const partSelected = partFlag ? flags.includes(partFlag.id) : false

  const prices = useMemo(() => {
    if (!m || !typeId || !rec) return null
    return priceAssessment({
      items: m.items,
      market: m.market,
      fittingTypeId: typeId,
      recommended: rec,
      currentFinishId: finishId,
      targetFinishId: rec === 'restore_finish' ? targetFinishId : null,
    })
  }, [m, typeId, rec, finishId, targetFinishId])

  const have = new Set((drafts ?? []).map((d) => d.slot))
  const missing = SLOTS.filter((sl) => !have.has(sl))
  const typeName = m?.types.find((t) => t.id === typeId)?.name ?? 'Fitting'

  // The button says why it is disabled (BR-S5)
  let blocker: string | null = null
  if (!typeId) blocker = 'Choose the fitting type.'
  else if (missing.length === 1) blocker = `Add the ${SLOT_LABEL[missing[0]].toLowerCase()} photo to save.`
  else if (missing.length > 1) blocker = `Add ${missing.length} more photos to save (all four are required).`
  else if (!rec) blocker = 'Choose a recommendation.'
  else if (prices && prices.missing.length) blocker = `No rate-card price for ${prices.missing.join(', ')}.`

  async function shoot(slot: Slot, source: CaptureSource) {
    if (!s) return
    const free = freeSpaceMb()
    if (free !== null && free < 150) {
      Alert.alert('Phone storage is low', 'Upload when you get signal to free space. You can still take this photo.')
    }
    setBusySlot(slot)
    try {
      const photo = await capturePhoto(slot, source)
      if (!photo) return
      await discardReplacedDraft(fittingId, slot, photo.local_uri)
      await saveDraftPhoto(s.id, fittingId, unitId, photo)
    } catch (e) {
      Alert.alert("Couldn't take the photo", e instanceof Error ? e.message : 'Try again.')
    } finally {
      setBusySlot(null)
    }
  }

  async function save(next: boolean) {
    if (!s || !unit || !m || !typeId || !rec) return
    setSaving(true)
    try {
      await saveFitting({
        id: fittingId,
        survey: s,
        unit,
        fittingTypeId: typeId,
        typeName,
        brandId,
        model: model.trim() || null,
        finishId,
        conditionIds: flags,
        recommended: rec,
        targetFinishId: rec === 'restore_finish' ? targetFinishId : null,
        surveyorNote: note.trim() || null,
        partUnavailableNote: partSelected ? partNote.trim() || null : null,
        masters: m,
      })
      void drain()
      if (next) router.replace({ pathname: '/survey/[id]/fitting', params: { id, unitId, fittingId: uuid() } })
      else router.back()
    } catch (e) {
      Alert.alert('Not saved yet', e instanceof Error ? e.message : 'Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!s || !unit || !m) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader title="Fitting" back />
        <ActivityIndicator color={colors.blue} style={{ marginTop: 40 }} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title={`${s.unit_label} ${unit.label} · ${s.property_name ?? ''}`} subtitle={typeId ? typeName : 'New fitting'} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 170 + insets.bottom }} keyboardShouldPersistTaps="handled">
          {m.types.length === 0 ? (
            <Notice tone="warning" icon="list-outline" title="Master lists not downloaded" body="Go back to the visit list and pull down to refresh while you have signal." />
          ) : null}

          {/* Identity */}
          <View style={{ gap: space.md }}>
            <SelectField label="Type" value={typeId} options={m.types} recent={recentTypes} onChange={setTypeId} placeholder="Choose type" />
            <SelectField label="Brand" value={brandId} options={m.brands} recent={recentBrands} onChange={setBrandId} optional placeholder="Choose brand" />
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Model</Text>
              <TextInput value={model} onChangeText={setModel} placeholder="e.g. EB-2201 (optional)" placeholderTextColor={colors.faint} style={styles.input} autoCapitalize="characters" />
            </View>
            <SelectField label="Finish" value={finishId} options={m.finishes} recent={recentFinishes} onChange={setFinishId} optional placeholder="Choose finish" />
          </View>

          {/* Photos — four fixed slots; captured = solid with a tick, missing = dashed */}
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Label>Photos (4 required)</Label>
              <Text style={[type.caption, { color: missing.length ? colors.blue : colors.success, fontWeight: '700' }]}>{4 - missing.length}/4</Text>
            </View>
            <View style={styles.slotGrid}>
              {SLOTS.map((slot) => {
                const d = drafts?.find((x) => x.slot === slot)
                return (
                  <View key={slot} style={styles.slotCell}>
                    <Pressable
                      onPress={() => void shoot(slot, 'camera')}
                      accessibilityLabel={`${SLOT_LABEL[slot]} photo${d ? ', taken — tap to retake' : ''}`}
                      style={({ pressed }) => [styles.slot, d ? styles.slotDone : styles.slotEmpty, pressed && { opacity: 0.85 }]}
                    >
                      {d ? <Image source={{ uri: d.local_uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                      {busySlot === slot ? (
                        <ActivityIndicator color={d ? colors.white : colors.blue} />
                      ) : d ? (
                        <View style={styles.tick}>
                          <Ionicons name="checkmark" size={18} color={colors.blue} />
                        </View>
                      ) : (
                        <Ionicons name="camera" size={34} color={colors.blue} />
                      )}
                      <View style={[styles.slotLabel, d && { backgroundColor: 'rgba(0,71,171,0.85)' }]}>
                        <Text style={[styles.slotLabelText, d && { color: colors.white }]}>{SLOT_LABEL[slot]}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => void shoot(slot, 'library')} hitSlop={6} style={styles.gallery}>
                      <Text style={styles.galleryText}>{d ? 'Replace from gallery' : 'From gallery'}</Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
            <Text style={type.caption}>Photos are saved on this phone the moment you take them.</Text>
          </View>

          {/* Condition — multi-select, one tap each */}
          <View style={{ gap: space.md }}>
            <Label>Condition</Label>
            <View style={styles.wrap}>
              {m.flags.map((f) => (
                <Chip
                  key={f.id}
                  label={f.name}
                  selected={flags.includes(f.id)}
                  onPress={() => setFlags((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                />
              ))}
            </View>
            {partSelected ? (
              <TextInput
                value={partNote}
                onChangeText={setPartNote}
                placeholder="Which part? e.g. discontinued cartridge — Eurobrass can re-machine it"
                placeholderTextColor={colors.faint}
                style={[styles.input, { minHeight: 64 }]}
                multiline
              />
            ) : null}
          </View>

          {/* Recommendation + all three prices (BR-A2) */}
          <View style={{ gap: space.md }}>
            <Label>Recommendation</Label>
            <View style={styles.wrap}>
              {TREATMENTS.map((t) => (
                <Chip key={t} label={TREATMENT_LABEL[t]} selected={rec === t} onPress={() => setRec(t)} />
              ))}
            </View>
            {rec === 'restore_finish' ? (
              <SelectField
                label="Restore to finish"
                value={targetFinishId}
                options={m.finishes}
                onChange={setTargetFinishId}
                optional
                placeholder="Same as current finish"
              />
            ) : null}
            {prices ? <PricePanel prices={prices} rec={rec!} /> : null}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional) — e.g. body sound, finish worn at the spout"
              placeholderTextColor={colors.faint}
              style={[styles.input, { minHeight: 64 }]}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
        {blocker ? <Text style={styles.blocker}>{blocker}</Text> : null}
        <Button title="Save & next fitting" icon="checkmark-done" disabled={blocker !== null} loading={saving} onPress={() => void save(true)} />
        <Button title={`Save & back to ${s.unit_label.toLowerCase()}`} variant="ghost" compact disabled={blocker !== null || saving} onPress={() => void save(false)} />
      </View>
    </View>
  )
}

function PricePanel({ prices, rec }: { prices: ReturnType<typeof priceAssessment>; rec: Treatment }) {
  const cols = [
    { key: 'rec', title: rec === 'replace_eurobrass' ? 'Recommended' : TREATMENT_LABEL[rec], value: prices.recommended, on: true },
    { key: 'rep', title: 'Eurobrass replacement', value: prices.replaceEurobrass, on: false },
    { key: 'mkt', title: 'Market replacement', value: prices.marketReplacement, on: false },
  ]
  return (
    <View style={styles.pricePanel}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {cols.map((c) => (
          <View key={c.key} style={[styles.priceCol, c.on && styles.priceColOn]}>
            <Text style={[styles.priceTitle, c.on && { color: colors.pale }]} numberOfLines={2}>
              {c.title}
            </Text>
            <Text style={[styles.priceValue, c.on && { color: colors.white }, c.value === null && { color: colors.danger }]}>{c.value === null ? 'No price' : inr(c.value)}</Text>
          </View>
        ))}
      </View>
      {prices.youSave ? (
        <View style={styles.save}>
          <Text style={styles.saveText}>Customer saves {inr(prices.youSave)}</Text>
          <Text style={styles.saveSub}>vs market replacement</Text>
        </View>
      ) : null}
      <Text style={[type.caption, { marginTop: 6 }]}>Priced offline from the active rate card; the server re-checks on upload.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.muted },
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
  },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  slotCell: { width: '48.5%', gap: 4 },
  slot: {
    aspectRatio: 1.15,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotEmpty: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.blue, backgroundColor: colors.select },
  slotDone: { borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.ink },
  tick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 6, alignItems: 'center' },
  slotLabelText: { fontSize: 15, fontWeight: '700', color: colors.blue },
  gallery: { alignSelf: 'center', paddingVertical: 4 },
  galleryText: { fontSize: 12.5, color: colors.muted, textDecorationLine: 'underline' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pricePanel: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.md },
  priceCol: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.sm, minHeight: 84, justifyContent: 'space-between' },
  priceColOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  priceTitle: { fontSize: 12, fontWeight: '700', color: colors.muted },
  priceValue: { fontSize: 18, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 6 },
  save: { marginTop: space.md, backgroundColor: colors.lime, borderRadius: radius.md, padding: space.md, alignItems: 'center' },
  saveText: { fontSize: 20, fontWeight: '800', color: colors.blue, fontVariant: ['tabular-nums'] },
  saveSub: { fontSize: 12.5, color: colors.blue, fontWeight: '600' },
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
    gap: 4,
  },
  blocker: { fontSize: 14, color: colors.blue, textAlign: 'center', fontWeight: '600', marginBottom: 4 },
})
