# 03 — Domain Glossary

Use these exact words in code, database columns, UI labels and client conversation.
Where a word has a REDUX meaning that differs from the everyday one, it is marked **⚠**.

## Commercial

| Term | Meaning | Code / DB name |
|---|---|---|
| **Lead** | An enquiry from any channel, before qualification | `leads` |
| **Source** | The channel a lead came from (website, meta_lead_ad, whatsapp_chat, whatsapp_campaign, google_ads, dealer, call, walk_in) | `lead_sources.code` |
| **Qualified lead** ⚠ | A lead a Care Executive has spoken to *and* booked a free survey for. Not "interested" — **booked**. | `leads.status = 'survey_booked'` |
| **Free survey / assessment** | REDUX's free on-site audit. Never charged. The deck calls it *property assessment*. | `surveys` |
| **Pilot** ⚠ | A trial bathroom done at agreed cost/timing before a hotel approves a wider project. A real commercial stage, not a demo. | `jobs.is_pilot` |
| **Wider project** | The full multi-room job approved after a successful pilot | `jobs.parent_job_id` |
| **Quotation** | The priced proposal generated from the audit | `quotations` |
| **Job** | Approved work, created automatically when a quotation is OTP-approved | `jobs` |
| **Batch** ⚠ | A group of rooms taken out of service together, sized around the property's approved dates | `job_batches` |
| **Downtime** | The period a room is out of service for removal → restoration → refit → test | `job_units.downtime_from/to` |
| **Handover** | After-photos + customer sign-off that returns a unit to service | `handovers` |

## Technical / product

| Term | Meaning | Code / DB name |
|---|---|---|
| **Property** | A hotel, residence or commercial site belonging to a customer | `properties` |
| **Unit** ⚠ | One room or bathroom inside a property. Hotels say "room"; homes say "bathroom". UI shows the customer's word; the DB always says unit. | `property_units` |
| **Fitting** | One tap, mixer, shower, diverter, spout, aerator or accessory | `fittings` (audited instances) |
| **Fitting type** | The master category (basin mixer, shower mixer, diverter, health faucet, aerator…) | `fitting_types` |
| **Finish** | Surface treatment — chrome, PVD Brushed Gold, PVD Black, matte etc. | `finishes` |
| **Condition flag** | One of the standard faults: leak, stiff control, scaling, worn finish, part unavailable | `condition_flags` |
| **Assessment** ⚠ | The per-fitting recommendation: **restore**, **repair**, **replace** — with all three priced side by side. Not a free-text note. | `assessments` |
| **Restore (finish)** | Recoat in chrome or coloured PVD | `work_types.code = 'restore_finish'` |
| **Repair (function)** | Cartridges, seals, re-machined parts | `work_types.code = 'repair_function'` |
| **Replace** | New Eurobrass fitting at manufacturer-direct price | `work_types.code = 'replace_eurobrass'` |
| **Market replacement price** ⚠ | What the customer would pay in the open market. Stored so the quote can show "You save". Never charged. | `market_prices` |
| **Rate card** | Admin-controlled price list by fitting type × work type × finish. Versioned — a quote references the version it was priced from. | `rate_cards`, `rate_card_items` |
| **Photo slot** ⚠ | One of exactly four required angles per fitting: `front`, `side`, `top`, `close_up`. A fitting is not complete until all four exist. | `fitting_photos.slot` |
| **Outbox** | The surveyor app's local SQLite queue of unsent writes and unsent photos | `outbox`, `attachments` (on-device) |
| **Check-in** | GPS + timestamp record when a surveyor arrives on site | `survey_checkins` |

## Roles

| Role | Code | Who |
|---|---|---|
| **Super Admin** | `super_admin` | REDUX / Eurobrass management |
| **Care Executive** | `cc_exec` | Customer care executive who calls leads and books surveys |
| **Surveyor** | `surveyor` | Field auditor, uses the mobile app |
| **Customer** | `customer` | Hotel or homeowner, uses the customer portal |

Permission detail: `../02-product/01-roles-permissions.md`.

## Integrations

| Term | Meaning |
|---|---|
| **CTWA** | Click-to-WhatsApp ad. Carries a `referral` object and a `ctwa_clid` we must store for conversion reporting. |
| **CAPI** | Meta Conversions API — how we tell Meta a lead became a *booked survey* or a *won job*, so ads optimise on revenue, not chats. |
| **WABA** | WhatsApp Business Account |
| **DLT** | TRAI's Distributed Ledger Technology registry — mandatory for domestic commercial SMS |
| **IRP / IRN** | GST Invoice Registration Portal / Invoice Reference Number (only if REDUX crosses ₹5 Cr AATO) |
| **Outbox pattern** | Write to a durable local/DB queue first, deliver asynchronously — used for both webhooks and the surveyor app |

## Words we deliberately do NOT use

| Don't say | Say instead | Why |
|---|---|---|
| "Ticket" | Lead, or Service request | REDUX is not a helpdesk |
| "Customer" for an unconverted enquiry | Lead | A customer exists only after an approved quotation |
| "Refurbishment" | Restoration | Client's brand word |
| "Site visit" | Free survey / assessment | The word "free" is the offer |
| "Inspection" | Audit | Matches the deck's *audit record* |
