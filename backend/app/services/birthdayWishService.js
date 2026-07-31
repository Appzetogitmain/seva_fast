import Customer from "../models/customer.js";
import logger from "./logger.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { getISTDateParts } from "../utils/customerDob.js";

export async function processBirthdayWishes() {
  const { year, month, day } = getISTDateParts(new Date());

  const customers = await Customer.find({
    role: "user",
    isVerified: true,
    isActive: true,
    dateOfBirth: { $exists: true, $ne: null },
    dobMonth: month,
    dobDay: day,
    $or: [
      { birthdayWishSentYear: { $exists: false } },
      { birthdayWishSentYear: null },
      { birthdayWishSentYear: { $lt: year } },
    ],
  })
    .select("_id name birthdayWishSentYear")
    .lean();

  if (!customers.length) {
    return { processed: 0, year, month, day };
  }

  let processed = 0;

  for (const customer of customers) {
    try {
      const updated = await Customer.findOneAndUpdate(
        {
          _id: customer._id,
          $or: [
            { birthdayWishSentYear: { $exists: false } },
            { birthdayWishSentYear: null },
            { birthdayWishSentYear: { $lt: year } },
          ],
        },
        { $set: { birthdayWishSentYear: year } },
        { new: true },
      ).select("_id name");

      if (!updated) continue;

      emitNotificationEvent(NOTIFICATION_EVENTS.BIRTHDAY_WISH, {
        userId: updated._id,
        customerId: updated._id,
        name: updated.name,
        birthdayYear: year,
      });

      processed += 1;
    } catch (error) {
      logger.error("Failed to send birthday wish", {
        customerId: customer._id,
        message: error.message,
      });
    }
  }

  logger.info("Birthday wish job completed", {
    processed,
    matched: customers.length,
    year,
    month,
    day,
  });

  return { processed, matched: customers.length, year, month, day };
}
