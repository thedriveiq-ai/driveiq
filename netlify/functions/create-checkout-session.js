// Netlify Function: create-checkout-session
// Creates a Stripe Checkout session for SafVia Premium and returns its URL for redirect.
// Uses Stripe's plain REST API via fetch — no npm package needed, so nothing extra to bundle.

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';
const PRICE_ID = 'price_1U0ioTHZsHyH8AQ7qkJC2nV8'; // SafVia Premium, £6.99/month

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 200, body: JSON.stringify({ error: 'Billing is not configured yet' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { userId, email } = body;
  if (!userId || !email) {
    return { statusCode: 200, body: JSON.stringify({ error: 'Missing account details' }) };
  }

  const origin = event.headers.origin || 'https://safvia.co.uk';

  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', PRICE_ID);
  params.append('line_items[0][quantity]', '1');
  params.append('client_reference_id', userId);
  params.append('customer_email', email);
  params.append('success_url', `${origin}/?checkout=success`);
  params.append('cancel_url', `${origin}/?checkout=cancelled`);

  try {
    const res = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const data = await res.json();
    if (data.error) {
      return { statusCode: 200, body: JSON.stringify({ error: data.error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ url: data.url }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ error: 'Could not start checkout: ' + err.message }) };
  }
};
