import {
  Apple,
  Bike,
  BookOpen,
  Brain,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  Pencil,
  PiggyBank,
  Pill,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { HabitIcon as HabitIconName } from '@/lib/look';

/**
 * A habit's icon name turned into something that can be drawn.
 *
 * Kept apart from `lib/look.ts` so that file stays pure text handling with no
 * React and no lucide import — it is read by the reducer, the storage layer and
 * the sync layer, none of which should pull in an icon set to validate a
 * string.
 *
 * Named imports rather than lucide's dynamic icon component: these are the only
 * sixteen that can ever be used, and naming them is what lets the bundler drop
 * the other thousand-odd.
 */
const ICONS: Record<HabitIconName, LucideIcon> = {
  droplet: Droplet,
  footprints: Footprints,
  dumbbell: Dumbbell,
  'book-open': BookOpen,
  moon: Moon,
  sun: Sun,
  leaf: Leaf,
  apple: Apple,
  coffee: Coffee,
  pencil: Pencil,
  music: Music,
  bike: Bike,
  pill: Pill,
  brain: Brain,
  'piggy-bank': PiggyBank,
  heart: Heart,
};

/**
 * Decoration by default. The row already says what the habit is called, and an
 * icon that repeats the title is noise in a screen reader — so it is hidden
 * unless a caller gives it a name, which the chooser does.
 */
export function HabitIcon({
  name,
  className,
  label,
}: {
  name: HabitIconName;
  className?: string;
  label?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={2.5} aria-hidden={label ? undefined : true} aria-label={label} />;
}
