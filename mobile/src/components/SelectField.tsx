import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, space, TOUCH } from '~/lib/theme'

export type Option = { id: string; name: string; hex?: string | null }

/** A master-list dropdown as a bottom sheet. Recents are pinned to the top. */
export function SelectField(props: {
  label: string
  value: string | null
  options: Option[]
  recent?: string[]
  onChange: (id: string | null) => void
  placeholder?: string
  optional?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const insets = useSafeAreaInsets()
  const selected = props.options.find((o) => o.id === props.value) ?? null

  const list = useMemo(() => {
    const recent = (props.recent ?? []).map((id) => props.options.find((o) => o.id === id)).filter(Boolean) as Option[]
    const rest = props.options.filter((o) => !recent.some((r) => r.id === o.id))
    const all = [...recent.map((r) => ({ ...r, recent: true })), ...rest.map((r) => ({ ...r, recent: false }))]
    const needle = q.trim().toLowerCase()
    return needle ? all.filter((o) => o.name.toLowerCase().includes(needle)) : all
  }, [props.options, props.recent, q])

  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{props.label}</Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${props.label}: ${selected?.name ?? 'not set'}`}
          style={({ pressed }) => [styles.field, pressed && { borderColor: colors.blue }]}
        >
          {selected?.hex ? <View style={[styles.swatch, { backgroundColor: selected.hex }]} /> : null}
          <Text style={[styles.value, !selected && { color: colors.faint }]} numberOfLines={1}>
            {selected?.name ?? props.placeholder ?? 'Choose'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{props.label}</Text>
          {props.options.length > 8 ? (
            <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={colors.faint} style={styles.search} />
          ) : null}
          <FlatList
            data={list}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              props.optional ? (
                <Pressable
                  style={styles.opt}
                  onPress={() => {
                    props.onChange(null)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.optText, { color: colors.muted }]}>Not known</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const on = item.id === props.value
              return (
                <Pressable
                  onPress={() => {
                    props.onChange(item.id)
                    setQ('')
                    setOpen(false)
                  }}
                  style={({ pressed }) => [styles.opt, on && { backgroundColor: colors.select }, pressed && { backgroundColor: colors.surface }]}
                >
                  {item.hex ? <View style={[styles.swatch, { backgroundColor: item.hex }]} /> : null}
                  <Text style={[styles.optText, on && { color: colors.blue, fontWeight: '700' }]}>{item.name}</Text>
                  {item.recent ? <Text style={styles.recent}>RECENT</Text> : null}
                  {on ? <Ionicons name="checkmark" size={22} color={colors.blue} /> : null}
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted },
  field: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  value: { flex: 1, fontSize: 17, color: colors.ink, fontWeight: '500' },
  swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  scrim: { flex: 1, backgroundColor: 'rgba(20,27,45,0.45)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '75%',
    paddingHorizontal: space.lg,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginVertical: space.sm },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: colors.ink, marginBottom: space.sm },
  search: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
    marginBottom: space.sm,
    color: colors.ink,
  },
  opt: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  optText: { flex: 1, fontSize: 17, color: colors.ink },
  recent: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: colors.blue, backgroundColor: colors.select, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
})
