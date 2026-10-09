// Pure helpers for the reminder email (no Deno or network APIs, so Vitest can test them under Node).

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type GreetingClient = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined;

/**
 * HTML-escaped greeting: `clients.name` when set (it is optional since P0-06), else `first_name`
 * (like notify-appointment, which greets by first name only), else "Hola," with no trailing space.
 */
export function reminderGreeting(client: GreetingClient): string {
  const display = client?.name?.trim() || client?.first_name?.trim() || "";
  return display ? `Hola ${esc(display)}` : "Hola,";
}
