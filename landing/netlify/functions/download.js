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
    { headers: { "User-Agent": "zentrio-download-redirect" } },
  );

  if (!res.ok) {
    return new Response("Failed to fetch latest release", { status: 502 });
  }

  const release = await res.json();
  const asset = release.assets?.find((a) => matcher(a.name));

  if (!asset) {
    return new Response(`No asset found for platform "${platform}" in latest release`, { status: 404 });
  }

  return Response.redirect(asset.browser_download_url, 302);
};

export const config = { path: "/download/:platform" };
