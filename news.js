import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";
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
      console.log(
        item.properties.event,
        getAlertScore(item),
        item.properties.Date
      );
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
  const API_KEY = process.env.GNEWS_API_KEY;
  const res = await fetch(
    `https://gnews.io/api/v4/search?q=flood&country=us&lang=en&token=${API_KEY}`
  );
  const data = await res.json();

  const articles = data.articles.map((a) => ({
    title: a.title,
    image: a.image,
    publishedAt: a.publishedAt,
    url: a.url,
    source: a.source.name,
  }));
  return articles
};

function cleanGeminiResponse(raw) {
  try {
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/`/g, "")
      .trim();

    const match = cleaned.match(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error("Failed to parse Gemini response:", err);
    return null;
  }
}

const openai_query = async (articles) => {
  try {
    const formattedMessages = [
      {
        role: "user",
        content: `You are a helpful assistant. Your job is to return a JSON Array that is valid JSON, and nothing else.
              I will give you an array of news article objects, each with a title, linke, pubDate, and source, from the GNEWS api.
              These are articles which have been found based on keywords related to flooding and heavy rain. 

              Your goal is to find articles that either 1). Describe current DISASTERS in the US 
              or 2). Give information on floods events that are predicted to hit somewhere in the US soon.
              
              You must determine 4-6 articles in this list that best fit these two criteria. 
              Finally, determine the indices of those articles from the list I am about to give you, and then sort them so that the most relevant article is first.

              Exact Instructions: Return an array of indices, where each item in the array is an index from the long list of articles, sort so that the first index points to the most relevant article in the long list I am about to give. 
              Here is the long list of articles from GNEWS:

              ARTICLES: 
              ${JSON.stringify(articles)}
              `,
      },
    ];
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: formattedMessages,
    });
    const response = completion.choices[0].message.content;

    if (!response) {
      return null;
    }

    // console.log(response);
    const JSONArray = cleanGeminiResponse(response);
    // console.log(JSONArray);
    // if (JSONArray) {
    //   for (let i = 0; i < JSONArray.length; i++) {
    //     console.log(articles[JSONArray[i]]);
    //   }
    // }

    return JSONArray;
  } catch (error) {
    console.error(error);
    return null;
  }
};

async function getNews() {
  const NEWS_ARTICLES = await fetchFloodArticles();
  const results = openai_query(NEWS_ARTICLES)
  return [articles, results]
}

export {
  getLatestNwsAlerts,
  getNews
};
