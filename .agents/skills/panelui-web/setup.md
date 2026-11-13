# Setting up

The collection is installed one of two ways. Use whichever the project already uses.

## From the registry, with the shadcn CLI

The project needs shadcn/ui initialised (`components.json` exists). Add the registry once:

```json
{
  "registries": {
    "@panelui": "https://panelui.dev/r/web/{name}.json"
  }
}
```

Then add components by name. Use the project's own runner:

```bash
npx shadcn@latest add @panelui/planet
npx shadcn@latest add @panelui/kpi @panelui/lane-board
```

A component's source is copied to `components/panelui/<name>.tsx` (or a folder of that name for a
component with more than one file), where it can be edited. Import it from there:

```tsx
import { Planet } from "@/components/panelui/planet"
```

Without the registry entry, the full address works: `npx shadcn@latest add
https://panelui.dev/r/web/planet.json`.

The CLI also adds what a component needs: its npm packages, any component it is built on, and the
`--success`, `--warning` and `--info` tokens if the theme does not have them.

## From npm

```bash
npm install panelui-web
```

```tsx
import { Planet } from "panelui-web/planet"
```

Tailwind has to be told to read the package's classes. In the project's main stylesheet:

```css
@source "../node_modules/panelui-web/dist";
```

The path is relative to the stylesheet. The three status tokens are not added for you on this
route; see [theming.md](theming.md).

## Looking things up

- `npx shadcn@latest search @panelui` lists every component.
- `npx shadcn@latest view @panelui/<name>` prints one in full, source included.
- With the shadcn MCP server configured (`npx shadcn@latest mcp init --client <client>`), the same
  lookups are available as tools, and they read the `@panelui` registry from `components.json`.
