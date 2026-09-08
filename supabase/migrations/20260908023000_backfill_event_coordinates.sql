-- Event pins must use persisted coordinates. Browser clients should never bulk
-- geocode the upcoming event catalog on map load. Coordinates were resolved
-- once through the ArcGIS World Geocoding service and reviewed before import.

with coordinates(address, latitude, longitude) as (
  values
    ('1138 Park Ave, Orange Park, FL 32073', 30.175746954128, -81.701913886565),
    ('1330 Blanding Blvd #135, Orange Park, FL 32065', 30.123753505817, -81.798764514643),
    ('1701 Park Ave, Orange Park, FL 32073', 30.169914783989, -81.699034786643),
    ('1842 Kings Ave, Jacksonville, FL 32207', 30.309397825184, -81.649690019735),
    ('194 FL-13, St Johns, FL 32259', 30.124413580692, -81.625873009500),
    ('2032 County Rd 220, Fleming Island, FL 32003', 30.100780637050, -81.745776553520),
    ('2141 Loch Rane Blvd, Orange Park, FL 32073', 30.162600861007, -81.749992650817),
    ('3433 US Highway 1 S, St. Augustine, FL 32086', 29.831133973706, -81.323025879135),
    ('445 World Commerce Pkwy St Augustine, FL 32092', 29.978450154876, -81.459867237816),
    ('4730 Dixie Hwy, St. Augustine, FL 32086', 29.804168804457, -81.319945026804),
    ('542309 US-1, Callahan, FL 32011', 30.562794283294, -81.829252178701),
    ('545 Cathy Tripp Ln, Jacksonville, FL 32220', 30.326715004783, -81.816087980669),
    ('610 E Bay St, Jacksonville, FL 32202', 30.323681510204, -81.650786540308),
    ('6550 FL-13 N, St. Augustine, FL 32092', 29.987064404407, -81.565803513660),
    ('6550 FL-13, St. Augustine, FL 32092', 29.987064404407, -81.565803513660),
    ('7137 Bentley Rd, Jacksonville, FL 32256', 30.245489375780, -81.593769482148),
    ('8316 Merchants Way, Jacksonville, FL 32222', 30.194967370571, -81.833769353961),
    ('Centre St, Fernandina Beach, FL 32034', 30.671109592358, -81.462086058289),
    ('Jacksonville, FL 32256', 30.209880400000, -81.545748700000)
)
update public.events as event
set latitude = coordinates.latitude,
    longitude = coordinates.longitude,
    updated_at = now()
from coordinates
where event.address = coordinates.address
  and (event.latitude is null or event.longitude is null);
