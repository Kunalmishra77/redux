import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Notice } from '~/components/ui'
import { useAuth } from '~/lib/auth'
import { pullAll } from '~/lib/pull'
import { colors, radius, space, TOUCH } from '~/lib/theme'

type Problem = { title: string; body: string }

function explain(e: unknown): Problem {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg === 'not_surveyor') {
    return { title: 'This app is for surveyors', body: 'That account is not a surveyor. Care executives and admins use the REDUX web portal.' }
  }
  if (msg === 'other_user_pending') {
    return {
      title: 'Another surveyor has unsent work here',
      body: 'This phone still holds work that has not uploaded. Sign in as that surveyor and let it sync first — nothing is ever discarded.',
    }
  }
  if (/invalid login credentials|invalid.*password|email not confirmed/i.test(msg)) {
    return { title: 'Email or password is wrong', body: 'Check both and try again. The office can reset your password.' }
  }
  return {
    title: "Can't reach the REDUX server",
    body:
      'Check that you have signal. On home Wi-Fi some internet providers block our server — switch to mobile data, ' +
      'or set Android Settings → Network → Private DNS to "dns.google", then try again.',
  }
}

export default function Login() {
  const { signIn } = useAuth()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  async function submit() {
    setProblem(null)
    setBusy(true)
    try {
      await signIn(email, password)
      await pullAll().catch(() => undefined) // first download; the list retries on its own
    } catch (e) {
      setProblem(explain(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.blue }} behavior="height">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { paddingTop: insets.top + 56 }]}>
          <Text style={styles.brand}>REDUX</Text>
          <Text style={styles.by}>Bath Restorations by Eurobrass</Text>
          <View style={styles.tag}>
            <Ionicons name="clipboard-outline" size={15} color={colors.blue} />
            <Text style={styles.tagText}>Surveyor app</Text>
          </View>
        </View>

        <View style={[styles.panel, { paddingBottom: insets.bottom + space.xl }]}>
          <Text style={styles.h1}>Sign in</Text>
          <Text style={styles.lead}>Your visits, fittings and photos are kept on this phone and upload when there is signal.</Text>

          <Text style={styles.label}>Work email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="name@redux.demo"
            placeholderTextColor={colors.faint}
            style={styles.input}
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoComplete="password"
              placeholder="Password"
              placeholderTextColor={colors.faint}
              style={[styles.input, { paddingRight: 56 }]}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable onPress={() => setShow((s) => !s)} style={styles.eye} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
            </Pressable>
          </View>

          {problem ? (
            <View style={{ marginTop: space.lg }}>
              <Notice tone="danger" icon="alert-circle" title={problem.title} body={problem.body} />
            </View>
          ) : null}

          <Button
            title="Sign in"
            icon="log-in-outline"
            onPress={submit}
            loading={busy}
            disabled={!email.includes('@') || password.length < 4}
            style={{ marginTop: space.xl }}
          />
          <Text style={styles.foot}>Signing out never deletes unsent work.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  brand: { color: colors.white, fontSize: 44, fontWeight: '800', letterSpacing: 8 },
  by: { color: colors.pale, fontSize: 15, marginTop: 2 },
  tag: {
    marginTop: space.lg,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { color: colors.blue, fontWeight: '800', fontSize: 13 },
  panel: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl },
  h1: { fontSize: 26, fontWeight: '700', color: colors.ink },
  lead: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted, marginTop: space.lg, marginBottom: 6 },
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  eye: { position: 'absolute', right: 4, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' },
  foot: { textAlign: 'center', color: colors.faint, fontSize: 13, marginTop: space.lg },
})
