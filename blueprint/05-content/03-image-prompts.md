# Image-generation prompts — REDUX website and catalogue

**Purpose.** REDUX has decided to create its own images (19 Oct 2026). Use this document to generate
every image the website still needs. Each section gives a finished prompt you can paste as it is.
Each section also lists the file name to save the image under, so the images can go straight onto
the site.

**Status (19 Oct 2026):**

- 360 of 469 products already have a sharp Eurobrass photo from eurobrass.in.
- The 109 listed in §3 have only a small catalogue thumbnail.
- Process photos currently use Eurobrass's own technology images.
- Before/after pairs and case studies currently use line illustrations, labelled *illustrative*.

---

## 1. Rules for every image

1. **Before/after images must be labelled as illustrative until real.** Generated "before/after"
   images are illustrations, not evidence. The site labels them so. Replace them with real job
   photos (these come from the surveyor app) as soon as REDUX has them. Consumer-protection and
   advertising rules (ASCI) treat a fake "result" photo as misleading.
2. **No logos, brand names, text, watermarks or numbers in any image.** AI models garble them. The
   site adds text itself.
3. **No real people's faces in close-up.** Hands, backs or blurred figures only. This avoids
   model-release problems.
4. **Indian context.** The setting is a Delhi NCR home or an Indian business/heritage hotel:
   - Indian tiles and stone (Kota stone, white marble, beige vitrified tiles)
   - Indian-style bathrooms, with a health faucet next to the WC
   - natural daylight
5. **Consistency.** Within one set, keep the same light, angle, background and lens. The prompt
   templates below already do this.

### Technical specification

| Use | Size (px) | Ratio | Format | Background |
|---|---|---|---|---|
| Product (catalogue) | 1200 × 1200 | 1:1 | JPG, quality 85 | pure white #FFFFFF |
| Process step | 1600 × 1200 | 4:3 | JPG | as described |
| Before / after (each half) | 1200 × 1200 | 1:1 | JPG | same framing in both |
| Hero / lifestyle | 2400 × 1350 | 16:9 | JPG | as described |
| Case-study cover | 1600 × 1000 | 16:10 | JPG | as described |

Keep each file under 400 KB if possible. Send the originals; we compress them on upload.

### Negative prompt (append to every prompt where the tool supports one)

```
text, letters, words, logo, brand name, watermark, signature, numbers, label, sticker, price tag,
people's faces, extra spouts, extra handles, duplicated objects, melted metal, bent geometry,
warped reflections, blurry, low resolution, noisy, oversaturated, cartoon, illustration, 3D render
look, plastic look, fingerprints, dust, water drops (unless asked), cluttered background, harsh
shadows, colour cast, frame, border
```

---

## 2. Product photos — master prompt

Attach the **catalogue thumbnail as a reference image** in the tool. It is on the product's page on
the site, or in `EUROBRASS_CAT_2025.pdf` at the listed catalogue page. The model must keep the
exact shape.

```
Professional e-commerce studio product photograph of a single {PRODUCT DESCRIPTION}, made of solid
brass with a flawless polished chrome finish, exactly matching the shape, proportions, handle and
spout design of the reference image. Product isolated on a pure white seamless background
(#FFFFFF), centred, filling about 75% of the frame, three-quarter front view from slightly above
(15° elevation, 30° rotation to the left), the way premium faucet catalogues shoot. Soft, even
studio lighting from large softboxes left and right, a long white strip light reflecting cleanly
along the curved chrome surfaces, crisp specular highlights, deep but clean dark reflections, a very
soft natural contact shadow directly beneath the product. Ultra-sharp focus throughout (f/11
look), 100mm macro lens, no perspective distortion, true-to-life metal colour, no colour cast.
Square 1:1, 1200×1200, high resolution, photorealistic.
```

**Per-category additions.** Add the line for the product's category to the end of the prompt.

