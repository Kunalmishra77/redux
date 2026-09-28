// Demo seed, part 1: logins, roles, cities, master lists, rate card, settings, privacy notice.
// Staging only. Idempotent. Run: pnpm demo:seed
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { DEMO_CUSTOMERS, DEMO_PASSWORD, DEMO_STAFF } from './users'
import { seedTemplates } from './templates'

const STAGING_REF = 'bkygjdzljfkkbkomujav'

export function assertStaging() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing to seed demo data: ${url} is not the staging project (${STAGING_REF})`)
  }
}

export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Create (or find) every demo login; returns email → user id. */
export async function ensureUsers(): Promise<Record<string, string>> {
  const sb = admin()
  const ids: Record<string, string> = {}
  const existing = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) if (u.email) existing.set(u.email, u.id)
    if (data.users.length < 200) break
  }
  for (const u of [...DEMO_STAFF, ...DEMO_CUSTOMERS]) {
    let id = existing.get(u.email)
    if (!id) {
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        phone: u.phone?.replace('+', ''),
        phone_confirm: true,
        user_metadata: { full_name: u.name, demo: true },
      })
      if (error) throw new Error(`${u.email}: ${error.message}`)
      id = data.user.id
    }
    ids[u.key] = id
  }
  return ids
}

export async function seedBase(db: pg.Client, ids: Record<string, string>) {
  const q = (sql: string, v?: unknown[]) => db.query(sql, v)

  // Cities (GST state codes)
  await q(`insert into public.cities (name, state_code) values
    ('Delhi','07'), ('Gurugram','06'), ('Noida','09'), ('Jaipur','08'), ('Faridabad','06')
    on conflict (name) do nothing`)

  // Staff profiles + roles
  for (const u of DEMO_STAFF) {
    await q(`insert into public.profiles (id, full_name, email, phone, city_id)
             values ($1, $2, $3, $4, (select id from public.cities where name = $5))
             on conflict (id) do update set full_name = excluded.full_name, city_id = excluded.city_id`,
      [ids[u.key], u.name, u.email, u.phone, u.city ?? null])
    await q(`insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing`, [ids[u.key], u.role])
  }

  // Master lists (demo values — REDUX supplies the real ones, A8)
  await q(`insert into public.fitting_types (code, name, sort_order) values
    ('basin_mixer','Basin mixer',10), ('shower_mixer','Shower mixer',20), ('diverter','Diverter',30),
    ('health_faucet','Health faucet',40), ('spout','Bath spout',50), ('shower_head','Shower head',60),
    ('angle_valve','Angle valve',70), ('aerator','Aerator (water-saving)',80)
    on conflict (code) do nothing`)
  await q(`insert into public.brands (name) values ('Grohe'), ('Hansgrohe'), ('Kohler'), ('Jaquar'), ('Eurobrass'), ('Roca'), ('Toto')
    on conflict (name) do nothing`)
  await q(`insert into public.finishes (code, name, hex) values
    ('chrome','Chrome','#C9CFD6'), ('pvd_brushed_gold','PVD Brushed Gold','#C9A55C'), ('pvd_matte_black','PVD Matte Black','#26282B'),
    ('pvd_rose_gold','PVD Rose Gold','#C99A87'), ('brushed_nickel','Brushed Nickel','#A7A9A6')
    on conflict (code) do nothing`)

  // Settings REDUX will supply for real (A10, A11) — demo values
  await q(`update public.settings set value = $1 where key = 'warranty_terms'`, [JSON.stringify({
    version: 'W-DEMO-1',
    text: 'Mechanical warranty: 12 months on restored mechanisms and replaced cartridges. Finish warranty: 24 months on restored chrome and PVD finishes, against peeling and discolouration under normal use. Excludes damage from hard-water scaling left untreated, abrasive cleaners and third-party work.',
    mechanical_days: 365, finish_days: 730,
  })])
  for (const [k, v] of [
    ['supplier_gstin', '07AAACE1234F1Z5'], ['supplier_legal_name', 'Eurobrass Industries (REDUX) — DEMO'],
    ['supplier_address', 'D 8/7, Okhla Industrial Area Phase 1, New Delhi 110020'],
    ['invoice_series_code', 'RDX'], ['credit_note_series_code', 'RDXCN'],
  ] as const) {
    await q(`update public.settings set value = to_jsonb($2::text) where key = $1`, [k, v])
  }

  // D14-08 needs a cost per free-survey visit — REDUX to set the real figure
  await q(`insert into public.settings (key, value, description) values ('survey_visit_cost_inr', '1500', 'D14-08: field cost of one free survey (surveyor time + travel) — used for free-survey cost per won job') on conflict (key) do nothing`)

  // Privacy notice (the version web forms record consent against)
  await q(`insert into public.privacy_notices (version, body, effective_from, is_active)
           values ('v1.0', $1, current_date - 60, true) on conflict (version, language) do nothing`,
    ['REDUX (Eurobrass Industries) collects your name, phone number, email, property details and site photographs to arrange and deliver your free assessment, quotation and restoration work. Marketing messages are sent only if you opt in, and you can withdraw at any time from the customer portal or by writing to privacy@reduxbath.com. You may complain to the Data Protection Board of India.'])

  // Rate card v1 (demo prices — REDUX's real card is A9)
  const { rows: rc } = await q(`select id from public.rate_cards where version = 1`)
  if (rc.length === 0) {
    const { rows } = await q(`insert into public.rate_cards (version, effective_from, notes) values (1, current_date - 45, 'Demo rate card') returning id`)
    const card = rows[0].id
    const price: [string, string, string | null, number][] = []
    const types: [string, number, number, number][] = [   // code, repair, restore(chrome), replace(chrome)
      ['basin_mixer', 1400, 2200, 9800], ['shower_mixer', 1800, 2900, 14500], ['diverter', 1600, 2600, 11800],
      ['health_faucet', 650, 1100, 3400], ['spout', 900, 1700, 6900], ['shower_head', 700, 1500, 5200],
      ['angle_valve', 450, 800, 1900], ['aerator', 250, 350, 650],
    ]
    for (const [code, repair, restore, replace] of types) {
      price.push([code, 'repair_function', null, repair])
      price.push([code, 'restore_finish', 'chrome', restore])
      price.push([code, 'restore_finish', 'pvd_brushed_gold', Math.round(restore * 1.6)])
      price.push([code, 'restore_finish', 'pvd_matte_black', Math.round(restore * 1.5)])
      price.push([code, 'replace_eurobrass', null, replace])
    }
    for (const [ft, wt, fin, p] of price) {
      await q(`insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, finish_id, price, gst_rate, hsn_sac)
               values ($1, (select id from public.fitting_types where code = $2), (select id from public.work_types where code = $3),
                       (select id from public.finishes where code = $4), $5, 18, '998719')`, [card, ft, wt, fin, p])
    }
    // market replacement: what the hotel would pay for a comparable new premium fitting
    for (const [code, , , replace] of types) {
      await q(`insert into public.market_prices (rate_card_id, fitting_type_id, finish_id, price)
               values ($1, (select id from public.fitting_types where code = $2), null, $3)`, [card, code, Math.round(replace * 2.4)])
    }
    await q(`select public.activate_rate_card($1)`, [card])
  }

  // WhatsApp templates, word for word from 05-content
  await seedTemplates(db)

  // Integration accounts for the health screen
  await q(`insert into public.integration_accounts (provider, external_id, display_name, last_event_at, config) values
    ('meta','page_redux','REDUX Facebook Page', now() - interval '22 minutes', '{"form_ids":[]}'),
    ('whatsapp','waba_redux','WhatsApp +91 98110 00000', now() - interval '4 minutes', '{}'),
    ('google_ads','gads_redux','Google Ads · Lead forms', now() - interval '3 hours', '{}'),
    ('razorpay','rzp_redux','Razorpay (test mode)', now() - interval '1 day', '{}')
    on conflict do nothing`)
}

/** Does a real login carry user_role? That needs the Custom Access Token Hook switched on. */
export async function hookIsOn(email: string): Promise<boolean> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await sb.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  if (error || !data.session) throw new Error(`Demo login failed for ${email}: ${error?.message}`)
  const claims = JSON.parse(Buffer.from(data.session.access_token.split('.')[1]!, 'base64url').toString())
  await sb.auth.signOut()
  return typeof claims.user_role === 'string'
}
