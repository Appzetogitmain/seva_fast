import ChatbotAccessControl from "../../models/chatbot/chatbotAccessControl.js";

const DURATION_MS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export async function getChatbotAccessStatus(role, userRef) {
  const doc = await ChatbotAccessControl.findOne({ role, userRef }).lean();
  return (
    doc || {
      role,
      userRef,
      status: "ACTIVE",
      reason: "",
      disabledUntil: null,
    }
  );
}

export async function disableChatbotAccess({ role, userRef, mode, duration, reason, adminId }) {
  const now = new Date();
  const update = {
    role,
    userRef,
    disabledAt: now,
    reason: reason || "",
    actionedBy: adminId,
  };

  if (mode === "permanent") {
    update.status = "PERMANENTLY_DISABLED";
    update.disabledUntil = null;
  } else {
    const durationMs = DURATION_MS[duration];
    if (!durationMs) {
      throw new Error("Invalid duration. Use one of: 1h, 24h, 7d");
    }
    update.status = "TEMPORARILY_DISABLED";
    update.disabledUntil = new Date(now.getTime() + durationMs);
  }

  const doc = await ChatbotAccessControl.findOneAndUpdate(
    { role, userRef },
    { $set: update },
    { upsert: true, new: true },
  );
  return doc;
}

export async function enableChatbotAccess({ role, userRef, reason, adminId }) {
  const doc = await ChatbotAccessControl.findOneAndUpdate(
    { role, userRef },
    {
      $set: {
        role,
        userRef,
        status: "ACTIVE",
        disabledAt: null,
        disabledUntil: null,
        reason: reason || "",
        actionedBy: adminId,
      },
    },
    { upsert: true, new: true },
  );
  return doc;
}
