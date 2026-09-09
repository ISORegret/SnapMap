import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import ICAL from "npm:ical.js@2.2.1";

const SOURCE_LABEL = "First Coast Car Council";
const SOURCE_PAGE = "https://www.carcouncil.org/events";
const CALENDAR_ICS = "https://calendar.google.com/calendar/ical/firstcoastcarcouncil%40gmail.com/public/basic.ics";
const SOURCE_PREFIX = "fccc:";
const TIME_ZONE = "America/New_York";
const HORIZON_DAYS = 240;
const MIN_RUN_GAP_MS = 10 * 60 * 1000;
const MIN_SAFE_EVENT_COUNT = 5;
const MAX_GEOCODES_PER_RUN = 10;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

function eventType(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  if (/cars?\s*(?:&|and)\s*coffee|caffeine|coffee\s*(?:&|and)\s*cars?|caffeine\s*(?:&|and)\s*octane|caffeine\s*(?:&|and)\s*gasoline/.test(text)) return "cars_and_coffee";
  if (/cruise|cruisin/.test(text)) return "cruise_in";
  if (/car\s*show|auto\s*show|show|rally|rod\s*run|swap\s*meet/.test(text)) return "car_show";
  return "meetup";
}

function shouldSkip(title: string) {
  return /\b(board|business|council|member(?:ship)?)\s+meeting\b|\bmonthly\s+meeting\b/i.test(title);
}

function normalizeUrl(value: unknown) {
  const text = clamp(value, 2048);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 2048) : "";
  } catch {
    return "";
  }
}

function firstDescriptionUrl(description: string) {
  const match = description.match(/https?:\/\/[^\s<>]+/i);
  return normalizeUrl(match?.[0]?.replace(/[),.;]+$/, ""));
}

function sourceTimestamp(component: InstanceType<typeof ICAL.Component>) {
  for (const key of ["last-modified", "dtstamp"]) {
    const value = component.getFirstPropertyValue(key) as { toJSDate?: () => Date } | null;
    if (value?.toJSDate) return value.toJSDate().toISOString();
  }
  return null;
}

function splitLocation(location: string, existing?: Record<string, unknown>) {
  const clean = clamp(location, 500);
  if (!clean) return {
    venueName: clamp(existing?.venue_name, 160),
    address: clamp(existing?.address, 300),
  };
  const parts = clean.split(",").map((part) => part.trim()).filter(Boolean);
  const first = parts[0] || "";
  const looksLikeAddress = /^\d/.test(first)
    || /\b(st|street|rd|road|ave|avenue|blvd|boulevard|hwy|highway|ln|lane|dr|drive|way|ct|court|pkwy|parkway|trl|trail)\b/i.test(first);
  if (parts.length >= 3 && !looksLikeAddress) {
    return { venueName: clamp(first, 160), address: clamp(parts.slice(1).join(", "), 300) };
  }
  return {
    venueName: clamp(existing?.venue_name, 160),
    address: clamp(clean, 300),
  };
}

