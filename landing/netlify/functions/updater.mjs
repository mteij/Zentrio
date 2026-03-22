const REPO_RELEASES_URL = "https://api.github.com/repos/mteij/Zentrio/releases?per_page=1";

const PLATFORM_MATCHERS = {
  "windows-x86_64": {
    asset: (name) => name.endsWith(".exe") && !name.endsWith(".sig"),
    signature: (name) => name.endsWith(".exe.sig"),
  },
  "darwin-aarch64": {
    asset: (name) => name.endsWith(".app.tar.gz") && !name.endsWith(".sig"),
    signature: (name) => name.endsWith(".app.tar.gz.sig"),
  },
};

function normalizeVersion(version) {
  return String(version || "").trim().replace(/^v/i, "");
}

function compareVersions(currentVersion, latestVersion) {
  const current = normalizeVersion(currentVersion).split(".").map(Number);
  const latest = normalizeVersion(latestVersion).split(".").map(Number);
  const length = Math.max(current.length, latest.length);

  for (let i = 0; i < length; i += 1) {
    const left = Number.isFinite(current[i]) ? current[i] : 0;
    const right = Number.isFinite(latest[i]) ? latest[i] : 0;
    if (left < right) return -1;
    if (left > right) return 1;
  }

  return 0;
}

function noUpdate() {
  return {
    statusCode: 204,
    headers: {
      "cache-control": "no-store",
    },
  };
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "zentrio-updater",
      Accept: "application/vnd.github.v3+json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchText(url, signal) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "zentrio-updater",
      Accept: "text/plain",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Signature request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export const handler = async (event) => {
  const currentVersion = normalizeVersion(event.queryStringParameters?.current_version);
  const target = String(event.queryStringParameters?.target || "").trim();
  const arch = String(event.queryStringParameters?.arch || "").trim();
  const platformKey = `${target}-${arch}`;
  const matcher = PLATFORM_MATCHERS[platformKey];

  if (!matcher) {
    return noUpdate();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const releases = await fetchJson(REPO_RELEASES_URL, controller.signal);
    const release = Array.isArray(releases) ? releases[0] : releases;
    if (!release) {
      return noUpdate();
    }

    const latestVersion = normalizeVersion(release.tag_name);
    if (currentVersion && compareVersions(currentVersion, latestVersion) >= 0) {
      return noUpdate();
    }

    const asset = release.assets?.find((entry) => matcher.asset(entry.name));
    const signatureAsset = release.assets?.find((entry) => matcher.signature(entry.name));
    if (!asset || !signatureAsset) {
      console.warn("Updater asset missing for platform", {
        platformKey,
        tag: release.tag_name,
        hasAsset: Boolean(asset),
        hasSignature: Boolean(signatureAsset),
      });
      return noUpdate();
    }

    const signature = (await fetchText(signatureAsset.browser_download_url, controller.signal)).trim();

    return {
      statusCode: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        version: latestVersion,
        notes: release.body || "",
        pub_date: release.published_at || release.created_at,
        url: asset.browser_download_url,
        signature,
      }),
    };
  } catch (error) {
    console.error("Updater function error:", error);

    if (error?.name === "AbortError") {
      return {
        statusCode: 504,
        headers: {
          "cache-control": "no-store",
        },
        body: "Updater request timed out",
      };
    }

    return {
      statusCode: 502,
      headers: {
        "cache-control": "no-store",
      },
      body: `Updater request failed: ${error.message || String(error)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
};
