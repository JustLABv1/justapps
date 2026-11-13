import { fileURLToPath } from "node:url";

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Temporary, while HeroUI and PanelUI share the theme: see the file.
    [fileURLToPath(new URL("./postcss-heroui-muted.cjs", import.meta.url))]: {},
  },
};

export default config;
