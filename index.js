import express from "express";
import cors from "cors";
import { getLatestNwsAlerts, getNews } from "./news.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());

app.get("/api/nws", async (req, res) => {
  try {
    const nwsAlerts = await getLatestNwsAlerts();
    res.json({
      alerts: nwsAlerts,
    });
  } catch (err) {
    console.error("Error getting news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const result = await getNews();
    if (result.length === 2 && result[0].length > 0 && result[1].length > 0) {
      res.json({
        articles: result[0],
        indices: result[1],
      });
    } else {
      res.json({
        articles: null,
        indices: null,
      });
    }
  } catch (err) {
    console.error("Error getting news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