| Category | Add |
|---|---|
| Bath accessories (rails, rings, hooks, holders) | `Shown wall-mounted orientation but floating on white, mounting plate visible at the back, no wall.` For glass parts: `clear tempered glass with a soft green edge.` |
| Soap dish / dispenser / tumbler | `Clear frosted glass or white ceramic insert as in the reference, chrome holder.` |
| Grab rails | `Stainless steel satin finish where the reference shows it; anti-slip textured grip if mentioned.` |
| Heated towel rack | `Ladder-style chrome rails, power cable hidden, wall brackets visible.` |
| Sensor taps | `Small dark infrared sensor window on the front of the body, no visible buttons.` |
| Showers (overhead / rain) | `Shot from 45° below so the face of the shower plate with its silicone nozzles is visible; the plate is thin, the arm is not included unless in the reference.` |
| Hand showers / shower sets | `Hand shower lying at a slight angle with its face visible; for a set include hose coiled neatly and wall bracket.` |
| Slider rail assembly | `Vertical rail standing upright, sliding holder in the middle, full length visible.` |
| Wall mixers / concealed mixers | `Only the visible wall plate, lever and spout as in the reference, floating on white, no wall.` |
| Valves / stopcocks / angle valves | `Small product, shot closer, the handle or knob detailed sharply.` |

**Version A / Version B.** Two catalogue designs share one code. Generate both, each from its own
reference thumbnail.

**Delivery.** Name each file by its code: lowercase, spaces removed, version as a suffix. For
example `ebsen010-a.jpg`, `ebsen010-b.jpg`, `eba9202.jpg`. We upload them to
`catalog/eb/<code>.jpg` and they replace the thumbnails automatically.

---

## 3. The 109 products still on a thumbnail

### Bath accessories (56)

| Codes | Products |
|---|---|
| EBA 9202, 9203, 9201 | Twin Rail |
| EBA 9204 | Swivel Rail |
| EBA 9101, 9102 | Towel Rail |
| EBA 9140, 9141 | Towel Ring |
| EBA 9400, 9401, 9402 | Towel Rack |
| EBA 9403 | Towel Rack DLX |
| EBA 9152 | Soap Dish |
| EBA 9153 | Soap Dish Glass |
| EBA 9154 | Soap Dish Wired |
| EBA 9155 | Soap Dish Corner Wired (Version A) |
| EBA 9155 | Soap Dish Wired (Version B) |
| EBA 9151, C200 | Soap Dispenser |
| EBA C010, C011 | Napkin Holder |
| EBA C012 | Paper Holder |
| EBA C013, C014 | Toilet Paper Holder |
| EBA C015, C016 | Double Roll Holder |
| EBA C017 | Spare Roll Holder |
| EBA C018, C019 | Tumbler Holder |
| EBA C001, C002 | Corner Shelf |
| EBA C170, C171 | Robe Hook |
| EBA C172 | Robe Hook Single |
| EBA C173 | Robe Hook Twin |
| EBA C174 | Twin Robe Hook |
| EBA C175 | PentaLine Hooks |
| EBA C176 | TriLine Hooks |
| EBA C800 | Toilet Brush Holder Round DM |
| EBA C801 | Toilet Brush Holder Round WM |
| EBA C802 | Toilet Brush Holder Square DM |
| EBA C803 | Toilet Brush Holder with removable dish DM |
| EBA C804 | Toilet Brush Holder with removable dish WM |
| EB EF001 | Easy Fix Paper Holder |
| EB EF002 | Easy Fix Robe Hook |
| EB EF003 | Easy Fix Towel Ring |
| EB EF004 | Easy Fix Towel Rail |
| EB GR001, GR002 | Grab Rail |
| EB GR003 | Grab Rail With Anti-Bacterial Grip |
| EB GR004 | Grab Rail With Soap Dish |
| EB GR005 | Grab Rail Y Type |
| EB HT001 | Heated Towel Rack |
| EB HT002 | Heated Towel Rack RD With Shelf |
| EB HT003 | Heated Towel Rack SQ With Shelf |
| EB HT004 | Heated Towel Rack With Shelf |

### Showers (18)

