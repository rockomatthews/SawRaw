-- Subscriptions table for gating watermark removal
create table if not exists public.subscriptions (
  user_id uuid primary key,
  status text,
  price_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
on public.subscriptions
for select
using (auth.uid() = user_id);

-- Video jobs table
create table if not exists public.video_jobs (
  video_id text primary key,
  user_id uuid,
  status text,
  prompt text,
  size text,
  seconds text,
  watermark_required boolean default true,
  output_url text,
  created_at timestamptz default now()
);
