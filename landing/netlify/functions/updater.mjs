const REPO_RELEASES_URL = "https://api.github.com/repos/mteij/Zentrio/releases?per_page=5";

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

function parseSemver(version) {
  const cleaned = normalizeVersion(version);
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: cleaned.includes("-") ? cleaned.split("-")[1]?.split(".")[0] || "" : "",
  };
}

function compareVersions(currentVersion, latestVersion) {
  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);
  if (!current || !latest) return 0;

  if (latest.major !== current.major) return latest.major > current.major ? 1 : -1;
  if (latest.minor !== current.minor) return latest.minor > current.minor ? 1 : -1;
  if (latest.patch !== current.patch) return latest.patch > current.patch ? 1 : -1;

  const currentPre = current.prerelease;
  const latestPre = latest.prerelease;
  if (currentPre && !latestPre) return 1;
  if (!currentPre && latestPre) return -1;
  if (currentPre && latestPre) return latestPre.localeCompare(currentPre);

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

function findUpdate(releases, currentVersion, platformKey) {
  const matcher = PLATFORM_MATCHERS[platformKey];
  if (!matcher) return null;

  const currentSemver = parseSemver(currentVersion);
  if (!currentSemver) return null;

  for (const release of releases) {
    if (release.draft) continue;

    const releaseSemver = parseSemver(release.tag_name);
    if (!releaseSemver) continue;

    if (releaseSemver.major <= currentSemver.major &&
        releaseSemver.minor <= currentSemver.minor &&
        releaseSemver.patch <= currentSemver.patch) {
      continue;
    }

    if (releaseSemver.prerelease && currentSemver.prerelease) {
      if (releaseSemver.prerelease <= currentSemver.prerelease) {
        continue;
      }
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
      continue;
    }

    return { release, asset, signatureAsset };
  }

  return null;
}

export const handler = async (event) => {
  const currentVersion = normalizeVersion(event.queryStringParameters?.current_version);
  const target = String(event.queryStringParameters?.target || "").trim();
  const arch = String(event.queryStringParameters?.arch || "").trim();
  const platformKey = `${target}-${arch}`;

  if (!PLATFORM_MATCHERS[platformKey]) {
    return noUpdate();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const releases = await fetchJson(REPO_RELEASES_URL, controller.signal);
    if (!Array.isArray(releases) || releases.length === 0) {
      return noUpdate();
    }

    const update = findUpdate(releases, currentVersion, platformKey);
    if (!update) {
      return noUpdate();
    }

    const { release, asset, signatureAsset } = update;
    const latestVersion = normalizeVersion(release.tag_name);
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
        platforms: {
          [platformKey]: {
            url: asset.browser_download_url,
            signature,
          },
        },
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
