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

Waitlist Edge Functions use a **single `index.ts` per function** (Supabase deploy often bundles only that file). Add launch email HTML inside a new function or script when sending from cron or one-off.
