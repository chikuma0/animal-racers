import type { CharacterId } from "./simulation";
export const ROSTER: Record<
  CharacterId,
  {
    name: string;
    title: string;
    symbol: string;
    color: string;
    description: string;
    special: string;
    counter: string;
  }
> = {
  lion: {
    name: "Fire Lion",
    title: "THE SUNSET BRUISER",
    symbol: "☀",
    color: "#f5a464",
    description: "A mighty paw. A moment worth waiting for.",
    special: "Sunset Strike",
    counter: "A heavy strike with a clear wind-up. Make it miss.",
  },
  wolf: {
    name: "Water Wolf",
    title: "THE COLD CREEK DUELIST",
    symbol: "❄",
    color: "#9dcfdc",
    description: "Light feet. Quick paws. Catch their mistake.",
    special: "Creek Slash",
    counter: "The quickest strike. Watch the shoulders, then evade.",
  },
  unicorn: {
    name: "Rainbow Unicorn",
    title: "THE PRISM PROTECTOR",
    symbol: "✦",
    color: "#d8b3e3",
    description: "A calm stance. A flash of light. Your turn.",
    special: "Prism Strike",
    counter: "A forgiving shimmer during evasion. Answer with both hooves.",
  },
};
export const CHARACTER_IDS: CharacterId[] = ["lion", "wolf", "unicorn"];
