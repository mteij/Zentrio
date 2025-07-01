// functions/index.js

const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const axios = require("axios");

const app = express();

// This function acts as a proxy to fetch content from another URL.
// It bypasses browser CORS restrictions by fetching the content on the server.
app.get("/", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send("Error: Missing 'url' query parameter.");
  }

  try {
    // Define a standard User-Agent to avoid being blocked.
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/91.0.4472.124 Safari/537.36";

    // Fetch the target URL using axios
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent": userAgent,
      },
    });

    // IMPORTANT: We explicitly do NOT forward security headers like
    // Content-Security-Policy or X-Frame-Options from the target server.
    // This is what allows the content to be embedded in an iframe.
    res.set({
      "Content-Type": response.headers["content-type"],
    });

    res.send(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message);
    return res.status(500).send(`Error fetching the URL: ${error.message}`);
  }
});

// Expose the express app as a Firebase Cloud Function.
// Using v2 syntax and setting the region.
exports.proxy = onRequest({region: "europe-west3"}, app);
