import AppShell from '@/components/app-shell';
import { CustomerProfilePage } from '@/components/pages/customer-profile-page';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell>
      <CustomerProfilePage customerId={id} />
    </AppShell>
  );
}
