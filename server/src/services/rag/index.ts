/**
 * RAG Module - Retrieval-Augmented Generation
 * Exports all RAG-related functionality
 */

export { getVectorStore, type Document, type SearchResult } from "./vectorStore";
export { generateEmbedding, generateEmbeddings, getEmbeddingBackend } from "./embeddingService";
export { getAllKnowledge, getKnowledgeByCategory, getKnowledgeByTags, getCategories, type KnowledgeDocument } from "./knowledgeBase";
export {
  initializeRAG,
  indexListings,
  storeConversation,
  retrieveKnowledge,
  retrieveSimilarListings,
  retrieveConversationContext,
  buildRAGContext,
  getRAGStats,
  clearRAGData,
  searchListingsByCriteria,
  parseSearchQuery,
  type ListingSearchCriteria,
} from "./ragService";
