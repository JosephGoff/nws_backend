import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();

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

export const openai_query = async (req, res) => {
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

    console.log(response);
    const JSONArray = cleanGeminiResponse(response);
    console.log(JSONArray);

    if (JSONArray) {
      for (let i = 0; i < JSONArray.length; i++) {
        console.log(articles[JSONArray[i]]);
      }
    }
    return JSONArray;
  } catch (error) {
    console.error(error);
    return null;
  }
};
