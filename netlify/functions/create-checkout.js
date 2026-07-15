// ============================================================
//  Netlify Function — create a Stripe Checkout session
//  Called from the storefront with the cart; returns a Stripe
//  hosted-checkout URL. The Stripe secret key is read from the
//  site's environment variables (STRIPE_SECRET_KEY) on Netlify.
// ============================================================
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Stripe is not configured (set STRIPE_SECRET_KEY)." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const items = body.items || [];
  if (!items.length) {
    return { statusCode: 400, body: JSON.stringify({ error: "Cart is empty" }) };
  }

  const base = process.env.URL || event.headers.origin || "https://dingjiang1688.github.io";
  const shipping = Number(body.shipping) || 0;

  const line_items = items.map((it) => ({
    quantity: Math.max(1, parseInt(it.qty, 10) || 1),
    price_data: {
      currency: "usd",
      product_data: { name: it.name },
      unit_amount: Math.round(Number(it.price) * 100)
    }
  }));

  const shipping_options = [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: Math.round(shipping * 100), currency: "usd" },
        display_name: shipping > 0 ? "Standard shipping" : "Free shipping"
      }
    }
  ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_options,
      customer_email: body.customer_email,
      shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR"] },
      success_url: `${base}/cart.html?placed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cart.html`,
      metadata: { customer_name: body.customer_name || "" }
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
