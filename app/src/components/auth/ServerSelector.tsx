import { useState, useEffect } from "react";
import { toast } from 'sonner'
import { Check, AlertCircle, Server } from "lucide-react";
import { getServerUrl } from "../../lib/auth-client";

interface ServerSelectorProps {
  onServerSelected: (url: string) => void;
}

export function ServerSelector({ onServerSelected }: ServerSelectorProps) {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // initialize with current stored or default
    setUrl(getServerUrl());
  }, []);

  const handleConnect = async (targetUrl: string) => {
    try {
      setChecking(true);
      setError(null);
      
      let cleanUrl = targetUrl.replace(/\/$/, "");
      if (!cleanUrl.startsWith("http")) {
        cleanUrl = `https://${cleanUrl}`;
      }

      // Simple health check
      const res = await fetch(`${cleanUrl}/api/health`);
      if (!res.ok) {
        throw new Error("Could not connect to server");
      }
      
      const data = await res.json();
      if (data.status !== "ok") {
        throw new Error("Server returned invalid status");
      }

      localStorage.setItem("zentrio_server_url", cleanUrl);
      onServerSelected(cleanUrl);
    } catch (e) {
      toast.error('Connection Failed', { description: 'Failed to connect to server. Please check the URL.' })
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-6">
            <Server className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Connect to Server</h2>
          <p className="mt-2 text-zinc-400">
            Enter the URL of your Zentrio server to continue.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="server-url" className="text-sm font-medium text-zinc-300">
              Server URL
            </label>
            <input
              id="server-url"
              type="text"
              placeholder="https://app.zentrio.eu"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all placeholder:text-zinc-600"
            />
          </div>


          <button
            onClick={() => handleConnect(url)}
            disabled={checking || !url}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {checking ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Connect
                <Check className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-950 px-2 text-zinc-500">Or</span>
            </div>
          </div>

          <button
            onClick={() => handleConnect("https://app.zentrio.eu")}
            disabled={checking}
            className="w-full px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium rounded-lg transition-colors"
          >
            Use Official Server
          </button>
        </div>
      </div>
    </div>
  );
}
