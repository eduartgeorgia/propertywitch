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

// Chat endpoint using Groq
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  
  if (!GROQ_API_KEY) {
    return res.json({ 
      type: "text", 
      message: "AI is not configured. Please set GROQ_API_KEY environment variable." 
    });
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
          { 
            role: "system", 
            content: "You are a helpful real estate assistant specializing in Portuguese properties. Help users find properties, answer questions about the market, and provide advice."
          },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that request.";
    
    res.json({ 
      type: "text", 
      message: aiMessage,
      aiAvailable: true,
      aiBackend: "groq"
    });
  } catch (error) {
    console.error("Groq API error:", error);
    res.json({ 
      type: "text", 
      message: "Sorry, there was an error processing your request.",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Property Witch API running on port ${PORT}`);
  console.log(`Groq API configured: ${!!GROQ_API_KEY}`);
});
