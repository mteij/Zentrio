import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// GLOBAL FETCH PATCH for broken libraries (better-auth/plugins)
// Some updates to better-auth seem to pass a Promise as the method property
// which causes the browser to crash with "Failed to execute 'fetch' on 'Window'".
const originalFetch = window.fetch;
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    // Intercept better-fetch method normalization probe to prevent crash in native fetch
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes('fetch-options/method') || urlStr.endsWith('to-upper-case')) {
        console.warn('[GlobalFetch] Intercepted internal check request:', urlStr);
        return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let overrideMethod: any = init ? init.method : undefined;
    if (overrideMethod instanceof Promise) {
        console.warn('[GlobalFetch] Found Promise in init.method, resolving...');
        try {
            overrideMethod = await overrideMethod;
        } catch (e) {
            console.error('[GlobalFetch] Failed to resolve method promise:', e);
            overrideMethod = 'GET';
        }
    } 
    
    if (overrideMethod && typeof overrideMethod === 'object') {
        // Better Fetch might pass an object proxy. Convert it to string so native fetch doesn't throw.
        try {
           const methodObj = overrideMethod;
           overrideMethod = typeof methodObj.toString === 'function' && methodObj.toString() !== '[object Object]' 
              ? methodObj.toString() 
              : (init?.body ? 'POST' : 'GET');
        } catch(e) {
           overrideMethod = init?.body ? 'POST' : 'GET';
        }
    }

    if (overrideMethod === '[object Object]' || !overrideMethod) {
       overrideMethod = init?.body ? 'POST' : 'GET';
    }
    
    // Create a new init object to avoid mutating frozen/proxy objects from better-fetch
    const finalInit = init ? { ...init } : undefined;
    if (finalInit && overrideMethod) {
        // Double check it's definitely a primitive string before sending to fetch
        finalInit.method = String(overrideMethod);
    }

    return originalFetch(input, finalInit);
}) as any;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
