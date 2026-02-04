"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("./config");
const search_1 = __importDefault(require("./routes/search"));
const report_1 = __importDefault(require("./routes/report"));
const diagnostics_1 = __importDefault(require("./routes/diagnostics"));
const chat_1 = __importDefault(require("./routes/chat"));
const rag_1 = __importDefault(require("./routes/rag"));
const training_1 = __importDefault(require("./routes/training"));
const agent_1 = __importDefault(require("./routes/agent"));
const index_listings_1 = __importDefault(require("./routes/index-listings"));
const index_1 = require("./services/rag/index");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" }));
app.use("/api", search_1.default);
app.use("/api", report_1.default);
app.use("/api", diagnostics_1.default);
app.use("/api", chat_1.default);
app.use("/api", rag_1.default);
app.use("/api", training_1.default);
app.use("/api", agent_1.default);
app.use("/api/index", index_listings_1.default);
app.use("/reports", express_1.default.static(node_path_1.default.resolve(config_1.APP_CONFIG.reportsDir)));
app.get("/", (_req, res) => {
    res.json({ status: "ok", name: "ai-property-assistant-server" });
});
// Initialize RAG system and start server
const startServer = async () => {
    try {
        console.log("Initializing RAG system...");
        await (0, index_1.initializeRAG)();
        console.log("RAG system ready");
    }
    catch (error) {
        console.error("RAG initialization warning:", error);
        // Don't fail startup, RAG is optional
    }
    app.listen(config_1.APP_CONFIG.port, () => {
        console.log(`Server running on http://localhost:${config_1.APP_CONFIG.port}`);
    });
};
startServer();
