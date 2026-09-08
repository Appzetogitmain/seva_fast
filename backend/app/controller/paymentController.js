import handleResponse from "../utils/helper.js";
import {
  createPaymentOrderForOrderRef,
  verifyRazorpayPaymentStatus,
  processRazorpayWebhook,
} from "../services/paymentService.js";
import {
  createPaymentOrderSchema,
  verifyPaymentClientSchema,
  validateSchema,
} from "../validation/paymentValidation.js";

function resolvePaymentErrorMessage(error) {
  if (error?.statusCode === 401 || error?.status === 401 || error?.error?.description?.includes?.("Authentication failed")) {
    return "Razorpay Authentication Failed: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env is invalid or expired.";
  }

  const directMessage = String(error?.message || "").trim();
  if (directMessage) return directMessage;

  const responseStatusText = String(error?.response?.statusText || "").trim();
  if (responseStatusText) return `Razorpay gateway error: ${responseStatusText}`;

  const causeCode = String(error?.cause?.code || error?.code || "").trim();
  if (causeCode) return `Razorpay gateway request failed (${causeCode})`;

  return "Unable to initiate payment with Razorpay right now";
}

export const createPaymentOrder = async (req, res) => {
  try {
    const payload = validateSchema(createPaymentOrderSchema, req.body || {});
    const result = await createPaymentOrderForOrderRef({
      orderRef: payload.orderRef || payload.orderId,
      userId: req.user?.id,
      idempotencyKey: req.headers["idempotency-key"] || null,
      correlationId: req.correlationId || null,
    });

    return handleResponse(
      res,
      result.duplicate ? 200 : 201,
      result.duplicate ? "Re-using existing payment" : "Payment initiated",
      {
        payment: result.payment,
        razorpayOrderId: result.razorpayOrderId,
        amount: result.amount,
        currency: result.currency,
        razorpayKey: result.razorpayKey,
        keyId: result.razorpayKey,
        merchantOrderId: result.merchantOrderId,
      },
    );
  } catch (error) {
    console.error("[PaymentController] createPaymentOrder failed", {
      message: error?.message,
      statusCode: error?.statusCode || error?.status || 500,
      code: error?.code || error?.cause?.code || null,
      responseStatus: error?.response?.status || null,
      responseStatusText: error?.response?.statusText || null,
      orderRef: req.body?.orderRef || req.body?.orderId || null,
      userId: req.user?.id || null,
      correlationId: req.correlationId || null,
    });
    return handleResponse(
      res,
      error.statusCode || error.status || 500,
      resolvePaymentErrorMessage(error),
    );
  }
};

export const verifyPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const merchantOrderId = id || req.query.merchantOrderId;

    if (!merchantOrderId) {
      return handleResponse(res, 400, "merchantOrderId is required");
    }

    const verification = await verifyRazorpayPaymentStatus({
      merchantOrderId,
      userId: req.user?.id,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Payment status verified", {
      status: verification.status,
      payment: verification.payment,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const verifyPaymentClient = async (req, res) => {
  try {
    const payload = validateSchema(verifyPaymentClientSchema, req.body || {});
    const verification = await verifyRazorpayPaymentStatus({
      merchantOrderId: payload.merchantOrderId,
      userId: req.user?.id,
      razorpayPaymentId: payload.razorpay_payment_id || payload.transactionId || null,
      razorpaySignature: payload.razorpay_signature || null,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Payment verified", {
      status: verification.status,
      payment: verification.payment,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body;

    if (!signature) {
      console.warn("[RazorpayWebhook] Missing x-razorpay-signature header");
      return res.status(401).send("Unauthorized");
    }

    const result = await processRazorpayWebhook({
      rawBody,
      signature,
      correlationId: req.correlationId || null,
    });

    if (result.accepted) {
      return res.status(200).send("OK");
    }

    return res.status(400).send("Bad Request");
  } catch (error) {
    console.error("[RazorpayWebhook] Error processing webhook:", error.message);
    return res.status(error.statusCode === 401 ? 401 : 500).send(error.message);
  }
};

export const getRazorpayConfig = async (req, res) => {
  try {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    if (!keyId) {
      return handleResponse(res, 500, "Razorpay is not configured");
    }

    return handleResponse(res, 200, "Razorpay config loaded", {
      keyId,
      razorpayKey: keyId,
      gateway: "RAZORPAY",
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const merchantOrderId = id;

    const verification = await verifyRazorpayPaymentStatus({
      merchantOrderId,
      userId: req.user?.id,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Payment status retrieved", {
      status: verification.status,
      merchantOrderId: verification.payment.gatewayOrderId,
      amount: verification.payment.amount,
      currency: verification.payment.currency,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
