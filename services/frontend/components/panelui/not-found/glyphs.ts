/**
 * The shapes NotFound draws, as grids of cells.
 *
 * A digit is drawn at 5 by 7 and scaled up three times, so every stroke is
 * three cells wide. Kept whole that is a solid pixel digit; reduced to the
 * cells on its edge it is a digit drawn in outline, two rows of dots with a
 * gap between, which is the look a stroked numeral has at this size.
 *
 * Digits are drawn without diagonal strokes. Two blocks that meet only at a
 * corner come apart when reduced to their edges, so a slanted stroke would
 * outline as a stair of separate rings.
 *
 * The icons Scramble turns a digit into are drawn straight onto the same 15 by
 * 21 grid, from circles and lines, so they arrive at exactly the size of the
 * digit they replace and need no scaling of their own.
 */

/** Cells across one glyph. */
export const GLYPH_COLUMNS = 15;
/** Cells down one glyph. */
export const GLYPH_ROWS = 21;

const SCALE = 3;

const DIGITS: Record<string, readonly string[]> = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '.###.', '#....', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['#..#.', '#..#.', '#..#.', '#####', '...#.', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '....#', '####.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '....#', '...##', '...#.', '...#.', '...#.'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
};

/** A glyph: which cells are on, row by row. */
export type Glyph = boolean[][];

function empty(): Glyph {
  return Array.from({ length: GLYPH_ROWS }, () => Array<boolean>(GLYPH_COLUMNS).fill(false));
}

/** A digit as a solid grid of cells, or `null` for a character there is no drawing of. */
function solidDigit(character: string): Glyph | null {
  const rows = DIGITS[character];
  if (!rows) return null;
  const glyph = empty();
  for (let y = 0; y < GLYPH_ROWS; y += 1) {
    for (let x = 0; x < GLYPH_COLUMNS; x += 1) {
      glyph[y]![x] = rows[Math.floor(y / SCALE)]![Math.floor(x / SCALE)] === '#';
    }
  }
  return glyph;
}

/**
 * Only the cells of a glyph that touch a cell outside it, corners included.
 * Counting corners keeps a diagonal stroke as a continuous band; counting
 * only sides leaves it as a scatter of single dots.
 */
function outlineOf(glyph: Glyph): Glyph {
  const on = (x: number, y: number) => glyph[y]?.[x] === true;
  return glyph.map((row, y) =>
    row.map((cell, x) => {
      if (!cell) return false;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) if (!on(x + dx, y + dy)) return true;
      }
      return false;
    })
  );
}

/** A digit, solid or as its outline. */
export function digitGlyph(character: string, fill: 'outline' | 'solid'): Glyph | null {
  const solid = STROKED[character] ?? solidDigit(character);
  if (!solid) return null;
  return fill === 'solid' ? solid : outlineOf(solid);
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

/** Distance from a point to the segment from a to b. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** A glyph from a test of each cell's centre. */
function drawn(test: (x: number, y: number) => boolean): Glyph {
  const glyph = empty();
  for (let y = 0; y < GLYPH_ROWS; y += 1) {
    for (let x = 0; x < GLYPH_COLUMNS; x += 1) glyph[y]![x] = test(x + 0.5, y + 0.5);
  }
  return glyph;
}

/** A ring: cells whose centre is within half a stroke of the circle. */
const ring = (x: number, y: number, cx: number, cy: number, r: number, stroke: number) =>
  Math.abs(Math.hypot(x - cx, y - cy) - r) <= stroke / 2;

/** A question mark: a hook, a short stem, a dot. */
const question = drawn((x, y) => {
  const angle = Math.atan2(y - 6.5, x - 7.5);
  // The hook runs from the left of the circle, over the top, round to the
  // lower right, and stops there so the stem can drop from it.
  const onHook = ring(x, y, 7.5, 6.5, 4.6, 2) && (y < 6.5 || angle < Math.PI * 0.35);
  const stem = toSegment(x, y, 9.4, 10.6, 7.5, 13.2) <= 1 || toSegment(x, y, 7.5, 13.2, 7.5, 14.5) <= 1;
  const dot = Math.hypot(x - 7.5, y - 18) <= 1.3;
  return onHook || stem || dot;
});

/** A magnifying glass, the lens high and the handle running to the lower right. */
const magnifier = drawn(
  (x, y) => ring(x, y, 6.5, 7.5, 4.8, 2) || toSegment(x, y, 10.2, 11.6, 13.4, 17.6) <= 1.2
);

/** A map pin: a ring with a dot in it, narrowing to a point. */
const pin = drawn((x, y) => {
  const head = ring(x, y, 7.5, 7.5, 5, 2) && y < 10.5;
  // The two sides run from the widest part of the ring down to the point.
  const sides =
    toSegment(x, y, 3, 9.6, 7.5, 18.6) <= 1 || toSegment(x, y, 12, 9.6, 7.5, 18.6) <= 1;
  const dot = Math.hypot(x - 7.5, y - 7.5) <= 1.5;
  return head || sides || dot;
});

/*
 * Digits drawn from strokes rather than scaled up, for the ones whose shape
 * needs a diagonal. Each stroke is three cells wide, the same as a scaled-up
 * pixel, so they sit with the others.
 */
const stroke = (x: number, y: number, ax: number, ay: number, bx: number, by: number) =>
  toSegment(x, y, ax, ay, bx, by) <= 1.5;

/** Distance from a point to an ellipse's outline, near enough for drawing at this size. */
const toEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const r = Math.hypot(nx, ny);
  // Scale the radial error back to cells by the radius in that direction.
  const along = r === 0 ? Math.min(rx, ry) : Math.hypot(nx * rx, ny * ry) / r;
  return Math.abs(r - 1) * along;
};

const STROKED: Record<string, Glyph> = {
  // An oval nought, not a box with its corners cut.
  '0': drawn((x, y) => toEllipse(x, y, 7.5, 10.5, 6, 9) <= 1.5),
  // A closed four: the diagonal runs from the top of the stem down to the
  // crossbar, and the crossbar reaches a little past the stem.
  '4': drawn(
    (x, y) =>
      stroke(x, y, 10.5, 1.5, 10.5, 19.5) ||
      stroke(x, y, 10.5, 1.5, 1.5, 14.5) ||
      stroke(x, y, 1.5, 14.5, 13.5, 14.5)
  ),
};

/** The icons Scramble cycles through, in order. */
export const ICONS: readonly Glyph[] = [question, magnifier, pin];
