import express from "express";
import { handleShiprocketWebhook } from "../controllers/shiprocketWebhookController.js";

const router = express.Router();

/**
 * Mount in your main app, e.g.:
 *   import shiprocketRoutes from "./routes/shiprocket.routes.js";
 *   app.use("/api/webhooks/shiprocket", shiprocketRoutes);
 *
 * IMPORTANT: this route must NOT sit behind your normal auth middleware
 * (Shiprocket can't send your JWT). It's protected instead by the
 * x-api-key secret check inside the controller. If you have a global
 * `app.use(authMiddleware)` before your routers, register this router
 * BEFORE that middleware, or explicitly exclude this path.
 */
router.post("/", handleShiprocketWebhook);

export default router;