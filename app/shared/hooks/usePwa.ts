import { useEffect, useState } from "preact/hooks";

export function usePwa() {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const checkPwa = () => {
      const isStandalone = globalThis.matchMedia("(display-mode: standalone)").matches;
      const isMinimalUi = globalThis.matchMedia("(display-mode: minimal-ui)").matches;
      
      if (document.referrer.startsWith("android-app://")) {
        console.log("usePwa: detected android-app referrer");
        setIsPwa(true);
      } else if ((navigator as Navigator & { standalone?: boolean }).standalone || isStandalone || isMinimalUi) {
        console.log("usePwa: detected standalone or minimal-ui display mode");
        setIsPwa(true);
      } else {
        console.log("usePwa: no PWA indicators found");
        setIsPwa(false);
      }
    };

    checkPwa();
    
    // Listen for changes in display mode
    const mediaQuery = globalThis.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", checkPwa);

    return () => {
      mediaQuery.removeEventListener("change", checkPwa);
    };
  }, []);

  return isPwa;
}