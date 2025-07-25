import express from "express";
import cors from "cors";
import { getLatestNwsAlerts, fetchFloodNews, fetchFloodArticles } from "./news.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());  

app.get("/api/news", async (req, res) => {
  try {
    console.log("hello")
    const nwsAlerts = await getLatestNwsAlerts();
    res.json({
      alerts: nwsAlerts,
    });
  } catch (err) {
    console.error("Error getting news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});