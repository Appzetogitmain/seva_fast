import { processCustomerRewards } from "../services/customerRewardService.js";
import logger from "../services/logger.js";

// Every 15 minutes: cashback only becomes due after settlement + return
// window, and slabs only after month end, so there is no need to run often.
// The job does nothing until the admin enables reward payouts.
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

const runCustomerRewardJob = async () => {
  try {
    await processCustomerRewards();
  } catch (error) {
    logger.error("Customer reward job failed", {
      jobName: "customerRewardJob",
      error: error.message,
      stack: error.stack,
    });
  }
};

export const getCustomerRewardJobHandler = () => runCustomerRewardJob;

export const getCustomerRewardJobInterval = () =>
  parseInt(process.env.CUSTOMER_REWARD_JOB_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`, 10) || DEFAULT_INTERVAL_MS;

export default runCustomerRewardJob;
