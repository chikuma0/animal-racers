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
    name: "らいおん",
    title: "🦁 ほのおの らいおん",
    symbol: "☀",
    color: "#f5a464",
    description: "げんき いっぱい！",
    special: "ほのお パンチ",
    counter: "🥊 で たたこう",
  },
  wolf: {
    name: "おおかみ",
    title: "🐺 みずの おおかみ",
    symbol: "❄",
    color: "#9dcfdc",
    description: "すばやく はしるよ！",
    special: "みず パンチ",
    counter: "🥊 で たたこう",
  },
  unicorn: {
    name: "ゆにこーん",
    title: "🦄 にじの ゆにこーん",
    symbol: "✦",
    color: "#d8b3e3",
    description: "にじの ちからで がんばるよ！",
    special: "にじ パンチ",
    counter: "🥊 で たたこう",
  },
};
export const CHARACTER_IDS: CharacterId[] = ["lion", "wolf", "unicorn"];
