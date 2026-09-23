"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowRight } from "react-icons/fa";
import styles from "./page.module.css";

type Country = {
  name: { common: string; official: string };
  cca2: string;
  capital?: string[];
  region: string;
  population: number;
  latitude?: number;
  longitude?: number;
  resultType?: "country" | "city" | "postal";
  displayName?: string;
};

type SearchState = "idle" | "loading" | "success" | "empty" | "error";

export default function Home() {
  const [visitorLabel, setVisitorLabel] = useState("Explore from wherever you are");

  useEffect(() => {
    fetch("/api/ip")
      .then((response) => response.ok ? response.json() : null)
      .then((location: { location?: { label?: string } } | null) => {
        if (location?.location?.label) setVisitorLabel(`Starting near ${location.location.label}`);
      })
      .catch(() => undefined);
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="page-title">
        <header className={styles.header}>
          <Link className={styles.brand} href="#page-title" aria-label="Atlas home"><span className={styles.brandIcon}>A</span> atlas</Link>
        </header>

        <section className={styles.hero} id="explore">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}><span className={styles.playIcon}>+</span> A guide to everywhere</p>
            <h1 id="page-title">Find a place<br />to <em>begin.</em></h1>
            <p className={styles.lede}>Search the world&apos;s countries, one curious question at a time. Start with a name, a region, or simply somewhere you&apos;ve always wanted to know more about.</p>
          </div>
          <div className={styles.heroVisual} aria-label="Compass video illustration">
            <video src="/hero/compress.mp4" autoPlay loop muted playsInline preload="auto" />
          </div>
        </section>

        <section className={styles.searchSection} aria-label="Search Atlas"><CountrySearch /></section>

        <section className={styles.globeCard} aria-label="Explore the globe">
          <div><p className={styles.kicker}>Atlas / The whole picture</p><h2>See the world<br /><em>in motion.</em></h2><p>Turn the globe, zoom into a region, and follow a marker to a country profile.</p><small className={styles.visitorLabel}>{visitorLabel}</small></div>
          <Link className={styles.globeCardAction} href="/globe">Explore the globe <FaArrowRight aria-hidden="true" /></Link>
        </section>

        <section className={styles.stats} aria-label="Atlas facts"><div><strong>195</strong><small>Countries<br />to discover</small></div><div><strong>7</strong><small>Continents<br />to wander</small></div><div><strong>1</strong><small>Curious<br />starting point</small></div><div><strong>∞</strong><small>Stories<br />to uncover</small></div></section>

        <section className={styles.whySection} id="regions"><div className={styles.whyCopy}><p className={styles.kicker}>- What you can find</p><h2>Every country has<br />a different way<br />of seeing the world.</h2><p>Atlas gives you a quick, inviting starting point: a capital, a region, a population, and a reason to keep looking.</p></div><div className={styles.benefits}><article><span className={styles.benefitIcon}>⌕</span><strong>Search naturally</strong><p>Find countries, cities, and postal codes in a few keystrokes.</p></article><article><span className={styles.benefitIcon}><FaArrowRight aria-hidden="true" /></span><strong>Keep discovering</strong><p>Open a place, then move around the globe to find another.</p></article><article className={styles.mapBenefit}><div className={styles.miniMap} /><strong>Start with somewhere new</strong><p>From familiar places to names you&apos;ve never heard before.</p></article></div></section>

        <footer className={styles.footer} id="footer">
          <span>Atlas / A small guide to a big world</span><span>Data by First.org</span>
        </footer>
      </section>
    </main>
  );
}

function CountrySearch() {
  const [query, setQuery] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const trimmedQuery = query.trim();
    const currentRequest = ++requestId.current;
    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/countries?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          if (response.status === 404) {
            if (currentRequest === requestId.current) {
              setCountries([]);
              setState("empty");
            }
            return;
          }
          throw new Error("The directory is unavailable");
        }

        const results = (await response.json()) as Country[];
        if (currentRequest === requestId.current) {
          setCountries(results.slice(0, 8));
          setState(results.length ? "success" : "empty");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (currentRequest === requestId.current) setState("error");
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  function chooseCountry(country: Country) {
    router.push(resultHref(country));
  }

  function resultHref(country: Country) {
    const name = country.displayName || country.name.common || "place";
    return `/country/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && countries.length) {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % countries.length);
    } else if (event.key === "ArrowUp" && countries.length) {
      event.preventDefault();
      setHighlightedIndex((index) => (index <= 0 ? countries.length - 1 : index - 1));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      chooseCountry(countries[highlightedIndex]);
    } else if (event.key === "Home" && countries.length) {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End" && countries.length) {
      event.preventDefault();
      setHighlightedIndex(countries.length - 1);
    } else if (event.key === "Escape") {
      setCountries([]);
      setHighlightedIndex(-1);
      setState(query.trim().length >= 2 ? "success" : "idle");
      inputRef.current?.blur();
    }
  }

  const statusMessage = {
    idle: "Type at least two letters to begin",
    loading: "Searching the directory...",
    empty: `No countries found for “${query.trim()}”`,
    error: "Something interrupted the search. Try again.",
    success: "Use the arrow keys to browse results",
  }[state];

  return (
    <div className={styles.searchArea}>
      <div className={styles.searchLabelRow}>
        <label htmlFor="country-search">Search countries</label>
        <span className={styles.shortcut}>CMD K</span>
      </div>
      <div className={`${styles.searchBox} ${state === "error" ? styles.searchBoxError : ""}`}>
        <span className={styles.searchIcon} aria-hidden="true">?</span>
        <input
          ref={inputRef}
          id="country-search"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              setCountries([]);
              setState("idle");
              setHighlightedIndex(-1);
            } else {
              setState("loading");
              setHighlightedIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Try Japan, Kenya, or Brazil..."
          autoComplete="off"
          role="combobox"
          aria-label="Search countries, cities, or postal codes"
          aria-expanded={countries.length > 0}
          aria-controls="country-results"
          aria-autocomplete="list"
          aria-busy={state === "loading"}
          aria-activedescendant={highlightedIndex >= 0 ? `country-${countries[highlightedIndex].cca2}` : undefined}
        />
        {query && <button className={styles.clearButton} onClick={() => setQuery("")} aria-label="Clear search">X</button>}
        {state === "loading" && <span className={styles.spinner} aria-label="Loading" />}
      </div>

      <div className={styles.status} role="status">{statusMessage}</div>

      {countries.length > 0 && (
        <ul id="country-results" className={styles.results} role="listbox" aria-label="Country results">
          {countries.map((country, index) => (
            <li key={`${country.cca2}-${country.name.common}-${country.resultType ?? "country"}`} role="option" aria-selected={index === highlightedIndex} id={`country-${country.cca2}`}>
              <Link className={`${styles.result} ${index === highlightedIndex ? styles.resultActive : ""}`} href={resultHref(country)} onMouseDown={(event) => event.preventDefault()}>
                <span className={styles.countryCode}>{country.cca2}</span>
                <span className={styles.countryText}>
                  <strong>{country.displayName ?? country.name.common}</strong>
                  <small>{country.resultType === "city" ? "City" : country.resultType === "postal" ? "Postal code" : `${country.capital?.[0] ?? "No capital listed"} / ${country.region}`}</small>
                </span>
                <span className={styles.population}>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(country.population)}</span>
                <span className={styles.arrow}><FaArrowRight aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
