import { redirect } from 'next/navigation';

export default function GitLabSyncRedirect() {
  redirect('/verwaltung/integrationen/repository-sync');
}
