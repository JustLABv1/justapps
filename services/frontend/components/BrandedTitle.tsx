/** Whether a hex colour is too dark to read on a dark background. */
function isVeryDark(color: string) {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return false;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.15;
}

/**
 * The hero title in the brand colours, word by word: the words are split into
 * three runs, each in one solid colour, so the title reads like the flag it
 * stands for. A gradient across the letters blended black, red and gold into
 * pink and orange and cut colours through the middle of words.
 *
 * A very dark colour (the flag's black) stays black in dark mode too; it gets
 * a light outline there so the word can still be read.
 */
export function BrandedTitle({ text, colors }: { text: string; colors: readonly string[] }) {
  const words = text.split(/\s+/).filter(Boolean);
  if (colors.length === 0 || words.length === 0) return <>{text}</>;
  return (
    <>
      {words.map((word, index) => {
        const color = colors[Math.min(colors.length - 1, Math.floor((index * colors.length) / words.length))];
        return (
          <span
            key={`${word}-${index}`}
            style={{ color }}
            className={isVeryDark(color) ? 'dark:[-webkit-text-stroke:1.5px_rgb(255_255_255/0.55)] dark:[paint-order:stroke_fill]' : undefined}
          >
            {word}
            {index < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </>
  );
}
