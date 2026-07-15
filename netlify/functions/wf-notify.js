// WorldFirst (万里汇) payment notification webhook
// WorldFirst calls this after a payment finishes. We verify the signature
// (using WorldFirst's platform public key) and acknowledge receipt so they
// stop retrying. Parse the body here to mark the order as paid.
//
// Optional env var:
//   WF_PLATFORM_PUBLIC_KEY – WorldFirst's public key (PEM) for verifying
//                            notifications. If unset, verification is skipped
//                            (dev only — enable in production).

const crypto = require("crypto");

function verify(clientId, responseTime, body, signature) {
  const pub = (process.env.WF_PLATFORM_PUBLIC_KEY || "").replace(/\\n/g, "\n");
  if (!pub) return true; // not configured -> skip (dev)
  const content = `${clientId}\n${responseTime}\n${body}`;
  try {
    return crypto
      .createVerify("RSA-SHA256")
      .update(content)
      .verify(pub, signature, "base64");
  } catch (e) {
    return false;
  }
}

const ACK = JSON.stringify({
  result: { resultStatus: "S", resultCode: "SUCCESS", resultMessage: "success" },
});

exports.handler = async (event) => {
  try {
    const clientId = event.headers["client-id"];
    const responseTime = event.headers["response-time"];
    const sigHeader = event.headers["signature"] || "";
    const m = sigHeader.match(/signature=([^,]+)/);
    const signature = m ? m[1] : "";
    const body = event.body || "";

    if (!verify(clientId, responseTime, body, signature)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          result: { resultStatus: "F", resultCode: "VERIFY_FAILED", resultMessage: "bad signature" },
        }),
      };
    }

    // TODO: parse `body` (payment result) and mark the order as paid in your
    // system / send a confirmation email. For now we just acknowledge.
  } catch (e) {
    // still acknowledge so WorldFirst doesn't keep retrying
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: ACK,
  };
};
