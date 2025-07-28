import { VideoPlayer, VideoJsPlayerOptions } from "../shared/components/VideoPlayer.tsx";
import { useEffect, useState } from "preact/hooks";
import { get } from "../shared/utils/idb.ts";
import { STORES } from "../shared/utils/idb.ts";

interface Subtitle {
  label: string;
  src: string;
}

interface VideoPlayerHandlerProps {
  src: string;
  subtitles: Subtitle[];
  fileName: string | null;
}

export default function VideoPlayerHandler({ src, subtitles, fileName }: VideoPlayerHandlerProps) {
  const [videoJsOptions, setVideoJsOptions] = useState<VideoJsPlayerOptions | null>(null);

  useEffect(() => {
    const loadSubtitles = async () => {
      if (!fileName) {
        setVideoJsOptions({
          autoplay: true,
          controls: true,
          responsive: true,
          fill: true,
          sources: [{
            src: src,
            type: "video/mp4"
          }],
          tracks: subtitles.map(sub => ({
            kind: "subtitles",
            label: sub.label,
            srclang: sub.label,
            src: sub.src
          }))
        });
        return;
      }

      const subFileName = `${fileName.split('.').slice(0, -1).join('.')}.srt`;
      const dirHandle = await get<FileSystemDirectoryHandle>(STORES.HANDLES, "downloadDir");
      if (dirHandle) {
        try {
          const fileHandle = await dirHandle.getFileHandle(subFileName);
          const file = await fileHandle.getFile();
          const reader = new FileReader();
          reader.onload = () => {
            const subSrc = reader.result as string;
            const newSubtitles = [...subtitles, { label: "Downloaded", src: subSrc }];
            setVideoJsOptions({
              autoplay: true,
              controls: true,
              responsive: true,
              fill: true,
              sources: [{
                src: src,
                type: "video/mp4"
              }],
              tracks: newSubtitles.map(sub => ({
                kind: "subtitles",
                label: sub.label,
                srclang: sub.label,
                src: sub.src
              }))
            });
          };
          reader.readAsDataURL(file);
        } catch (_error) {
          console.log("No downloaded subtitle found for this video.");
          setVideoJsOptions({
            autoplay: true,
            controls: true,
            responsive: true,
            fill: true,
            sources: [{
              src: src,
              type: "video/mp4"
            }],
            tracks: subtitles.map(sub => ({
              kind: "subtitles",
              label: sub.label,
              srclang: sub.label,
              src: sub.src
            }))
          });
        }
      }
    };

    loadSubtitles();
  }, [src, subtitles, fileName]);

  return (
    <div class="relative h-full">
      {videoJsOptions && <VideoPlayer options={videoJsOptions} src={src} />}
    </div>
  );
}