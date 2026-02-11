/**
 * Thread API Routes - Manage chat threads
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
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

// JWT secret (must match auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || "property-witch-secret-key-change-in-production";

// Extract user ID from token (returns null for anonymous users)
function getUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    const [payloadB64, signature] = token.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(payloadB64)
      .digest("base64url");
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload.id || null;
  } catch {
    return null;
  }
}

/**
 * Get all threads for the current user
 */
router.get("/threads", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    const threads = getAllThreads(userId);
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
 * Create a new thread for the current user
 */
router.post("/threads", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { initialMessage } = req.body;
    const thread = createThread(initialMessage, userId);
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
 * Only returns if user owns the thread or thread is anonymous
 */
router.get("/threads/:threadId", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { threadId } = req.params;
    const thread = getThread(threadId);
    
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    // Check ownership: user can access their own threads or anonymous threads if they're anonymous
    if (thread.userId !== null && thread.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    return res.json(thread);
  } catch (error) {
    console.error("Failed to get thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Delete a thread (only owner can delete)
 */
router.delete("/threads/:threadId", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { threadId } = req.params;
    const thread = getThread(threadId);
    
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    // Check ownership
    if (thread.userId !== null && thread.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
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
