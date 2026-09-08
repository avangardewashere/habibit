import { HabitSection } from '@/components/habit/HabitSection';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import { SaveWarning } from '@/components/layout/SaveWarning';
import { TaskSection } from '@/components/task/TaskSection';

export default function Home() {
  return (
    <AppShell>
      <Header />
      <SaveWarning />
      <HabitSection />
      <TaskSection />
    </AppShell>
  );
}
