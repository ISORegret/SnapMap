-- Required for invoking the event-refresh Edge Function from Postgres.
-- Scheduling is added only after a manual refresh has been validated.
create extension if not exists pg_net with schema extensions;