| Codes | Products |
|---|---|
| EB SH5301 | 9" Slim Series Rain Shower |
| EB SH3901, SH3904 | 9" Self Cleaning Rain Shower |
| EB SH5201 | 10" Self Cleaning Rain Shower |
| EB SH5002 | 10" Air Rain Shower |
| EB SH1702 | 8" Slim Square Rain Shower |
| EB SH3601 | 9" Square Rain Shower |
| EB SH2210 | 1 Function Overhead Shower |
| EB SH3210 | 3 Function Overhead Shower |
| EB HS1613, HS3904, HS5001, HS5004, HS5901 | 3 Function Hand Shower Only |
| EB HS3601 | 3 Function Press Handshower |
| EB HS3054 | 3 Function Shower Set |
| D 22, D 24 | Slider Rail Assembly |

### Sensor taps (11)

| Codes | Products |
|---|---|
| EBSEN 010 | Sensor Wash Basin Tap (Version A and Version B) |
| EBSEN 020 | Sensor Wash Basin Tap |
| EBSEN 030, 050 | Sensor Washbasin Tap |
| EBSEN 021, 031, 051 | Sensor Washbasin Tap — Tall |
| EBSEN 040, 041 | Sensor Washbasin Tap Tall |
| EBNCT 010 | Push Tap Deck Mounted |

### Basin mixers (6)

| Codes | Products |
|---|---|
| ST 110, TM 110, AZ 110, SM 110 | Studio / Time / Aztech / Smart single lever wall-mounted concealed basin mixer |
| TM 100 | Time single lever basin mixer |
| DN 511 | Dune single lever basin mixer, exposed, wall-mounted |

### Wall & shower mixers (5)

| Codes | Products |
|---|---|
| ST 930 | Studio wall mixer, non-telephonic |
| TM 410 | Time single lever shower mixer |
| DN 410 | Dune wall-mounted shower mixer |
| AL 4016 | Alpha shower mixer |
| CL 1001 | Classic wall-mount shower mixer |

### Valves & stopcocks (4)

| Codes | Products |
|---|---|
| AT 3006 | Aztech concealed stopcock, exposed |
| AT 3015 | Aztech 2-way angle valve |
| NE 3007 | Neo concealed stopcock |
| CL 3015 | Classic concealed stopcock (Version B) |

### Sink, pillar, bib, spouts (9)

| Codes | Products |
|---|---|
| ST 104 | Studio tall sink mixer with swivel spout |
| NE 3039 | Neo wall-mounted sink cock |
| LT 4006 | Lite one-hole sink mixer |
| RN 1007 | Ronda pillar tap |
| CL 1016 | Classic swan-neck pillar cock, J pipe |
| CL 1006 | Classic pillar cock GR |
| LT 2006 | Lite bib cock |
| PU 781 | Pure tipton spout |
| AZ 7809 | Aztech plain spout |

**Check first.** For ST 930, LT 4006 and CL 3015-B, the code printed in the catalogue does not
match the photo on eurobrass.in. Ask REDUX which picture is right before generating.

---

## 4. The REDUX Way — ten process steps

**Shared style.** Paste this paragraph first, then the step line.

```
Documentary-style industrial photograph inside a clean, well-run Indian metal-finishing workshop in
New Delhi. Natural cool daylight from high windows mixed with bright overhead LED tube light,
realistic and honest, not glossy advertising. Shallow depth of field (35mm lens, f/2.8), the
subject sharp, the background softly blurred. Workers appear only as hands, forearms or blurred
figures in work aprons and nitrile gloves; no faces. Colour palette: steel grey, brass gold, deep
blue workwear, small touches of lime green. 4:3, 1600×1200, photorealistic.
```

