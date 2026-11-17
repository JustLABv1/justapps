'use client';

import { Button } from "@/components/panelui/button";
import { Tooltip } from "@/components/panelui/tooltip";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // The theme is only known on the client: hold the space until then.
  if (!mounted) {
    return <Button variant="ghost" size="icon-sm" aria-hidden="true" tabIndex={-1} className="invisible" />;
  }

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln';

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          />
        }
      >
        {isDark ? <Sun /> : <Moon />}
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
