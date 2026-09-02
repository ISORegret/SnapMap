-- Add standalone public car-show listings to the creator meetup system.
-- This is a one-time seed only: there is no calendar connection or future sync.
alter table public.events alter column host_id drop not null;
alter table public.events alter column spot_id drop not null;
alter table public.events add column if not exists event_type text not null default 'meetup'
  check (event_type in ('car_show', 'cruise_in', 'cars_and_coffee', 'meetup'));
alter table public.events add column if not exists venue_name text not null default '';
alter table public.events add column if not exists address text not null default '';
alter table public.events add column if not exists listing_type text not null default 'hosted'
  check (listing_type in ('hosted', 'listed'));
alter table public.events add column if not exists source_label text not null default 'SnapMap community';
alter table public.events add column if not exists source_key text;
create unique index if not exists events_source_key_unique_idx
  on public.events(source_key);

create or replace function public.add_event_host_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.host_id is not null then
    insert into public.event_rsvps(event_id, user_id) values (new.id, new.host_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- One-time seed: public automotive events visible on the First Coast Car Council
-- calendar from September 2 through December 31, 2026. Meetings and duplicate entries are excluded.
insert into public.events
  (title, event_type, venue_name, address, starts_at, ends_at, listing_type, source_label, source_key)
values
  ('NE Florida Rod Run Carshow and Swap Meet', 'car_show', 'Northeast Florida Fair', '543378 US-1, Callahan, FL 32011', '2026-09-05T10:00:00-04:00', '2026-09-05T15:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:73eqsl0urhlpps457kb7opkec8'),
  ('Clay County Cruzers 1st Saturday Cruise', 'cruise_in', 'Callahan''s Irish Bistro', '2141 Loch Rane Blvd, Orange Park, FL 32073', '2026-09-05T14:00:00-04:00', '2026-09-05T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:1l5uun2b5hl5pfbqah40hruttv:20260905'),
  ('Big Dawg''s Cruise In', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-09-05T14:00:00-04:00', '2026-09-05T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:cfmlpeohfp1tkqlrg9hvt2a9ri:20260905'),
  ('Caffeine and Octane', 'cars_and_coffee', 'Avenues Mall', 'Jacksonville, FL 32256', '2026-09-12T08:00:00-04:00', '2026-09-12T10:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:5n2a31d4e6nrc4mtqtv4gnfb4i:20260912'),
  ('11th Annual Rocket Man Rally and Show', 'car_show', 'Trout Creek Memorial Park and Marina', '6550 FL-13 N, St. Augustine, FL 32092', '2026-09-12T09:00:00-04:00', '2026-09-12T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:7tdr3uh6ekohfhrbresbg17c6r'),
  ('Clay County Cruzers 2nd Saturday Cruise', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-09-12T14:00:00-04:00', '2026-09-12T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:36j7m4l9qn45hmsp3srjefopnm:20260912'),
  ('Callahan Cruisers 2nd Saturday Cruise', 'cruise_in', 'Hardee''s', '542309 US-1, Callahan, FL 32011', '2026-09-12T14:00:00-04:00', '2026-09-12T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:76ksnuu56s8e1dt19sem1kc1v3:20260912'),
  ('Clay County Cruzers 3rd Saturday Cruise', 'cruise_in', 'Cheers Park Avenue', '1138 Park Ave, Orange Park, FL 32073', '2026-09-19T13:00:00-04:00', '2026-09-19T16:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:0rc1ljq1hb6c0u56ec0368ofh3:20260919'),
  ('SSC@PDQ 3rd Saturday Cruise In', 'cruise_in', 'PDQ', '194 FL-13, St Johns, FL 32259', '2026-09-19T14:00:00-04:00', '2026-09-19T18:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:64r6djv57u0f0aqaq6uo7tvivs:20260919'),
  ('St. Augustine Cruisers Third Saturday Cruise', 'cruise_in', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-09-19T17:00:00-04:00', '2026-09-19T19:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:v997ib8k7jfc9d3uq0g52p524n:20260919'),
  ('3rd Monday Cruise hosted by Sunshine State Chevelles', 'cruise_in', '1937 Spirits & Eatery', '1842 Kings Ave, Jacksonville, FL 32207', '2026-09-21T16:00:00-04:00', '2026-09-21T19:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:349u13qbep03s9ufqm4a409dsc:20260921'),
  ('Classic Cars & Coffee', 'cars_and_coffee', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-09-26T08:00:00-04:00', '2026-09-26T10:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:30l6nru1vlur59pqpuiq0qscp1:20260926'),
  ('Clay County Cruzers 4th Saturday Cruise', 'cruise_in', 'Gator''s Dockside Oakleaf', '8316 Merchants Way, Jacksonville, FL 32222', '2026-09-26T14:00:00-04:00', '2026-09-26T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:4190oi724hi31o5s9siho0vf10:20260926'),
  ('FCCC Cruisin'' to the Creek Car Show', 'car_show', 'Trout Creek', '6550 FL-13, St. Augustine, FL 32092', '2026-10-03T09:00:00-04:00', '2026-10-03T15:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:1u6jet86cdnct1v2s566m2moqe'),
  ('Clay County Cruzers 1st Saturday Cruise', 'cruise_in', 'Callahan''s Irish Bistro', '2141 Loch Rane Blvd, Orange Park, FL 32073', '2026-10-03T14:00:00-04:00', '2026-10-03T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:1l5uun2b5hl5pfbqah40hruttv:20261003'),
  ('Big Dawg''s Cruise In', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-10-03T14:00:00-04:00', '2026-10-03T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:cfmlpeohfp1tkqlrg9hvt2a9ri:20261003'),
  ('Culvers Monthly Cruise', 'cruise_in', 'Culver''s', '3433 US Highway 1 S, St. Augustine, FL 32086', '2026-10-06T16:00:00-04:00', '2026-10-06T19:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:2iv1n5h5tc18qjpk98c301075g:20261006'),
  ('Caffeine and Octane', 'cars_and_coffee', 'Avenues Mall', 'Jacksonville, FL 32256', '2026-10-10T08:00:00-04:00', '2026-10-10T10:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:5n2a31d4e6nrc4mtqtv4gnfb4i:20261010'),
  ('2026 Pontiac Classic Car Show', 'car_show', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-10-10T09:00:00-04:00', '2026-10-10T15:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:1pl3461h82vsu9gvjh967nh56h'),
  ('Clay County Cruzers 2nd Saturday Cruise', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-10-10T14:00:00-04:00', '2026-10-10T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:36j7m4l9qn45hmsp3srjefopnm:20261010'),
  ('Callahan Cruisers 2nd Saturday Cruise', 'cruise_in', 'Hardee''s', '542309 US-1, Callahan, FL 32011', '2026-10-10T14:00:00-04:00', '2026-10-10T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:76ksnuu56s8e1dt19sem1kc1v3:20261010'),
  ('Amelia Cruizers 8-Flags Car Show', 'car_show', 'Centre Street', 'Centre St, Fernandina Beach, FL 32034', '2026-10-17T08:00:00-04:00', '2026-10-17T15:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:7hpmcjdb622sdf4qv12cbhe3g5'),
  ('The Barn at Maple', 'car_show', 'The Barn at Maple', '545 Cathy Tripp Ln, Jacksonville, FL 32220', '2026-10-17T10:00:00-04:00', '2026-10-17T16:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:1kbt24h6l8glrt0i8e3lgqmdqi'),
  ('Clay County Cruzers 3rd Saturday Cruise', 'cruise_in', 'Cheers Park Avenue', '1138 Park Ave, Orange Park, FL 32073', '2026-10-17T13:00:00-04:00', '2026-10-17T16:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:0rc1ljq1hb6c0u56ec0368ofh3:20261017'),
  ('SSC@PDQ 3rd Saturday Cruise In', 'cruise_in', 'PDQ', '194 FL-13, St Johns, FL 32259', '2026-10-17T14:00:00-04:00', '2026-10-17T18:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:64r6djv57u0f0aqaq6uo7tvivs:20261017'),
  ('St. Augustine Cruisers Third Saturday Cruise', 'cruise_in', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-10-17T17:00:00-04:00', '2026-10-17T19:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:v997ib8k7jfc9d3uq0g52p524n:20261017'),
  ('3rd Monday Cruise hosted by Sunshine State Chevelles', 'cruise_in', '1937 Spirits & Eatery', '1842 Kings Ave, Jacksonville, FL 32207', '2026-10-19T16:00:00-04:00', '2026-10-19T19:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:349u13qbep03s9ufqm4a409dsc:20261019'),
  ('Classic Cars & Coffee', 'cars_and_coffee', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-10-24T08:00:00-04:00', '2026-10-24T10:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:30l6nru1vlur59pqpuiq0qscp1:20261024'),
  ('Clay County Cruzers 4th Saturday Cruise', 'cruise_in', 'Gator''s Dockside Oakleaf', '8316 Merchants Way, Jacksonville, FL 32222', '2026-10-24T14:00:00-04:00', '2026-10-24T17:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:4190oi724hi31o5s9siho0vf10:20261024'),
  ('Pharoahs 5th Saturday Cruise', 'cruise_in', 'Trout Creek', '6550 FL-13, St. Augustine, FL 32092', '2026-10-31T09:00:00-04:00', '2026-10-31T12:00:00-04:00', 'listed', 'First Coast Car Council', 'fccc:3elmor31l7s8ktceqlq0v0j5f7'),
  ('Culvers Monthly Cruise', 'cruise_in', 'Culver''s', '3433 US Highway 1 S, St. Augustine, FL 32086', '2026-11-03T16:00:00-05:00', '2026-11-03T19:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:2iv1n5h5tc18qjpk98c301075g:20261103'),
  ('Clay County Cruzers 1st Saturday Cruise', 'cruise_in', 'Callahan''s Irish Bistro', '2141 Loch Rane Blvd, Orange Park, FL 32073', '2026-11-07T14:00:00-05:00', '2026-11-07T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:1l5uun2b5hl5pfbqah40hruttv:20261107'),
  ('Big Dawg''s Cruise In', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-11-07T14:00:00-05:00', '2026-11-07T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:cfmlpeohfp1tkqlrg9hvt2a9ri:20261107'),
  ('Caffeine and Octane', 'cars_and_coffee', 'Avenues Mall', 'Jacksonville, FL 32256', '2026-11-14T08:00:00-05:00', '2026-11-14T10:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:5n2a31d4e6nrc4mtqtv4gnfb4i:20261114'),
  ('Clay County Cruzers 19th Annual Car Show', 'car_show', 'Orange Park', '1701 Park Ave, Orange Park, FL 32073', '2026-11-14T13:00:00-05:00', '2026-11-14T16:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:4tuhq7t0akkda5ohg1ojs6n70v'),
  ('Clay County Cruzers 2nd Saturday Cruise', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-11-14T14:00:00-05:00', '2026-11-14T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:36j7m4l9qn45hmsp3srjefopnm:20261114'),
  ('Callahan Cruisers 2nd Saturday Cruise', 'cruise_in', 'Hardee''s', '542309 US-1, Callahan, FL 32011', '2026-11-14T14:00:00-05:00', '2026-11-14T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:76ksnuu56s8e1dt19sem1kc1v3:20261114'),
  ('3rd Monday Cruise hosted by Sunshine State Chevelles', 'cruise_in', '1937 Spirits & Eatery', '1842 Kings Ave, Jacksonville, FL 32207', '2026-11-16T16:00:00-05:00', '2026-11-16T19:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:349u13qbep03s9ufqm4a409dsc:20261116'),
  ('Clay County Cruzers 3rd Saturday Cruise', 'cruise_in', 'Cheers Park Avenue', '1138 Park Ave, Orange Park, FL 32073', '2026-11-21T13:00:00-05:00', '2026-11-21T16:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:0rc1ljq1hb6c0u56ec0368ofh3:20261121'),
  ('SSC@PDQ 3rd Saturday Cruise In', 'cruise_in', 'PDQ', '194 FL-13, St Johns, FL 32259', '2026-11-21T14:00:00-05:00', '2026-11-21T18:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:64r6djv57u0f0aqaq6uo7tvivs:20261121'),
  ('St. Augustine Cruisers Third Saturday Cruise', 'cruise_in', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-11-21T17:00:00-05:00', '2026-11-21T19:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:v997ib8k7jfc9d3uq0g52p524n:20261121'),
  ('Classic Cars & Coffee', 'cars_and_coffee', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-11-28T08:00:00-05:00', '2026-11-28T10:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:30l6nru1vlur59pqpuiq0qscp1:20261128'),
  ('Clay County Cruzers 4th Saturday Cruise', 'cruise_in', 'Gator''s Dockside Oakleaf', '8316 Merchants Way, Jacksonville, FL 32222', '2026-11-28T14:00:00-05:00', '2026-11-28T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:4190oi724hi31o5s9siho0vf10:20261128'),
  ('Culvers Monthly Cruise', 'cruise_in', 'Culver''s', '3433 US Highway 1 S, St. Augustine, FL 32086', '2026-12-01T16:00:00-05:00', '2026-12-01T19:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:2iv1n5h5tc18qjpk98c301075g:20261201'),
  ('Orleck Car Show Sponsored by NAPA', 'car_show', 'USS Orleck Naval Museum', '610 E Bay St, Jacksonville, FL 32202', '2026-12-05T05:00:00-05:00', '2026-12-05T15:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:e1t2dfk97tiqimt430045ph6kg'),
  ('Clay County Cruzers 1st Saturday Cruise', 'cruise_in', 'Callahan''s Irish Bistro', '2141 Loch Rane Blvd, Orange Park, FL 32073', '2026-12-05T14:00:00-05:00', '2026-12-05T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:1l5uun2b5hl5pfbqah40hruttv:20261205'),
  ('Big Dawg''s Cruise In', 'cruise_in', 'Big Dawgs Family Sports Restaurant', '1330 Blanding Blvd #135, Orange Park, FL 32065', '2026-12-05T14:00:00-05:00', '2026-12-05T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:cfmlpeohfp1tkqlrg9hvt2a9ri:20261205'),
  ('Caffeine and Octane', 'cars_and_coffee', 'Avenues Mall', 'Jacksonville, FL 32256', '2026-12-12T08:00:00-05:00', '2026-12-12T10:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:5n2a31d4e6nrc4mtqtv4gnfb4i:20261212'),
  ('Clay County Cruzers 2nd Saturday Cruise', 'cruise_in', 'Whitey''s Fish Camp', '2032 County Rd 220, Fleming Island, FL 32003', '2026-12-12T13:00:00-05:00', '2026-12-12T16:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:7jenf176u62a29cbd9n3tohuga:20261212'),
  ('Callahan Cruisers 2nd Saturday Cruise', 'cruise_in', 'Hardee''s', '542309 US-1, Callahan, FL 32011', '2026-12-12T14:00:00-05:00', '2026-12-12T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:76ksnuu56s8e1dt19sem1kc1v3:20261212'),
  ('Clay County Cruzers 3rd Saturday Cruise', 'cruise_in', 'Cheers Park Avenue', '1138 Park Ave, Orange Park, FL 32073', '2026-12-19T13:00:00-05:00', '2026-12-19T16:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:0rc1ljq1hb6c0u56ec0368ofh3:20261219'),
  ('SSC@PDQ 3rd Saturday Cruise In', 'cruise_in', 'PDQ', '194 FL-13, St Johns, FL 32259', '2026-12-19T14:00:00-05:00', '2026-12-19T18:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:64r6djv57u0f0aqaq6uo7tvivs:20261219'),
  ('St. Augustine Cruisers Third Saturday Cruise', 'cruise_in', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-12-19T17:00:00-05:00', '2026-12-19T19:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:v997ib8k7jfc9d3uq0g52p524n:20261219'),
  ('3rd Monday Cruise hosted by Sunshine State Chevelles', 'cruise_in', '1937 Spirits & Eatery', '1842 Kings Ave, Jacksonville, FL 32207', '2026-12-21T16:00:00-05:00', '2026-12-21T19:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:349u13qbep03s9ufqm4a409dsc:20261221'),
  ('Classic Cars & Coffee', 'cars_and_coffee', 'Classic Car Museum of St. Augustine', '4730 Dixie Hwy, St. Augustine, FL 32086', '2026-12-26T08:00:00-05:00', '2026-12-26T10:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:30l6nru1vlur59pqpuiq0qscp1:20261226'),
  ('Clay County Cruzers 4th Saturday Cruise', 'cruise_in', 'Gator''s Dockside Oakleaf', '8316 Merchants Way, Jacksonville, FL 32222', '2026-12-26T14:00:00-05:00', '2026-12-26T17:00:00-05:00', 'listed', 'First Coast Car Council', 'fccc:r0ubekhja5rvqm106fo5jhbcdb:20261226')
on conflict (source_key) do nothing;
