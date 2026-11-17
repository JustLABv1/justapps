# Rolling Number

A number whose digits roll to their new values.

```tsx
import { RollingNumber } from "@/components/panelui/rolling-number"
```

From npm the path is `panelui-web/rolling-number`. Install with `npx shadcn@latest add @panelui/rolling-number`.

## When to use it

Use it for a figure that changes while someone is looking at it: a live count, a balance, a score. Each digit rolls to its new value on its own, so going from 312 to 318 moves one column and leaves the other two where they were.

The number is written by `Intl.NumberFormat`. Currency, percent and compact notation are options you pass, not strings you build.

For a number that is shown once and never changes, plain text does the same job.

## Usage

```tsx
<RollingNumber value={waiting} />
```

## Props

Every part also takes the props of the element it renders, and a `className`.

#### `RollingNumberProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `number` | **required** | The number to show. Each digit rolls to its new value on its own. |
| `format` | `Intl.NumberFormatOptions` | — | How the number is written: currency, percent, compact notation, how many decimals. Passed to `Intl.NumberFormat`. |
| `locales` | `Intl.LocalesArgument` | `'en-US'` | The locale the number is written in. Defaults to `en-US` rather than the browser's, so a page rendered on a server writes the same thing the browser then does. |
| `duration` | `number` | `600` | How long a digit takes to roll, in milliseconds. |

## Notes

#### Width

The digits are set in tabular figures, so a 1 is as wide as an 8 and the number keeps its width while it rolls. It does get wider when it gains a digit, as 99 does on its way to 100. Give it room, or a fixed width, where something sits beside it.

#### Server rendering

`locales` defaults to `en-US`, not to the browser's locale. A page rendered on a server would otherwise write the number one way and the browser another, and React reports that as a hydration mismatch. Pass the locale you want written.

#### Reduced motion

With the system's reduce-motion setting on, a digit changes without rolling.

#### Screen readers

A screen reader is given the formatted number once, as text. The rolling columns are hidden from it, so it does not read ten digits per column.

## Example

```tsx
'use client';

import { useEffect, useState } from 'react';
import { RollingNumber } from '@/components/panelui/rolling-number';
import { Stat } from '@/components/panelui/stat';

/** Jobs waiting in a queue, read every couple of seconds. */
const WAITING = [312, 298, 305, 341, 327, 289];

export default function RollingNumberQueue() {
  const [reading, setReading] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setReading((current) => (current + 1) % WAITING.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <Stat.Content>
      <Stat.Label weight="medium">Jobs waiting</Stat.Label>
      <RollingNumber value={WAITING[reading]} className="text-6xl font-bold tracking-tight" />
    </Stat.Content>
  );
}
```
