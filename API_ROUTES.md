# API Routes Documentation

Since this is a Vite React app (not Next.js), API routes need to be implemented separately. You have two options:

## Option 1: Supabase Edge Functions (Recommended)

Create Supabase Edge Functions for serverless API routes.

### Setup Edge Functions

1. Install Supabase CLI: `npm install -g supabase`
2. Initialize: `supabase functions new checkout`
3. Deploy: `supabase functions deploy checkout`

### Required Edge Functions

#### 1. `/api/checkout` (POST)
Location: `supabase/functions/checkout/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { priceId, email, businessName, tier } = await req.json()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        business_name: businessName,
        subscription_tier: tier,
      },
      success_url: `${Deno.env.get('APP_URL')}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('APP_URL')}/pricing`,
    })

    return new Response(
      JSON.stringify({ sessionId: session.id }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

#### 2. `/api/webhooks/stripe` (POST)
Location: `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  
  if (!signature || !webhookSecret) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase)
      break
  }

  return new Response(JSON.stringify({ received: true }))
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: any) {
  // Create user in Supabase Auth
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: session.customer_email,
    email_confirm: false,
    user_metadata: {
      business_name: session.metadata?.business_name,
    },
  })

  if (userError || !user) {
    console.error('Error creating user:', userError)
    return
  }

  // Create business record
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name: session.metadata?.business_name || 'New Business',
      email: session.customer_email || '',
      subscription_tier: session.metadata?.subscription_tier || 'basic',
      subscription_status: 'trialing',
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (businessError || !business) {
    console.error('Error creating business:', businessError)
    return
  }

  // Link profile to business
  await supabase
    .from('profiles')
    .update({ business_id: business.id })
    .eq('id', user.user.id)

  // Send welcome email via Resend
  // TODO: Implement Resend email sending
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
  await supabase
    .from('businesses')
    .update({
      subscription_status: subscription.status === 'active' ? 'active' : 'past_due',
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
  await supabase
    .from('businesses')
    .update({
      subscription_status: 'canceled',
      subscription_ends_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
}
```

#### 3. `/api/admin/impersonate` (POST)
Location: `supabase/functions/admin-impersonate/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check if user is super admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return new Response('Forbidden', { status: 403 })
  }

  const { businessId } = await req.json()

  // Call database function to generate token
  const { data, error } = await supabase.rpc('generate_impersonation_token', {
    target_business_id: businessId,
  })

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate token' }),
      { status: 400 }
    )
  }

  const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'
  const impersonateUrl = `${appUrl}/admin/impersonate/${data.token}`

  return new Response(
    JSON.stringify({
      token: data.token,
      expiresAt: data.expires_at,
      impersonateUrl,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

## Option 2: Separate Express/Node.js Backend

Create a separate Node.js/Express server for API routes.

### Setup

1. Create `server/` directory
2. Install dependencies: `npm install express stripe @supabase/supabase-js resend`
3. Create `server/index.ts` with all API routes
4. Run server: `npm run dev:server`

## Environment Variables for Edge Functions

Set these in Supabase Dashboard → Project Settings → Edge Functions:

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APP_URL=https://yourdomain.com
RESEND_API_KEY=re_...
```

## Frontend API Calls

Update frontend to call Edge Functions:

```typescript
// In Pricing.tsx
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkout`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ priceId, email, businessName, tier }),
  }
)
```
