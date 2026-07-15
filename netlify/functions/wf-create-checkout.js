// WorldFirst (万里汇) Cashier Payment — create order
// Called from the checkout form. Builds a createCashierPayment request,
// signs it with RSA-SHA256, and returns the redirect URL to WorldFirst's
// hosted checkout page.
//
// Required Netlify env vars:
//   WF_CLIENT_ID      – from 开发者中心 (Developer Center)
//   WF_PRIVATE_KEY    – RSA private key (PEM) used to sign requests
//   WF_API_BASE       – e.g. https://openapi-sandbox.worldfirst.com (or production)
//   WF_KEY_VERSION    – key version shown in 开发者中心 (usually "1")
//   SITE_URL          – your site URL, e.g. https://<site>.netlify.app

const crypto = require("crypto");

function sign(method, uri, clientId, requestTime, body) {
  const content = `${method}\n${uri}\n${clientId}\n${requestTime}\n${body}`;
  return crypto.createSign("RSA-SHA256").update(content).sign(WF_PRIVATE_KEY(), "base64");
}

// private key may be passed with \n escaped; normalise to real newlines
function WF_PRIVATE_KEY() {
  return (process.env.WF_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function requestTime() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const oh = p(Math.floor(Math.abs(off) / 60));
  const om = p(Math.abs(off) % 60);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}${sign}${oh}:${om}`;
}

function rid(prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: "Method Not Allowed" };

  const clientId = process.env.WF_CLIENT_ID;
  const apiBase = (process.env.WF_API_BASE || "").replace(/\/$/, "");
  const keyVersion = process.env.WF_KEY_VERSION || "1";
  const siteUrl = (process.env.SITE_URL || "https://dingjiang1688.github.io").replace(/\/$/, "");

  if (!clientId || !apiBase || !process.env.WF_PRIVATE_KEY)
    return { statusCode: 500, body: JSON.stringify({ error: "Missing WorldFirst config" }) };

  try {
    const cart = JSON.parse(event.body || "{}");
    const items = cart.items || [];
    if (!items.length)
      return { statusCode: 400, body: JSON.stringify({ error: "Cart is empty" }) };

    const currency = "USD";
    const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty || 1), 0);
    const shipping = Number(cart.shipping || 0);
    const total = (subtotal + shipping).toFixed(2);

    const orderGroupId = rid("LF");
    const refOrderId = rid("ORD");
    const payToRequestId = rid("PR");

    const bodyObj = {
      orderGroup: {
        orderBuyer: { referenceBuyerId: cart.customer_email || "guest" },
        orderGroupDescription: "Lume Home order",
        orderGroupId,
        orders: [
          {
            orderTotalAmount: { currency, value: total },
            orderDescription: "Lume Home order",
            referenceOrderId: refOrderId,
            transactionTime: new Date().toISOString(),
          },
        ],
      },
      industryProductCode: "ONLINE_DIRECT_PAY",
      paymentRedirectUrl: `${siteUrl}/cart.html?placed=1`,
      payToDetails: [
        {
          payToRequestId,
          payToAmount: { currency, value: total },
          payToMethod: {
            paymentMethodType: "BALANCE",
            paymentMethodDataType: "PAYMENT_ACCOUNT_NO",
            paymentMethodData: "",
          },
          paymentNotifyUrl: `${siteUrl}/.netlify/functions/wf-notify`,
          referenceOrderId: refOrderId,
        },
      ],
    };

    const uri = "/amsin/api/v1/business/create";
    const body = JSON.stringify(bodyObj);
    const rt = requestTime();
    const signature = sign("POST", uri, clientId, rt, body);

    const res = await fetch(`${apiBase}${uri}`, {
      method: "POST",
      headers: {
        "Client-Id": clientId,
        Signature: `algorithm=RSA256,keyVersion=${keyVersion},signature=${signature}`,
        "Content-Type": "application/json; charset=UTF-8",
        "Request-Time": rt,
      },
      body,
    });

    const data = await res.json();

    if (data.result && data.result.resultStatus === "S") {
      const actionForm = JSON.parse(data.actionForm);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: actionForm.redirectUrl }),
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: data.result || "WorldFirst rejected the order" }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
