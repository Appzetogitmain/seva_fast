import ChatSession from "../../models/chatbot/chatSession.js";
import ChatMessage, { isRawMessageRetentionEnabled } from "../../models/chatbot/chatMessage.js";
import ChatbotUserStats from "../../models/chatbot/chatbotUserStats.js";
import ChatbotModeration from "../../models/chatbot/chatbotModeration.js";
import { classifySessionIfDue } from "./chatClassificationService.js";

const CLASSIFY_EVERY_N_MESSAGES = parseInt(process.env.CHATBOT_CLASSIFY_EVERY_N_MESSAGES || "4", 10);

function extractText(parts = []) {
  return parts
    .filter((p) => typeof p?.text === "string")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

// Builds a compact transcript string from Gemini `contents`-style messages,
// used only in-memory for classification prompts — never persisted verbatim
// unless CHATBOT_RAW_MESSAGE_RETENTION_DAYS is explicitly turned on.
export function buildTranscript(messages = []) {
  return messages
    .map((m) => {
      if (m.parts?.some((p) => p.functionCall)) {
        const fc = m.parts.find((p) => p.functionCall)?.functionCall;
        return `[tool_call:${fc?.name || "unknown"}]`;
      }
      if (m.parts?.some((p) => p.functionResponse)) return null; // tool results are noisy, not conversational signal
      const text = extractText(m.parts || []);
      if (!text) return null;
      return `${m.role === "user" ? "User" : "Assistant"}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Records one chat turn (user message + assistant reply) against a session,
 * and fires an async classification pass every N messages. Never throws —
 * analytics/moderation tracking must not be able to break the chat itself.
 */
export async function trackChatTurn({ sessionId, role, userRef = null, anonymousId = null, messages, replyText, guardrailFlags = [] }) {
  if (!sessionId) return;
  try {
    const session = await ChatSession.findOneAndUpdate(
      { sessionId },
      {
        $setOnInsert: { sessionId, role, userRef, anonymousId, startedAt: new Date(), status: "active" },
        $set: { lastMessageAt: new Date() },
        $inc: { messageCount: 1 },
      },
      { upsert: true, new: true },
    );

    const isNewSession = session.messageCount === 1;

    if (isRawMessageRetentionEnabled()) {
      const lastUserText = extractText(messages?.[messages.length - 1]?.parts || []);
      const rows = [
        lastUserText ? { sessionId, role: "user", text: lastUserText } : null,
        replyText ? { sessionId, role: "model", text: replyText } : null,
      ].filter(Boolean);
      if (rows.length > 0) await ChatMessage.insertMany(rows);
    }

    const statsFilter = userRef ? { role, userRef } : { role, anonymousId };
    await ChatbotUserStats.updateOne(
      statsFilter,
      {
        $setOnInsert: { role, userRef, anonymousId },
        $set: { lastSessionAt: new Date() },
        $inc: { totalMessages: 1, totalSessions: isNewSession ? 1 : 0 },
      },
      { upsert: true },
    );

    if (guardrailFlags.length > 0) {
      await ChatbotModeration.create({
        sessionId,
        role,
        userRef,
        anonymousId,
        riskLevel: "HIGH",
        flags: guardrailFlags.map((f) => `output_leak:${f}`),
        reason: "Server-side output guardrail redacted a potential secret/credential leak in the AI reply.",
        snippet: "[redacted before storage]",
      });
      await ChatbotUserStats.updateOne(statsFilter, { $inc: { highRiskCount: 1 } });
    }

    const dueForClassification =
      session.messageCount >= 2 &&
      (session.lastClassifiedMessageCount === 0 ||
        session.messageCount - session.lastClassifiedMessageCount >= CLASSIFY_EVERY_N_MESSAGES);

    if (dueForClassification) {
      const transcript = buildTranscript([...(messages || []), { role: "model", parts: [{ text: replyText }] }]);
      setImmediate(() => {
        classifySessionIfDue({
          sessionId,
          role,
          userRef,
          anonymousId,
          transcript,
          messageCount: session.messageCount,
        }).catch((err) => console.error("[Chatbot] classification failed:", err.message));
      });
    }
  } catch (err) {
    console.error("[Chatbot] trackChatTurn failed:", err.message);
  }
}

export async function markSessionEnded(sessionId) {
  if (!sessionId) return;
  try {
    await ChatSession.updateOne({ sessionId }, { $set: { status: "ended" } });
  } catch (err) {
    console.error("[Chatbot] markSessionEnded failed:", err.message);
  }
}