async function geocode(address: string) {
  if (!address) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SnapMap event refresh (https://github.com/ISORegret/SnapMap)",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return null;
  const [first] = await response.json();
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

type SourceOccurrence = {
  sourceKey: string;
  uid: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  status: "active" | "cancelled";
  sourceUpdatedAt: string | null;
  officialUrl: string;
};

function occurrenceFromEvent(event: InstanceType<typeof ICAL.Event>, start: Date, end: Date | null, recurring: boolean): SourceOccurrence | null {
  const title = clamp(event.summary, 100);
  if (!title || shouldSkip(title)) return null;
  const description = clamp(event.description, 1200);
  const component = event.component;
  const rawStatus = String(component.getFirstPropertyValue("status") || "").toUpperCase();
  const uid = clamp(event.uid, 300);
  if (!uid) return null;
  const propertyUrl = normalizeUrl(component.getFirstPropertyValue("url"));
  return {
    sourceKey: `${SOURCE_PREFIX}${uid}${recurring ? `:${localDateKey(start)}` : ""}`,
    uid,
    title,
    description,
    startsAt: start.toISOString(),
    endsAt: end ? end.toISOString() : null,
    location: clamp(event.location, 500),
    status: rawStatus === "CANCELLED" ? "cancelled" : "active",
    sourceUpdatedAt: sourceTimestamp(component),
    officialUrl: propertyUrl || firstDescriptionUrl(description),
  };
}

function parseCalendar(ics: string, now: Date) {
  const root = new ICAL.Component(ICAL.parse(ics));
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  const exceptions: InstanceType<typeof ICAL.Event>[] = [];

  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.uid) continue;
    if (event.recurrenceId) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const exception of exceptions) masters.get(exception.uid)?.relateException(exception);

  const rangeStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const occurrences = new Map<string, SourceOccurrence>();

  for (const event of masters.values()) {
    if (event.isRecurring()) {
      const iterator = event.iterator();
      let next;
      let guard = 0;
      while ((next = iterator.next()) && guard++ < 1000) {
        const details = event.getOccurrenceDetails(next);
        const start = details.startDate.toJSDate();
        if (start > rangeEnd) break;
        if (start < rangeStart) continue;
        const end = details.endDate?.toJSDate?.() || null;
        const occurrence = occurrenceFromEvent(details.item, start, end, true);
        if (occurrence) occurrences.set(occurrence.sourceKey, occurrence);
      }
    } else {
      const start = event.startDate?.toJSDate?.();
      if (!start || start < rangeStart || start > rangeEnd) continue;
      const end = event.endDate?.toJSDate?.() || null;
      const occurrence = occurrenceFromEvent(event, start, end, false);
      if (occurrence) occurrences.set(occurrence.sourceKey, occurrence);
    }
  }

  return [...occurrences.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function changed(existing: Record<string, unknown> | undefined, row: Record<string, unknown>) {
  if (!existing) return true;
  const keys = ["title", "description", "starts_at", "ends_at", "event_type", "venue_name", "address", "source_status", "source_updated_at", "official_url"];
  return keys.some((key) => String(existing[key] ?? "") !== String(row[key] ?? ""));
}

async function finishRun(runId: string, values: Record<string, unknown>) {
  await db.from("event_import_runs").update({ completed_at: new Date().toISOString(), ...values }).eq("id", runId);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("POST required", { status: 405 });
  const now = new Date();

  const { data: lastRun } = await db.from("event_import_runs")
    .select("completed_at,status")
    .eq("source_label", SOURCE_LABEL)
    .eq("status", "succeeded")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRun?.completed_at && now.getTime() - new Date(lastRun.completed_at).getTime() < MIN_RUN_GAP_MS) {
    return Response.json({ ok: true, skipped: true, reason: "recent_success" });
  }

  const { data: run, error: runError } = await db.from("event_import_runs")
    .insert({ source_label: SOURCE_LABEL, started_at: now.toISOString(), status: "running" })
    .select("id").single();
  if (runError || !run?.id) return Response.json({ ok: false, error: "Could not start import audit." }, { status: 500 });

  try {
    const response = await fetch(CALENDAR_ICS, {
      headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Calendar returned HTTP ${response.status}`);
    const ics = await response.text();
    if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("Calendar response was not ICS data.");

    const occurrences = parseCalendar(ics, now);
    if (occurrences.length < MIN_SAFE_EVENT_COUNT) throw new Error(`Safety stop: only ${occurrences.length} usable future events were parsed.`);

    const { data: existingRows, error: existingError } = await db.from("events")
      .select("id,source_key,title,description,starts_at,ends_at,event_type,venue_name,address,latitude,longitude,source_status,source_updated_at,official_url")
      .eq("listing_type", "listed")
      .eq("source_label", SOURCE_LABEL)
      .like("source_key", `${SOURCE_PREFIX}%`)
      .limit(1000);
    if (existingError) throw existingError;

    const existingByKey = new Map((existingRows || []).map((row) => [row.source_key, row]));
    const seenKeys = new Set(occurrences.map((item) => item.sourceKey));
    const verifiedAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    let insertedCount = 0;
    let updatedCount = 0;
    let geocodeCount = 0;

    for (const item of occurrences) {
      const existing = existingByKey.get(item.sourceKey) as Record<string, unknown> | undefined;
      const location = splitLocation(item.location, existing);
      const row: Record<string, unknown> = {
        title: item.title,
        description: item.description,
        starts_at: item.startsAt,
        ends_at: item.endsAt,
        event_type: eventType(item.title, item.description),
        venue_name: location.venueName,
        address: location.address,
        listing_type: "listed",
        source_label: SOURCE_LABEL,
        source_key: item.sourceKey,
        source_url: SOURCE_PAGE,
        source_updated_at: item.sourceUpdatedAt,
        last_verified_at: verifiedAt,
        source_status: item.status,
        official_url: item.officialUrl || null,
      };

      const addressChanged = existing && String(existing.address || "") !== location.address;
      const needsGeocode = location.address && geocodeCount < MAX_GEOCODES_PER_RUN
        && (!existing || existing.latitude == null || existing.longitude == null || addressChanged);
      if (needsGeocode) {
        if (geocodeCount > 0) await sleep(1100);
        const coords = await geocode(location.address);
        geocodeCount += 1;
        if (coords) Object.assign(row, coords);
        else if (existing && !addressChanged) {
          row.latitude = existing.latitude;
          row.longitude = existing.longitude;
        } else {
          row.latitude = null;
          row.longitude = null;
        }
      } else if (existing) {
        row.latitude = existing.latitude;
        row.longitude = existing.longitude;
      }

      if (!existing) insertedCount += 1;
      else if (changed(existing, row)) updatedCount += 1;
      rows.push(row);
    }

    for (let index = 0; index < rows.length; index += 100) {
      const { error } = await db.from("events").upsert(rows.slice(index, index + 100), { onConflict: "source_key" });
      if (error) throw error;
    }

    const missingIds = (existingRows || [])
      .filter((row) => row.source_key && !seenKeys.has(row.source_key) && new Date(row.starts_at).getTime() >= now.getTime() - 60 * 60 * 1000)
      .map((row) => row.id);
    if (missingIds.length) {
      const { error } = await db.from("events").update({ source_status: "missing", last_verified_at: verifiedAt }).in("id", missingIds);
      if (error) throw error;
    }

    await finishRun(run.id, {
      status: "succeeded",
      events_seen: occurrences.length,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      missing_count: missingIds.length,
    });

    return Response.json({
      ok: true,
      source: SOURCE_LABEL,
      seen: occurrences.length,
      inserted: insertedCount,
      updated: updatedCount,
      missing: missingIds.length,
      geocoded: geocodeCount,
      verifiedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(run.id, { status: "failed", error_message: clamp(message, 1000) });
    console.error("FCCC refresh failed", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
