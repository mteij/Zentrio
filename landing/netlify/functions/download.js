const PLATFORM_PATTERNS = {
  android: (name) => /android-universal.*\.apk$/i.test(name),
  windows: (name) => /\.exe$/i.test(name),
  mac: (name) => /\.dmg$/i.test(name),
  "linux-deb": (name) => /\.deb$/i.test(name),
  "linux-rpm": (name) => /\.rpm$/i.test(name),
  "linux-appimage": (name) => /\.AppImage$/i.test(name),
  ios: (name) => /\.ipa$/i.test(name),
};

export const handler = async (event) => {
  const platform = event.queryStringParameters?.platform;

  const matcher = PLATFORM_PATTERNS[platform];
  if (!matcher) {
    return {
      statusCode: 400,
      body: `Unknown platform "${platform}". Valid options: ${Object.keys(PLATFORM_PATTERNS).join(", ")}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let res;
    try {
      res = await fetch(
        "https://api.github.com/repos/mteij/Zentrio/releases/latest",
        {
          headers: {
            "User-Agent": "zentrio-download-redirect",
            Accept: "application/vnd.github.v3+json",
          },
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      if (res.status === 403) {
        return { statusCode: 502, body: "GitHub API rate limit exceeded. Please try again later." };
      } else if (res.status === 404) {
        return { statusCode: 502, body: "Repository not found or no releases available" };
      }
      return { statusCode: 502, body: `Failed to fetch latest release: ${res.status} ${res.statusText}` };
    }

    const release = await res.json();
    const asset = release.assets?.find((a) => matcher(a.name));

    if (!asset) {
      return { statusCode: 404, body: `No asset found for platform "${platform}" in latest release` };
    }

    return {
      statusCode: 302,
      headers: { Location: asset.browser_download_url },
    };
  } catch (error) {
    console.error("Download function error:", error);
    if (error.name === "AbortError") {
      return { statusCode: 504, body: "Request timeout: GitHub API took too long to respond" };
    }
    return { statusCode: 502, body: `Internal server error: ${error.message}` };
  }
};
