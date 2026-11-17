# Switch

On or off, for a setting that takes effect the moment it changes.

```tsx
import { Switch } from "@/components/panelui/switch"
```

From npm the path is `panelui-web/switch`. Install with `npx shadcn@latest add @panelui/switch`.

## When to use it

Use it for a setting that takes effect as soon as it changes: notifications on, dark mode off. There is nothing to save afterwards.

For a choice that only applies when a form is sent, such as agreeing to terms, use a checkbox. For a choice between more than two options, use [Tabs](/docs/web/components/tabs) or a radio group.

Give every switch a name. Wrap it in a [Label](/docs/web/components/label), tie a label to its `id`, or pass `label` when the name is shown elsewhere on the screen.

## Usage

```tsx
<Switch label="Dark mode" defaultChecked />

<Label>
  <Label.Text>Email me a receipt</Label.Text>
  <Label.Action>
    <Switch />
  </Label.Action>
</Label>
```

## Props

Every part also takes the props of the element it renders, and a `className`.

#### `SwitchProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `size` | `SwitchSize` | — | Default `md`. |
| `color` | `SwitchColor` | `primary` | The colour it fills with when on. `primary` by default; pick another for what it means. |
| `label` | `string` | — | What a screen reader calls it, when there is no visible label tied to it. A `Label` wrapped round it, or pointing at its `id`, is better when there is room. |
| `pending` | `boolean` | — | A change is being saved: a ring turns in the thumb, and it cannot be pressed again until it is done. |
| `className` | `string` | — | — |
| `style` | `CSSProperties` | — | — |

## Notes

#### Motion

The colour sweeps along the track behind the thumb rather than fading in. While the switch is pressed, the thumb stretches towards where it will go. With reduced motion turned on, it switches in place.

#### Keyboard

The switch is a button with `role="switch"`. Space and Enter flip it.

#### In a form

Pass `name` and the switch submits with the form, as a checkbox does. `required` makes it one that must be on.

#### Built on

It is the Base UI switch, which the package depends on directly.

## Example

```tsx
'use client';

import { Switch } from '@/components/panelui/switch';

export default function SwitchOverview() {
  return (
    <div className="flex items-center gap-6">
      <Switch label="Wi-Fi" size="lg" />
      <Switch label="Bluetooth" size="lg" defaultChecked />
      <Switch label="Airplane mode" size="lg" defaultChecked disabled />
    </div>
  );
}
```
