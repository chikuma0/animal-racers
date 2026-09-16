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
    description: "Close the distance. Commit to the moment.",
    special: "Fire Dash",
    counter: "A charging burst. Guard it, then punish the recovery.",
  },
  wolf: {
    name: "Water Wolf",
    title: "THE COLD CREEK DUELIST",
    symbol: "❄",
    color: "#9dcfdc",
    description: "Keep your distance. Catch a reckless rival.",
    special: "Freezing Howl",
    counter: "A wind-up howl. Step outside its reach or guard.",
  },
  unicorn: {
    name: "Rainbow Unicorn",
    title: "THE PRISM PROTECTOR",
    symbol: "✦",
    color: "#d8b3e3",
    description: "Hold your ground. Turn defense into opportunity.",
    special: "Prism Shield",
    counter: "A brief ward. Wait for its shimmer to fade.",
  },
};
export const CHARACTER_IDS: CharacterId[] = ["lion", "wolf", "unicorn"];
