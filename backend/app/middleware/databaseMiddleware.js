import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";

export function ensureDatabaseConnected(req, res, next) {
  const readyState = mongoose.connection.readyState;

  if (readyState === 1) {
    return next();
  }

  const statusCode = 503;
  const message =
    readyState === 2
      ? "Database is connecting. Please retry in a moment."
      : "Database is temporarily unavailable. Please retry in a moment.";

  return handleResponse(res, statusCode, message, {
    code: "DATABASE_UNAVAILABLE",
    readyState,
  });
}
