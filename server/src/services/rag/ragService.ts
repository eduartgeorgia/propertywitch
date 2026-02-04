/**
 * RAG Service - Retrieval-Augmented Generation for the Property Assistant
 * Combines vector search with AI generation for context-aware responses
 */

import { getVectorStore, Document, SearchResult } from "./vectorStore";
import { generateEmbedding, generateEmbeddings, getEmbeddingBackend } from "./embeddingService";
import { getAllKnowledge, KnowledgeDocument } from "./knowledgeBase";
import type { Listing } from "../../domain/listing";

// Collection names
const KNOWLEDGE_COLLECTION = "knowledge";
const LISTINGS_COLLECTION = "listings";
const CONVERSATIONS_COLLECTION = "conversations";

/**
 * Initialize RAG system - index knowledge base
 */
export async function initializeRAG(): Promise<void> {
  const store = getVectorStore();
  const knowledge = getAllKnowledge();
  
  // Check if knowledge is already indexed
  const stats = store.getStats();
  if (stats[KNOWLEDGE_COLLECTION] === knowledge.length) {
    console.log("[RAG] Knowledge base already indexed");
    return;
  }
  
  console.log("[RAG] Indexing knowledge base...");
  
  // Generate embeddings for all knowledge documents
  const texts = knowledge.map(doc => `${doc.title}\n${doc.content}`);
  const embeddings = await generateEmbeddings(texts);
  
  // Create documents with embeddings
  const documents: Document[] = knowledge.map((doc, index) => ({
    id: doc.id,
    content: doc.content,
    metadata: {
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
    },
    embedding: embeddings[index],
  }));
  
  // Store in vector store
  store.addDocuments(KNOWLEDGE_COLLECTION, documents);
  console.log(`[RAG] Indexed ${documents.length} knowledge documents`);
}

/**
 * Index property listings for RAG retrieval
 */
export async function indexListings(listings: Listing[]): Promise<void> {
  if (listings.length === 0) return;
  
  const store = getVectorStore();
  
  // Create document representations of listings
  const documents: Document[] = [];
  const texts: string[] = [];
  
  for (const listing of listings) {
    const text = [
      listing.title,
      `Price: €${listing.priceEur}`,
      listing.city ? `Location: ${listing.city}` : "",
      listing.beds ? `Bedrooms: ${listing.beds}` : "",
      listing.baths ? `Bathrooms: ${listing.baths}` : "",
      listing.areaSqm ? `Area: ${listing.areaSqm} sqm` : "",
      listing.description || "",
    ].filter(Boolean).join(". ");
    
    texts.push(text);
    
    documents.push({
      id: listing.id,
      content: text,
      metadata: {
        title: listing.title,
        priceEur: listing.priceEur,
        city: listing.city,
        sourceSite: listing.sourceSite,
        sourceUrl: listing.sourceUrl,
        beds: listing.beds,
        baths: listing.baths,
        areaSqm: listing.areaSqm,
        indexedAt: new Date().toISOString(),
      },
    });
  }
  
  // Generate embeddings
  const embeddings = await generateEmbeddings(texts);
  
  // Add embeddings to documents
  for (let i = 0; i < documents.length; i++) {
    documents[i].embedding = embeddings[i];
  }
  
  // Store in vector store
  store.addDocuments(LISTINGS_COLLECTION, documents);
  console.log(`[RAG] Indexed ${documents.length} listings`);
}

/**
 * Store conversation context for future retrieval
 */
export async function storeConversation(
  conversationId: string,
  userQuery: string,
  assistantResponse: string,
  searchContext?: string
): Promise<void> {
  const store = getVectorStore();
  
  const content = [
    `User: ${userQuery}`,
    `Assistant: ${assistantResponse}`,
    searchContext ? `Context: ${searchContext}` : "",
  ].filter(Boolean).join("\n");
  
  const embedding = await generateEmbedding(content);
  
  const document: Document = {
    id: `conv-${conversationId}-${Date.now()}`,
    content,
    metadata: {
      conversationId,
      userQuery,
      timestamp: new Date().toISOString(),
    },
    embedding,
  };
  
  store.addDocuments(CONVERSATIONS_COLLECTION, [document]);
}

