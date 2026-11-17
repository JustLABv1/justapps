# Textarea

A field for more than one line that grows as it is written in, up to a limit.

```tsx
import { Textarea } from "@/components/panelui/textarea"
```

From npm the path is `panelui-web/textarea`. Install with `npx shadcn@latest add @panelui/textarea`.

## When to use it

Use it for text that runs to more than one line: a comment, a description, a message. For one line, use [Input](/docs/web/components/input).

It grows a line at a time as it is written in, from `minRows` to `maxRows`, and scrolls after that. Set `autoResize={false}` for one that keeps its size and can be resized by hand.

For a message to an assistant, with files and a send button, use [Prompt](/docs/web/components/prompt), which is built on it.

## Usage

```tsx
<Textarea placeholder="What changed?" minRows={2} maxRows={6} />
```

## Parts

```tsx
<Textarea />
```

## Props

Every part also takes the props of the element it renders, and a `className`.

#### `TextareaProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'ghost'` | `default` | `ghost` draws no box, for a field inside something that draws one. Default `default`. |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | Its text size and line height. Default `md`. |
| `autoResize` | `boolean` | `true` | Whether it grows with what is written in it. Default `true`. |
| `minRows` | `number` | `2` | How many lines tall it starts, while growing. Default `2`. |
| `maxRows` | `number` | `8` | How many lines tall it can grow before it scrolls. Default `8`. |

## Notes

#### Growing

The height is measured from the text before the page is painted, so a field with a value already in it opens at the right height, and so does one whose value is set from outside. Past `maxRows` it scrolls with a thin scrollbar in the theme's border colour.

#### Sizes

`size` is `sm`, `md` or `lg` and sets the text size and line height. The rows are counted in that line height.

#### Every attribute passes through

`Textarea` renders a `<textarea>` and passes everything to it, so `name`, `maxLength`, `required` and the rest work as they do on the element. `rows` is used only with `autoResize={false}`.

## Example

```tsx
'use client';

import { Textarea } from '@/components/panelui/textarea';
import { useState } from 'react';

const LIMIT = 280;

export default function TextareaGrows() {
  const [text, setText] = useState('The release moved to Thursday. ');

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <Textarea
        aria-label="Update"
        placeholder="What changed?"
        minRows={2}
        maxRows={6}
        maxLength={LIMIT}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="flex justify-between px-1 text-xs text-muted-foreground">
        <span>Grows to six lines, then scrolls.</span>
        <span className="tabular-nums">
          {text.length} / {LIMIT}
        </span>
      </p>
    </div>
  );
}
```
