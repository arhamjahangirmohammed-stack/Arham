import AppShell from '@/components/app-shell';
import { TasksPage } from '@/components/pages/tasks-page';

export default function Page() {
  return (
    <AppShell>
      <TasksPage />
    </AppShell>
  );
}
