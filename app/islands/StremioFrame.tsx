import { h as _h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ProfileSchema } from "../utils/db.ts";
// We will add the automation logic here later

interface StremioFrameProps {
  profile: ProfileSchema;
}

export default function StremioFrame({ profile }: StremioFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onload = () => {
      console.log("Iframe loaded. Automation would run now for profile:", profile.name);
      // TODO: Implement iframe automation logic
    };
  }, [profile]);

  return (
    <iframe
      ref={iframeRef}
      src="/stremio/"
      class="w-full h-full border-none"
    >
    </iframe>
  );
}