| # | File | Step line to add |
|---|---|---|
| 01 | `process-01-assessment.jpg` | `A worn chrome basin mixer with limescale and pitted plating on a white inspection table, a gloved hand turning it under a magnifying lamp, a tablet beside it showing a blurred checklist.` |
| 02 | `process-02-receipt.jpg` | `A row of used bathroom faucets, each in a labelled plastic tray with a blank tag, arriving on a steel workshop counter; a gloved hand placing one more tray.` |
| 03 | `process-03-child-parts.jpg` | `A single-lever mixer completely taken apart on a grey rubber mat: body, lever, cartridge, aerator, screws and O-rings laid out neatly in a row, tools beside them.` |
| 04 | `process-04-stripping.jpg` | `Faucet bodies hanging on a steel rack being lowered into a chemical stripping tank, faint vapour, the old chrome visibly dissolving to bare yellow brass.` |
| 05 | `process-05-regrinding.jpg` | `A gloved hand pressing a bare brass faucet body against a fast-spinning grinding belt, small bright sparks, fine brass dust in the light.` |
| 06 | `process-06-polishing.jpg` | `A brass faucet body against a large cloth buffing wheel with polishing compound, the brass turning to a mirror gold shine.` |
| 07 | `process-07-plating.jpg` | `Rows of faucet bodies on a plating jig rising out of a nickel-chrome electroplating bath, liquid running off gleaming mirror-chrome surfaces, blue-tinted tanks behind.` |
| 08 | `process-08-reassembly.jpg` | `Gloved hands fitting a new ceramic cartridge and lever back onto a freshly chromed mixer body on a clean white bench, new O-rings and a torque screwdriver beside it.` |
| 09 | `process-09-testing.jpg` | `A restored chrome mixer clamped to a pressure-test rig with a round analogue pressure gauge and clear water flowing from the spout, a gloved hand on the valve.` |
| 10 | `process-10-packing.jpg` | `A gleaming restored chrome mixer being wrapped in soft protective foam and placed into a plain white carton with moulded inserts; a blank warranty card beside it.` |

---

## 5. Before / after pairs

Generate each pair **in one session**. The "after" must use the *same* camera, angle, framing,
light and tiles as the "before". Generate the before first, then use it as the reference image for
the after.

**Before**

```
Close-up photograph of a {FITTING} installed in a real Indian bathroom, {BEFORE CONDITION}. Same
fixture, same position, eye-level three-quarter view, natural daylight from a window on the left,
{TILE} wall tiles behind, shallow depth of field, 50mm lens. Honest, unretouched, realistic. 1:1,
1200×1200.
```

**After**

```
The exact same photograph — identical camera position, framing, lighting, tiles and fixture shape —
but the {FITTING} is now fully restored: {AFTER FINISH}, smooth flawless surface, no limescale, no
pitting, clean crisp reflections of the room. Nothing else in the frame changes. 1:1, 1200×1200.
```

**Values for the placeholders**

- `{BEFORE CONDITION}`: `heavy white limescale crust around the spout and base, chrome plating peeled and pitted in patches showing dull brass underneath, water stains, slight green verdigris at the joints`
- `{AFTER FINISH}`:
  - Chrome: `mirror-bright chrome`
  - Brushed gold: `PVD brushed gold with a fine satin grain`
  - Matte black: `PVD matte black, even and velvety, no shine`
- `{TILE}`, varied across the set: `white glossy ceramic` · `beige vitrified` · `grey Kota stone` · `white Italian marble`

**Files.** The site already has slots for these pairs. Save them as
`<fitting>-<finish>-before.jpg` and `<fitting>-<finish>-after.jpg`.

| Fitting (`{FITTING}` text) | File key |
|---|---|
| single-lever basin mixer | `basin_mixer` |
| wall-mounted shower mixer with diverter knob | `shower_mixer` |
| concealed diverter with round wall plate | `diverter` |
| wall-mounted bath spout | `spout` |
| health faucet (bidet spray) on its wall hook beside a WC | `health_faucet` |
| round overhead rain shower | `shower_head` |

Finish keys: `chrome` · `pvd_brushed_gold` · `pvd_matte_black`. 6 fittings × 3 finishes = 18
pairs = 36 images. Start with the 6 chrome pairs; they matter most.

---

## 6. Hero and lifestyle images

**Shared style.**

```
Editorial architectural interior photograph, natural soft daylight, calm and premium but realistic,
neutral palette (white, warm grey, brass and chrome accents), one small touch of fresh green (a
plant or towel), 24mm tilt-shift lens, straight verticals, high dynamic range. 16:9, 2400×1350,
photorealistic. No people's faces.
```

