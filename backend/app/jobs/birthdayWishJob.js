import { processBirthdayWishes } from "../services/birthdayWishService.js";
import logger from "../services/logger.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export const isBirthdayWishJobEnabled = () =>
  String(process.env.BIRTHDAY_WISH_ENABLED || "true").toLowerCase() !== "false";

export const getBirthdayWishJobInterval = () =>
  parseInt(process.env.BIRTHDAY_WISH_JOB_INTERVAL_MS || SIX_HOURS_MS, 10);

export const getBirthdayWishJobHandler = () => async () => {
  if (!isBirthdayWishJobEnabled()) {
    return;
  }

  logger.info("Starting Birthday Wish Job");
  try {
    await processBirthdayWishes();
  } catch (error) {
    logger.error("Birthday Wish Job Error", {
      error: error.message,
      stack: error.stack,
    });
  }
};
