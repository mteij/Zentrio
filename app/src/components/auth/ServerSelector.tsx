import { useState, useEffect } from "react";
import { toast } from 'sonner'
import { Server, Wrench, ArrowRight, Loader2 } from "lucide-react";
import { getServerUrl, isTauri } from "../../lib/auth-client";

interface ServerSelectorProps {
  onServerSelected: (url: string) => void;
  showDevMode?: boolean;
}

export function ServerSelector({ onServerSelected, showDevMode = false }: ServerSelectorProps) {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // initialize with current stored or default
    const storedUrl = getServerUrl();
    // Don't show external URLs by default in the input - start clean
    if (storedUrl && storedUrl !== window.location.origin) {
      setUrl(storedUrl);
    }
  }, []);

  const handleConnect = async (targetUrl: string, skipHealthCheck = false) => {
    try {
      setChecking(true);
      
      let cleanUrl = targetUrl.replace(/\/$/, "");
      if (!cleanUrl.startsWith("http")) {
        cleanUrl = `https://${cleanUrl}`;
      }

      if (!skipHealthCheck) {
        // Simple health check with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          console.log('[Connection Check] Target:', cleanUrl);
          const isTauriEnv = isTauri();
          console.log('[Connection Check] Is Tauri:', isTauriEnv);
          
          let fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
          try {
             fetchFn = isTauriEnv ? (await import('@tauri-apps/plugin-http')).fetch : fetch;
          } catch (importErr) {
             console.error('Failed to import Tauri HTTP plugin:', importErr);
             fetchFn = fetch;
          }
          
          const tryFetch = async (endpoint: string) => {
            console.log(`Trying endpoint: ${endpoint}`);
            const r = await fetchFn(endpoint, { signal: controller.signal });
            return r;
          };

          let res = await tryFetch(`${cleanUrl}/api/health`);
          
          if (!res.ok && res.status === 404) {
             console.log('/api/health returned 404, trying /health');
             const res2 = await tryFetch(`${cleanUrl}/health`);
             if (res2.ok) res = res2;
          }

          clearTimeout(timeoutId);
          console.log('[Connection Check] Status:', res.status);
          
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error('Response error:', res.status, text);
            throw new Error(`Server returned error ${res.status}: ${text.substring(0, 50)}`);
          }
          
          const data = await res.json();
          console.log('[Connection Check] Data:', data);
          if (data.status !== "ok") {
            throw new Error(`Server status is '${data.status}' (expected 'ok')`);
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          console.error('[Connection Check] Exception:', fetchErr);
          
          if (fetchErr.name === 'AbortError') {
            throw new Error("Connection timed out. Server unavailable.");
          }
          
          if (fetchErr.message?.includes('Failed to fetch') || fetchErr.message?.includes('NetworkError') || fetchErr.message?.includes('Load failed')) {
            throw new Error(`Network Error: ${fetchErr.message}. (CORS or Offline)`);
          }
          
          throw fetchErr;
        }
      }

      localStorage.setItem("zentrio_server_url", cleanUrl);
      toast.success('Connected', { description: `Connected to ${cleanUrl}` });
      onServerSelected(cleanUrl);
    } catch (e: any) {
      const message = e.message || 'Failed to connect to server. Please check the URL.';
      toast.error('Connection Failed', { description: message });
    } finally {
      setChecking(false);
    }
  };
  
  const handleDevMode = () => {
    // Use a special marker that tells auth-client to use the current origin
    // This ensures requests go through the Vite proxy
    localStorage.setItem("zentrio_server_url", "PROXY");
    toast.success('Development Mode', { description: 'Using local development server' });
    onServerSelected("PROXY");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white p-4">
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-10 shadow-2xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-6">
              <Server className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
              Connect to Server
            </h1>
            <p className="text-zinc-400 text-sm">
              Enter the URL of your Zentrio server to continue.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="server-url" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">
                Server URL
              </label>
              <input
                id="server-url"
                type="text"
                placeholder="https://app.zentrio.eu"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && url && handleConnect(url)}
                className="!w-full bg-white/5 border border-white/10 !rounded-md !px-4 !py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all font-light"
              />
            </div>

            <button
              onClick={() => handleConnect(url)}
              disabled={checking || !url}
              className="!w-full bg-red-600 hover:bg-red-700 text-white font-medium !py-3 !rounded-md transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Connect
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase text-zinc-500 font-medium">Or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Quick Options */}
            <button
              onClick={() => handleConnect("https://app.zentrio.eu")}
              disabled={checking}
              className="!w-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-medium !py-3 !rounded-md transition-all disabled:opacity-50"
            >
              Use Official Server
            </button>
            
            {showDevMode && (
              <button
                onClick={handleDevMode}
                className="!w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-medium !py-3 !rounded-md transition-all"
              >
                <Wrench className="w-4 h-4" />
                Development Mode (localhost:3000)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
