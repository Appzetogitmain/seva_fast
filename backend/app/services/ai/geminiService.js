import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

let client = null;

/**
 * Typed error for AI service failures — controllers map `.code` to a
 * user-facing status/message instead of leaking raw SDK errors.
 */
export class AiServiceError extends Error {
  constructor(message, code = "AI_ERROR", cause) {
    super(message);
    this.name = "AiServiceError";
    this.code = code;
    this.cause = cause;
  }
}

function getClient() {
  if (!apiKey) {
    throw new AiServiceError("GEMINI_API_KEY not configured", "NOT_CONFIGURED");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Single entry point every AI feature builds on: sends a prompt and gets
 * back parsed JSON matching `responseSchema`, using Gemini's native
 * structured-output support (no manual "please respond in JSON" prompting
 * or free-text parsing).
 */
export async function generateStructuredJson({
  prompt,
  responseSchema,
  systemInstruction,
  temperature = 0.4,
  timeoutMs = 15000,
}) {
  let response;
  let timeoutHandle;
  try {
    const ai = getClient();
    response = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          systemInstruction,
          temperature,
        },
      }),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new AiServiceError("Gemini request timed out", "TIMEOUT")),
          timeoutMs,
        );
      }),
    ]);
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    const status = err?.status || err?.response?.status;
    const code =
      status === 429 ? "RATE_LIMITED" : status >= 500 ? "UPSTREAM_ERROR" : "AI_ERROR";
    throw new AiServiceError(err.message || "Gemini request failed", code, err);
  } finally {
    clearTimeout(timeoutHandle);
  }

  try {
    return JSON.parse(response.text);
  } catch (err) {
    throw new AiServiceError("Gemini returned invalid JSON", "PARSE_ERROR", err);
  }
}

export async function generateChatResponse({
  messages,
  systemInstruction,
  tools = [],
  temperature = 0.5,
}) {
  try {
    const ai = getClient();
    const config = {
      systemInstruction,
      temperature,
    };
    if (tools.length > 0) {
      config.tools = [{ functionDeclarations: tools }];
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: messages,
      config,
    });
    return response;
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    const status = err?.status || err?.response?.status;
    const code = status === 429 ? "RATE_LIMITED" : status >= 500 ? "UPSTREAM_ERROR" : "AI_ERROR";
    throw new AiServiceError(err.message || "Gemini chat request failed", code, err);
  }
}

export async function analyzeImageForSearch({
  imageBuffer,
  mimeType,
  prompt,
}) {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType,
              },
            },
          ],
        },
      ],
    });
    return response.text;
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    throw new AiServiceError(err.message || "Gemini image analysis failed", "AI_ERROR", err);
  }
}

export async function analyzeImageStructuredJson({
  imageBuffer,
  mimeType,
  prompt,
  systemInstruction,
  responseSchema,
}) {
  try {
    const ai = getClient();
    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBuffer.toString("base64"),
              mimeType,
            },
          },
        ],
      },
    ];

    const config = {
      responseMimeType: "application/json",
      responseSchema,
    };
    if (systemInstruction) config.systemInstruction = systemInstruction;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config,
    });

    return JSON.parse(response.text);
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    throw new AiServiceError(err.message || "Gemini vision analysis failed", "AI_ERROR", err);
  }
}

