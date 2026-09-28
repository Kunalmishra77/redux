// Demo seed, part 2: the story. Every step goes through the real database functions (ingest_lead,
// log_call, book_survey, upsert_assessment, create_quote_from_survey, verify_quote_otp,
// move_unit_stage, record_handover, issue_invoice, record_payment …) so the demo obeys the same
// business rules as production. Timestamps are then spread back over the past six weeks.
import { createHash } from 'node:crypto'
import type pg from 'pg'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

type Ids = Record<string, string>
const DAY = 86_400_000

type LeadSpec = {
  phone: string; name: string; source: string; city: string; type: 'hotel' | 'home' | 'dealer'
  property?: string; units?: number; role?: string; daysAgo: number
  stage: 'new' | 'contacted' | 'lost' | 'booked' | 'surveyed' | 'quoted' | 'discount' | 'won'
  owner: 'priya' | 'arjun'; jobStage?: string; blocked?: boolean; complete?: boolean; paid?: 'full' | 'part' | 'none'
  lost?: string; campaign?: string
}

// Delhi-NCR hotels and homes — invented names, so nothing here resembles a real client record
const LEADS: LeadSpec[] = [
  { phone: '+919810011001', name: 'Anita Sharma', source: 'google_ads', city: 'Delhi', type: 'hotel', property: 'The Grand Orchid, Connaught Place', units: 84, role: 'Chief Engineer', daysAgo: 41, stage: 'won', owner: 'priya', jobStage: 'refit_test', blocked: true, campaign: 'Hotels — Delhi search' },
  { phone: '+919810011002', name: 'Rohit Mehra', source: 'website', city: 'Gurugram', type: 'home', property: 'Mehra Residence, DLF Phase 5', units: 2, daysAgo: 38, stage: 'won', owner: 'arjun', complete: true, paid: 'full' },
  { phone: '+919810011003', name: 'Kavita Bhalla', source: 'meta_lead_ad', city: 'Delhi', type: 'hotel', property: 'Hotel Lakeview Residency', units: 42, role: 'General Manager', daysAgo: 36, stage: 'won', owner: 'priya', complete: true, paid: 'part', campaign: 'Meta — Hotel restoration' },
  { phone: '+919810011004', name: 'Deepak Arora', source: 'whatsapp_chat', city: 'Noida', type: 'hotel', property: 'Parkside Suites Noida', units: 36, role: 'Maintenance Head', daysAgo: 30, stage: 'won', owner: 'priya', jobStage: 'at_eurobrass' },
  { phone: '+919810011005', name: 'Sanjay Khanna', source: 'dealer', city: 'Gurugram', type: 'hotel', property: 'Aravalli Business Hotel', units: 58, role: 'Chief Engineer', daysAgo: 27, stage: 'won', owner: 'arjun', jobStage: 'dates_confirmed' },
  { phone: '+919810011006', name: 'Meera Iyer', source: 'google_ads', city: 'Delhi', type: 'home', property: 'Iyer Residence, Vasant Vihar', units: 3, daysAgo: 22, stage: 'quoted', owner: 'priya', campaign: 'Hotels — Delhi search' },
  { phone: '+919810011007', name: 'Harpreet Gill', source: 'meta_lead_ad', city: 'Gurugram', type: 'hotel', property: 'The Cyber Court Hotel', units: 120, role: 'Chief Engineer', daysAgo: 20, stage: 'discount', owner: 'arjun', campaign: 'Meta — Hotel restoration' },
  { phone: '+919810011008', name: 'Nisha Kapoor', source: 'website', city: 'Delhi', type: 'home', property: 'Kapoor House, Greater Kailash', units: 2, daysAgo: 16, stage: 'quoted', owner: 'priya' },
  { phone: '+919810011009', name: 'Aditya Rao', source: 'whatsapp_campaign', city: 'Delhi', type: 'hotel', property: 'Heritage Haveli Hotel', units: 28, role: 'Owner', daysAgo: 14, stage: 'surveyed', owner: 'priya' },
  { phone: '+919810011010', name: 'Pooja Sethi', source: 'google_ads', city: 'Noida', type: 'home', property: 'Sethi Residence, Sector 50', units: 2, daysAgo: 12, stage: 'surveyed', owner: 'priya', campaign: 'Hotels — Delhi search' },
  { phone: '+919810011011', name: 'Vivek Chandra', source: 'meta_lead_ad', city: 'Delhi', type: 'hotel', property: 'Hotel Imperial Court', units: 64, role: 'Chief Engineer', daysAgo: 9, stage: 'booked', owner: 'priya', campaign: 'Meta — Hotel restoration' },
  { phone: '+919810011012', name: 'Rashmi Jain', source: 'website', city: 'Gurugram', type: 'home', property: 'Jain Villa, Sohna Road', units: 4, daysAgo: 7, stage: 'booked', owner: 'arjun' },
  { phone: '+919810011013', name: 'Manoj Tiwari', source: 'call', city: 'Delhi', type: 'hotel', property: 'Hotel Metro Inn', units: 30, role: 'Maintenance Head', daysAgo: 6, stage: 'booked', owner: 'priya' },
  { phone: '+919810011014', name: 'Sunita Reddy', source: 'whatsapp_chat', city: 'Delhi', type: 'home', property: 'Reddy Residence, Saket', units: 2, daysAgo: 5, stage: 'booked', owner: 'priya' },
  { phone: '+919810011015', name: 'Farhan Siddiqui', source: 'dealer', city: 'Noida', type: 'dealer', property: 'Siddiqui Sanitation Store', daysAgo: 11, stage: 'contacted', owner: 'priya' },
  { phone: '+919810011016', name: 'Gaurav Bansal', source: 'google_ads', city: 'Gurugram', type: 'hotel', property: 'Golf Course Residency', units: 48, role: 'General Manager', daysAgo: 4, stage: 'contacted', owner: 'arjun', campaign: 'Hotels — Delhi search' },
  { phone: '+919810011017', name: 'Ritu Agarwal', source: 'meta_lead_ad', city: 'Delhi', type: 'home', property: 'Agarwal Residence', units: 2, daysAgo: 3, stage: 'contacted', owner: 'priya', campaign: 'Meta — Hotel restoration' },
  { phone: '+919810011018', name: 'Karan Malhotra', source: 'walk_in', city: 'Delhi', type: 'home', property: 'Malhotra Residence, Defence Colony', units: 3, daysAgo: 2, stage: 'contacted', owner: 'priya' },
  { phone: '+919810011019', name: 'Shalini Verma', source: 'website', city: 'Delhi', type: 'home', daysAgo: 19, stage: 'lost', owner: 'priya', lost: 'price' },
  { phone: '+919810011020', name: 'Imran Qureshi', source: 'google_ads', city: 'Gurugram', type: 'hotel', property: 'Midtown Business Inn', units: 22, daysAgo: 24, stage: 'lost', owner: 'arjun', lost: 'timing', campaign: 'Hotels — Delhi search' },
  { phone: '+919810011021', name: 'Neha Saxena', source: 'meta_lead_ad', city: 'Delhi', type: 'home', daysAgo: 17, stage: 'lost', owner: 'priya', lost: 'no_response', campaign: 'Meta — Hotel restoration' },
  { phone: '+919810011022', name: 'Hotel Silver Oak', source: 'google_ads', city: 'Delhi', type: 'hotel', property: 'Hotel Silver Oak, Karol Bagh', units: 40, role: 'Chief Engineer', daysAgo: 0.2, stage: 'new', owner: 'priya', campaign: 'Hotels — Delhi search' },
  { phone: '+919810011023', name: 'Amit Choudhary', source: 'meta_lead_ad', city: 'Delhi', type: 'home', property: 'Choudhary Residence', units: 2, daysAgo: 0.08, stage: 'new', owner: 'priya', campaign: 'Meta — Hotel restoration' },
  { phone: '+919810011024', name: 'Lata Menon', source: 'whatsapp_chat', city: 'Delhi', type: 'home', daysAgo: 1.4, stage: 'new', owner: 'priya' },
  { phone: '+919810011025', name: 'Tarun Grover', source: 'website', city: 'Gurugram', type: 'hotel', property: 'Grover Grand, MG Road', units: 55, role: 'Owner', daysAgo: 0.5, stage: 'new', owner: 'arjun' },
  { phone: '+919810011026', name: 'Sneha Pillai', source: 'google_ads', city: 'Noida', type: 'home', daysAgo: 0.03, stage: 'new', owner: 'priya', campaign: 'Hotels — Delhi search' },
  { phone: '+919810011027', name: 'Rajesh Dua', source: 'dealer', city: 'Delhi', type: 'dealer', property: 'Dua Bath Studio', daysAgo: 2.5, stage: 'new', owner: 'priya' },
  { phone: '+919810011028', name: 'Hotel Maple Crest', source: 'meta_lead_ad', city: 'Jaipur', type: 'hotel', property: 'Maple Crest, Jaipur', units: 70, role: 'Chief Engineer', daysAgo: 0.7, stage: 'new', owner: 'arjun', campaign: 'Meta — Hotel restoration' },
]

