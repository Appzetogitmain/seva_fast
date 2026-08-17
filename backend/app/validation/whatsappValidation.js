import Joi from "joi";
import {
  WHATSAPP_CAMPAIGN_TYPES,
  WHATSAPP_AUDIENCE_TYPES,
  WHATSAPP_SCHEDULE_TYPES,
} from "../models/whatsappCampaign.js";
import { WHATSAPP_TEMPLATE_TYPES } from "../models/whatsappTemplate.js";

const objectId = Joi.string().trim().length(24).hex();

export const updateTemplateSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1024).required(),
}).options({ abortEarly: false });

export const templateMessageTypeSchema = Joi.string()
  .valid(...WHATSAPP_TEMPLATE_TYPES)
  .required();

export const createCampaignSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  campaignType: Joi.string()
    .valid(...WHATSAPP_CAMPAIGN_TYPES)
    .default("announcement"),
  message: Joi.string().trim().min(1).max(1024).required(),
  audienceType: Joi.string()
    .valid(...WHATSAPP_AUDIENCE_TYPES)
    .required(),
  targetCustomerIds: Joi.array()
    .items(objectId)
    .when("audienceType", {
      is: "selected",
      then: Joi.array().items(objectId).min(1).required(),
      otherwise: Joi.array().items(objectId).optional(),
    }),
  scheduleType: Joi.string()
    .valid(...WHATSAPP_SCHEDULE_TYPES)
    .default("immediate"),
  scheduledAt: Joi.date().iso().when("scheduleType", {
    is: "scheduled",
    then: Joi.date().iso().greater("now").required(),
    otherwise: Joi.date().iso().optional(),
  }),
}).options({ abortEarly: false });

export function validateSchema(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const err = new Error(error.details.map((item) => item.message).join("; "));
    err.statusCode = 400;
    throw err;
  }
  return value;
}
