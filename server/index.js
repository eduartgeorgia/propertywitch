const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", name: "ai-property-assistant-server", time: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ healthy: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
