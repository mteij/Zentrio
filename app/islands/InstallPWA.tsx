import { useEffect, useState } from "preact/hooks";

export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
      const dismissed = sessionStorage.getItem("pwaInstallDismissed");
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;

    (installPrompt as any).prompt();

    (installPrompt as any).userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt");
      } else {
        console.log("User dismissed the install prompt");
      }
      setInstallPrompt(null);
      setIsVisible(false);
    });
  };

  const handleDismissClick = () => {
    sessionStorage.setItem("pwaInstallDismissed", "true");
    setIsVisible(false);
  };

  if (!installPrompt || !isVisible) {
    return null;
  }

  return (
    <div class="fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-2xl bg-zentrio-gray-800 bg-opacity-90 backdrop-blur-sm border border-zentrio-gray-700 max-w-sm animate-fadein">
      <div class="flex items-center">
        <img src="/icons/icon-192.png" alt="Zentrio Icon" class="w-16 h-16 mr-4"/>
        <div>
          <h3 class="text-lg font-bold text-white">Install Zentrio</h3>
          <p class="text-gray-300 text-sm">Get the best experience by installing the app on your device.</p>
        </div>
      </div>
      <div class="flex justify-end mt-4 space-x-2">
        <button
          type="button"
          onClick={handleDismissClick}
          class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-zentrio-gray-700 focus:outline-none"
        >
          No, thanks
        </button>
        <button
          type="button"
          onClick={handleInstallClick}
          class="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
        >
          Install
        </button>
      </div>
    </div>
  );
}