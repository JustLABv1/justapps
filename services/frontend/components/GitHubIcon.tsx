import type { ComponentPropsWithoutRef } from 'react';
import { siGithub } from 'simple-icons';

type GitHubIconProps = ComponentPropsWithoutRef<'svg'> & {
  title?: string;
};

export function GitHubIcon({ title, ...props }: GitHubIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={siGithub.path} />
    </svg>
  );
}