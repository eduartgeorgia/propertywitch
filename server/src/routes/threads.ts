/**
 * Thread API Routes - Manage chat threads
 */

import { Router } from "express";
import {
  createThread,
  getThread,
  getAllThreads,
  addMessage,
  deleteThread,
  updateThreadTitle,
  getThreadCount,
  getConversationHistory,
  getLastSearchContext,
} from "../services/threadService";

const router = Router();

/**
 * Get all threads
 */
router.get("/threads", (_req, res) => {
  try {
    const threads = getAllThreads();
    // Return summary without full message history
    const summary = threads.map(t => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messageCount: t.messages.length,
      lastMessage: t.messages.length > 0 
        ? t.messages[t.messages.length - 1].content.slice(0, 100)
        : null,
    }));
    return res.json({ threads: summary, total: threads.length });
  } catch (error) {
    console.error("Failed to get threads:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Create a new thread
 */
router.post("/threads", (req, res) => {
  try {
    const { initialMessage } = req.body;
    const thread = createThread(initialMessage);
    return res.json({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      messages: thread.messages,
    });
  } catch (error) {
    console.error("Failed to create thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Get a specific thread with full history
 */
router.get("/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const thread = getThread(threadId);
    
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    return res.json(thread);
  } catch (error) {
    console.error("Failed to get thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Delete a thread
 */
router.delete("/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const deleted = deleteThread(threadId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Update thread title
 */
router.patch("/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    
    const thread = updateThreadTitle(threadId, title);
    
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    return res.json({
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt,
    });
  } catch (error) {
    console.error("Failed to update thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Get thread statistics
 */
router.get("/threads-stats", (_req, res) => {
  try {
    const count = getThreadCount();
    const threads = getAllThreads();
    const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0);
    
    return res.json({
      threadCount: count,
      totalMessages,
    });
  } catch (error) {
    console.error("Failed to get thread stats:", error);
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
export { getConversationHistory, getLastSearchContext, addMessage };
