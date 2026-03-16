import { CharacterId } from './types';

interface CharacterArtDef {
  racer: string;
  portrait?: string;
  accent: string;
  glow: string;
  fight: {
    idle: string;
    punch: string;
    special: string;
    hit: string;
  };
}

export const CHARACTER_ART: Record<CharacterId, CharacterArtDef> = {
  lion: {
    racer: '/assets/characters/lion-racer.svg',
    portrait: '/assets/characters/lion-racer.svg',
    accent: '#FF9C33',
    glow: '#FFD16B',
    fight: {
      idle: '/assets/characters/lion-fight-idle.svg',
      punch: '/assets/characters/lion-fight-punch.svg',
      special: '/assets/characters/lion-fight-special.svg',
      hit: '/assets/characters/lion-fight-hit.svg',
    },
  },
  wolf: {
    racer: '/assets/characters/wolf-racer.svg',
    portrait: '/assets/characters/wolf-racer.svg',
    accent: '#63B5FF',
    glow: '#D6F3FF',
    fight: {
      idle: '/assets/characters/wolf-fight-idle.svg',
      punch: '/assets/characters/wolf-fight-punch.svg',
      special: '/assets/characters/wolf-fight-special.svg',
      hit: '/assets/characters/wolf-fight-hit.svg',
    },
  },
  unicorn: {
    racer: '/assets/characters/unicorn-racer.svg',
    portrait: '/assets/characters/unicorn-racer.svg',
    accent: '#FF7AD8',
    glow: '#FFF6FF',
    fight: {
      idle: '/assets/characters/unicorn-fight-idle.svg',
      punch: '/assets/characters/unicorn-fight-punch.svg',
      special: '/assets/characters/unicorn-fight-special.svg',
      hit: '/assets/characters/unicorn-fight-hit.svg',
    },
  },
};

export const ENV_ART = {
  jungleCanopy: '/assets/env/jungle-canopy.svg',
  arenaCrowd: '/assets/env/arena-crowd.svg',
  stoneTotem: '/assets/env/stone-totem.svg',
} as const;

const IMAGE_CACHE = new Map<string, HTMLImageElement>();
const LOAD_CACHE = new Map<string, Promise<void>>();

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof Image !== 'undefined';
}

function loadImage(src: string): Promise<void> {
  if (!isBrowser()) {
    return Promise.resolve();
  }

  if (IMAGE_CACHE.has(src)) {
    const cached = IMAGE_CACHE.get(src);
    if (cached && cached.complete) {
      return Promise.resolve();
    }
  }

  const existing = LOAD_CACHE.get(src);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      IMAGE_CACHE.set(src, img);
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    img.src = src;
  }).catch(() => {
    LOAD_CACHE.delete(src);
  });

  LOAD_CACHE.set(src, promise);
  return promise;
}

export function getAssetImage(src: string): HTMLImageElement | null {
  const image = IMAGE_CACHE.get(src);
  if (image?.complete && image.naturalWidth > 0) {
    return image;
  }
  return null;
}

export function getAllGameAssetUrls(): string[] {
  return Array.from(new Set([
    ...Object.values(CHARACTER_ART).flatMap(entry => [
      entry.racer,
      ...(entry.portrait ? [entry.portrait] : []),
      ...Object.values(entry.fight),
    ]),
    ...Object.values(ENV_ART),
  ]));
}

export async function primeGameAssets(): Promise<void> {
  const urls = getAllGameAssetUrls();
  await Promise.all(urls.map(loadImage));
}
