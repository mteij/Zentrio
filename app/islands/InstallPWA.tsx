import { useEffect, useState } from "preact/hooks";

export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    globalThis.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      globalThis.removeEventListener(
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
    });
  };

  if (!installPrompt) {
    return null;
  }

  return (
    <div class="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg flex items-center space-x-4">
      <p>Get the best experience. Install Zentrio?</p>
      <button
        type="button"
        onClick={handleInstallClick}
        class="bg-purple-600 text-white px-4 py-2 rounded-lg"
      >
        Install
      </button>
    </div>
  );
}