// Fittings found per surveyed room — type, brand, finish, recommended work
const ROOM_FITTINGS: [string, string, string, 'restore_finish' | 'repair_function' | 'replace_eurobrass' | 'no_action', string | null, string[]][] = [
  ['basin_mixer', 'Grohe', 'chrome', 'restore_finish', null, ['scaling', 'worn_finish']],
  ['shower_mixer', 'Hansgrohe', 'chrome', 'repair_function', null, ['leak', 'stiff_control']],
  ['diverter', 'Kohler', 'chrome', 'restore_finish', 'pvd_brushed_gold', ['worn_finish']],
  ['health_faucet', 'Jaquar', 'chrome', 'replace_eurobrass', null, ['leak', 'part_unavailable']],
]

export async function seedFlows(db: pg.Client, ids: Ids) {
  const q = async (sql: string, v?: unknown[]) => (await db.query(sql, v)).rows
  const as = async (claims: Record<string, unknown> | null) =>
    q(`select set_config('request.jwt.claims', $1, false)`, [claims ? JSON.stringify(claims) : ''])
  const asUser = (key: string, role: string) => as({ role: 'authenticated', sub: ids[key], user_role: role })
  const asSystem = () => as({ role: 'service_role' })

  const notice = 'v1.0'
  const photo = (type: string, finish: string, state: 'before' | 'after') => `demo/fittings/${type}-${finish === 'pvd_brushed_gold' || finish === 'pvd_matte_black' ? finish : 'chrome'}-${state}.svg`

  // Campaigns with spend (cost per lead / per won job on the dashboard, D14-02)
  await q(`insert into public.campaigns (source_id, external_id, name, spend_to_date, started_on) values
    ((select id from public.lead_sources where code = 'google_ads'), 'gads-hotels-delhi', 'Hotels — Delhi search', 48500, current_date - 45),
    ((select id from public.lead_sources where code = 'meta_lead_ad'), 'meta-hotel-restoration', 'Meta — Hotel restoration', 36200, current_date - 45)
    on conflict do nothing`)

  // Only our two demo executives take leads in the demo
  await q(`update public.profiles set is_active = false where id in (select user_id from public.user_roles where role = 'cc_exec')
           and id not in ($1, $2)`, [ids.priya, ids.arjun])

  const leadIds: Record<string, string> = {}
  for (const l of LEADS) {
    // Intake as the channel would deliver it; manual entry by the executive who took the call
    if (l.source === 'call' || l.source === 'walk_in') await asUser(l.owner, 'cc_exec')
    else await asSystem()
    const campaign = l.campaign ? (await q(`select id from public.campaigns where name = $1`, [l.campaign]))[0]?.id : undefined
    const intake = {
      phone: l.phone, name: l.name, source: l.source, city_id: (await q(`select id from public.cities where name = $1`, [l.city]))[0].id,
      customer_type: l.type, property_name: l.property, unit_count: l.units, enquirer_role: l.role, campaign_id: campaign,
      utm: l.source === 'google_ads' ? { utm_source: 'google', utm_medium: 'cpc' } : undefined,
      ctwa_clid: l.source === 'whatsapp_chat' ? `CLID-DEMO-${l.phone.slice(-4)}` : undefined,
    }
    const r = l.source === 'website' || l.source === 'dealer'
      ? (await q(`select public.ingest_lead_with_consent($1::jsonb, $2::jsonb) as r`, [JSON.stringify(intake),
          JSON.stringify({ notice_version: notice, method: 'web_form', purposes: { service: true, marketing: l.daysAgo > 20 } })]))[0].r
      : (await q(`select public.ingest_lead($1::jsonb) as r`, [JSON.stringify(intake)]))[0].r
    const leadId = r.lead_id as string
    leadIds[l.phone] = leadId
    // the demo decides who owns which lead (round-robin would scatter them)
    await as(null)
    await q(`update public.leads set assigned_to = $2 where id = $1`, [leadId, ids[l.owner]])
  }

  const future = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * DAY)
    d.setUTCHours(hour - 5, 30, 0, 0) // hour IST
    return d.toISOString()
  }

  for (const [i, l] of LEADS.entries()) {
    const leadId = leadIds[l.phone]!
    if (l.stage === 'new') continue

    // Every worked lead got a call
    await asUser(l.owner, 'cc_exec')
    await q(`select public.log_call($1::jsonb)`, [JSON.stringify({
      lead_id: leadId, outcome: l.stage === 'lost' && l.lost === 'no_response' ? 'no_answer' : 'interested',
      started_at: new Date(Date.now() - (l.daysAgo - 0.02) * DAY).toISOString(),
      ended_at: new Date(Date.now() - (l.daysAgo - 0.02) * DAY + 190_000 + i * 7000).toISOString(),
    })])
    await q(`insert into public.lead_notes (lead_id, author_id, body) values ($1, $2, $3)`, [leadId, ids[l.owner],
      l.type === 'hotel' ? `Spoke to ${l.role ?? 'the owner'}. ${l.units} rooms; recurring leaks on shower mixers and worn chrome on basins. Wants a pilot first.`
        : 'Homeowner — premium fittings they don’t want to replace. Keen on the chrome restoration.'])

    if (l.stage === 'contacted') {
      await q(`insert into public.follow_ups (lead_id, assigned_to, due_at, note) values ($1, $2, $3, $4)`,
        [leadId, ids[l.owner], new Date(Date.now() + (i % 2 ? -3 : 20) * 3_600_000).toISOString(), 'Call back after they check dates with the GM'])
      continue
    }
    if (l.stage === 'lost') {
      await q(`update public.leads set status = 'lost', lost_reason_id = (select id from public.lost_reasons where code = $2),
               lost_note = $3 where id = $1`, [leadId, l.lost, l.lost === 'price' ? 'Chose to replace with a local brand' : null])
      continue
    }

    // Book the free survey (prospect customer + property, BR-S8)
    const surveyor = l.city === 'Gurugram' ? 'sunil' : 'ankit'
    const booked = (await q(`select public.book_survey($1::jsonb) as r`, [JSON.stringify({
      lead_id: leadId, surveyor_id: ids[surveyor], scheduled_at: future(2 + (i % 5), 10 + (i % 3) * 2),
      property: { name: l.property ?? `${l.name} residence`, address: `${l.property ?? l.name}, ${l.city}`,
                  lat: 28.55 + (i % 7) * 0.02, lng: 77.12 + (i % 5) * 0.03 },
    })]))[0].r
    const surveyId = booked.survey_id as string
    if (l.stage === 'booked') continue

    // The survey happened: move it into the past, check in, record fittings with 4 photos
    await as(null)
    await q(`update public.surveys set scheduled_at = $2, slot_end_at = $2::timestamptz + interval '2 hours' where id = $1`,
      [surveyId, new Date(Date.now() - (l.daysAgo - 3) * DAY).toISOString()])
    await asUser(surveyor, 'surveyor')
    const prop = (await q(`select p.lat, p.lng from public.surveys s join public.properties p on p.id = s.property_id where s.id = $1`, [surveyId]))[0]
    await q(`insert into public.survey_checkins (survey_id, surveyor_id, idem_key, lat, lng, accuracy_m, checked_in_at)
             values ($1, $2, $3, $4, $5, $6, $7)`, [surveyId, ids[surveyor], `demo-ci-${i}`, prop.lat, prop.lng,
      i % 4 === 0 ? 85 : 12, new Date(Date.now() - (l.daysAgo - 3) * DAY).toISOString()])

    const rooms = l.type === 'hotel' ? ['101', '102', '204'].slice(0, l.jobStage === 'refit_test' ? 3 : 2) : ['Master bath', 'Guest bath']
    let f = 0
    for (const room of rooms) {
      for (const [type, brand, finish, rec, target, flags] of ROOM_FITTINGS.slice(0, room === 'Guest bath' ? 2 : 4)) {
        const fid = (await q(`insert into public.fittings (survey_id, unit_label, fitting_type_id, brand_id, model, current_finish_id, idem_key, captured_at)
          values ($1, $2, (select id from public.fitting_types where code = $3), (select id from public.brands where name = $4), $5,
                  (select id from public.finishes where code = $6), $7, now()) returning id`,
          [surveyId, room, type, brand, `${brand.slice(0, 3).toUpperCase()}-${200 + f}`, finish, `demo-f-${i}-${f}`]))[0].id
        for (const flag of flags) {
          await q(`insert into public.fitting_conditions values ($1, (select id from public.condition_flags where code = $2))`, [fid, flag])
        }
        for (const slot of ['front', 'side', 'top', 'close_up']) {
          await q(`insert into public.fitting_photos (fitting_id, slot, storage_path, sha256, bytes, width, height, captured_at, marketing_use_consented)
                   values ($1, $2, $3, $5, 184000, 1600, 1200, now(), $4)`,
            [fid, slot, photo(type, finish, 'before'), l.stage === 'won' && l.complete === true, sha(fid + slot)])
        }
        await q(`select public.upsert_assessment($1::jsonb)`, [JSON.stringify({
          fitting_id: fid, recommended: rec, finish_id: target ? (await q(`select id from public.finishes where code = $1`, [target]))[0].id : undefined,
          part_unavailable_note: flags.includes('part_unavailable') ? 'Discontinued cartridge — Eurobrass can re-machine this part.' : undefined,
          surveyor_note: rec === 'restore_finish' ? 'Body sound; finish worn at the spout and lever.' : undefined,
        })])
        f++
      }
    }
    await q(`update public.surveys set status = 'in_progress' where id = $1`, [surveyId]).catch(() => undefined)
    await q(`select public.submit_survey($1)`, [surveyId])
    if (l.stage === 'surveyed') continue

    // The quotation
    const quoteId = (await q(`select public.create_quote_from_survey($1) as id`, [surveyId]))[0].id
    if (l.stage === 'discount') {
      await q(`select public.set_quote_discount($1, 12, 'Wider project likely after the pilot — 120 rooms')`, [quoteId])
      continue
    }
    if (l.type === 'hotel') await q(`select public.set_quote_discount($1, 5)`, [quoteId])
    await q(`select public.freeze_quote_for_issue($1)`, [quoteId])
    await q(`select public.mark_quote_sent($1, $2, $3)`, [quoteId, `demo/quotes/${quoteId}.pdf`, sha(`quote:${quoteId}`)])
    if (l.stage === 'quoted') continue

    // Approved by OTP → customer + job, atomically (BR-Q6)
    await asSystem()
    const otp = (await q(`select public.request_quote_otp($1, $2, 'whatsapp') as r`, [quoteId, l.phone]))[0].r
    await q(`select public.record_otp_delivery($1, $2)`, [otp.otp_id, `wamid.DEMO-OTP-${i}`])
    const approved = (await q(`select public.verify_quote_otp($1, $2, $3::jsonb) as r`, [otp.otp_id, otp.code,
      JSON.stringify({ approver_name: l.name, ip_address: '49.36.12.' + (10 + i), user_agent: 'Mozilla/5.0 (Linux; Android 14) Chrome/128' })]))[0].r
    if (!approved.ok) throw new Error(`demo approval failed for ${l.name}: ${JSON.stringify(approved)}`)
    const jobId = approved.job_id as string

    // Work dates and stages
    await as(null)
    const units = await q(`select u.id, pu.label from public.job_units u join public.property_units pu on pu.id = u.property_unit_id
                           where u.job_id = $1 order by pu.label`, [jobId])
    await q(`update public.job_units set planned_downtime_hours = 72 where job_id = $1`, [jobId])
    if (l.type === 'hotel' && units.length > 1) {
      const batch = (await q(`insert into public.job_batches (job_id, name, planned_from, planned_to, sort_order)
        values ($1, $2, current_date - 6, current_date + 4, 1) returning id`, [jobId, `Batch 1 · Rooms ${units.map((u) => u.label).join(', ')}`]))[0].id
      await q(`update public.job_units set batch_id = $2 where job_id = $1`, [jobId, batch])
    }
    await asUser('admin', 'super_admin')
    const target = l.complete ? 'refit_test' : l.jobStage ?? 'dates_confirmed'
    const order = ['dates_confirmed', 'removal_pickup', 'at_eurobrass', 'quality_check', 'refit_test']
    for (const u of units) {
      for (const st of order.slice(1, order.indexOf(target) + 1)) {
        await q(`select public.move_unit_stage($1, $2::public.job_stage)`, [u.id, st])
      }
    }
    if (l.blocked && units[1]) {
      await q(`select public.block_unit($1, 'civil_work', 'Hotel maintenance panel re-tiling the wall behind the mixer')`, [units[1].id])
    }
    if (l.complete) {
      await asUser(surveyor, 'surveyor')
      for (const u of units) {
        const hid = (await q(`select public.record_handover($1::jsonb) as id`, [JSON.stringify({
          job_unit_id: u.id, leak_check: true, operation_check: true, finish_check: true, customer_name: l.name,
          notes: 'All fittings tested under pressure; finish inspected with the customer.',
        })]))[0].id
        for (const fr of await q(`select f.id, ft.code, fi.code as finish from public.fittings f
            join public.fitting_types ft on ft.id = f.fitting_type_id left join public.finishes fi on fi.id = f.current_finish_id
            join public.property_units pu on pu.label = f.unit_label join public.job_units ju on ju.property_unit_id = pu.id
            where ju.id = $1 and f.survey_id = $2`, [u.id, surveyId])) {
          await q(`insert into public.handover_photos (handover_id, fitting_id, storage_path, sha256)
                   values ($1, $2, $3, $4)`,
            [hid, fr.id, photo(fr.code, fr.finish ?? 'chrome', 'after'), sha(`${fr.id}after`)])
        }
      }
      // GST invoice (D13) and payment through the verified-webhook path (BR-I5)
      await asUser('admin', 'super_admin')
      const invoiceId = (await q(`select public.create_invoice_from_job($1) as id`, [jobId]))[0].id
      await q(`select public.issue_invoice($1)`, [invoiceId])
      if (l.paid !== 'none') {
        const total = (await q(`select total from public.invoices where id = $1`, [invoiceId]))[0].total
        await asSystem()
        await q(`select public.record_payment($1::jsonb)`, [JSON.stringify({
          invoice_id: invoiceId, provider_payment_id: `pay_DEMO${i}`, status: 'captured',
          method: Number(total) > 50000 ? 'neft' : 'upi', captured_at: new Date(Date.now() - 2 * DAY).toISOString(),
          amount: l.paid === 'full' ? total : (Math.round(Number(total) * 0.5 * 100) / 100).toFixed(2),
        })])
      }
    }
  }

  // Portal logins are linked to their customer contacts (demo users were created before the contacts)
  await as(null)
  await q(`update public.customer_contacts cc set user_id = u.id from auth.users u
           where cc.user_id is null and u.phone is not null and cc.phone = '+' || u.phone`)

  // WhatsApp inbox conversations
  const chats: [string, [string, 'inbound' | 'outbound', number][]][] = [
    ['+919810011024', [['Hi, the mixer in our master bath leaks from the base. Can someone take a look?', 'inbound', 34], ['Thanks for reaching REDUX! Your enquiry is logged — our team will call you shortly.', 'outbound', 33.9]]],
    ['+919810011014', [['Hello, is the survey really free?', 'inbound', 120], ['Yes — the assessment is always free. Priya from REDUX will call to fix a time.', 'outbound', 118], ['Great, Thursday morning works', 'inbound', 90]]],
    ['+919810011004', [['Our Noida property has 36 rooms, all Jaquar fittings from 2015', 'inbound', 700], ['Thank you — we’ve booked your free assessment. Ankit will visit on the date confirmed.', 'outbound', 690]]],
  ]
  for (const [phone, msgs] of chats) {
    const waId = phone.slice(1)
    const conv = (await q(`insert into public.whatsapp_conversations (wa_id, lead_id, profile_name, window_expires_at, last_message_at)
      values ($1, $2, $3, now() + interval '20 hours', now() - $4::numeric * interval '1 minute') on conflict (wa_id) do update set lead_id = excluded.lead_id returning id`,
      [waId, leadIds[phone], LEADS.find((l) => l.phone === phone)?.name, msgs[msgs.length - 1]![2]]))[0].id
    for (const [k, [body, dir, minsAgo]] of msgs.entries()) {
      await q(`insert into public.whatsapp_messages (conversation_id, wamid, direction, kind, body, status, occurred_at)
               values ($1, $2, $3, 'text', $4, $5, now() - $6::numeric * interval '1 minute') on conflict (wamid) do nothing`,
        [conv, `wamid.DEMO-${waId}-${k}`, dir, body, dir === 'outbound' ? 'read' : null, minsAgo])
    }
  }

  // Stock at Eurobrass (D15) — some already below minimum
  await asUser('admin', 'super_admin')
  const stock: [string, string, string, number, number][] = [
    ['CRT-35-CER', '35 mm ceramic cartridge', 'cartridge', 40, 25], ['CRT-40-CER', '40 mm ceramic cartridge', 'cartridge', 12, 20],
    ['CRT-DIV-3W', '3-way diverter cartridge', 'cartridge', 9, 10], ['SPR-ORING-KIT', 'O-ring & seal kit', 'spare', 180, 60],
    ['SPR-AERATOR-M24', 'M24 aerator insert', 'spare', 95, 50], ['SPR-HOSE-1.2', '1.2 m health-faucet hose', 'spare', 30, 25],
    ['FIN-CHROME-L', 'Chrome plating solution (L)', 'finish', 140, 80], ['FIN-PVD-GOLD', 'PVD brushed-gold target', 'finish', 3, 4],
    ['FIN-PVD-BLACK', 'PVD matte-black target', 'finish', 5, 3], ['REP-BASIN-EB', 'Eurobrass basin mixer', 'replacement', 14, 6],
    ['REP-HF-EB', 'Eurobrass health faucet', 'replacement', 22, 10], ['REP-SHOWER-EB', 'Eurobrass shower mixer', 'replacement', 4, 5],
  ]
  for (const [sku, name, cat, qty, min] of stock) {
    const id = (await q(`insert into public.stock_items (sku, name, category, min_level) values ($1, $2, $3, 0)
                         on conflict (sku) do update set name = excluded.name returning id`, [sku, name, cat]))[0].id
    await q(`select public.record_stock_movement($1::jsonb)`, [JSON.stringify({ item_id: id, type: 'in', quantity: qty + 6 })])
    await q(`select public.record_stock_movement($1::jsonb)`, [JSON.stringify({ item_id: id, type: 'out', quantity: 6 })])
    await q(`update public.stock_items set min_level = $2 where id = $1`, [id, min])
  }

  // Service requests (D13-07)
  await asSystem()
  const orchid = (await q(`select c.id from public.customers c join public.leads l on l.id = c.lead_id where l.phone = '+919810011001'`))[0]?.id
  const mehra = (await q(`select c.id from public.customers c join public.leads l on l.id = c.lead_id where l.phone = '+919810011002'`))[0]?.id
  if (orchid) await q(`select public.raise_service_request($1::jsonb)`, [JSON.stringify({ customer_id: orchid, subject: 'Room 101 basin mixer — slight drip after refit', body: 'Noticed a slow drip from the spout since yesterday evening.' })])
  if (mehra) {
    const sr = (await q(`select public.raise_service_request($1::jsonb) as r`, [JSON.stringify({ customer_id: mehra, subject: 'Guest bath shower — water temperature fluctuates' })]))[0].r
    await asUser('priya', 'cc_exec')
    await q(`select public.progress_service_request($1, 'acknowledged')`, [sr.id])
  }

  // DPDP: one access request on the ledger
  await asSystem()
  if (mehra) await q(`select public.create_dsr_request('access', $1, '+919810011002', 'Please send me a copy of the data you hold.')`, [mehra])

  await as(null)
  return leadIds
}

