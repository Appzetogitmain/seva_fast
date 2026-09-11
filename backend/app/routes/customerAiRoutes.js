import express from "express";
import {
  handleChat,
  handleVisualSearch,
  handleProcessShoppingList,
} from "../controller/customerAiController.js";

const router = express.Router();

// Chat endpoint
router.post("/chat", handleChat);

// Visual search endpoint
router.post("/visual-search", handleVisualSearch);

// Process shopping list (text or image)
router.post("/process-list", handleProcessShoppingList);

export default router;
