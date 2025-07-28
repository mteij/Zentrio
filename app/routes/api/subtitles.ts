import { Handlers } from "$fresh/server.ts";
import { getUserSubDlApiKey, getUserSubtitleLanguage, getUserTmdbApiKey } from "../../utils/db.ts";
import { AppState } from "../_middleware.ts";
import { BlobReader, BlobWriter, ZipReader } from "npm:@zip.js/zip.js";

export const handler: Handlers<unknown, AppState> = {
  async POST(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { fileName } = await req.json();

    const apiKey = await getUserSubDlApiKey(userId);
    const language = await getUserSubtitleLanguage(userId);
    const tmdbApiKey = await getUserTmdbApiKey(userId);

    if (!apiKey) {
      return new Response("SubDL API key is required", { status: 400 });
    }

    try {
      let tmdb_id = null;
      if (tmdbApiKey) {
        const yearMatch = fileName.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : null;
        const query = year ? `${fileName.split('(')[0].trim()}` : fileName;
        const tmdbUrl = new URL("https://api.themoviedb.org/3/search/movie");
        tmdbUrl.searchParams.set("api_key", tmdbApiKey);
        tmdbUrl.searchParams.set("query", query);
        if (year) {
          tmdbUrl.searchParams.set("year", year);
        }
        const tmdbResponse = await fetch(tmdbUrl);
        const tmdbData = await tmdbResponse.json();
        if (tmdbData.results && tmdbData.results.length > 0) {
          tmdb_id = tmdbData.results[0].id;
        }
      }

      const url = new URL("https://api.subdl.com/api/v1/subtitles");
      url.searchParams.set("api_key", apiKey);
      if (tmdb_id) {
        url.searchParams.set("tmdb_id", tmdb_id);
      } else {
        const yearMatch = fileName.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : null;
        const film_name = year ? `${fileName.split('(')[0].trim()}` : fileName;
        url.searchParams.set("film_name", film_name);
        if (year) {
          url.searchParams.set("year", year);
        }
      }
      url.searchParams.set("languages", language);

      console.log("Searching for subtitles with URL:", url.toString());
      let response = await fetch(url);
      let data = await response.json();
      console.log(`Found ${data.subtitles ? data.subtitles.length : 0} subtitles.`);

      if (language !== "en" && (!data.status || !data.subtitles || data.subtitles.length === 0)) {
        console.log("No subtitles found in the preferred language. Trying English...");
        url.searchParams.set("languages", "en");
        response = await fetch(url);
        data = await response.json();
        console.log(`Found ${data.subtitles ? data.subtitles.length : 0} English subtitles.`);
      }

      if (data.status && data.subtitles && data.subtitles.length > 0) {
        const sub = data.subtitles[0];
        const downloadUrl = `https://dl.subdl.com${sub.url}`;
        const subResponse = await fetch(downloadUrl);
        const subData = await subResponse.blob();
        
        try {
          const zipReader = new ZipReader(new BlobReader(subData));
          const entries = await zipReader.getEntries();
          const srtEntry = entries.find(entry => entry.filename.endsWith(".srt"));

          if (srtEntry && srtEntry.getData) {
            const srtContent = await srtEntry.getData(new BlobWriter());
            return new Response(srtContent, {
              headers: { "Content-Type": "text/plain" },
            });
          } else {
            return new Response("No .srt file found in the zip archive", { status: 404 });
          }
        } catch (error) {
          // If it's not a zip file, assume it's a raw srt file
          const srtContent = await subData.text();
          return new Response(srtContent, {
            headers: { "Content-Type": "text/plain" },
          });
        }
      } else {
        return new Response("No subtitles found", { status: 404 });
      }
    } catch (error) {
      console.error("Failed to download subtitles:", error);
      return new Response("Failed to download subtitles", { status: 500 });
    }
  },
};