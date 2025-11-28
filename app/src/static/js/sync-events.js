(function() {
  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('App is online, triggering sync...');
    fetch('/api/sync/trigger', { method: 'POST' }).catch(console.error);
  });

  // Listen for visibility change (app resume)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('App resumed, triggering sync...');
      fetch('/api/sync/trigger', { method: 'POST' }).catch(console.error);
    }
  });
})();