create extension if not exists pg_cron;

create table if not exists public.analysis_snapshots (
  device_id text primary key,
  records jsonb not null default '[]'::jsonb,
  hall_data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.analysis_snapshots enable row level security;

create or replace function public.set_analysis_snapshot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_analysis_snapshot_updated_at on public.analysis_snapshots;

create trigger set_analysis_snapshot_updated_at
before update on public.analysis_snapshots
for each row
execute function public.set_analysis_snapshot_updated_at();

create or replace function public.delete_old_analysis_snapshots()
returns integer
language plpgsql
as $$
declare
  deleted_count integer;
begin
  delete from public.analysis_snapshots
  where updated_at < timezone('utc', now()) - interval '3 months';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'delete-old-analysis-snapshots';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'delete-old-analysis-snapshots',
    '17 3 * * *',
    $$select public.delete_old_analysis_snapshots();$$
  );
end
$$;
