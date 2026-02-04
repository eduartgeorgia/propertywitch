import express from "express";
import cors from "cors";
import path from "node:path";
import { APP_CONFIG } from "./config";
import searchRouter from "./routes/search";
import reportRouter from "./routes/report";
import diagnosticsRouter from "./routes/diagnostics";
import chatRouter from "./routes/chat";
import ragRouter from "./routes/rag";
import trainingRouter from "./routes/training";
import agentRouter from "./routes/agent";
import indexListingsRouter from "./routes/index-listings";
import threadsRouter from "./routes/threads";
import { initializeRAG } from "./services/rag/index";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api", searchRouter);
app.use("/api", reportRouter);
app.use("/api", diagnosticsRouter);
app.use("/api", chatRouter);
app.use("/api", ragRouter);
app.use("/api", trainingRouter);
app.use("/api", agentRouter);
app.use("/api", threadsRouter);
app.use("/api/index", indexListingsRouter);

app.use("/reports", express.static(path.resolve(APP_CONFIG.reportsDir)));

app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "ai-property-assistant-server" });
});

// Initialize RAG system and start server
const startServer = async () => {
  try {
    console.log("Initializing RAG system...");
    await initializeRAG();
    console.log("RAG system ready");
  } catch (error) {
    console.error("RAG initialization warning:", error);
    // Don't fail startup, RAG is optional
  }
  
  app.listen(APP_CONFIG.port, () => {
    console.log(`Server running on http://localhost:${APP_CONFIG.port}`);
  });
};

startServer();
