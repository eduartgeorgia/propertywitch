/**
 * Vision Service - AI Image Analysis for Property Listings
 * Uses Groq's vision model (llama-3.2-90b-vision-preview) to analyze property photos
 * Identifies features like: pools, sea views, forests, ruins, architectural styles, etc.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const VISION_MODEL = "llama-3.2-90b-vision-preview";

// Features that can be detected in property images
export type ImageFeature = 
  | "swimming_pool"
  | "sea_view"
  | "ocean_view"
  | "mountain_view"
  | "city_view"
  | "forest"
  | "trees"
  | "garden"
  | "bare_land"
  | "ruins"
  | "old_building"
  | "modern_architecture"
  | "traditional_architecture"
  | "rustic_style"
  | "luxury_finish"
  | "needs_renovation"
  | "parking"
  | "garage"
  | "terrace"
  | "balcony"
  | "rooftop"
  | "waterfront"
  | "river_view"
  | "vineyard"
  | "olive_grove"
  | "agricultural_land"
  | "construction_ready"
  | "flat_terrain"
  | "sloped_terrain"
  | "rocky_terrain"
  | "road_access"
  | "remote_location"
  | "urban_area"
  | "suburban_area"
  | "rural_area"
  | "solar_panels"
  | "fence"
  | "gated";

export type ImageAnalysisResult = {
  features: ImageFeature[];
  confidence: Record<ImageFeature, number>;
  description: string;
  propertyCondition?: "excellent" | "good" | "fair" | "needs_work" | "ruins";
  architecturalStyle?: string;
  surroundings?: string;
  rawAnalysis: string;
};

export type ListingImageAnalysis = {
  listingId: string;
  analyzedPhotos: number;
  combinedFeatures: ImageFeature[];
  featureConfidence: Record<string, number>;
  summary: string;
  analyzedAt: string;
};

// Cache for analyzed images (in production, use Redis or database)
const analysisCache = new Map<string, ImageAnalysisResult>();

/**
 * Analyze a single image URL using Groq Vision
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult | null> {
  // Check cache first
  const cached = analysisCache.get(imageUrl);
  if (cached) {
    console.log(`[Vision] Cache hit for image`);
    return cached;
  }

  if (!GROQ_API_KEY) {
    console.error("[Vision] No GROQ_API_KEY configured");
    return null;
  }

  console.log(`[Vision] Analyzing image: ${imageUrl.substring(0, 60)}...`);

  const systemPrompt = `You are an expert real estate photo analyzer. Analyze the property image and identify all visible features.

FEATURE CATEGORIES TO DETECT:
1. WATER FEATURES: swimming_pool, sea_view, ocean_view, waterfront, river_view
2. NATURAL SURROUNDINGS: forest, trees, garden, mountain_view, vineyard, olive_grove, agricultural_land
3. TERRAIN: bare_land, flat_terrain, sloped_terrain, rocky_terrain
4. BUILDING CONDITION: ruins, old_building, needs_renovation, modern_architecture, traditional_architecture, rustic_style, luxury_finish
5. AMENITIES: parking, garage, terrace, balcony, rooftop, solar_panels, fence, gated
6. LOCATION TYPE: urban_area, suburban_area, rural_area, remote_location, road_access, city_view
7. SPECIAL: construction_ready (cleared land ready to build)

Respond with ONLY valid JSON:
{
  "features": ["feature1", "feature2"],
  "confidence": {"feature1": 0.95, "feature2": 0.8},
  "description": "Brief description of what's in the image",
  "propertyCondition": "excellent|good|fair|needs_work|ruins",
  "architecturalStyle": "modern/traditional/rustic/etc or null if not a building",
  "surroundings": "Brief description of the surroundings"
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this property image and identify all visible features. Focus on features buyers would care about."
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Vision] Groq API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[Vision] No content in response");
      return null;
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Vision] Could not parse JSON from response:", content);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const result: ImageAnalysisResult = {
      features: parsed.features || [],
      confidence: parsed.confidence || {},
      description: parsed.description || "",
      propertyCondition: parsed.propertyCondition,
      architecturalStyle: parsed.architecturalStyle,
      surroundings: parsed.surroundings,
      rawAnalysis: content,
    };

    // Cache the result
    analysisCache.set(imageUrl, result);
    
    console.log(`[Vision] Detected features: ${result.features.join(", ")}`);
    return result;

  } catch (error) {
    console.error("[Vision] Error analyzing image:", error);
    return null;
  }
}

/**
 * Analyze multiple photos for a listing and combine results
 */