/** Spread the story over the past six weeks (all rows were written "now"). */
export async function backdate(db: pg.Client, leadIds: Record<string, string>) {
  const q = async (sql: string, v?: unknown[]) => (await db.query(sql, v)).rows
  // BR-L3 guards created_at; the demo seed alone lifts it, inside its own transaction
  await q(`alter table public.leads disable trigger trg_lead_attribution`)
  await q(`alter table public.consent_records disable trigger trg_consent_guard`)
  for (const l of LEADS) {
    const id = leadIds[l.phone]
    if (!id) continue
    const created = new Date(Date.now() - l.daysAgo * DAY).toISOString()
    await q(`update public.leads set created_at = $2, assigned_at = $2, sla_due_at = $2::timestamptz + interval '60 minutes' where id = $1`, [id, created])
    await q(`update public.lead_touches set occurred_at = $2 where lead_id = $1`, [id, created])
    // each later status change a little after the previous one, all before today
    await q(`update public.lead_status_history h
             set changed_at = $2::timestamptz + ((x.rn - 1) * least(1.0, $3::numeric / 6)) * interval '1 day'
             from (select id, row_number() over (order by changed_at, id) as rn from public.lead_status_history where lead_id = $1) x
             where h.id = x.id`, [id, created, l.daysAgo])
    await q(`update public.consent_records set granted_at = $2 where lead_id = $1`, [id, created])
  }
  await q(`alter table public.leads enable trigger trg_lead_attribution`)
  await q(`alter table public.consent_records enable trigger trg_consent_guard`)
  await spreadJobTimelines(db)
  await q(`update public.team_notifications set created_at = now() - (abs(hashtext(id::text)) % 4000) * interval '1 minute'`)
}

/**
 * Spread each room's stage events over the job's life, in stage order (they were all written in one
 * transaction, so they share a timestamp). Removal was ~5 days ago; each later stage ~20 h apart.
 * Deterministic relative to now(), so it is safe to re-run.
 */
export async function spreadJobTimelines(db: pg.Client) {
  await db.query(`update public.job_stage_events e set occurred_at = now() - (7 - s.n) * interval '20 hours'
    from (select id, case when job_unit_id is null then 0 else
            row_number() over (partition by job_unit_id order by array_position(enum_range(null::public.job_stage), to_stage), is_backward) end as n
          from public.job_stage_events) s
    where e.id = s.id`)
  await db.query(`update public.job_units u set downtime_from = e.occurred_at
    from public.job_stage_events e where e.job_unit_id = u.id and e.to_stage = 'removal_pickup' and not e.is_backward`)
  await db.query(`update public.job_units u set back_in_service_at = e.occurred_at, downtime_to = e.occurred_at
    from public.job_stage_events e where e.job_unit_id = u.id and e.to_stage = 'handover'`)
  await db.query(`update public.unit_blocks set blocked_from = now() - interval '2 days' where blocked_to is null`)
}