/**
 * Retrieve relevant knowledge for a query
 */
export async function retrieveKnowledge(
  query: string,
  topK: number = 3,
  minScore: number = 0.3
): Promise<SearchResult[]> {
  const store = getVectorStore();
  const backend = getEmbeddingBackend();
  
  // Use vector search if we have real embeddings, otherwise keyword search
  if (backend.backend === "tfidf") {
    // For TF-IDF, use vector search (it works with our simple embeddings)
    const queryEmbedding = await generateEmbedding(query);
    return store.search(KNOWLEDGE_COLLECTION, queryEmbedding, topK, minScore);
  }
  
  const queryEmbedding = await generateEmbedding(query);
  return store.search(KNOWLEDGE_COLLECTION, queryEmbedding, topK, minScore);
}

/**
 * Retrieve similar listings
 */
export async function retrieveSimilarListings(
  query: string,
  topK: number = 5,
  minScore: number = 0.3
): Promise<SearchResult[]> {
  const store = getVectorStore();
  const queryEmbedding = await generateEmbedding(query);
  return store.search(LISTINGS_COLLECTION, queryEmbedding, topK, minScore);
}

/**
 * Search criteria for filtering listings
 */
export interface ListingSearchCriteria {
  city?: string;
  minBeds?: number;
  maxBeds?: number;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string; // apartment, house, land, etc.
  forRent?: boolean; // true = rent, false = sale, undefined = both
}

/**
 * Search indexed listings with specific criteria (filter-based, not semantic)
 */
