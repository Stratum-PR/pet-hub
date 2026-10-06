# Appointment notifications (email and SMS)

When staff confirm, decline or propose a new time for an online request, or cancel an appointment,
the client is told through the channel they chose (`clients.contact_preference`: `email`, `sms` or `none`).
If the preferred channel isn't possible (no email on file, SMS not configured), the other channel is used.
The message never says which staff member made the decision; that is stored only in
`appointments.decided_by_staff_id` / `decided_by_profile_id` for the team.

Every attempt is logged in `public.appointment_notifications` (sent / skipped / failed, with the provider
error for failures), so you can see what happened without checking the provider dashboard.

Code: `supabase/functions/notify-appointment/index.ts` (called from `src/lib/appointmentNotifications.ts`).

## 1. Email first (free, already set up)

The project already sends email through [Resend](https://resend.com) (`RESEND_API_KEY`, sender
`noreply@stratumpr.com`). Resend's free plan allows 100 emails/day and 3,000/month, which is plenty for testing.

```bash
# from the repo root, logged in to the Supabase CLI and linked to the project
supabase db push                                   # applies 20261005120000_scheduling_overhaul.sql
supabase functions deploy notify-appointment       # JWT is verified (see supabase/config.toml)
supabase secrets set ALLOWED_ORIGINS="https://<your-app-domain>,http://localhost:8080"
# Optional: a different sender (must be on a domain verified in Resend)
supabase secrets set NOTIFY_FROM_EMAIL="Grumi <citas@stratumpr.com>"
```

`notify-appointment` uses `NOTIFY_RESEND_API_KEY` when it is set (a key just for appointment emails) and
otherwise falls back to the shared `RESEND_API_KEY` used by the other email functions.

```bash
supabase secrets set NOTIFY_RESEND_API_KEY="re_…"   # paste the key here, never in chat or in git
```

Test: create a client with your own email and contact preference "Correo", open the booking link
(`/<slug>/reservar`), send a request, then confirm it in **Citas → Solicitudes en línea**.
Check the toast ("se le avisó por correo") and the `appointment_notifications` table.

## 2. SMS (Twilio trial, free to test)

A Twilio trial includes about 100 SMS for 30 days and can only text phone numbers you verify
in the Twilio console (up to 5). That is enough to test with your own phones.

1. Sign up at twilio.com, verify your phone, and get a trial number.
2. Add the phones you'll test with under *Verified Caller IDs*.
3. Set the secrets:

```bash
supabase secrets set TWILIO_ACCOUNT_SID="AC…" TWILIO_AUTH_TOKEN="…" TWILIO_FROM_NUMBER="+1…"
```

No redeploy is needed; the function reads secrets on each call. Clients with preference "SMS" now get texts.

**Before real clients:** texting arbitrary US numbers requires a paid Twilio account and carrier
registration (A2P 10DLC for a local number, or toll-free verification). Registration can take days to weeks,
so start it early. Until then, leave SMS clients on the email fallback.

## Never commit secrets

Secrets live only in Supabase (`supabase secrets set`) or Vercel environment variables.
`.env` is ignored by git; only `.env.example` (placeholders) is committed.
