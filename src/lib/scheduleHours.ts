import { differenceInMinutes } from 'date-fns';

export function scheduledHoursBetween(startIso: string, endIso: string): number {
  return differenceInMinutes(new Date(endIso), new Date(startIso)) / 60;
}

export function formatHours1Decimal(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

