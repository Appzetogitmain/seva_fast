import Notification from "./notification.model.js";
import PushToken from "./token.model.js";
import NotificationPreference from "./preference.model.js";
import {
  notificationQueue,
  notificationDeadQueue,
  NOTIFICATION_JOB_NAMES,
  getNotificationQueueStats,
} from "./notification.queue.js";
import { sendFCM } from "./firebase.service.js";
import {
  INVALID_FCM_TOKEN_CODES,
  NOTIFICATION_QUEUE_CONCURRENCY,
  NOTIFICATION_QUEUE_JOB_TIMEOUT_MS,
} from "./notification.constants.js";
import { isRedisEnabled } from "../../config/redis.js";
import logger from "../../services/logger.js";
import {
  incrementCounter,
  recordHistogram,
  setGauge,
} from "../../services/metrics.js";

function failedCodeOf(responseItem) {
  return String(responseItem?.error?.code || "").trim();
}

function shouldRetryForResponses(responses = []) {
  if (!responses.length) return true;
  for (const response of responses) {
    if (response?.success) return false;
    const code = failedCodeOf(response);
    if (!INVALID_FCM_TOKEN_CODES.has(code)) {
      return true;
    }
  }
  return false;
}

async function refreshQueueMetrics() {
  try {
    const stats = await getNotificationQueueStats();
    setGauge("notifications_queue_size", Number(stats.size || 0));
    setGauge("notifications_queue_waiting", Number(stats.waiting || 0));
    setGauge("notifications_queue_active", Number(stats.active || 0));
    setGauge("notifications_queue_failed", Number(stats.failed || 0));
  } catch (error) {
    logger.debug("Notification queue metrics refresh failed", {
      message: error.message,
    });
  }
}

async function deactivateInvalidTokens(tokens = [], responses = []) {
  const invalidUpdates = [];

  responses.forEach((response, index) => {
    if (response?.success) return;
    const code = failedCodeOf(response);
    if (!INVALID_FCM_TOKEN_CODES.has(code)) return;
    const tokenDoc = tokens[index];
    if (tokenDoc?._id) {
      let reason = "FCM_TOKEN_INVALID";
      if (code === "messaging/mismatched-credential") {
        reason = "FCM_SENDER_ID_MISMATCH";
        logger.warn("[NotificationWorker] Token rejected with SenderId mismatch", {
          tokenId: tokenDoc._id,
          platform: tokenDoc.platform,
          role: tokenDoc.role,
          message: "The mobile app was built with a different Firebase project than the backend service account. Align google-services.json or set FIREBASE_SERVICE_ACCOUNT_APP.",
        });
      }
      invalidUpdates.push({ id: tokenDoc._id, reason });
    }
  });

  if (!invalidUpdates.length) {
    return 0;
  }

  // Group by reason and batch update via updateMany
  const byReason = new Map();
  for (const item of invalidUpdates) {
    if (!byReason.has(item.reason)) {
      byReason.set(item.reason, []);
    }
    byReason.get(item.reason).push(item.id);
  }

  for (const [reason, ids] of byReason.entries()) {
    await PushToken.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          isActive: false,
          invalidReason: reason,
          invalidatedAt: new Date(),
          lastUsedAt: new Date(),
        },
      },
    );
  }

  incrementCounter("notifications_invalid_tokens_total", {}, invalidUpdates.length);
  return invalidUpdates.length;
}

