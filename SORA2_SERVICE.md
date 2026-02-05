# Continuity Studio (Sora 2 Service)

Agency-facing service that generates short, on-brand video clip packs with tight visual continuity. The product is the *visual continuity system* (reference anchors, prompt blueprints, and remix-driven variants), not just raw video generation.

## Core concept
Continuity Studio delivers “lookbook-style” campaign clips that stay consistent across shots, products, and seasonal swaps. It anchors wardrobe, lighting, and scene design with reference images, then uses controlled remix steps to create a structured variation matrix.

Why agencies buy it:
- Rapid concept validation with consistent brand look
- Fast variant generation for testing and media placement
- Reduced pre-production for pitch decks and early creative

## MVP spec

### Inputs
- Brand kit: palette, tone words, lighting style, camera style, do-not-use list
- 3–5 reference images per look (wardrobe, set dressing, lighting)
- Product shots (optional, used to tie product styling into shots)
- Short creative brief (1–2 paragraphs)

### Outputs
- 8–20 clips (4s or 8s) per “look system”
- A prompt/parameter pack (JSON) per clip for traceability and remixing

### Batch structure
- One batch = one look system
- Fixed `size` and `seconds` across the batch for consistency
- 3 clip types per look:
  - Anchor shots: strong continuity, minimal variation
  - Variant shots: 1–2 controlled changes
  - Seasonal swaps: motif and prop changes only

### Generation controls
- Use `input_reference` image(s) to lock framing, wardrobe, and set layout
- Use short clips (4s/8s) to improve reliability
- Apply remix for one-change-at-a-time deltas (e.g., “same shot, palette swap”)

## Workflow (high level)
1. **Brief ingestion** → generate a structured “visual canon” prompt template
2. **Reference anchoring** → gather/approve reference images
3. **Anchor generation** → create 2–4 anchor clips per look
4. **Remix variants** → apply constrained changes (palette, prop, scene micro-change)
5. **Delivery** → provide clips + JSON prompt pack for each

## Visual canon template (fields)
- Style: era, texture, grade, film emulation
- Camera: framing, lens, motion
- Lighting: key direction, palette anchors, fill/rim
- Wardrobe: specific items, materials, color constraints
- Set dressing: background objects, prop list
- Action: 1–3 timed beats
- Audio: diegetic cues only (if needed)

## Pricing model (draft)
- Starter: 8 clips / 1 look system
- Pro: 20 clips / 2 look systems
- Enterprise: custom look systems + SLA

Upsells:
- Seasonal refresh packs (monthly/quarterly)
- Additional remix passes
- “Continuity audit” of existing assets

## Pilot target list (agency-facing)
- Mid-size creative agencies with paid social teams
- Performance marketing agencies needing rapid ad variants
- Lifestyle and CPG-focused agencies with seasonal campaigns

## Success metrics
- Time from brief to first delivery (target: 48–72 hours)
- Variant acceptance rate (target: >60% used in review)
- Cost per usable clip vs traditional pre-production
