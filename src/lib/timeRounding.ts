/**
 * Time Rounding Utilities
 * Rounds timestamps to nearest interval (default 15 minutes)
 */

/**
 * Rounds a timestamp to the nearest interval
 * @param timestamp - The timestamp to round
 * @param intervalMinutes - The interval in minutes (default: 15)
 * @returns Rounded timestamp
 */
export function roundToNearestInterval(
  timestamp: Date,
  intervalMinutes: number = 15
): Date {
  const intervalMs = intervalMinutes * 60 * 1000;
  const timestampMs = timestamp.getTime();
  const roundedMs = Math.round(timestampMs / intervalMs) * intervalMs;
  return new Date(roundedMs);
}

/**
 * Rounds a time string (ISO format) to the nearest interval
 * @param timeString - ISO time string
 * @param intervalMinutes - The interval in minutes (default: 15)
 * @returns Rounded timestamp as ISO string
 */
export function roundTimeStringToInterval(
  timeString: string,
  intervalMinutes: number = 15
): string {
  const timestamp = new Date(timeString);
  const rounded = roundToNearestInterval(timestamp, intervalMinutes);
  return rounded.toISOString();
}

/**
 * Formats rounded time for display
 * @param timestamp - The timestamp to format
 * @param intervalMinutes - The interval used for rounding
 * @returns Formatted time string
 */
export function formatRoundedTime(
  timestamp: Date,
  intervalMinutes: number = 15
): string {
  const rounded = roundToNearestInterval(timestamp, intervalMinutes);
  return rounded.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

