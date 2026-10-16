import AppShell from '@/components/app-shell';
import { LeadProfilePage } from '@/components/pages/lead-profile-page';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell>
      <LeadProfilePage leadId={id} />
    </AppShell>
  );
}
