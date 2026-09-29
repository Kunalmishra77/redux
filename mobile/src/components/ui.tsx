import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius, space, TOUCH, type } from '~/lib/theme'

export type IconName = ComponentProps<typeof Ionicons>['name']

type ButtonVariant = 'primary' | 'blue' | 'outline' | 'ghost' | 'danger'

/** Full-width by default; 56 dp minimum (thumb reach, wet hands). Lime = the one action that matters. */
export function Button(props: {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  icon?: IconName
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
  compact?: boolean
}) {
  const v = props.variant ?? 'primary'
  const palette = {
    primary: { bg: colors.lime, fg: colors.blue, border: colors.lime },
    blue: { bg: colors.blue, fg: colors.white, border: colors.blue },
    outline: { bg: colors.white, fg: colors.blue, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.blue, border: 'transparent' },
    danger: { bg: colors.white, fg: colors.danger, border: colors.danger },
  }[v]
  const disabled = props.disabled || props.loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : props.onPress}
      style={({ pressed }) => [
        styles.btn,
        props.compact && styles.btnCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        props.style,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {props.icon ? <Ionicons name={props.icon} size={22} color={disabled ? colors.faint : palette.fg} /> : null}
          <Text style={[styles.btnText, { color: disabled ? colors.faint : palette.fg }]} numberOfLines={1}>
            {props.title}
          </Text>
        </>
      )}
    </Pressable>
  )
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.select }, style]}>
        {children}
      </Pressable>
    )
  }
  return <View style={[styles.card, style]}>{children}</View>
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={type.label}>{children}</Text>
    </View>
  )
}

type Tone = 'neutral' | 'blue' | 'lime' | 'warning' | 'danger' | 'success' | 'ink'

export function Pill({ text, tone = 'neutral', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = {
    neutral: { bg: colors.white, fg: colors.muted, border: colors.line },
    blue: { bg: colors.blue, fg: colors.white, border: colors.blue },
    lime: { bg: colors.lime, fg: colors.blue, border: colors.lime },
    warning: { bg: colors.warningBg, fg: colors.warning, border: colors.warningBg },
    danger: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
    success: { bg: colors.successBg, fg: colors.success, border: colors.successBg },
    ink: { bg: colors.ink, fg: colors.white, border: colors.ink },
  }[tone]
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text style={[styles.pillText, { color: t.fg }]}>{text}</Text>
    </View>
  )
}

/** Big, one-tap multi/single-select chip. */
export function Chip({ label, selected, onPress, swatch }: { label: string; selected: boolean; onPress: () => void; swatch?: string | null }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.85 }]}
    >
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
      {selected ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.blue} />
      </View>
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.small, { textAlign: 'center', marginTop: 6 }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  )
}

export function Notice({ tone, icon, title, body, action }: { tone: 'warning' | 'danger' | 'info' | 'success'; icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const t = {
    warning: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    info: { bg: colors.select, fg: colors.blue },
    success: { bg: colors.successBg, fg: colors.success },
  }[tone]
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Ionicons name={icon} size={22} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        {body ? <Text style={{ color: t.fg, fontSize: 14, marginTop: 2, lineHeight: 20 }}>{body}</Text> : null}
        {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
      </View>
    </View>
  )
}

export const styles = StyleSheet.create({
  btn: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  btnCompact: { minHeight: 48, paddingHorizontal: space.md },
  btnDisabled: { backgroundColor: colors.surface, borderColor: colors.surface },
  btnText: { fontSize: 17, fontWeight: '700' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12.5, fontWeight: '700' },
  chip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  empty: { alignItems: 'center', padding: space.xl, paddingTop: space.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.select,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  notice: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md },
})
