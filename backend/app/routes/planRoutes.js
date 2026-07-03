import express from "express";
import {
    createPlan,
    updatePlan,
    deletePlan,
    getPlans,
    createPlanOrder,
    verifyPlanPayment
} from "../controller/planController.js";
import { verifyToken, allowRoles, optionalVerifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// User subscription routes (must be registered before /:id routes)
router.get("/", optionalVerifyToken, getPlans);
router.post("/subscribe/initiate", verifyToken, createPlanOrder);
router.post("/subscribe", verifyToken, createPlanOrder);
router.post("/subscribe/verify", verifyToken, verifyPlanPayment);

// Admin routes
router.post("/", verifyToken, allowRoles("admin"), createPlan);
router.put("/:id", verifyToken, allowRoles("admin"), updatePlan);
router.delete("/:id", verifyToken, allowRoles("admin"), deletePlan);

export default router;
