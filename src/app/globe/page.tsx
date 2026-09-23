import InteractiveGlobe from "./InteractiveGlobe";

export default async function GlobePage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  return <InteractiveGlobe regionFilter={region} />;
}
