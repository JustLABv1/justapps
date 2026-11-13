# Colour and theme

## The five roles

A component's colour is one of the theme's roles, passed as `color`:

| Role | Token it reads | Use it for |
| --- | --- | --- |
| `primary` | `--primary` | The default. The theme's main colour. |
| `info` | `--info` | Neutral emphasis: something to notice that is neither good nor bad. |
| `success` | `--success` | Good news, progress, a healthy state. |
| `warning` | `--warning` | Something that wants attention before it becomes a problem. |
| `destructive` | `--destructive` | Bad news, a failure, a limit passed. |

Choose by what the colour means. A reading that crosses a limit changes role; it is not styled
with a class:

```tsx
<RangeMeter value={time} color={time <= 300 ? "success" : time <= 450 ? "warning" : "destructive"} />
```

Components also read the surface tokens every shadcn theme has: `--background`, `--foreground`,
`--card`, `--muted`, `--muted-foreground`, `--accent`, `--border`, `--ring`.

## The three tokens a stock theme lacks

`--primary` and `--destructive` are in every shadcn theme. `--success`, `--warning` and `--info`
are not. The registry adds them when a component that uses one is installed. Installing from npm,
or by hand, add them to the stylesheet:

```css
:root {
  --success: oklch(0.696 0.17 162.48);
  --warning: oklch(0.769 0.188 70.08);
  --info: oklch(0.623 0.214 259.815);
}
```

They are the same in light and dark. Without them a component drawn in one of those roles has no
colour where the colour should be.

## Dark mode

Nothing to do. The components read tokens, and the tokens change with the theme.

## Changing one component

Every part takes `className`, merged over its own classes. A few components expose a variable
meant to be set, written as an arbitrary property: `className="[--pu-thumb:4.5rem]"`. Each
component's file says which.

Do not override a component's colour with a palette class such as `bg-emerald-500`. Change the
role, or change the token.
