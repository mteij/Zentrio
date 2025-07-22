const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

const STREMIO_BASE_URL = "https://web.stremio.com/";
const STREMIO_API_URL = "https://api.stremio.com/";

// List of paths that should be proxied to the API
const API_PATHS = ["/login", "/login/v2", "/logout", "/register"];

const proxyRequest = async (req, res) => {
  console.log(`Proxy function invoked for path: ${req.path}, method: ${req.method}`);

  if (!req.path) {
    console.warn("Received request with empty path.");
    return res.status(400).send("Bad Request: Path is empty.");
  }

  const stremioPath = req.path.substring("/stremio".length);

  const isApiCall = API_PATHS.some((apiPath) => stremioPath.startsWith(apiPath));
  const baseUrl = isApiCall ? STREMIO_API_URL : STREMIO_BASE_URL;

  const targetUrl = new URL(stremioPath || "/", baseUrl).href;

  console.log("Proxying URL:", targetUrl);

  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/91.0.4472.124 Safari/537.36";

    const headers = {
      "User-Agent": userAgent,
      "Accept": req.headers.accept || "application/json, text/plain, */*",
    };
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }
    if (req.headers["authorization"]) {
      headers["Authorization"] = req.headers["authorization"];
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      responseType: "arraybuffer",
      headers: headers,
    });

    // Set CORS headers to allow everything
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Forward relevant headers from the original response
    const headersToForward = [
      "content-type",
      "cache-control",
      "etag",
      "last-modified",
    ];
    headersToForward.forEach((header) => {
      if (response.headers[header]) {
        res.set(header, response.headers[header]);
      }
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message, "for URL:", targetUrl);
    if (error.response) {
      console.error("Axios response error:", {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data ?
          error.response.data.toString() :
          "[No data]",
      });
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).send(`Error fetching the URL: ${error.message}`);
    }
  }
};

// Handle preflight OPTIONS requests for CORS
app.options("/*", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).send("");
});

// Handle both GET and POST requests to the proxy
app.get("/*", proxyRequest);
app.post("/*", proxyRequest);

exports.proxy = onRequest({region: "europe-west3"}, app);
