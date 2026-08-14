import Joi from "joi";

export const sendSignupOtpSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  phone: Joi.string().trim().min(7).max(24).required(),
});

export const sendLoginOtpSchema = Joi.object({
  phone: Joi.string().trim().min(7).max(24).required(),
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string().trim().min(7).max(24).required(),
  otp: Joi.string().trim().pattern(/^\d{4,8}$/).required(),
  dateOfBirth: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
});

export const updateCustomerProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional(),
  email: Joi.string().trim().email().optional().allow("", null),
  addresses: Joi.array().optional(),
  dateOfBirth: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
  profileImage: Joi.string().trim().max(500).optional().allow("", null),
});

export function validateSchema(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (!error) return value;
  const err = new Error(error.details.map((item) => item.message).join("; "));
  err.statusCode = 400;
  throw err;
}
