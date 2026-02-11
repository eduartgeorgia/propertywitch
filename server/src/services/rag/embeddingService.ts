/**
 * Embedding Service - Generate embeddings for text using various backends
 * Supports: DeepSeek (via OpenAI-compatible API), Local models, or simple TF-IDF fallback
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

// Vocabulary for TF-IDF fallback (property-related terms)
const PROPERTY_VOCABULARY = [
  // Property types
  "land", "plot", "house", "villa", "apartment", "farm", "quinta", "commercial", "rural", "urban",
  // Features
  "bedroom", "bathroom", "kitchen", "pool", "garden", "garage", "terrace", "balcony", "view", "sea",
  // Location
  "portugal", "lisbon", "porto", "algarve", "alentejo", "coimbra", "braga", "faro", "cascais", "sintra",
  "central", "north", "south", "coast", "beach", "mountain", "countryside", "city", "town", "village",
  // Price/Size
  "cheap", "affordable", "expensive", "luxury", "budget", "small", "large", "spacious", "sqm", "hectare",
  // Condition
  "new", "renovated", "restored", "ruin", "construction", "modern", "traditional", "old",
  // Amenities
  "water", "electricity", "road", "access", "internet", "heating", "cooling", "furnished",
  // Actions
  "buy", "rent", "invest", "sale", "price", "cost", "value",
  // Legal/Process
  "tax", "imt", "notary", "lawyer", "contract", "deed", "registration", "nif", "visa", "golden",
];

type EmbeddingBackend = "openai" | "tfidf";
let activeBackend: EmbeddingBackend = "tfidf";

/**
 * Detect available embedding backend
 */
async function detectBackend(): Promise<EmbeddingBackend> {
  // Check OpenAI API (works with various providers)
  if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith("sk-")) {
    console.log("[Embeddings] Using OpenAI API");
    return "openai";
  }
  
  console.log("[Embeddings] Using TF-IDF fallback (no embedding API configured)");
  return "tfidf";
}

/**
 * Generate embeddings using OpenAI-compatible API
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // Truncate to fit model limits
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}

/**
 * Simple TF-IDF-like embedding (fallback when no API available)
 * Creates a sparse vector based on vocabulary presence
 */
function generateTFIDFEmbedding(text: string): number[] {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const wordCounts = new Map<string, number>();
  
  // Count word frequencies
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (clean.length > 2) {
      wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1);
    }
  }
  
  // Create embedding vector based on vocabulary
  const embedding: number[] = new Array(PROPERTY_VOCABULARY.length).fill(0);
  
  for (let i = 0; i < PROPERTY_VOCABULARY.length; i++) {
    const term = PROPERTY_VOCABULARY[i];
    const count = wordCounts.get(term) || 0;
    
    // Also check for partial matches
    let partialCount = 0;
    for (const [word, cnt] of wordCounts) {
      if (word.includes(term) || term.includes(word)) {
        partialCount += cnt * 0.5;
      }
    }
    
    // TF component (normalized by document length)
    const tf = (count + partialCount) / Math.max(words.length, 1);
    
    // Simple IDF-like weighting (less common terms get higher weight)
    const idf = Math.log(PROPERTY_VOCABULARY.length / (i + 1));
    
    embedding[i] = tf * idf;
  }
  
  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }
  
  return embedding;
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Detect backend on first call
  if (activeBackend === "tfidf") {
    activeBackend = await detectBackend();
  }
  
  try {
    switch (activeBackend) {
      case "openai":
        return await generateOpenAIEmbedding(text);
      case "tfidf":
      default:
        return generateTFIDFEmbedding(text);
    }
  } catch (error) {
    console.error("[Embeddings] API failed, falling back to TF-IDF:", error);
    return generateTFIDFEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts (batched for efficiency)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // For TF-IDF, process all locally
  if (activeBackend === "tfidf") {
    return texts.map(text => generateTFIDFEmbedding(text));
  }
  
  // For API calls, batch to avoid rate limits
  const embeddings: number[][] = [];
  const batchSize = 10;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);
    
    // Rate limiting delay
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return embeddings;
}

/**
 * Get embedding dimension
 */
export function getEmbeddingDimension(): number {
  return activeBackend === "openai" ? 1536 : PROPERTY_VOCABULARY.length;
}

/**
 * Get current backend info
 */
export function getEmbeddingBackend(): { backend: EmbeddingBackend; dimension: number } {
  return {
    backend: activeBackend,
    dimension: getEmbeddingDimension(),
  };
}
