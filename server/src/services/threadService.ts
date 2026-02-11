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
  userId: string | null; // null for anonymous users
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  lastSearchContext?: string;
  lastSearchResults?: any[]; // Store actual listing data for pick/select queries
  previousSearchResults?: any[]; // Store ONE previous search (for "go back" feature)
  previousSearchContext?: string; // Context of the previous search
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
export function createThread(initialMessage?: string, userId?: string | null): ChatThread {
  const id = generateThreadId();
  const now = new Date().toISOString();
  
  const thread: ChatThread = {
    id,
    userId: userId || null,
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
  console.log(`[Threads] Created new thread: ${id} for user: ${userId || 'anonymous'}`);
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
 * If userId is provided, only returns threads for that user
 * If userId is null, returns threads with no user (anonymous)
 */
export function getAllThreads(userId?: string | null): ChatThread[] {
  const allThreads = Array.from(threads.values());
  
  // If userId is provided, filter by that user
  if (userId !== undefined) {
    return allThreads
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  
  // Otherwise return all threads (backwards compatibility)
  return allThreads
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
 * Store search results in a thread (for pick/select queries)
 * Also saves the current results as "previous" before overwriting
 */
export function storeSearchResults(threadId: string, listings: any[], searchContext?: string): void {
  const thread = threads.get(threadId);
  if (thread) {
    // Save current results as previous (only if there are current results)
    if (thread.lastSearchResults && thread.lastSearchResults.length > 0) {
      thread.previousSearchResults = thread.lastSearchResults;
      thread.previousSearchContext = thread.lastSearchContext;
      console.log(`[Threads] Saved ${thread.previousSearchResults.length} listings as previous in thread ${threadId}`);
    }
    
    // Store new results as current
    thread.lastSearchResults = listings;
    if (searchContext) {
      thread.lastSearchContext = searchContext;
    }
    console.log(`[Threads] Stored ${listings.length} listings in thread ${threadId}`);
  }
}

/**
 * Get last search results from a thread
 */
export function getLastSearchResults(threadId: string): any[] | null {
  const thread = threads.get(threadId);
  return thread?.lastSearchResults || null;
}

/**
 * Get previous search results from a thread (one search ago)
 */
export function getPreviousSearchResults(threadId: string): { listings: any[] | null; context: string | null } {
  const thread = threads.get(threadId);
  return {
    listings: thread?.previousSearchResults || null,
    context: thread?.previousSearchContext || null,
  };
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
