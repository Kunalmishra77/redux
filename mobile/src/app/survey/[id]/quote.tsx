import { useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toPaise } from '@/lib/services/money'
import { calculateYouSave } from '@/lib/services/pricing'
import { AppHeader } from '~/components/AppHeader'
import { EmptyState } from '~/components/ui'
import { useLocalQuery } from '~/lib/events'
import { inr } from '~/lib/format'
import { TREATMENT_CUSTOMER } from '~/lib/labels'
import { getSurvey, quoteLines, type QuoteLine } from '~/lib/repo'
import { colors, radius, space } from '~/lib/theme'

function sum(values: (string | null)[]): string {
  let p = 0n
  for (const v of values) if (v) p += toPaise(v)
  const neg = p < 0n
  const a = neg ? -p : p
  return `${neg ? '-' : ''}${a / 100n}.${(a % 100n).toString().padStart(2, '0')}`
}

/**
 * C10 — quote preview on site. Designed to be turned around and shown to the customer: large type,
 * no internal jargon, no cost fields. Indicative — the office issues the formal quotation.
 */
export default function QuotePreview() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { data: s } = useLocalQuery(() => getSurvey(id), [id])
  const { data: lines } = useLocalQuery(() => quoteLines(id), [id])

  const totals = useMemo(() => {
    const l = lines ?? []
    const rec = sum(l.map((x) => x.price_recommended))
    const mkt = sum(l.map((x) => x.price_market_replacement))
    return { rec, mkt, save: calculateYouSave(mkt, rec) } // BR-A4: hidden when not positive
  }, [lines])

  const groups = useMemo(() => {
    const m = new Map<string, QuoteLine[]>()
    for (const l of lines ?? []) {
      const k = l.unit_label ?? '—'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(l)
    }
    return [...m.entries()]
  }, [lines])

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppHeader title="Your restoration estimate" subtitle={s?.property_name} back />
      {lines && lines.length === 0 ? (
        <EmptyState icon="pricetags-outline" title="Nothing to price yet" body="Record fittings with a recommendation and they appear here." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 200 + insets.bottom }}>
          <View style={styles.legend}>
            <Text style={[styles.legendCell, { flex: 1.3 }]}>Fitting</Text>
            <Text style={styles.legendCell}>Our option</Text>
            <Text style={styles.legendCell}>New Eurobrass</Text>
            <Text style={styles.legendCell}>New from market</Text>
          </View>
          {groups.map(([unit, items]) => (
            <View key={unit} style={{ gap: space.sm }}>
              <Text style={styles.unit}>
                {s?.unit_label ?? 'Room'} {unit}
              </Text>
              {items.map((l) => (
                <View key={l.fitting_id} style={styles.line}>
                  <View style={{ flex: 1.3, paddingRight: 4 }}>
                    <Text style={styles.fitting}>{l.type_name}</Text>
                    <Text style={styles.sub}>{l.finish_name ?? ''}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellOn]}>
                    <Text style={styles.cellTag}>{TREATMENT_CUSTOMER[l.recommended]}</Text>
                    <Text style={[styles.price, { color: colors.white }]}>{inr(l.price_recommended)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.price}>{inr(l.price_replace_eurobrass)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={[styles.price, styles.strike]}>{inr(l.price_market_replacement)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.note}>Indicative prices before GST from REDUX's current rate card. Your formal quotation follows from the office.</Text>
        </ScrollView>
      )}
      {lines && lines.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.totRow}>
            <Text style={styles.totLabel}>Restoring with REDUX</Text>
            <Text style={styles.totValue}>{inr(totals.rec)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text style={styles.totLabel}>Replacing from the market</Text>
            <Text style={[styles.totValue, { color: colors.pale }]}>{inr(totals.mkt)}</Text>
          </View>
          {totals.save ? (
            <View style={styles.saveBox}>
              <Text style={styles.saveLabel}>You save</Text>
              <Text style={styles.saveValue}>{inr(totals.save)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 6, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: space.sm },
  legendCell: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  unit: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4, color: colors.blue, textTransform: 'uppercase' },
  line: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  fitting: { fontSize: 16, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.muted },
  cell: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  cellOn: { backgroundColor: colors.blue },
  cellTag: { fontSize: 10.5, fontWeight: '800', color: colors.lime, letterSpacing: 0.5, textTransform: 'uppercase' },
  price: { fontSize: 15.5, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  strike: { color: colors.muted },
  note: { fontSize: 13, color: colors.faint, textAlign: 'center', marginTop: space.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.blue, padding: space.lg, gap: 6 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totLabel: { color: colors.pale, fontSize: 15 },
  totValue: { color: colors.white, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  saveBox: {
    marginTop: space.sm,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveLabel: { color: colors.blue, fontSize: 18, fontWeight: '800' },
  saveValue: { color: colors.blue, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
})
