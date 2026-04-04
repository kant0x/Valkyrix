// Web Worker: sends tick messages at ~20fps regardless of tab/window visibility.
// Browser timers in workers are NOT throttled when the window is minimized.
let intervalId: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<'start' | 'stop'>) => {
  if (e.data === 'start') {
    if (intervalId === null) {
      intervalId = setInterval(() => self.postMessage('tick'), 50);
    }
  } else if (e.data === 'stop') {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
