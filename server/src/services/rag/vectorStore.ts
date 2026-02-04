/**
 * Vector Store - Simple in-memory vector database with file persistence
 * Uses cosine similarity for retrieval
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data", "rag");

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export interface SearchResult {
  document: Document;
  score: number;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Simple vector store with collections
 */
export class VectorStore {
  private collections: Map<string, Document[]> = new Map();
  private persistPath: string;

  constructor(storeName: string = "default") {
    this.persistPath = path.join(DATA_DIR, `${storeName}.json`);
    this.load();
  }

  /**
   * Load store from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, "utf-8"));
        this.collections = new Map(Object.entries(data));
        console.log(`[VectorStore] Loaded ${this.collections.size} collections from disk`);
      }
    } catch (error) {
      console.error("[VectorStore] Failed to load from disk:", error);
    }
  }

  /**
   * Save store to disk
   */
  private save(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const data = Object.fromEntries(this.collections);
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[VectorStore] Failed to save to disk:", error);
    }
  }

  /**
   * Create or get a collection
   */
  getCollection(name: string): Document[] {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return this.collections.get(name)!;
  }

  /**
   * Add documents to a collection
   */
  addDocuments(collectionName: string, documents: Document[]): void {
    const collection = this.getCollection(collectionName);
    
    for (const doc of documents) {
      // Check if document already exists
      const existingIndex = collection.findIndex(d => d.id === doc.id);
      if (existingIndex >= 0) {
        collection[existingIndex] = doc;
      } else {
        collection.push(doc);
      }
    }
    
    this.save();
    console.log(`[VectorStore] Added ${documents.length} documents to ${collectionName}`);
  }

  /**
   * Search for similar documents using cosine similarity
   */
  search(
    collectionName: string,
    queryEmbedding: number[],
    topK: number = 5,
    minScore: number = 0.5
  ): SearchResult[] {
    const collection = this.getCollection(collectionName);
    
    const results: SearchResult[] = collection
      .filter(doc => doc.embedding && doc.embedding.length > 0)
      .map(doc => ({
        document: doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding!),
      }))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return results;
  }

  /**
   * Search by text (for documents without embeddings, uses simple keyword matching)
   */
  searchByKeywords(
    collectionName: string,
    query: string,
    topK: number = 5
  ): SearchResult[] {
    const collection = this.getCollection(collectionName);
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const results: SearchResult[] = collection
      .map(doc => {
        const content = doc.content.toLowerCase();
        const metadata = JSON.stringify(doc.metadata).toLowerCase();
        const fullText = content + " " + metadata;
        
        // Simple TF scoring
        let score = 0;
        for (const term of queryTerms) {
          const regex = new RegExp(term, "gi");
          const matches = fullText.match(regex);
          score += matches ? matches.length : 0;
        }
        
        return { document: doc, score: score / queryTerms.length };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return results;
  }

  /**
   * Delete documents from a collection
   */
  deleteDocuments(collectionName: string, documentIds: string[]): void {
    const collection = this.getCollection(collectionName);
    const filtered = collection.filter(doc => !documentIds.includes(doc.id));
    this.collections.set(collectionName, filtered);
    this.save();
  }

  /**
   * Get collection stats
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, docs] of this.collections) {
      stats[name] = docs.length;
    }
    return stats;
  }

  /**
   * Clear a collection
   */
  clearCollection(collectionName: string): void {
    this.collections.set(collectionName, []);
    this.save();
  }
}

// Singleton instance
let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore("property-assistant");
  }
  return vectorStoreInstance;
}
