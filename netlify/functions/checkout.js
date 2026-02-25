const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ── PRICE ID MAP ─────────────────────────────────────────────────────────────
// Replace each placeholder with your real Price ID from Stripe Dashboard
// Stripe Dashboard → Products → click product → copy Price ID (price_xxx...)
const PRICE_IDS = {
  'Short Sleeve':'price_1T4XbiPfOXaPKmBfRTaPX8dy',
  'Long Sleeve':'price_1T4bEHPfOXaPKmBfdlLhAhMl',
  'Futsal Tigers':'price_1T4bEFPfOXaPKmBfAdQpkhSA',
  'Stickers':'price_1T4bEAPfOXaPKmBfOuwDtMrI',
  'Pins':'price_1T4bE5PfOXaPKmBfhyi2sdCI',
};

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items } = JSON.parse(event.body);
    // items = [{ name: 'Short Sleeve', size: 'M', qty: 2 }, ...]

    if (!items || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No items in cart' }) };
    }

    // Build Stripe line items
    const lineItems = items.map(item => {
      const priceId = PRICE_IDS[item.name];
      if (!priceId) throw new Error(`Unknown product: ${item.name}`);
      return {
        price: priceId,
        quantity: item.qty,
        // Pass size as metadata via adjustable_quantity or description
      };
    });

    // Build order description with sizes for reference
    const orderNote = items
      .map(i => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty}`)
      .join(', ');

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US'],
      },
      custom_text: {
        submit: {
          message: `Order: ${orderNote} — Sizes are noted above. Double-check before completing.`,
        },
      },
      metadata: {
        order_items: orderNote,
      },
      success_url: `${process.env.URL}/store?success=true`,
      cancel_url:  `${process.env.URL}/store?cancelled=true`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