| File | Where | Add |
|---|---|---|
| `hero-home.jpg` | Home page | `A bright modern Indian hotel bathroom: marble vanity, a gleaming chrome single-lever basin mixer in sharp focus in the foreground, a rain shower behind glass, folded white towels. Space on the left third for headline text.` |
| `hero-hotels.jpg` | /hotels | `A business-hotel corridor in Gurugram with a housekeeping trolley at a room door, and through the open door a refreshed bathroom with shining chrome fittings.` |
| `hero-homes.jpg` | /homes | `A family bathroom in a South Delhi home: beige tiles, a health faucet and a shower mixer gleaming like new, a child's yellow towel on the rail.` |
| `hero-process.jpg` | /process, /how-we-restore | `A neat row of freshly restored chrome mixers and spouts lined up on a stainless-steel workshop table, soft daylight, the workshop softly blurred behind.` |
| `hero-assessment.jpg` | /assessment | `A hand holding a smartphone photographing a worn basin mixer in a bathroom, the phone screen showing a blurred camera view, shot over the shoulder.` |
| `hero-demo.jpg` | /demo-programme | `One hotel room bathroom restored as a pilot: everything gleaming, a small folded card on the vanity (blank, no text), daylight.` |
| `hero-referral.jpg` | /referral-programme | `Two hotel managers (backs or hands only) shaking hands in a hotel lobby with brass details, warm and friendly, softly blurred.` |
| `hero-products.jpg` | /products | `A flat lay of chrome Eurobrass-style faucets, a shower head and a spout arranged on a light grey stone surface from directly above, soft shadows.` |

---

## 7. Case-study images (illustrative)

These three engagements are illustrative and labelled so on the site. Each needs a cover image and
two before/after pairs. Use the prompts in §5 and the tiles given here.

| Case study | Cover (16:10) | Pairs (§5) |
|---|---|---|
| `business-hotel-gurugram` — 120-room business hotel | `Modern business-hotel bathroom in Gurugram, white glossy tiles, glass shower partition, chrome fittings, early-morning light, neat and corporate.` | basin mixer chrome; shower mixer chrome — white glossy tiles |
| `heritage-hotel-jaipur` — 48-room heritage hotel | `Heritage haveli-style hotel bathroom in Jaipur: arched niche, lime-plaster walls, white marble, antique-style pillar taps in brushed gold, warm afternoon light.` | basin mixer pvd_brushed_gold; spout pvd_brushed_gold — white marble |
| `south-delhi-residence` — 3-bathroom home | `A family master bathroom in a South Delhi apartment, beige vitrified tiles, wall-mounted mixer and health faucet, a small plant on the window sill.` | shower mixer chrome; health faucet chrome — beige vitrified |

**Files.** `case-<slug>-cover.jpg`, `case-<slug>-before-1.jpg`, `case-<slug>-after-1.jpg`, …

---

## 8. Self-assessment guide images (customer portal)

These four images show customers how to photograph a fitting. Generate them as one set, all of the
same worn basin mixer.

```
Photograph of a worn chrome single-lever basin mixer installed on a white basin, light limescale,
taken with a phone in a home bathroom, natural light, clear and simple, {ANGLE}. 1:1, 1200×1200.
```

| File | `{ANGLE}` |
|---|---|
| `slot-front.jpg` | `straight-on front view, whole fitting in frame` |
| `slot-side.jpg` | `side profile at 90°, whole fitting in frame` |
| `slot-top.jpg` | `from directly above, looking down on the lever and spout` |
| `slot-close_up.jpg` | `extreme close-up of the worst damage: pitted plating at the spout tip` |

---

## 9. Sending the images

1. Put each set in a folder named after the section, e.g. `products/`, `process/`, `before-after/`,
   `hero/`, `case-studies/`, `slots/`.
2. Name the files exactly as listed. A wrong name means the image will not appear.
3. Share the folder (Drive / zip). We upload, compress and switch the site over in one step, and
   remove the *illustrative* labels only where an image is a real REDUX photo.
