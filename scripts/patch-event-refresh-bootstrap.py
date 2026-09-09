from pathlib import Path

path = Path('supabase/functions/refresh-fccc-events/index.ts')
text = path.read_text()


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'Missing anchor: {label}')
    text = text.replace(old, new, 1)

replace_once(
'''function eventSignature(title: unknown, startsAt: unknown) {
  const date = new Date(String(startsAt || ""));
  if (!titleKey(title) || Number.isNaN(date.getTime())) return "";
  return `${titleKey(title)}|${localDateKey(date)}`;
}
''',
'''function eventSignature(title: unknown, startsAt: unknown) {
  const date = new Date(String(startsAt || ""));
  if (!titleKey(title) || Number.isNaN(date.getTime())) return "";
  return `${titleKey(title)}|${localDateKey(date)}`;
}

function locationKey(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/usa$/, "");
}

function locationMatchScore(sourceLocation: string, existing: Record<string, any>) {
  const source = locationKey(sourceLocation);
  const address = locationKey(existing.address);
  const venue = locationKey(existing.venue_name);
  let score = 0;
  if (address.length >= 8 && (source.includes(address) || address.includes(source))) score += 100;
  if (venue.length >= 5 && source.includes(venue)) score += 40;
  return score;
}
''',
'location matcher helpers',
)

replace_once(
'''  const existingByKey = new Map(existingRows.map((row) => [row.source_key, row]));
  const bySignature = new Map<string, Record<string, any>[]>();
  for (const row of existingRows) {
    const signature = eventSignature(row.title, row.starts_at);
    if (!signature) continue;
    const group = bySignature.get(signature) || [];
    group.push(row);
    bySignature.set(signature, group);
  }

  const usedIds = new Set<string>();
  let sourceKeyMatches = 0;
  let bootstrapMatches = 0;
''',
'''  const existingByKey = new Map(existingRows.map((row) => [row.source_key, row]));
  const bySignature = new Map<string, Record<string, any>[]>();
  const byDate = new Map<string, Record<string, any>[]>();
  for (const row of existingRows) {
    const signature = eventSignature(row.title, row.starts_at);
    if (signature) {
      const group = bySignature.get(signature) || [];
      group.push(row);
      bySignature.set(signature, group);
    }
    const date = new Date(row.starts_at);
    if (!Number.isNaN(date.getTime())) {
      const dateKey = localDateKey(date);
      const dateGroup = byDate.get(dateKey) || [];
      dateGroup.push(row);
      byDate.set(dateKey, dateGroup);
    }
  }

  const usedIds = new Set<string>();
  let sourceKeyMatches = 0;
  let bootstrapMatches = 0;
  let locationBootstrapMatches = 0;
''',
'bootstrap indexes',
)

replace_once(
'''      if (candidates.length) {
        existing = candidates[0];
        match = "bootstrap";
        bootstrapMatches += 1;
        usedIds.add(existing.id);
      }
    }
    return { item, existing, match };
  });

  return { plans, sourceKeyMatches, bootstrapMatches, usedIds };
}
''',
'''      if (candidates.length) {
        existing = candidates[0];
        match = "bootstrap";
        bootstrapMatches += 1;
        usedIds.add(existing.id);
      } else {
        const dateKey = localDateKey(new Date(item.startsAt));
        const locationCandidates = (byDate.get(dateKey) || [])
          .filter((row) => !usedIds.has(row.id))
          .map((row) => ({ row, score: locationMatchScore(item.location, row) }))
          .filter((candidate) => candidate.score >= 100)
          .sort((left, right) => right.score - left.score);
        if (locationCandidates.length && (locationCandidates.length === 1 || locationCandidates[0].score > locationCandidates[1].score)) {
          existing = locationCandidates[0].row;
          match = "bootstrap_location";
          bootstrapMatches += 1;
          locationBootstrapMatches += 1;
          usedIds.add(existing.id);
        }
      }
    }
    return { item, existing, match };
  });

  return { plans, sourceKeyMatches, bootstrapMatches, locationBootstrapMatches, usedIds };
}
''',
'location bootstrap fallback',
)

replace_once(
'''        bootstrapMatches: plan.bootstrapMatches,
        newEvents: unmatchedSource.length,
''',
'''        bootstrapMatches: plan.bootstrapMatches,
        locationBootstrapMatches: plan.locationBootstrapMatches,
        newEvents: unmatchedSource.length,
''',
'dry-run location count',
)

replace_once(
'''        bootstrapMatches: plan.bootstrapMatches,
        inserted: insertedCount,
''',
'''        bootstrapMatches: plan.bootstrapMatches,
        locationBootstrapMatches: plan.locationBootstrapMatches,
        inserted: insertedCount,
''',
'write-run location count',
)

path.write_text(text)
