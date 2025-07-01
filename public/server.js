const express = require('express');
const fetch = require('node-fetch'); // To make requests from the server
const path = apath = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// This serves all the files from the 'public' folder
// We will place your app.js and index.html inside 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Define the proxy route
app.get('/proxy', async (req, res) => {
    // Get the URL to fetch from the query parameters
    const urlToFetch = req.query.url;

    if (!urlToFetch) {
        return res.status(400).send({ message: 'URL query parameter is required.' });
    }

    try {
        console.log(`Proxying request to: ${urlToFetch}`);

        // Fetch the content from the target URL
        const response = await fetch(urlToFetch, {
            // Pass along headers if needed, for example:
            headers: { 'User-Agent': 'StremioHub-Proxy/1.0' }
        });

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        // Send the content back to your front-end
        const content = await response.text();
        res.send(content);

    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send({ message: 'Failed to proxy request.', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
});