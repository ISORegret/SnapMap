-- Refresh First Coast Car Council listings twice daily.
-- Secrets are stored in Supabase Vault; no credentials are committed here.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'snapmap-refresh-fccc-events') then
    perform cron.unschedule('snapmap-refresh-fccc-events');
  end if;
end
$$;

select cron.schedule(
  'snapmap-refresh-fccc-events',
  '17 11,23 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'snapmap_project_url') || '/functions/v1/refresh-fccc-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'snapmap_edge_anon_jwt')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $cron$
);
