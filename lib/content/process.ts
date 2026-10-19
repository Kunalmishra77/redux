// CR-001 phase 8 (D31) — "The REDUX Way": the rechroming and refinishing sequence, as REDUX supplied it
// (redux_process.pdf, Oct 2026). Typed content, versioned with the site (CR §3.7) — edit here, not in
// the database. Wording follows the client's SOP; only spelling and punctuation are tidied.

export type ProcessStep = { n: string; title: string; objective: string; actions: string }

export const PROCESS_INTRO =
  'The standard operating procedure REDUX follows to turn old, tarnished and worn-out faucets and plumbing fixtures into restored, high-quality fixtures — a multi-stage restoration, step by step.'

export const PROCESS_STEPS: ProcessStep[] = [
  { n: '01', title: 'Pre-assessment of the old fixture',
    objective: "Evaluate the incoming fixture's overall condition, structural integrity and feasibility for rechroming.",
    actions: 'Inspect for deep cracks, severe corrosion, structural damage or missing components. Determine whether replacement child parts will be required.' },
  { n: '02', title: 'Dismantling & workshop receipt',
    objective: 'Receive the fixture safely from the client at our facility.',
    actions: 'The customer dismantles the fixture from the plumbing system and hands it over; we transport it to the workshop. Upon receipt at our workshop, we log the item, verify components against the initial assessment, and issue a job tracking ticket.' },
  { n: '03', title: 'Workshop dismantling into child parts',
    objective: 'Break down the faucet completely to treat every individual component effectively.',
    actions: 'Carefully disassemble handles, spouts, cartridges, stems, nuts and washers into individual “child parts” to prevent chemical trapping and ensure thorough surface treatment.' },
  { n: '04', title: 'Stripping via pickling',
    objective: 'Remove all legacy metallic coatings down to the raw base metal.',
    actions: 'Submerge the child parts in specialised chemical pickling baths to strip away existing layers of degraded chrome, nickel and any underlying copper flashes.' },
  { n: '05', title: 'Re-grinding of the base metal',
    objective: 'Correct surface imperfections, pitting, deep scratches and minor dents.',
    actions: 'Use mechanical grinding tools on the exposed base metal to level out pitting corrosion and smooth out imperfections inherited from age or wear.' },
  { n: '06', title: 'Polishing and buffing',
    objective: 'Achieve a mirror-smooth finish on the base metal before electroplating.',
    actions: 'Progress through various grades of abrasive compounds and buffing wheels to remove grinding marks, achieving a brilliant, reflective surface sheen.' },
  { n: '07', title: 'Nickel and chrome electroplating',
    objective: 'Apply protective and decorative corrosion-resistant metallic layers.',
    actions: 'Electroplate the polished parts first with an underlying layer of nickel (for corrosion resistance and adhesion), followed by a bright chromium topcoat for durability and mirror shine.' },
  { n: '08', title: 'Re-assembly',
    objective: 'Rebuild the faucet to factory specifications.',
    actions: 'Reassemble the child parts into the complete fixture, integrating old parts that passed inspection alongside newly renewed components — such as O-rings, washers and valve stems — wherever required.' },
  { n: '09', title: 'Testing of the reassembled faucet',
    objective: 'Ensure flawless mechanical operation and leak-free performance.',
    actions: 'Subject the refinished faucet to rigorous pressure and flow testing under simulated operating conditions.' },
  { n: '10', title: 'Packing and despatch',
    objective: 'Protect the pristine finish in transit and deliver it to the customer.',
    actions: 'Clean the exterior surface, apply protective wrapping (such as anti-tarnish tissue and bubble wrap), box it securely with any maintenance guidelines, and despatch it to the client.' },
]

/** REDUX 2026-10-19: nickel + chrome is part of every restoration; PVD colours are an extra, quoted per requirement. */
export const FINISH_NOTE = {
  included: 'Nickel and chrome plating is included in every restoration.',
  extra: 'PVD colour finishes — brushed gold, matte black and others — are available at extra cost, quoted to your requirement.',
}

/** The same body at five points of the process — Eurobrass's own photographs (eurobrass.in, Technology),
 *  stored in the brand bucket until REDUX shoots its own (blueprint/05-content/03-image-prompts.md). */
export const PROCESS_STAGES = [
  { image: 'catalog/process/stage-1.jpg', label: 'Stripped to bare brass', steps: '03–04' },
  { image: 'catalog/process/stage-2.jpg', label: 'Re-ground smooth', steps: '05' },
  { image: 'catalog/process/stage-3.jpg', label: 'Polished to a mirror', steps: '06' },
  { image: 'catalog/process/stage-4.jpg', label: 'Nickel and chrome plated', steps: '07' },
  { image: 'catalog/process/stage-5.jpg', label: 'Re-assembled and tested', steps: '08–09' },
]

