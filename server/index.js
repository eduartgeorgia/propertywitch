require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", name: "Property Witch API", time: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    healthy: true, 
    groqConfigured: !!GROQ_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/ai/health", (req, res) => {
  res.json({ 
    available: !!GROQ_API_KEY,
    backend: GROQ_API_KEY ? "groq" : "none",
    model: "llama-3.3-70b-versatile"
  });
});

// OLX API - fetch real listings
async function searchOLX(query, maxListings = 40) {
  const listings = [];
  
  // Parse query for location and price
  const queryLower = query.toLowerCase();
  let regionId = null;
  let maxPrice = null;
  let minPrice = null;
  
  // Region mapping
  const regions = {
    'lisboa': 11, 'lisbon': 11,
    'porto': 13,
    'faro': 8, 'algarve': 8,
    'braga': 3,
    'coimbra': 6,
    'setubal': 15, 'setúbal': 15,
    'aveiro': 1,
    'leiria': 10,
    'santarem': 14, 'santarém': 14,
  };
  
  for (const [name, id] of Object.entries(regions)) {
    if (queryLower.includes(name)) {
      regionId = id;
      break;
    }
  }
  
  // Extract price from query
  const priceMatch = query.match(/(\d{1,3}(?:[,.\s]?\d{3})*)/g);
  if (priceMatch) {
    const prices = priceMatch.map(p => parseInt(p.replace(/[,.\s]/g, '')));
    if (queryLower.includes('under') || queryLower.includes('below') || queryLower.includes('max')) {
      maxPrice = Math.max(...prices);
    } else if (queryLower.includes('over') || queryLower.includes('above') || queryLower.includes('min')) {
      minPrice = Math.min(...prices);
    } else if (prices.length >= 2) {
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
    } else {
      maxPrice = prices[0];
    }
  }
  
  // Determine category
  let category = 16; // Default: all real estate
  if (queryLower.includes('land') || queryLower.includes('terreno') || queryLower.includes('plot')) {
    category = 4795;
  } else if (queryLower.includes('apartment') || queryLower.includes('apartamento') || queryLower.includes('flat')) {
    category = 1723; // Apartments for sale
  } else if (queryLower.includes('house') || queryLower.includes('moradia') || queryLower.includes('villa')) {
    category = 1724; // Houses for sale
  }
  
  try {
    // Build OLX API URL
    let url = `https://www.olx.pt/api/v1/offers/?offset=0&limit=${maxListings}&category_id=${category}&sort_by=created_at:desc`;
    
    if (regionId) {
      url += `&region_id=${regionId}`;
    }
    if (minPrice) {
      url += `&filter_float_price:from=${minPrice}`;
    }
    if (maxPrice) {
      url += `&filter_float_price:to=${maxPrice}`;
    }
    
    console.log(`[OLX] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`[OLX] API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    for (const item of (data.data || [])) {
      const price = item.params?.find(p => p.key === 'price')?.value?.value || 0;
      const photo = item.photos?.[0]?.link?.replace('{width}', '400').replace('{height}', '300');
      
      listings.push({
        id: `olx-${item.id}`,
        title: item.title || 'Property',
        priceEur: parseInt(price) || 0,
        displayPrice: `€${parseInt(price).toLocaleString()}`,
        locationLabel: item.location?.city?.name || item.location?.region?.name || 'Portugal',
        beds: item.params?.find(p => p.key === 'rooms')?.value?.key,
        baths: item.params?.find(p => p.key === 'bathrooms')?.value?.key,
        areaSqm: parseInt(item.params?.find(p => p.key === 'm')?.value?.key) || undefined,
        image: photo,
        sourceSite: 'OLX',
        sourceUrl: item.url || `https://www.olx.pt/d/anuncio/${item.id}`,
        matchScore: 80,
      });
    }
    
    console.log(`[OLX] Found ${listings.length} listings`);
    
  } catch (error) {
    console.error('[OLX] Error:', error.message);
  }
  
  return listings;
}

// Chat with AI
async function chatWithGroq(message, systemPrompt) {
  if (!GROQ_API_KEY) {
    return "AI is not configured.";
  }
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 512
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
  } catch (error) {
    console.error("Groq error:", error);
    return "Error processing request.";
  }
}

// Detect if message is a search request
function isSearchIntent(message) {
  const searchKeywords = [
    'find', 'search', 'show', 'looking for', 'want', 'need',
    'apartment', 'house', 'land', 'property', 'properties',
    'buy', 'rent', 'under', 'below', 'around', 'near',
    'lisbon', 'porto', 'algarve', 'faro', 'braga',
    'bedroom', 'bed', 'bath', 'sqm', 'm2',
    '€', 'euro', 'eur', 'price'
  ];
  
  const lowerMsg = message.toLowerCase();
  const matchCount = searchKeywords.filter(kw => lowerMsg.includes(kw)).length;
  return matchCount >= 2;
}

// Main chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, userLocation } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }
  
  console.log(`[Chat] Message: "${message}"`);
  
  // Check if this is a property search
  if (isSearchIntent(message)) {
    console.log("[Chat] Detected search intent");
    
    // Search OLX for listings
    const listings = await searchOLX(message, 20);
    
    if (listings.length > 0) {
      // Generate AI summary
      const locations = [...new Set(listings.map(l => l.locationLabel))];
      const avgPrice = Math.round(listings.reduce((s, l) => s + l.priceEur, 0) / listings.length);
      
      const summaryPrompt = `You are a helpful real estate assistant. The user searched for: "${message}". 
We found ${listings.length} properties. Average price: €${avgPrice.toLocaleString()}. 
Locations: ${locations.slice(0, 5).join(', ')}.
Write a brief, friendly 2-sentence summary of the results.`;
      
      const aiSummary = await chatWithGroq(message, summaryPrompt);
      
      return res.json({
        type: "search",
        intentDetected: "search",
        message: aiSummary,
        searchResult: {
          searchId: `search-${Date.now()}`,
          matchType: "exact",
          note: `Found ${listings.length} properties`,
          appliedPriceRange: { currency: "EUR" },
          appliedRadiusKm: 50,
          listings: listings,
          blockedSites: []
        },
        aiAvailable: !!GROQ_API_KEY,
        aiBackend: "groq"
      });
    } else {
      return res.json({
        type: "chat",
        message: "I couldn't find any properties matching your search. Try broadening your criteria or searching in a different area.",
        aiAvailable: !!GROQ_API_KEY,
        aiBackend: "groq"
      });
    }
  }
  
  // Regular conversation
  const systemPrompt = `You are a helpful AI Property Witch assistant for Portugal real estate. 
Help users find properties, answer questions about the market, and provide advice. 
Keep responses concise (2-4 sentences). Be friendly and knowledgeable.`;
  
  const aiResponse = await chatWithGroq(message, systemPrompt);
  
  res.json({ 
    type: "chat", 
    message: aiResponse,
    aiAvailable: !!GROQ_API_KEY,
    aiBackend: "groq"
  });
});

app.listen(PORT, () => {
  console.log(`Property Witch API running on port ${PORT}`);
  console.log(`Groq API configured: ${!!GROQ_API_KEY}`);
});
