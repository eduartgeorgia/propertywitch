import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "ai-property-assistant-server", time: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ healthy: true, groqConfigured: !!process.env.GROQ_API_KEY });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
