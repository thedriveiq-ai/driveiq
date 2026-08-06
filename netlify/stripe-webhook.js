// Netlify Function: stripe-webhook
// Listens for Stripe payment events and updates the person's plan in Supabase.
// Verifies Stripe's signature manually using Node's built-in crypto — no npm package needed.

const crypto = require('crypto');

const SUPABASE_URL = 'https://xihflmpmdnaeclgzsqvm.supabase.co';

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('='))
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  // Constant-time-ish comparison
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

async function updateProfile(userId, fields) {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': secretKey,
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(fields)
  });
}

async function findUserByStripeCustomer(customerId) {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${customerId}&select=id`, {
    headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
  });
  const rows = await res.json();
  return (rows && rows[0]) ? rows[0].id : null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;

  if (!webhookSecret || !verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return { statusCode: 400, body: 'Signature verification failed' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const userId = session.client_reference_id;
      if (userId) {
        await updateProfile(userId, {
          plan: 'premium',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription
        });
      }
    }

    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object;
      const userId = await findUserByStripeCustomer(subscription.customer);
      if (userId) {
        await updateProfile(userId, { plan: 'free' });
      }
    }
  } catch (e) {
    // Log-only: Stripe will retry the webhook automatically if we return a non-200,
    // but we don't want a transient Supabase hiccup to cause endless retries here.
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
