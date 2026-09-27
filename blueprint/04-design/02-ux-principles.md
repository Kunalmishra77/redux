# 02 — UX Principles

Seven principles. Each exists because a specific thing goes wrong without it.

---

## 1. The next action is always obvious

Every screen has exactly one primary action in lime. If you cannot name the one thing the user
came to do, the screen is not designed yet.

| Screen | The one action |
|---|---|
| My leads | Call the top lead |
| Lead detail | Book the free survey |
| Visit detail (app) | Check in |
| Fitting capture | Take the next photo |
| Quote preview | Approve |
| Customer dashboard | Pay the due invoice |

---

## 2. Never make someone leave the screen to finish a thought

The care executive booking a survey is the test case: call → outcome → date → slot → surveyor →
confirm, **all on the lead detail screen**. A modal is fine. A navigation is not.

*Why:* an executive does this 30 times a day. Every extra navigation is 30 navigations a day,
and it is where the SLA quietly slips.

---

## 3. Evidence over assertion

REDUX sells the idea that a worn fitting can look new. Nobody believes a sentence; everyone
believes a photograph.

- Before/after photos side by side, always labelled, **never behind a slider**
- The three prices shown together, never one at a time
- "You save ₹X" as a number, not "save up to 60%"
- Job status as a stage tracker, not a text field

---

## 4. Offline is a state, not an error

In the surveyor app, offline is normal and the UI must be calm about it.

| Wrong | Right |
|---|---|
| ⚠️ "No internet connection!" | "Offline — 12 items saved on this device" |
| Blocking modal | Persistent header chip |
| "Failed to save" | "Saved. Will upload when you're back online." |
| Silent retry | "187 / 200 photos uploaded" |

The surveyor should never wonder whether their work is safe. The answer is on screen at all times.

---

## 5. Money is never ambiguous

- Always `₹1,23,456` — Indian grouping, tabular numerals
- Always say whether GST is included
- Show the tax split
- "You save" is computed and shown, never left for the customer to work out
- An expired quote says **expired**; it does not silently re-price

*Why:* the person reading a quote is a hotel's finance or engineering head. Ambiguity on a number
costs the deal, not just a support call.

---

## 6. Speed over completeness on the hot paths

Three screens carry almost all the daily usage and must feel instant:
**My leads** · **Fitting capture** · **Customer dashboard**.

For these: server-render the first paint, defer everything secondary, paginate from the server,
and never block the render on an analytics call. A dashboard widget that is one second slower is
acceptable. A lead list that is one second slower is not.

---

## 7. Design for the second year, not the demo

| Demo condition | Real condition | Design consequence |
|---|---|---|
| 12 leads | 8,000 leads | Server pagination and filters from day one, never client-side |
| 3 fittings | 200 fittings in one survey | Virtualised lists; batch photo upload |
| 1 property | A chain with 6 properties | Property switcher in the portal |
| Everything on time | Rooms blocked for weeks on civil work | A blocked state that stops the clock |
| One surveyor | Someone leaves mid-project | Reassignment, and offboarding that checks for unsynced data |

**Empty states are first-class.** Week one has no leads, no jobs, no stock. Every list gets an
empty state that explains what will appear there and offers the action that creates the first one.

---

## Copy rules

| Rule | Example |
|---|---|
| Plain English, no jargon | "Free assessment", not "pre-sales technical evaluation" |
| Verbs on buttons | "Book free assessment", not "Submit" |
| Say what happens next | "We'll call you within 2 hours" |
| Errors say what to do | "Couldn't upload 3 photos. They're saved — we'll retry automatically." |
| Never blame the user | "That code didn't match. Try again or request a new one." |
| The client's words | Restoration (not refurbishment) · Free assessment (not site visit) · Unit shown as *Room* for hotels, *Bathroom* for homes |
