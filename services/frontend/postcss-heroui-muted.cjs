/**
 * HeroUI compatibility for the PanelUI theme. Delete with @heroui/react.
 *
 * In the PanelUI (shadcn/ui) theme `--muted` is a surface tint, and quiet
 * text is `--muted-foreground`. HeroUI's stylesheet writes quiet text as
 * `color: var(--muted)`, which would make it near-invisible. PanelUI only
 * ever reads `--muted` as a background, and the app code uses
 * `text-muted-foreground`, so pointing every *text-colour* read of `--muted`
 * at `--muted-foreground` fixes HeroUI and leaves PanelUI alone.
 */
const TEXT_COLOR_PROPS = new Set(["color", "fill", "stroke", "caret-color", "text-decoration-color"]);
const MUTED = /var\(--muted\)/g;

module.exports = () => ({
  postcssPlugin: "heroui-muted-text",
  Declaration(decl) {
    if (TEXT_COLOR_PROPS.has(decl.prop) && decl.value.includes("var(--muted)")) {
      decl.value = decl.value.replace(MUTED, "var(--muted-foreground)");
    }
  },
});
module.exports.postcss = true;