export function searchListingsByCriteria(
  criteria: ListingSearchCriteria,
  limit: number = 10
): { listing: Document; score: number }[] {
  const store = getVectorStore();
  const collection = store.getCollection(LISTINGS_COLLECTION);
  
  const results: { listing: Document; score: number }[] = [];
  
  for (const doc of collection) {
    const meta = doc.metadata;
    let score = 100; // Start with perfect score, deduct for mismatches
    let matches = true;
    
    // City filter (fuzzy match)
    if (criteria.city) {
      const cityLower = (meta.city as string || "").toLowerCase();
      const criteriaCity = criteria.city.toLowerCase();
      if (!cityLower.includes(criteriaCity) && !criteriaCity.includes(cityLower)) {
        matches = false;
      }
    }
    
    // Bedrooms filter
    const beds = meta.beds as number | undefined;
    if (criteria.minBeds !== undefined && (beds === undefined || beds < criteria.minBeds)) {
      matches = false;
    }
    if (criteria.maxBeds !== undefined && beds !== undefined && beds > criteria.maxBeds) {
      matches = false;
    }
    
    // Area filter
    const area = meta.areaSqm as number | undefined;
    if (criteria.minArea !== undefined) {
      if (area === undefined) {
        score -= 20; // Penalize but don't exclude
      } else if (area < criteria.minArea * 0.8) { // Allow 20% tolerance
        matches = false;
      } else if (area < criteria.minArea) {
        score -= 10; // Slightly under, small penalty
      }
    }
    if (criteria.maxArea !== undefined && area !== undefined && area > criteria.maxArea * 1.2) {
      matches = false;
    }
    
    // Price filter
    const price = meta.priceEur as number | undefined;
    if (criteria.minPrice !== undefined && price !== undefined && price < criteria.minPrice) {
      matches = false;
    }
    if (criteria.maxPrice !== undefined && price !== undefined && price > criteria.maxPrice) {
      matches = false;
    }
    
    // Rent vs sale detection (check title/content for keywords)
    if (criteria.forRent !== undefined) {
      const content = doc.content.toLowerCase();
      const title = (meta.title as string || "").toLowerCase();
      const isRent = content.includes("arrend") || content.includes("rent") || 
                     content.includes("alug") || title.includes("arrend") ||
                     title.includes("rent") || title.includes("alug");
      const isSale = content.includes("vend") || content.includes("sale") || 
                     title.includes("vend") || title.includes("sale");
      
      if (criteria.forRent && !isRent && isSale) {
        matches = false;
      } else if (!criteria.forRent && !isSale && isRent) {
        matches = false;
      }
    }
    
    // Property type filter
    if (criteria.propertyType) {
      const content = doc.content.toLowerCase();
      const title = (meta.title as string || "").toLowerCase();
      const propType = criteria.propertyType.toLowerCase();
      
      const typeMatches = 
        (propType === "apartment" && (content.includes("apartamento") || content.includes("apartment") || title.includes("t1") || title.includes("t2") || title.includes("t3") || title.includes("t4"))) ||
        (propType === "house" && (content.includes("moradia") || content.includes("house") || content.includes("vivenda") || content.includes("villa"))) ||
        (propType === "land" && (content.includes("terreno") || content.includes("land") || content.includes("lote"))) ||
        (propType === "room" && (content.includes("quarto") || content.includes("room")));
      
      if (!typeMatches) {
        score -= 30; // Penalize but don't exclude completely
      }
    }
    
    // Boost score based on how well area matches
    if (criteria.minArea && area) {
      const areaRatio = area / criteria.minArea;
      if (areaRatio >= 0.9 && areaRatio <= 1.2) {
        score += 20; // Good match
      }
    }
    
    if (matches && score > 0) {
      results.push({ listing: doc, score });
    }
  }
  
  // Sort by score and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Parse search query to extract criteria
 */
export function parseSearchQuery(query: string): ListingSearchCriteria {
  const lower = query.toLowerCase();
  const criteria: ListingSearchCriteria = {};
  
  // City detection
  const cities = ["porto", "lisboa", "lisbon", "faro", "braga", "coimbra", "aveiro", "setubal", "evora"];
  for (const city of cities) {
    if (lower.includes(city)) {
      criteria.city = city;
      break;
    }
  }
  
  // Bedrooms (T1, T2, 1 bedroom, 2 bed, etc.)
  const bedsMatch = lower.match(/(\d+)\s*(?:bed|bedroom|quarto|t)|\bt(\d+)\b/);
  if (bedsMatch) {
    const beds = parseInt(bedsMatch[1] || bedsMatch[2], 10);
    if (beds > 0 && beds < 10) {
      criteria.minBeds = beds;
      criteria.maxBeds = beds;
    }
  }
  
  // Area in sqm/m2
  const areaMatch = lower.match(/(\d+)\s*(?:m2|sqm|m²|square|metros)/);
  if (areaMatch) {
    const area = parseInt(areaMatch[1], 10);
    if (area > 10 && area < 10000) {
      criteria.minArea = area * 0.8; // Allow some tolerance
      criteria.maxArea = area * 1.5;
    }
  }
  
  // Price
  const priceMatch = lower.match(/(?:€|eur|euro|price|under|below|max)\s*(\d+(?:[.,]\d{3})*)/i);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/[.,]/g, ""), 10);
    if (price > 0) {
      criteria.maxPrice = price;
    }
  }
  
  // Rent vs sale
  if (lower.includes("rent") || lower.includes("arrend") || lower.includes("alug") || lower.includes("arrendar")) {
    criteria.forRent = true;
  } else if (lower.includes("buy") || lower.includes("sale") || lower.includes("comprar") || lower.includes("vend")) {
    criteria.forRent = false;
  }
  
  // Property type
  if (lower.includes("apartment") || lower.includes("apartamento") || lower.includes("flat")) {
    criteria.propertyType = "apartment";
  } else if (lower.includes("house") || lower.includes("moradia") || lower.includes("villa") || lower.includes("vivenda")) {
    criteria.propertyType = "house";
  } else if (lower.includes("land") || lower.includes("terreno") || lower.includes("plot")) {
    criteria.propertyType = "land";
  } else if (lower.includes("room") || lower.includes("quarto")) {
    criteria.propertyType = "room";
  }
  
  return criteria;
}

