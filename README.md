# Continuity Studio MVP (Next.js + MUI)

Minimal Next.js + Material UI app for generating Sora 2 clips, exporting prompt
packs, and running look-system batch variants.

## Setup
1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
2. Install dependencies: `npm install`
3. Run: `npm run dev`
4. Open `http://localhost:3000`

## Features
- Single clip generation with optional reference image upload
- Reference image preview with automatic resize to selected size
- Look system template builder (fields to prompt)
- Prompt pack JSON exporter for look systems
- Batch variant runner with per-variant status + retry controls
- Supabase auth + Stripe subscription gating
- Watermarking for non-subscribers (image overlay)

## Notes
- `size` and `seconds` are enforced server-side for consistency.
- Optional reference can be a URL or an uploaded image file.
- Set `WATERMARK_IMAGE_URL` to a publicly accessible PNG (e.g., Supabase Storage).
- Configure a public storage bucket named `continuity-videos` for outputs.
- Configure Stripe webhook to `POST /api/stripe/webhook`.
