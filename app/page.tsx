import { HabitSection } from '@/components/habit/HabitSection';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import { SaveWarning } from '@/components/layout/SaveWarning';
import { Screens } from '@/components/layout/Screens';
import { TaskSection } from '@/components/task/TaskSection';

export default function Home() {
  return (
    <AppShell>
      {/*
        * Today is built here, on the server, and handed to Screens, so it is on
        * screen before any script runs. Progress and Settings are drawn in the
        * browser — the server can't see which tab the address names (v5 Block B).
        */}
      <Screens
        today={
          <>
            <Header />
            <SaveWarning />
            <HabitSection />
            <TaskSection />
          </>
        }
      />
    </AppShell>
  );
}
