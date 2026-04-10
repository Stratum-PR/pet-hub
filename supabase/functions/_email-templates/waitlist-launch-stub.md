# Launch email (Email 3) — stub for Resend / Edge Function

Copy into a new sender when Grumi goes live. Subjects:

- **ES:** ¡Grumi está LIVE! Activa tu Precio Fundador
- **EN:** Grumi is LIVE! Activate your Founder's Price

Body outline:

- Logo + headline: launch day
- CTA: create account with founder price auto-applied (link TBD)
- Urgency: Precio Fundador expires in 14 days
- 3–4 feature bullets
- Footer: Stratum PR LLC · Trujillo Alto, PR

Implement as inline HTML next to `waitlist_email_html.ts` or a dedicated `waitlist-launch-email.ts` when sending from a cron or one-off script.
