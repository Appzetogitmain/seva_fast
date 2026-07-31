let razorpayPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }
  
  if (razorpayPromise) {
    return razorpayPromise;
  }

  razorpayPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayPromise;
}

export function resolveRazorpayCheckoutPayload(paymentResult = {}) {
  const payment = paymentResult.payment || {};
  return {
    razorpayKey:
      paymentResult.razorpayKey ||
      paymentResult.keyId ||
      paymentResult.key ||
      import.meta.env.VITE_RAZORPAY_KEY_ID ||
      "",
    razorpayOrderId:
      paymentResult.razorpayOrderId ||
      paymentResult.merchantOrderId ||
      paymentResult.orderId ||
      payment.gatewayOrderId ||
      "",
    amount: Number(
      paymentResult.amount ||
        payment.amount ||
        paymentResult.payment?.amount ||
        0,
    ),
    currency:
      paymentResult.currency ||
      payment.currency ||
      paymentResult.payment?.currency ||
      "INR",
  };
}

export async function launchOrderRazorpayPayment({
  paymentResult,
  description = "Order payment",
  prefill = {},
  onVerified,
}) {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
  }

  const payload = resolveRazorpayCheckoutPayload(paymentResult);
  if (!payload.razorpayOrderId) {
    throw new Error("Razorpay order details were not returned by the server.");
  }
  if (!payload.razorpayKey) {
    throw new Error("Razorpay payment key is not configured.");
  }
  if (!payload.amount || payload.amount <= 0) {
    throw new Error("Invalid payment amount for Razorpay checkout.");
  }

  return new Promise((resolve, reject) => {
    const options = {
      key: payload.razorpayKey,
      amount: payload.amount,
      currency: payload.currency || "INR",
      name: "Seva Fast",
      description,
      order_id: payload.razorpayOrderId,
      handler: async (response) => {
        try {
          const result = await onVerified(response);
          resolve({ cancelled: false, ...result });
        } catch (error) {
          reject(error);
        }
      },
      prefill,
      theme: {
        color: "#0f172a",
      },
      modal: {
        ondismiss: () => resolve({ cancelled: true }),
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        reject(new Error(response?.error?.description || "Payment failed"));
      });
      rzp.open();
    } catch (error) {
      reject(error);
    }
  });
}

export async function openRazorpayCheckout({
  razorpayKey,
  razorpayOrderId,
  amount,
  currency = "INR",
  name = "Seva Fast",
  description = "Order payment",
  prefill = {},
  onSuccess,
  onFailure,
}) {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
  }

  if (!razorpayKey || !razorpayOrderId) {
    throw new Error("Razorpay payment details are missing. Please try again.");
  }

  return new Promise((resolve, reject) => {
    const options = {
      key: razorpayKey,
      amount,
      currency,
      name,
      description,
      order_id: razorpayOrderId,
      handler: async (response) => {
        try {
          const result = await onSuccess(response);
          resolve({ cancelled: false, ...result });
        } catch (error) {
          reject(error);
        }
      },
      prefill,
      theme: {
        color: "#0f172a",
      },
      modal: {
        ondismiss: () => {
          const error = new Error("Payment cancelled");
          error.code = "PAYMENT_CANCELLED";
          if (onFailure) onFailure(error);
          resolve({ cancelled: true });
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        const error = new Error(response?.error?.description || "Payment failed");
        if (onFailure) onFailure(error);
        reject(error);
      });
      rzp.open();
    } catch (error) {
      reject(error);
    }
  });
}