export async function analyzeListingPhotos(
  listingId: string,
  photoUrls: string[],
  maxPhotos: number = 3  // Limit to save API calls
): Promise<ListingImageAnalysis | null> {
  if (!photoUrls || photoUrls.length === 0) {
    return null;
  }

  const photosToAnalyze = photoUrls.slice(0, maxPhotos);
  const results: ImageAnalysisResult[] = [];

  console.log(`[Vision] Analyzing ${photosToAnalyze.length} photos for listing ${listingId}`);

  // Analyze photos sequentially to avoid rate limits
  for (const url of photosToAnalyze) {
    const result = await analyzeImage(url);
    if (result) {
      results.push(result);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (results.length === 0) {
    return null;
  }

  // Combine features from all photos
  const featureCount: Record<string, number> = {};
  const featureConfSum: Record<string, number> = {};
  const descriptions: string[] = [];

  for (const result of results) {
    descriptions.push(result.description);
    for (const feature of result.features) {
      featureCount[feature] = (featureCount[feature] || 0) + 1;
      const conf = result.confidence[feature] || 0.7;
      featureConfSum[feature] = (featureConfSum[feature] || 0) + conf;
    }
  }

  // Calculate average confidence and filter features seen in multiple photos
  const combinedFeatures: ImageFeature[] = [];
  const featureConfidence: Record<string, number> = {};

  for (const [feature, count] of Object.entries(featureCount)) {
    // Include if seen in at least one photo
    combinedFeatures.push(feature as ImageFeature);
    featureConfidence[feature] = featureConfSum[feature] / count;
  }

  // Sort by confidence
  combinedFeatures.sort((a, b) => (featureConfidence[b] || 0) - (featureConfidence[a] || 0));

  return {
    listingId,
    analyzedPhotos: results.length,
    combinedFeatures,
    featureConfidence,
    summary: descriptions.join(" | "),
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Quick analysis of first photo only (for faster indexing)
 */
export async function quickAnalyzeFirstPhoto(
  listingId: string,
  photoUrl: string
): Promise<ImageFeature[]> {
  const result = await analyzeImage(photoUrl);
  return result?.features || [];
}

/**
 * Check if a listing's features match user's requested features
 */
export function matchesFeatureQuery(
  listingFeatures: ImageFeature[],
  requestedFeatures: string[]
): { matches: boolean; matchedFeatures: string[]; score: number } {
  if (!requestedFeatures || requestedFeatures.length === 0) {
    return { matches: true, matchedFeatures: [], score: 1 };
  }

  const listingFeatureSet = new Set(listingFeatures.map(f => f.toLowerCase()));
  const matchedFeatures: string[] = [];

  // Feature synonyms and related terms
  const featureSynonyms: Record<string, string[]> = {
    pool: ["swimming_pool"],
    "swimming pool": ["swimming_pool"],
    sea: ["sea_view", "ocean_view", "waterfront"],
    ocean: ["ocean_view", "sea_view", "waterfront"],
    beach: ["sea_view", "ocean_view", "waterfront"],
    water: ["sea_view", "ocean_view", "waterfront", "river_view", "swimming_pool"],
    forest: ["forest", "trees"],
    trees: ["trees", "forest", "garden"],
    garden: ["garden", "trees"],
    mountain: ["mountain_view"],
    city: ["city_view", "urban_area"],
    ruins: ["ruins", "old_building", "needs_renovation"],
    old: ["old_building", "traditional_architecture", "needs_renovation"],
    modern: ["modern_architecture", "luxury_finish"],
    traditional: ["traditional_architecture", "rustic_style"],
    rustic: ["rustic_style", "traditional_architecture"],
    parking: ["parking", "garage"],
    garage: ["garage", "parking"],
    terrace: ["terrace", "balcony", "rooftop"],
    balcony: ["balcony", "terrace"],
    flat: ["flat_terrain"],
    sloped: ["sloped_terrain"],
    vineyard: ["vineyard", "agricultural_land"],
    olive: ["olive_grove", "agricultural_land"],
    farm: ["agricultural_land", "vineyard", "olive_grove"],
    rural: ["rural_area", "remote_location"],
    urban: ["urban_area", "city_view"],
    renovation: ["needs_renovation", "needs_work", "ruins"],
    "fixer upper": ["needs_renovation", "needs_work"],
    luxury: ["luxury_finish", "modern_architecture"],
    gated: ["gated", "fence"],
    fence: ["fence", "gated"],
    solar: ["solar_panels"],
  };

  for (const requested of requestedFeatures) {
    const normalizedRequested = requested.toLowerCase().trim();
    
    // Direct match
    if (listingFeatureSet.has(normalizedRequested)) {
      matchedFeatures.push(requested);
      continue;
    }

    // Check synonyms
    const possibleFeatures = featureSynonyms[normalizedRequested] || [normalizedRequested.replace(/\s+/g, "_")];
    for (const possibleFeature of possibleFeatures) {
      if (listingFeatureSet.has(possibleFeature)) {
        matchedFeatures.push(requested);
        break;
      }
    }
  }

  const score = matchedFeatures.length / requestedFeatures.length;
  return {
    matches: matchedFeatures.length > 0,
    matchedFeatures,
    score,
  };
}

/**
 * Extract image-related search terms from a user query
 */
export function extractImageFeatureQuery(userQuery: string): string[] {
  const query = userQuery.toLowerCase();
  const featureKeywords: string[] = [];

  // Feature detection patterns
  const patterns: [RegExp, string][] = [
    [/\b(swimming\s*)?pool\b/, "pool"],
    [/\bsea\s*(view|side|front)?\b/, "sea"],
    [/\bocean\s*(view|side|front)?\b/, "ocean"],
    [/\bbeach\b/, "beach"],
    [/\bwater\s*front\b/, "waterfront"],
    [/\briver\s*(view|side|front)?\b/, "river"],
    [/\bmountain\s*(view)?\b/, "mountain"],
    [/\bcity\s*(view)?\b/, "city"],
    [/\bforest(ed)?\b/, "forest"],
    [/\btrees?\b/, "trees"],
    [/\bgarden\b/, "garden"],
    [/\bruins?\b/, "ruins"],
    [/\bold\s*(building|house|property)?\b/, "old"],
    [/\bmodern\b/, "modern"],
    [/\btraditional\b/, "traditional"],
    [/\brusstic\b/, "rustic"],
    [/\brenovation\b/, "renovation"],
    [/\bfixer\s*upper\b/, "fixer upper"],
    [/\bluxury\b/, "luxury"],
    [/\bparking\b/, "parking"],
    [/\bgarage\b/, "garage"],
    [/\bterrace\b/, "terrace"],
    [/\bbalcony\b/, "balcony"],
    [/\broof\s*top\b/, "rooftop"],
    [/\bflat\s*(terrain|land)?\b/, "flat"],
    [/\bsloped?\b/, "sloped"],
    [/\bvineyard\b/, "vineyard"],
    [/\bolive\s*(grove|trees?)?\b/, "olive"],
    [/\bfarm(land)?\b/, "farm"],
    [/\brural\b/, "rural"],
    [/\burban\b/, "urban"],
    [/\bgated\b/, "gated"],
    [/\bfence[d]?\b/, "fence"],
    [/\bsolar\s*(panels?)?\b/, "solar"],
    [/\bbare\s*(land)?\b/, "bare_land"],
  ];

  for (const [pattern, keyword] of patterns) {
    if (pattern.test(query)) {
      featureKeywords.push(keyword);
    }
  }

  return featureKeywords;
}

/**
 * Generate a human-readable feature summary
 */
export function generateFeatureSummary(features: ImageFeature[]): string {
  if (!features || features.length === 0) {
    return "";
  }

  const featureLabels: Record<string, string> = {
    swimming_pool: "swimming pool",
    sea_view: "sea view",
    ocean_view: "ocean view",
    mountain_view: "mountain view",
    city_view: "city view",
    forest: "forested area",
    trees: "trees/greenery",
    garden: "garden",
    bare_land: "cleared/bare land",
    ruins: "ruins",
    old_building: "old building",
    modern_architecture: "modern architecture",
    traditional_architecture: "traditional style",
    rustic_style: "rustic charm",
    luxury_finish: "luxury finishes",
    needs_renovation: "needs renovation",
    parking: "parking",
    garage: "garage",
    terrace: "terrace",
    balcony: "balcony",
    rooftop: "rooftop",
    waterfront: "waterfront",
    river_view: "river view",
    vineyard: "vineyard",
    olive_grove: "olive grove",
    agricultural_land: "agricultural land",
    construction_ready: "construction ready",
    flat_terrain: "flat terrain",
    sloped_terrain: "sloped terrain",
    rocky_terrain: "rocky terrain",
    road_access: "road access",
    remote_location: "remote location",
    urban_area: "urban area",
    suburban_area: "suburban area",
    rural_area: "rural setting",
    solar_panels: "solar panels",
    fence: "fenced",
    gated: "gated",
  };

  const labels = features
    .map(f => featureLabels[f] || f.replace(/_/g, " "))
    .slice(0, 5);  // Limit to 5 features in summary

  return `Features: ${labels.join(", ")}`;
}

/**
 * Get vision service status
 */
export function getVisionServiceStatus(): {
  available: boolean;
  model: string;
  cacheSize: number;
} {
  return {
    available: !!GROQ_API_KEY,
    model: VISION_MODEL,
    cacheSize: analysisCache.size,
  };
}

/**
 * Clear the analysis cache
 */
export function clearVisionCache(): void {
  analysisCache.clear();
  console.log("[Vision] Cache cleared");
}

export default {
  analyzeImage,
  analyzeListingPhotos,
  quickAnalyzeFirstPhoto,
  matchesFeatureQuery,
  extractImageFeatureQuery,
  generateFeatureSummary,
  getVisionServiceStatus,
  clearVisionCache,
};