export async function deliverNotificationById(notificationId) {
  if (!notificationId) {
    return;
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    return;
  }

  const preference = await NotificationPreference.findOne({
    userId: notification.userId,
    role: notification.role,
  }).lean();

  if (preference && preference.pushNotifications === false) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: "sent",
          failureReason: "Push notifications disabled by user preference",
          deliveryStats: {
            attempted: 0,
            sent: 0,
            failed: 0,
            invalidTokens: 0,
          },
        },
      },
    );
    incrementCounter("notifications_total", {
      status: "sent",
      eventType: notification.type,
      role: notification.role,
    });
    return;
  }

  const tokens = await PushToken.find({
    userId: notification.userId,
    role: notification.role,
    isActive: true,
  })
    .sort({ lastUsedAt: -1 })
    .lean();

  if (!tokens.length) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: "failed",
          failureReason: "No active push tokens for user",
          deliveryStats: {
            attempted: 0,
            sent: 0,
            failed: 0,
            invalidTokens: 0,
          },
        },
      },
    );
    incrementCounter("notifications_total", {
      status: "failed",
      eventType: notification.type,
      role: notification.role,
    });
    return;
  }

  const ORDER_ALERT_EVENT_TYPES = new Set([
    "NEW_ORDER",
    "NEW_DELIVERY_BROADCAST",
    "NEW_RETURN_BROADCAST",
    "DELIVERY_ASSIGNED",
    "ORDER_READY",
    "SELLER_TIMEOUT_ALERT",
    "NO_RIDER_ALERT",
  ]);
  const isOrderAlertType = ORDER_ALERT_EVENT_TYPES.has(
    String(notification.type || "").toUpperCase()
  );

  // Split tokens by platform (web vs app) so each can use appropriate Firebase client
  const webTokens = tokens.filter((t) => t.platform !== "app");
  const appTokens = tokens.filter((t) => t.platform === "app");

  const sendPayload = {
    title: notification.title,
    body: notification.body || notification.message,
    message: notification.message,
    data: notification.data || {},
  };

  const baseOptions = {
    sound: preference?.sound !== false,
    vibration: preference?.vibration !== false,
    orderAlert: isOrderAlertType,
  };

  const dispatchPromises = [];

  if (webTokens.length > 0) {
    dispatchPromises.push(
      sendFCM(
        webTokens.map((t) => t.token),
        sendPayload,
        { ...baseOptions, platform: "web" },
      ).then((res) => ({ ...res, tokenDocs: webTokens })),
    );
  }

  if (appTokens.length > 0) {
    dispatchPromises.push(
      sendFCM(
        appTokens.map((t) => t.token),
        sendPayload,
        { ...baseOptions, platform: "app" },
      ).then((res) => ({ ...res, tokenDocs: appTokens })),
    );
  }

  let aggregatedResponse = {
    successCount: 0,
    failureCount: 0,
    responses: [],
    tokensOrdered: [],
  };

  try {
    const results = await Promise.race([
      Promise.all(dispatchPromises),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("FCM send timeout")),
          NOTIFICATION_QUEUE_JOB_TIMEOUT_MS(),
        ),
      ),
    ]);

    for (const res of results) {
      aggregatedResponse.successCount += Number(res?.successCount || 0);
      aggregatedResponse.failureCount += Number(res?.failureCount || 0);
      aggregatedResponse.responses.push(...(res?.responses || []));
      aggregatedResponse.tokensOrdered.push(...(res?.tokenDocs || []));
    }
  } catch (error) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: "failed",
          failureReason: error.message,
        },
      },
    );
    incrementCounter("notifications_total", {
      status: "failed",
      eventType: notification.type,
      role: notification.role,
    });
    throw error;
  }

  const attempted = Number(tokens.length || 0);
  const sent = Number(aggregatedResponse.successCount || 0);
  const failed = Number(aggregatedResponse.failureCount || 0);
  const responses = aggregatedResponse.responses || [];
  const invalidTokens = await deactivateInvalidTokens(aggregatedResponse.tokensOrdered, responses);
  const status = sent > 0 ? "sent" : "failed";
  const update = {
    status,
    failureReason: status === "failed" ? "Failed to deliver notification" : "",
    deliveryStats: {
      attempted,
      sent,
      failed,
      invalidTokens,
    },
  };
  if (status === "sent") {
    update.sentAt = new Date();
  }

  await Notification.updateOne({ _id: notification._id }, { $set: update });
  incrementCounter("notifications_total", {
    status,
    eventType: notification.type,
    role: notification.role,
  });

  if (sent === 0 && shouldRetryForResponses(responses)) {
    throw new Error("All notification sends failed");
  }
}

export async function processNotificationJob(job) {
  const { notificationId } = job.data || {};
  await deliverNotificationById(notificationId);
}

export function registerNotificationQueueProcessors() {
  if (!isRedisEnabled()) {
    logger.info("Redis disabled, skipping notification queue processor registration");
    return;
  }

  notificationQueue.process(
    NOTIFICATION_JOB_NAMES.SEND,
    NOTIFICATION_QUEUE_CONCURRENCY(),
    async (job) => {
      const startTime = Date.now();
      try {
        await processNotificationJob(job);
        incrementCounter("queue_jobs_total", {
          queue: "notifications",
          status: "completed",
        });
        recordHistogram("queue_job_duration_seconds", (Date.now() - startTime) / 1000, {
          queue: "notifications",
        });
      } catch (error) {
        incrementCounter("queue_jobs_total", {
          queue: "notifications",
          status: "failed",
        });
        recordHistogram("queue_job_duration_seconds", (Date.now() - startTime) / 1000, {
          queue: "notifications",
        });
        throw error;
      } finally {
        await refreshQueueMetrics();
      }
    },
  );

  notificationQueue.on("failed", async (job, err) => {
    logger.error("Notification queue job failed", {
      queue: "notifications",
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: err?.message,
    });

    const attempts = Number(job?.opts?.attempts || 1);
    if (Number(job?.attemptsMade || 0) >= attempts) {
      try {
        await notificationDeadQueue.add(
          NOTIFICATION_JOB_NAMES.DEAD_LETTER,
          {
            failedJobId: job?.id,
            originalData: job?.data || {},
            error: err?.message || "Unknown error",
            failedAt: new Date().toISOString(),
          },
          {
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      } catch (deadError) {
        logger.error("Failed to enqueue dead-letter notification job", {
          message: deadError.message,
        });
      }
    }
  });

  notificationQueue.on("completed", (job) => {
    logger.debug("Notification queue job completed", {
      queue: "notifications",
      jobId: job?.id,
    });
  });

  logger.info("Notification queue processors registered", {
    queue: "notifications",
    deadQueue: "notifications-dead",
    concurrency: NOTIFICATION_QUEUE_CONCURRENCY(),
  });
}

export default {
  deliverNotificationById,
  registerNotificationQueueProcessors,
};
