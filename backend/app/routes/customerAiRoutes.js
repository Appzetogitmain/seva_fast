import express from "express";
import { handleChat, handleVisualSearch } from "../controller/customerAiController.js";

const router = express.Router();

// Chat endpoint
router.post("/chat", handleChat);

// Visual search endpoint
router.post("/visual-search", handleVisualSearch);

export default router;
