const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const axios = require("axios");
// Removed: const cheerio = require("cheerio"); // Was unused

const app = express();

const STREMIO_BASE_URL = "https://web.stremio.com/";

app.get("/*", async (req, res) => {
  console.log("Proxy function invoked for path:", req.path);

  if (!req.path) {
    console.warn("Received request with empty path.");
    return res.status(400).send("Bad Request: Path is empty.");
  }

  // Extract the path for Stremio by removing the /stremio prefix
  // This resolves the 404 issue on the Stremio side.
  const stremioPath = req.path.substring("/stremio".length);
  // Ensure that if stremioPath is empty (e.g., for /stremio/),
  // it defaults to '/' to avoid invalid URLs.
  const targetUrl = new URL(
      stremioPath || "/",
      STREMIO_BASE_URL,
  ).href;

  console.log("Proxying URL:", targetUrl); // Shortened log message

  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/91.0.4472.124 Safari/537.36"; // Formatted for max-len

    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer", // Fetch as a buffer to handle all file types
      headers: {
        "User-Agent": userAgent,
      },
    });

    const contentType = response.headers["content-type"];

    // Set CORS headers to allow everything
    res.set("Access-Control-Allow-Origin", "*");

    // Forward the content type from the original response
    if (contentType) {
      res.set("Content-Type", contentType);
    }

    res.send(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message, "for URL:", targetUrl);
    if (error.response) {
      console.error("Axios response error:", {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data ?
          error.response.data.toString() :
          "[No data]", // Split into multiple lines for max-len
      });
    }
    console.error("Error stack:", error.stack);

    const status = error.response ? error.response.status : 500;
    res.status(status).send(`Error fetching the URL: ${error.message}`);
  }
});

exports.proxy = onRequest({region: "europe-west3"}, app);
