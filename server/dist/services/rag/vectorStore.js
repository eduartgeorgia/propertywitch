"use strict";
/**
 * Vector Store - Simple in-memory vector database with file persistence
 * Uses cosine similarity for retrieval
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStore = void 0;
exports.getVectorStore = getVectorStore;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const DATA_DIR = node_path_1.default.resolve(process.cwd(), "data", "rag");
/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
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
class VectorStore {
    collections = new Map();
    persistPath;
    constructor(storeName = "default") {
        this.persistPath = node_path_1.default.join(DATA_DIR, `${storeName}.json`);
        this.load();
    }
    /**
     * Load store from disk
     */
    load() {
        try {
            if (node_fs_1.default.existsSync(this.persistPath)) {
                const data = JSON.parse(node_fs_1.default.readFileSync(this.persistPath, "utf-8"));
                this.collections = new Map(Object.entries(data));
                console.log(`[VectorStore] Loaded ${this.collections.size} collections from disk`);
            }
        }
        catch (error) {
            console.error("[VectorStore] Failed to load from disk:", error);
        }
    }
    /**
     * Save store to disk
     */
    save() {
        try {
            node_fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
            const data = Object.fromEntries(this.collections);
            node_fs_1.default.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error("[VectorStore] Failed to save to disk:", error);
        }
    }
    /**
     * Create or get a collection
     */
    getCollection(name) {
        if (!this.collections.has(name)) {
            this.collections.set(name, []);
        }
        return this.collections.get(name);
    }
    /**
     * Add documents to a collection
     */
    addDocuments(collectionName, documents) {
        const collection = this.getCollection(collectionName);
        for (const doc of documents) {
            // Check if document already exists
            const existingIndex = collection.findIndex(d => d.id === doc.id);
            if (existingIndex >= 0) {
                collection[existingIndex] = doc;
            }
            else {
                collection.push(doc);
            }
        }
        this.save();
        console.log(`[VectorStore] Added ${documents.length} documents to ${collectionName}`);
    }
    /**
     * Search for similar documents using cosine similarity
     */
    search(collectionName, queryEmbedding, topK = 5, minScore = 0.5) {
        const collection = this.getCollection(collectionName);
        const results = collection
            .filter(doc => doc.embedding && doc.embedding.length > 0)
            .map(doc => ({
            document: doc,
            score: cosineSimilarity(queryEmbedding, doc.embedding),
        }))
            .filter(result => result.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        return results;
    }
    /**
     * Search by text (for documents without embeddings, uses simple keyword matching)
     */
    searchByKeywords(collectionName, query, topK = 5) {
        const collection = this.getCollection(collectionName);
        const queryTerms = query.toLowerCase().split(/\s+/);
        const results = collection
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
    deleteDocuments(collectionName, documentIds) {
        const collection = this.getCollection(collectionName);
        const filtered = collection.filter(doc => !documentIds.includes(doc.id));
        this.collections.set(collectionName, filtered);
        this.save();
    }
    /**
     * Get collection stats
     */
    getStats() {
        const stats = {};
        for (const [name, docs] of this.collections) {
            stats[name] = docs.length;
        }
        return stats;
    }
    /**
     * Clear a collection
     */
    clearCollection(collectionName) {
        this.collections.set(collectionName, []);
        this.save();
    }
}
exports.VectorStore = VectorStore;
// Singleton instance
let vectorStoreInstance = null;
function getVectorStore() {
    if (!vectorStoreInstance) {
        vectorStoreInstance = new VectorStore("property-assistant");
    }
    return vectorStoreInstance;
}
