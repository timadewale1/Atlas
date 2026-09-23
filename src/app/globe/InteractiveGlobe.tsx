"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { GlobeMethods } from "react-globe.gl";
import { useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaMapMarkerAlt } from "react-icons/fa";
import { FaArrowRight } from "react-icons/fa";
import styles from "./page.module.css";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

type Place = {
  name: string;
  region: string;
  lat: number;
  lng: number;
  code: string;
  resultType?: "country" | "city" | "postal";
};

const places: Place[] = [
  { name: "Nigeria", region: "Africa", lat: 9.08, lng: 8.68, code: "NG" },
  { name: "Brazil", region: "South America", lat: -14.24, lng: -51.92, code: "BR" },
  { name: "Japan", region: "Asia", lat: 36.2, lng: 138.25, code: "JP" },
  { name: "Iceland", region: "Europe", lat: 64.96, lng: -19.02, code: "IS" },
  { name: "Canada", region: "North America", lat: 56.13, lng: -106.35, code: "CA" },
  { name: "Australia", region: "Oceania", lat: -25.27, lng: 133.77, code: "AU" },
  { name: "India", region: "Asia", lat: 20.59, lng: 78.96, code: "IN" },
  { name: "Morocco", region: "Africa", lat: 31.79, lng: -7.09, code: "MA" },
];

export default function InteractiveGlobe({ regionFilter }: { regionFilter?: string }) {
  const filteredPlaces = regionFilter ? places.filter((place) => place.region.toLowerCase() === regionFilter.toLowerCase()) : places;
  const featuredPlaces = filteredPlaces.length ? filteredPlaces : places;
  const [selected, setSelected] = useState<Place>(featuredPlaces[0]);
  const [showLocation, setShowLocation] = useState(false);
  const [hovered, setHovered] = useState<Place | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const activePlaces = featuredPlaces.some((place) => place.name === selected.name) ? featuredPlaces : [...featuredPlaces, selected];

  function selectPlace(place: Place) {
    setSelected(place);
    setShowLocation(true);
    globeRef.current?.pointOfView({ lat: place.lat, lng: place.lng, altitude: 1.35 }, 1100);
    setSearchResults([]);
  }

  function zoomIn() {
    const current = globeRef.current?.pointOfView();
    if (current) globeRef.current?.pointOfView({ ...current, altitude: Math.max(current.altitude * 0.72, 0.55) }, 450);
  }

  function zoomOut() {
    const current = globeRef.current?.pointOfView();
    if (current) globeRef.current?.pointOfView({ ...current, altitude: Math.min(current.altitude * 1.35, 3.5) }, 450);
  }

  function resetGlobe() {
    globeRef.current?.pointOfView({ lat: 18, lng: 12, altitude: 2.4 }, 700);
    setSelected(featuredPlaces[0]);
    setShowLocation(false);
    setHovered(null);
  }

  async function searchPlace(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const response = await fetch(`/api/countries?query=${encodeURIComponent(value)}`);
    if (!response.ok) return;
    const results = await response.json() as Array<{ name: { common: string }; region: string; cca2: string; latitude?: number; longitude?: number; displayName?: string; resultType?: "country" | "city" | "postal" }>;
    setSearchResults(results.filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude)).slice(0, 5).map((result) => ({ name: result.displayName ?? result.name.common, region: result.region, code: result.cca2, lat: result.latitude ?? 0, lng: result.longitude ?? 0, resultType: result.resultType })));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Return to Atlas"><span className={styles.brandIcon}>A</span> atlas</Link>
        <Link className={styles.backLink} href="/">Back to search <FaArrowRight aria-hidden="true" /></Link>
      </header>
      <section className={styles.intro}>
        <p className={styles.kicker}>Atlas / The whole picture</p>
        <h1>Move around.<br /><em>Find somewhere.</em></h1>
        <p>{regionFilter ? `Showing featured places in ${regionFilter}. ` : ""}Drag to turn the globe, scroll to zoom, or select a glowing place to learn where to look next.</p>
      </section>
      <section className={styles.globePanel} aria-label="Interactive world globe">
        <div className={styles.globeSearch}>
          <span className={styles.searchIcon} aria-hidden="true" />
          <input value={query} onChange={(event) => void searchPlace(event.target.value)} placeholder="Search a country, city, or postal code" aria-label="Search the globe" />
          {searchResults.length > 0 && <ul>{searchResults.map((place) => <li key={`${place.code}-${place.name}-${place.resultType ?? "country"}`}><button onClick={() => selectPlace(place)}><strong>{place.name}</strong><small>{place.resultType ?? "country"} · {place.region}</small><span><FaArrowRight aria-hidden="true" /></span></button></li>)}</ul>}
        </div>
        <div className={styles.globeControls} aria-label="Globe controls"><button onClick={zoomIn} aria-label="Zoom in">+</button><button onClick={zoomOut} aria-label="Zoom out">-</button><button onClick={resetGlobe} aria-label="Reset globe">Reset</button></div>
        <div className={styles.globeCanvas}>
        <Globe
          ref={globeRef}
          width={typeof window === "undefined" ? 900 : Math.min(window.innerWidth - 32, 1100)}
          height={typeof window === "undefined" ? 590 : Math.min(window.innerHeight * 0.68, 650)}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#d76a52"
          atmosphereAltitude={0.16}
          htmlElementsData={activePlaces}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.02}
          htmlElement={(place) => {
            const marker = document.createElement("div");
            marker.className = styles.locationMarker;
            marker.innerHTML = renderToStaticMarkup(<FaMapMarkerAlt aria-label={`${(place as Place).name} location`} />);
            marker.onclick = () => selectPlace(place as Place);
            marker.onmouseenter = () => setHovered(place as Place);
            marker.onmouseleave = () => setHovered(null);
            return marker;
          }}
          pointsData={[]}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => "#f08766"}
          pointLabel={(place) => {
            const item = place as Place;
            return `${item.name} / ${item.region}`;
          }}
          onPointClick={(place) => selectPlace(place as Place)}
          pointsMerge={false}
          enablePointerInteraction
          animateIn
          onGlobeReady={() => {
            if (globeRef.current) globeRef.current.controls().enableZoom = false;
          }}
        />
        </div>
        <div className={styles.globeHint}>Drag to rotate <span /> Scroll to zoom</div>
        {(hovered || showLocation) && <div className={styles.locationPopover} role="status"><span className={styles.hoverPin}><FaMapMarkerAlt /></span><div><p>{hovered ? "Hovered location" : "Selected location"}</p><strong>{(hovered ?? selected).name}</strong><small>{(hovered ?? selected).region} · {(hovered ?? selected).lat.toFixed(2)}, {(hovered ?? selected).lng.toFixed(2)}</small></div><Link href={`/country/${(hovered ?? selected).name.toLowerCase().replace(/\s+/g, "-")}`} aria-label={`Open ${(hovered ?? selected).name} details`}><FaArrowRight aria-hidden="true" /></Link></div>}
      </section>
      <nav className={styles.placeRail} aria-label="Featured places">
        {featuredPlaces.slice(0, 5).map((place) => <button key={place.code} className={place.code === selected.code ? styles.placeActive : ""} onClick={() => selectPlace(place)}>{place.name}</button>)}
      </nav>
    </main>
  );
}
