import { processReferralCashbacks } from "../services/referralCashbackService.js";
import logger from "../services/logger.js";

// Every 10 minutes by default — cashback only becomes due once a return
// window (hours/days) has closed, so there is no need to run more often.
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

const runReferralCashbackJob = async () => {
  try {
    await processReferralCashbacks();
  } catch (error) {
    logger.error("Referral cashback job failed", {
      jobName: "referralCashbackJob",
      error: error.message,
      stack: error.stack,
    });
  }
};

export const getReferralCashbackJobHandler = () => runReferralCashbackJob;

export const getReferralCashbackJobInterval = () =>
  parseInt(process.env.REFERRAL_CASHBACK_JOB_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`, 10) ||
  DEFAULT_INTERVAL_MS;

export default runReferralCashbackJob;
