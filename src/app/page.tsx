"use client";
import dynamic from "next/dynamic";
const Championship = dynamic(() => import("@/components/Championship"), {
  ssr: false,
  loading: () => (
    <main
      style={{
        background: "#241d18",
        color: "#efdab5",
        height: "100dvh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Georgia",
      }}
    >
      <div>
        ANIMAL RACERS
        <br />
        <small>Preparing the frontier…</small>
      </div>
    </main>
  ),
});
export default function Home() {
  return <Championship />;
}
