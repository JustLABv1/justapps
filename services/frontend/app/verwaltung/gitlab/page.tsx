import { redirect } from 'next/navigation';

export default function GitLabSyncRedirect() {
  redirect('/verwaltung/repository-sync');
}
