import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import styles from "./page.module.css";

type CountryRecord = {
  name: string;
  code: string;
  capital: string;
  region: string;
  population: number;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  country?: string;
  kind: "country" | "city" | "postal";
  officialName?: string;
  flagUrl?: string;
  imageUrl?: string;
  subregion?: string;
  continent?: string;
  area?: number;
  borders?: string[];
  currencies?: Array<{ code?: string; name?: string; symbol?: string }>;
  languages?: Array<{ name?: string }>;
  timezones?: string[];
  callingCodes?: string[];
  tlds?: string[];
  landlocked?: boolean;
  drivingSide?: string;
  postalFormat?: string;
  startOfWeek?: string;
  links?: { official?: string; wikipedia?: string };
};

async function getCountryImage(name: string, capital?: string) {
  try {
    const searchTerms = capital ? `${capital} ${name} city skyline landmark` : `${name} city skyline landmark`;
    const commonsEndpoint = new URL("https://commons.wikimedia.org/w/api.php");
    commonsEndpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: searchTerms,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "1200",
      format: "json",
    }).toString();
    const commonsResponse = await fetch(commonsEndpoint, { next: { revalidate: 86400 } });
    if (commonsResponse.ok) {
      const commonsPayload = await commonsResponse.json() as { query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }> } };
      const image = Object.values(commonsPayload.query?.pages ?? []).find((page) => {
        const title = page.title?.toLowerCase() ?? "";
        const info = page.imageinfo?.[0];
        return info?.mime?.startsWith("image/") && !/flag|map|coat of arms|emblem|logo|hut|village|rural|tribal|traditional|historical|colonial|old town|museum/.test(title);
      })?.imageinfo?.[0];
      if (image?.thumburl || image?.url) return image.thumburl ?? image.url;
    }

    // The capital is a safer fallback than the country page, whose lead image is often the flag.
    for (const subject of [capital, name].filter(Boolean)) {
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(subject as string)}`, { next: { revalidate: 86400 } });
      if (!response.ok) continue;
      const summary = await response.json() as { title?: string; thumbnail?: { source?: string } };
      const title = summary.title?.toLowerCase() ?? "";
      if (summary.thumbnail?.source && !/flag|map|coat of arms|emblem|logo/.test(title)) return summary.thumbnail.source;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function getCountry(slug: string): Promise<CountryRecord | null> {
  const query = decodeURIComponent(slug).replace(/-/g, " ");
  const apiKey = process.env.REST_COUNTRIES_API_KEY;
  if (apiKey) {
    const endpoint = new URL(`https://api.restcountries.com/countries/v5/names.common/${encodeURIComponent(query)}`);
    endpoint.searchParams.set("response_fields", "names.common,names.official,codes.alpha_2,flag,region,subregion,continents,capitals,coordinates,population,area.kilometers,borders,currencies,languages,timezones,calling_codes,tlds,landlocked,cars.driving_side,postal_code.format,date.start_of_week,links");
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}` }, next: { revalidate: 3600 } });
      if (response.ok) {
        const payload = await response.json() as { data?: { objects?: Array<Record<string, unknown>> } };
      const country = payload.data?.objects?.[0] as {
        names?: { common?: string; official?: string }; codes?: { alpha_2?: string }; flag?: { url_png?: string; emoji?: string };
        region?: string; subregion?: string; continents?: string[]; capitals?: Array<{ name?: string }>;
        population?: number; area?: { kilometers?: number }; borders?: string[];
        currencies?: Array<{ code?: string; name?: string; symbol?: string }>; languages?: Array<{ name?: string }>;
        timezones?: string[]; calling_codes?: string[]; tlds?: string[]; landlocked?: boolean;
        cars?: { driving_side?: string }; postal_code?: { format?: string }; date?: { start_of_week?: string };
        links?: { official?: string; wikipedia?: string };
      } | undefined;
        if (country?.names?.common) return {
        name: country.names.common, officialName: country.names.official, code: country.codes?.alpha_2 ?? "", capital: country.capitals?.[0]?.name ?? "Not listed",
        region: country.region ?? "Unknown", subregion: country.subregion, continent: country.continents?.[0], population: country.population ?? 0,
        area: country.area?.kilometers, borders: country.borders ?? [], currencies: country.currencies ?? [], languages: country.languages ?? [],
        timezones: country.timezones ?? [], callingCodes: country.calling_codes ?? [], tlds: country.tlds ?? [], landlocked: country.landlocked,
        drivingSide: country.cars?.driving_side, postalFormat: country.postal_code?.format, startOfWeek: country.date?.start_of_week,
        links: country.links, flagUrl: country.flag?.url_png, imageUrl: await getCountryImage(country.names.common, country.capitals?.[0]?.name), kind: "country",
        };
      }
    } catch {
      // Continue to the public geocoder when the upstream country service is unavailable.
    }
  }

  let locationResponse: Response;
  try {
    locationResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Atlas country directory demo" }, next: { revalidate: 3600 } });
  } catch {
    return null;
  }
  if (!locationResponse.ok) return null;
  const locations = (await locationResponse.json()) as Array<{ display_name: string; lat: string; lon: string; address?: { country?: string; country_code?: string; city?: string; town?: string; village?: string; postcode?: string } }>;
  const location = locations[0];
  if (!location) return null;
  const address = location.address ?? {};
  const name = address.city ?? address.town ?? address.village ?? address.postcode ?? query;
  const isPostal = Boolean(address.postcode) || /^\d[\d\s-]+$/.test(query);
  return { name, code: (address.country_code ?? "loc").toUpperCase(), capital: "Location search", region: address.country ?? "Location", population: 0, latitude: Number(location.lat), longitude: Number(location.lon), countryCode: address.country_code, country: address.country, kind: isPostal ? "postal" : "city" };
}

export default async function CountryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getCountry(slug);
  if (!place) return <main className={styles.page}><div className={styles.shell}><Header /><section className={styles.notFound}><p className={styles.kicker}>Atlas / No result</p><h1>That place is still<br /><em>off the map.</em></h1><Link href="/">Return to search <FaArrowRight aria-hidden="true" /></Link></section></div></main>;

  const flagCode = (place.kind === "country" ? place.code : place.countryCode)?.toLowerCase();
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Header />
        <section className={styles.detailHero}>
          <div className={styles.detailCopy}>
            <p className={styles.kicker}>Atlas / {place.kind === "country" ? "Country profile" : place.kind === "city" ? "City search" : "Postal search"}</p>
            <h1>{place.name}<br /><em>worth knowing.</em></h1>
            <p>Use this profile as a practical snapshot of {place.name}: where it sits, how people live there, and what connects it to its neighbours.</p>
            <Link className={styles.backButton} href="/">Search another place <FaArrowRight aria-hidden="true" /></Link>
          </div>
          <div className={styles.visual} style={{ backgroundImage: `url(${place.imageUrl ?? "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1000&q=85"})` }}>
            {place.flagUrl ? <span className={styles.flag} role="img" aria-label={`${place.name} flag`} style={{ backgroundImage: `url(${place.flagUrl})` }} /> : flagCode && flagCode.length === 2 && <span className={styles.flag} role="img" aria-label={`${place.name} flag`} style={{ backgroundImage: `url(https://flags.restcountries.com/v5/w160/${flagCode}.png)` }} />}
            <span className={styles.visualLabel}>{place.region}</span>
          </div>
        </section>
        <section className={styles.facts} aria-label={`${place.name} details`}>
          <div><span>Location type</span><strong>{place.kind}</strong></div>
          <div><span>Region</span><strong>{place.region}</strong></div>
          <div><span>Capital</span><strong>{place.capital}</strong></div>
          <div><span>Population</span><strong>{place.population ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(place.population) : "Not available"}</strong></div>
        </section>
        {place.kind === "country" && <section className={styles.detailGrid} aria-label="More country information">
          <article><span>Official name</span><strong>{place.officialName ?? place.name}</strong></article>
          <article><span>Subregion</span><strong>{place.subregion ?? "Not listed"}</strong></article>
          <article><span>Area</span><strong>{place.area ? `${new Intl.NumberFormat("en").format(place.area)} km²` : "Not listed"}</strong></article>
          <article><span>Languages</span><strong>{place.languages?.map((language) => language.name).filter(Boolean).join(", ") || "Not listed"}</strong></article>
          <article><span>Currency</span><strong>{place.currencies?.map((currency) => currency.name).filter(Boolean).join(", ") || "Not listed"}</strong></article>
          <article><span>Time zones</span><strong>{place.timezones?.join(", ") || "Not listed"}</strong></article>
          <article><span>Driving side</span><strong>{place.drivingSide ?? "Not listed"}</strong></article>
          <article><span>Postal format</span><strong>{place.postalFormat ?? "Not listed"}</strong></article>
        </section>}
        <section className={styles.detailBottom}><div><p className={styles.kicker}>Keep going</p><h2>Place is never<br />just a point.</h2></div><Link className={styles.globeButton} href="/globe">Explore it on the globe <FaArrowRight aria-hidden="true" /></Link></section>
        <footer className={styles.footer}><span>Atlas / Country data via REST Countries</span><Link href="/">Back home</Link></footer>
      </div>
    </main>
  );
}

function Header() {
  return <header className={styles.header}><Link className={styles.brand} href="/" aria-label="Atlas home"><span className={styles.brandIcon}>A</span> atlas</Link></header>;
}
