const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio"); // Import cheerio

const app = express();

app.get("/*", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send("Error: Missing 'url' query parameter.");
  }

  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/91.0.4472.124 Safari/537.36";

    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent": userAgent,
      },
    });

    // Load the HTML content into cheerio
    const $ = cheerio.load(response.data);

    // Add a <base> tag to the <head> to resolve relative paths
    $("head").prepend(`<base href="${targetUrl}">`);

    // We still don't forward security headers
    res.set({
      "Content-Type": response.headers["content-type"],
    });

    // Send the modified HTML
    res.send($.html());
  } catch (error) {
    console.error("Proxy error:", error.message);
    return res.status(500).send(`Error fetching the URL: ${error.message}`);
  }
});

// Expose the express app as a Firebase Cloud Function
exports.proxy = onRequest({region: "europe-west3"}, app);
