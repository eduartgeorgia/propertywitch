/**
 * Thread Service - Manages chat threads with persistent memory
 * Stores conversation history for each thread
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "search" | "chat" | "clarification" | "agent";
  searchContext?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  lastSearchContext?: string;
};

// In-memory storage for threads (in production, use a database)
const threads: Map<string, ChatThread> = new Map();

// Generate unique thread ID
function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Generate thread title from first message
function generateTitle(message: string): string {
  // Truncate to first 40 characters or first sentence
  const firstSentence = message.split(/[.!?]/)[0];
  const title = firstSentence.length > 40 
    ? firstSentence.slice(0, 40) + "..." 
    : firstSentence;
  return title || "New conversation";
}

/**
 * Create a new chat thread
 */
export function createThread(initialMessage?: string): ChatThread {
  const id = generateThreadId();
  const now = new Date().toISOString();
  
  const thread: ChatThread = {
    id,
    title: initialMessage ? generateTitle(initialMessage) : "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  
  // Add welcome message
  thread.messages.push({
    role: "assistant",
    content: "🧙‍♀️ Hi! I'm your AI Property Witch. Tell me what you're looking for in Portugal and I'll conjure up the listings for you. You can also ask me questions about the results or Portuguese real estate in general.",
    timestamp: now,
    type: "chat",
  });
  
  threads.set(id, thread);
  console.log(`[Threads] Created new thread: ${id}`);
  return thread;
}

/**
 * Get a thread by ID
 */
export function getThread(threadId: string): ChatThread | null {
  return threads.get(threadId) || null;
}

/**
 * Get all threads (sorted by most recent)
 */
export function getAllThreads(): ChatThread[] {
  return Array.from(threads.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Add a message to a thread
 */
export function addMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string,
  type?: "search" | "chat" | "clarification" | "agent",
  searchContext?: string
): ChatThread | null {
  const thread = threads.get(threadId);
  if (!thread) return null;
  
  const now = new Date().toISOString();
  
  thread.messages.push({
    role,
    content,
    timestamp: now,
    type,
    searchContext,
  });
  
  thread.updatedAt = now;
  
  // Update title from first user message
  if (role === "user" && thread.messages.filter(m => m.role === "user").length === 1) {
    thread.title = generateTitle(content);
  }
  
  // Update last search context
  if (searchContext) {
    thread.lastSearchContext = searchContext;
  }
  
  return thread;
}

/**
 * Get conversation history for a thread (for AI context)
 */
export function getConversationHistory(threadId: string, limit = 20): Array<{ role: "user" | "assistant"; content: string }> {
  const thread = threads.get(threadId);
  if (!thread) return [];
  
  return thread.messages
    .slice(-limit)
    .map(m => ({ role: m.role, content: m.content }));
}

/**
 * Get last search context for a thread
 */
export function getLastSearchContext(threadId: string): string | null {
  const thread = threads.get(threadId);
  return thread?.lastSearchContext || null;
}

/**
 * Delete a thread
 */
export function deleteThread(threadId: string): boolean {
  return threads.delete(threadId);
}

/**
 * Update thread title
 */
export function updateThreadTitle(threadId: string, title: string): ChatThread | null {
  const thread = threads.get(threadId);
  if (!thread) return null;
  
  thread.title = title;
  thread.updatedAt = new Date().toISOString();
  return thread;
}

/**
 * Clear all threads (for testing)
 */
export function clearAllThreads(): void {
  threads.clear();
}

/**
 * Get thread count
 */
export function getThreadCount(): number {
  return threads.size;
}
