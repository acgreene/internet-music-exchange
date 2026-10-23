/**
 * IME's list of design styles. A designer picks up to three for a design,
 * and artists browse the gallery by them. Ids are stored on designs, so
 * renaming a style means changing its name here, never its id.
 */
export const DESIGN_STYLES = [
  { id: 'typographic', name: 'Typographic' },
  { id: 'editorial', name: 'Editorial' },
  { id: 'photographic', name: 'Photographic' },
  { id: 'illustrated', name: 'Illustrated' },
  { id: 'collage', name: 'Collage' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'brutalist', name: 'Brutalist' },
  { id: 'retro', name: 'Retro' },
  { id: '3d', name: '3D' },
  { id: 'motion', name: 'Motion' },
  { id: 'interactive', name: 'Interactive' },
  { id: 'generative', name: 'Generative' },
] as const;

export type DesignStyleId = (typeof DESIGN_STYLES)[number]['id'];

export const DESIGN_STYLE_IDS = DESIGN_STYLES.map((style) => style.id) as [
  DesignStyleId,
  ...DesignStyleId[],
];

/** The most styles a design can carry. */
export const MAX_DESIGN_STYLES = 3;

export function isDesignStyleId(id: string): id is DesignStyleId {
  return DESIGN_STYLES.some((style) => style.id === id);
}

export function designStyleName(id: string): string {
  return DESIGN_STYLES.find((style) => style.id === id)?.name ?? id;
}
