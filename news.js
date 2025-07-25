import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

function getAlertScore(alert) {
  const { severity, urgency, certainty } = alert.properties;

  const severityScore = {
    Extreme: 4,
    Severe: 3,
    Moderate: 2,
    Minor: 1,
    Unknown: 0,
  };

  const urgencyScore = {
    Immediate: 3,
    Expected: 2,
    Future: 1,
    Unknown: 0,
  };

  const certaintyScore = {
    Observed: 3,
    Likely: 2,
    Possible: 1,
    Unknown: 0,
  };

  return (
    (severityScore[severity] || 0) +
    (urgencyScore[urgency] || 0) +
    (certaintyScore[certainty] || 0)
  );
}

async function getLatestNwsAlerts() {
  const url = "https://api.weather.gov/alerts/active";
  try {
    const res = await axios.get(url);
    let alerts = res.data.features;
    console.log("TOTAL NWS ALERTS: ", alerts.length);

    // Filter out TEST alerts
    alerts = alerts.filter(
      (a) =>
        a.properties.status !== "Test" && a.properties.severity !== "Unknown"
    );

    // Filter for FLOOD alerts
    let filteredAlerts = [];
    for (const alert of alerts) {
      const event = alert.properties.event;
      const isRainRelated =
        event &&
        ["rain", "storm"].some((kw) => event.toLowerCase().includes(kw));
      const isFloodRelated =
        event && ["flood"].some((kw) => event.toLowerCase().includes(kw));
      if (isRainRelated || isFloodRelated) {
        filteredAlerts.push(alert);
      }
    }
    console.log("TOTAL RAIN & FLOOD RELATED ALERTS: ", filteredAlerts.length);

    // Sort alerts by score
    filteredAlerts = filteredAlerts
      .map((a) => ({ ...a, score: getAlertScore(a) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.properties.sent) - new Date(a.properties.sent)
      );

    for (let item of filteredAlerts) {
      console.log(item.properties.event, getAlertScore(item));
    }

    return filteredAlerts;
  } catch (err) {
    console.error("Failed to fetch NWS alerts:", err.message);
    return [];
  }
}

async function fetchFloodNews() {
  const url =
    "https://news.google.com/rss/search?q=flood+OR+flooding+OR+rain+OR+flash+flood+when:1d+location:us&hl=en-US&gl=US&ceid=US:en";
  const res = await fetch(url);
  const xml = await res.text();

  const parser = new XMLParser();
  const json = parser.parse(xml);

  const items = json.rss?.channel?.item || [];

  const articles = items.map((item) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    source: item.source?.["#text"] || "", // Handles source tag properly
  }));

  console.log(articles);
  return articles;
}

const fetchFloodArticles = async () => {
  const API_KEY = process.env.GNEWS_API_KEY
  const res = await fetch(`https://gnews.io/api/v4/search?q=flood&country=us&lang=en&token=${API_KEY}`);
  const data = await res.json();

  const articles = data.articles.map(a => ({
    title: a.title,
    image: a.image,
    publishedAt: a.publishedAt,
    url: a.url,
    source: a.source.name
  }));

  console.log(articles);
};

async function getNews() {
  const NWS_ALERTS = await getLatestNwsAlerts();
  // const NEWS_ARTICLES = await fetchFloodNews();
  // const NEWS_ARTICLES = await fetchFloodArticles();
}

export {
  getAlertScore,
  getLatestNwsAlerts,
  fetchFloodNews,
  fetchFloodArticles,
};

