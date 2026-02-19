import type { Employee } from '@/types';

export const SHIFT_COLORS = [
  { block: 'bg-blue-200/80 border-blue-400 dark:bg-blue-900/40 dark:border-blue-600', rowMarker: 'border-l-4 border-l-blue-400 dark:border-l-blue-600 bg-background', handle: 'bg-blue-300 hover:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-600', hover: 'hover:bg-blue-300/80 dark:hover:bg-blue-800/50' },
  { block: 'bg-emerald-200/80 border-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-600', rowMarker: 'border-l-4 border-l-emerald-400 dark:border-l-emerald-600 bg-background', handle: 'bg-emerald-300 hover:bg-emerald-400 dark:bg-emerald-700 dark:hover:bg-emerald-600', hover: 'hover:bg-emerald-300/80 dark:hover:bg-emerald-800/50' },
  { block: 'bg-amber-200/80 border-amber-400 dark:bg-amber-900/40 dark:border-amber-600', rowMarker: 'border-l-4 border-l-amber-400 dark:border-l-amber-600 bg-background', handle: 'bg-amber-300 hover:bg-amber-400 dark:bg-amber-700 dark:hover:bg-amber-600', hover: 'hover:bg-amber-300/80 dark:hover:bg-amber-800/50' },
  { block: 'bg-violet-200/80 border-violet-400 dark:bg-violet-900/40 dark:border-violet-600', rowMarker: 'border-l-4 border-l-violet-400 dark:border-l-violet-600 bg-background', handle: 'bg-violet-300 hover:bg-violet-400 dark:bg-violet-700 dark:hover:bg-violet-600', hover: 'hover:bg-violet-300/80 dark:hover:bg-violet-800/50' },
  { block: 'bg-rose-200/80 border-rose-400 dark:bg-rose-900/40 dark:border-rose-600', rowMarker: 'border-l-4 border-l-rose-400 dark:border-l-rose-600 bg-background', handle: 'bg-rose-300 hover:bg-rose-400 dark:bg-rose-700 dark:hover:bg-rose-600', hover: 'hover:bg-rose-300/80 dark:hover:bg-rose-800/50' },
  { block: 'bg-cyan-200/80 border-cyan-400 dark:bg-cyan-900/40 dark:border-cyan-600', rowMarker: 'border-l-4 border-l-cyan-400 dark:border-l-cyan-600 bg-background', handle: 'bg-cyan-300 hover:bg-cyan-400 dark:bg-cyan-700 dark:hover:bg-cyan-600', hover: 'hover:bg-cyan-300/80 dark:hover:bg-cyan-800/50' },
  { block: 'bg-orange-200/80 border-orange-400 dark:bg-orange-900/40 dark:border-orange-600', rowMarker: 'border-l-4 border-l-orange-400 dark:border-l-orange-600 bg-background', handle: 'bg-orange-300 hover:bg-orange-400 dark:bg-orange-700 dark:hover:bg-orange-600', hover: 'hover:bg-orange-300/80 dark:hover:bg-orange-800/50' },
  { block: 'bg-teal-200/80 border-teal-400 dark:bg-teal-900/40 dark:border-teal-600', rowMarker: 'border-l-4 border-l-teal-400 dark:border-l-teal-600 bg-background', handle: 'bg-teal-300 hover:bg-teal-400 dark:bg-teal-700 dark:hover:bg-teal-600', hover: 'hover:bg-teal-300/80 dark:hover:bg-teal-800/50' },
] as const;

export function getShiftColor(employeeId: string, activeEmployees: Employee[]) {
  const idx = activeEmployees.findIndex((e) => e.id === employeeId);
  return SHIFT_COLORS[idx < 0 ? 0 : idx % SHIFT_COLORS.length];
}
