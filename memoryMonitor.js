// memoryMonitor.js
// Log memory usage periodically so Render logs show the trend before an OOM kill.
// Import this once in index.js: import "./memoryMonitor.js";

const INTERVAL_MS     = 5 * 60 * 1000; // every 5 minutes
const WARN_THRESHOLD  = 400;            // MB — warn if usage exceeds this

export function startMemoryMonitor() {
  setInterval(() => {
    const used = process.memoryUsage();
    const mb   = (bytes) => (bytes / 1024 / 1024).toFixed(1);

    const heapMB = parseFloat(mb(used.heapUsed));
    const rssMB  = parseFloat(mb(used.rss));

    if (rssMB > WARN_THRESHOLD) {
      console.warn(`[memory] ⚠️  High memory usage — RSS: ${rssMB}MB, Heap: ${heapMB}MB`);
    } else {
      console.log(`[memory] RSS: ${rssMB}MB, Heap: ${heapMB}MB`);
    }
  }, INTERVAL_MS);
}
