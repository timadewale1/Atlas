import { NextResponse } from "next/server";

const API_URL = "https://api.restcountries.com/countries/v5";
const API_KEY = process.env.REST_COUNTRIES_API_KEY;
const RESPONSE_FIELDS = [
  "names.common", "names.official", "codes.alpha_2", "codes.alpha_3", "flag.emoji", "flag.url_png", "flag.url_svg",
  "region", "subregion", "continents", "capitals", "coordinates", "population", "area.kilometers", "borders",
  "currencies", "languages", "timezones", "calling_codes", "tlds", "landlocked", "cars.driving_side",
  "postal_code.format", "postal_code.regex", "date.start_of_week", "number_format.decimal_separator",
  "number_format.thousands_separator", "units.measurement_system", "links.official", "links.wikipedia",
].join(",");

type RestCountry = {
  names?: { common?: string; official?: string };
  codes?: { alpha_2?: string; alpha_3?: string };
  flag?: { emoji?: string; url_png?: string; url_svg?: string };
  region?: string;
  subregion?: string;
  continents?: string[];
  capitals?: Array<{ name?: string; coordinates?: { lat?: number; lng?: number } }>;
  coordinates?: { lat?: number; lng?: number };
  population?: number;
  area?: { kilometers?: number };
  borders?: string[];
  currencies?: Array<{ code?: string; name?: string; symbol?: string }>;
  languages?: Array<{ name?: string; native_name?: string }>;
  timezones?: string[];
  calling_codes?: string[];
  tlds?: string[];
  landlocked?: boolean;
  cars?: { driving_side?: string };
  postal_code?: { format?: string; regex?: string };
  date?: { start_of_week?: string };
  number_format?: { decimal_separator?: string; thousands_separator?: string };
  units?: { measurement_system?: string };
  links?: { official?: string; wikipedia?: string };
};

function normalize(country: RestCountry) {
  // Keep the browser contract stable even when REST Countries omits optional fields.
  return {
    name: { common: country.names?.common ?? "Unknown", official: country.names?.official ?? country.names?.common ?? "Unknown" },
    cca2: country.codes?.alpha_2 ?? "LOC",
    cca3: country.codes?.alpha_3,
    flag: country.flag,
    capital: country.capitals?.map((capital) => capital.name).filter(Boolean) ?? [],
    region: country.region ?? "Unknown",
    subregion: country.subregion,
    continents: country.continents ?? [],
    population: country.population ?? 0,
    area: country.area?.kilometers,
    coordinates: country.coordinates,
    latitude: country.coordinates?.lat,
    longitude: country.coordinates?.lng,
    borders: country.borders ?? [],
    currencies: country.currencies ?? [],
    languages: country.languages ?? [],
    timezones: country.timezones ?? [],
    callingCodes: country.calling_codes ?? [],
    tlds: country.tlds ?? [],
    landlocked: country.landlocked,
    drivingSide: country.cars?.driving_side,
    postalCode: country.postal_code,
    startOfWeek: country.date?.start_of_week,
    numberFormat: country.number_format,
    measurementSystem: country.units?.measurement_system,
    links: country.links,
    resultType: "country" as const,
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query || query.length < 2) return NextResponse.json([]);

  try {
    if (API_KEY) {
      const url = new URL(API_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "8");
      url.searchParams.set("response_fields", RESPONSE_FIELDS);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` }, next: { revalidate: 3600 } });
      if (response.ok) {
        const payload = (await response.json()) as { data?: { objects?: RestCountry[] } };
        const countries = (payload.data?.objects ?? []).map(normalize);
        if (countries.length) return NextResponse.json(countries);
      }
    }

    // A geocoder fallback keeps search useful for city and postal-code queries.
    const locationResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "Atlas country directory demo", "Accept-Language": "en" }, next: { revalidate: 3600 } },
    );
    if (!locationResponse.ok) return NextResponse.json([]);
    const locations = await locationResponse.json() as Array<{
      place_id: number; display_name: string; lat: string; lon: string; type: string;
      address?: { country?: string; country_code?: string; city?: string; town?: string; village?: string; postcode?: string };
    }>;
    const isPostal = /^\d[\d\s-]+$/.test(query);
    return NextResponse.json(locations.map((location) => {
      const address = location.address ?? {};
      const displayName = address.city ?? address.town ?? address.village ?? address.postcode ?? location.display_name.split(",")[0];
      return {
        name: { common: address.country ?? displayName, official: address.country ?? displayName },
        cca2: (address.country_code ?? "LOC").toUpperCase(),
        capital: [], region: address.country ?? "Location", population: 0,
        latitude: Number(location.lat), longitude: Number(location.lon), displayName,
        resultType: isPostal ? "postal" : "city",
      };
    }));
  } catch {
    return NextResponse.json({ message: "The country directory is unavailable" }, { status: 502 });
  }
}