/**
 * Retrieve relevant conversation history
 */
export async function retrieveConversationContext(
  query: string,
  conversationId?: string,
  topK: number = 3
): Promise<SearchResult[]> {
  const store = getVectorStore();
  const queryEmbedding = await generateEmbedding(query);
  
  let results = store.search(CONVERSATIONS_COLLECTION, queryEmbedding, topK * 2, 0.2);
  
  // Filter by conversation ID if provided
  if (conversationId) {
    results = results.filter(
      r => r.document.metadata.conversationId === conversationId
    );
  }
  
  return results.slice(0, topK);
}

/**
 * Build RAG context for AI prompt
 */
export async function buildRAGContext(
  query: string,
  options: {
    includeKnowledge?: boolean;
    includeListings?: boolean;
    includeConversations?: boolean;
    conversationId?: string;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const {
    includeKnowledge = true,
    includeListings = false,
    includeConversations = false,
    conversationId,
    maxTokens = 2000,
  } = options;
  
  const contextParts: string[] = [];
  let estimatedTokens = 0;
  const avgCharsPerToken = 4;
  
  // Retrieve knowledge
  if (includeKnowledge) {
    const knowledge = await retrieveKnowledge(query, 3, 0.2);
    if (knowledge.length > 0) {
      contextParts.push("=== Relevant Information ===");
      for (const result of knowledge) {
        const text = `[${result.document.metadata.title}]\n${result.document.content}`;
        const tokens = Math.ceil(text.length / avgCharsPerToken);
        
        if (estimatedTokens + tokens < maxTokens) {
          contextParts.push(text);
          estimatedTokens += tokens;
        }
      }
    }
  }
  
  // Retrieve similar listings
  if (includeListings) {
    const listings = await retrieveSimilarListings(query, 3, 0.3);
    if (listings.length > 0) {
      contextParts.push("\n=== Similar Properties ===");
      for (const result of listings) {
        const meta = result.document.metadata;
        const text = `- ${meta.title}: €${meta.priceEur} in ${meta.city || "Portugal"}`;
        const tokens = Math.ceil(text.length / avgCharsPerToken);
        
        if (estimatedTokens + tokens < maxTokens) {
          contextParts.push(text);
          estimatedTokens += tokens;
        }
      }
    }
  }
  
  // Retrieve conversation context
  if (includeConversations) {
    const conversations = await retrieveConversationContext(query, conversationId, 2);
    if (conversations.length > 0) {
      contextParts.push("\n=== Previous Relevant Conversations ===");
      for (const result of conversations) {
        const tokens = Math.ceil(result.document.content.length / avgCharsPerToken);
        
        if (estimatedTokens + tokens < maxTokens) {
          contextParts.push(result.document.content);
          estimatedTokens += tokens;
        }
      }
    }
  }
  
  return contextParts.join("\n\n");
}

/**
 * Get RAG system stats
 */
export function getRAGStats(): {
  collections: Record<string, number>;
  embeddingBackend: string;
  embeddingDimension: number;
} {
  const store = getVectorStore();
  const backend = getEmbeddingBackend();
  
  return {
    collections: store.getStats(),
    embeddingBackend: backend.backend,
    embeddingDimension: backend.dimension,
  };
}

/**
 * Clear RAG data (for testing/reset)
 */
export function clearRAGData(collection?: string): void {
  const store = getVectorStore();
  
  if (collection) {
    store.clearCollection(collection);
  } else {
    store.clearCollection(KNOWLEDGE_COLLECTION);
    store.clearCollection(LISTINGS_COLLECTION);
    store.clearCollection(CONVERSATIONS_COLLECTION);
  }
}
