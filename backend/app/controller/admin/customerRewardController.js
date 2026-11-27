import handleResponse from "../../utils/helper.js";
import {
  approveReward,
  creditReward,
  exportRewardsCsv,
  getRewardConfig,
  listRewards,
  reverseReward,
  simulateRewards,
  updateRewardConfig,
} from "../../services/customerRewardService.js";

const fail = (res, error) => handleResponse(res, error.statusCode || 500, error.message);

export const getCustomerRewardConfig = async (req, res) => {
  try {
    return handleResponse(res, 200, "Reward config", await getRewardConfig());
  } catch (error) {
    return fail(res, error);
  }
};

export const updateCustomerRewardConfig = async (req, res) => {
  try {
    const config = await updateRewardConfig(req.body || {});
    return handleResponse(res, 200, "Reward settings saved", config);
  } catch (error) {
    return fail(res, error);
  }
};

export const getCustomerRewards = async (req, res) => {
  try {
    return handleResponse(res, 200, "Rewards", await listRewards(req.query || {}));
  } catch (error) {
    return fail(res, error);
  }
};

export const simulateCustomerRewards = async (req, res) => {
  try {
    const { fromDate, toDate, slabs, assumeSettled } = req.body || {};
    return handleResponse(res, 200, "Simulation (no wallets touched)", await simulateRewards({ fromDate, toDate, slabs, assumeSettled: assumeSettled === true }));
  } catch (error) {
    return fail(res, error);
  }
};

export const approveCustomerReward = async (req, res) => {
  try {
    const reward = await approveReward(req.params.id, { by: req.user?.id, note: req.body?.note || "" });
    return handleResponse(res, 200, "Reward approved", reward);
  } catch (error) {
    return fail(res, error);
  }
};

export const creditCustomerReward = async (req, res) => {
  try {
    const reward = await creditReward(req.params.id, { by: req.user?.id });
    return handleResponse(res, 200, "Reward credited to wallet", reward);
  } catch (error) {
    return fail(res, error);
  }
};

export const reverseCustomerReward = async (req, res) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (!note) return handleResponse(res, 400, "A reason is required to reverse a reward");
    const reward = await reverseReward(req.params.id, { by: req.user?.id, note });
    return handleResponse(res, 200, "Reward reversed", reward);
  } catch (error) {
    return fail(res, error);
  }
};

export const exportCustomerRewards = async (req, res) => {
  try {
    const csv = await exportRewardsCsv(req.query || {});
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="reward-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(`﻿${csv}`);
  } catch (error) {
    return fail(res, error);
  }
};
