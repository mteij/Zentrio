const PLATFORM_PATTERNS = {
  android: (name) => /android-arm64.*\.apk$/i.test(name),
  "android-universal": (name) => /android-universal.*\.apk$/i.test(name),
  windows: (name) => /\.exe$/i.test(name),
  mac: (name) => /\.dmg$/i.test(name),
  "linux-deb": (name) => /\.deb$/i.test(name),
  "linux-rpm": (name) => /\.rpm$/i.test(name),
  "linux-appimage": (name) => /\.AppImage$/i.test(name),
  ios: (name) => /\.ipa$/i.test(name),
};

export default async (req) => {
  try {
    const platform = new URL(req.url).pathname.split("/").pop();

    const matcher = PLATFORM_PATTERNS[platform];
    if (!matcher) {
      return new Response(
        `Unknown platform "${platform}". Valid options: ${Object.keys(PLATFORM_PATTERNS).join(", ")}`,
        { status: 400 },
      );
    }

    const res = await fetch(
      "https://api.github.com/repos/mteij/Zentrio/releases/latest",
      { 
        headers: { 
          "User-Agent": "zentrio-download-redirect",
          "Accept": "application/vnd.github.v3+json"
        },
        timeout: 10000
      },
    );

    if (!res.ok) {
      // Provide more specific error messages based on status code
      if (res.status === 403) {
        return new Response(
          "GitHub API rate limit exceeded. Please try again later.",
          { status: 502 }
        );
      } else if (res.status === 404) {
        return new Response(
          "Repository not found or no releases available",
          { status: 502 }
        );
      } else {
        return new Response(
          `Failed to fetch latest release: ${res.status} ${res.statusText}`,
          { status: 502 }
        );
      }
    }

    const release = await res.json();
    const asset = release.assets?.find((a) => matcher(a.name));

    if (!asset) {
      return new Response(`No asset found for platform "${platform}" in latest release`, { status: 404 });
    }

    return Response.redirect(asset.browser_download_url, 302);
  } catch (error) {
    // Handle network errors, timeouts, etc.
    console.error("Download function error:", error);
    return new Response(
      `Internal server error: ${error.message}`,
      { status: 502 }
    );
  }
};

export const config = { path: "/download/:platform" };
