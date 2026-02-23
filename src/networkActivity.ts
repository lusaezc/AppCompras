type Listener = (pendingRequests: number) => void;

const listeners = new Set<Listener>();

let pendingRequests = 0;
let installed = false;

const emit = () => {
  listeners.forEach((listener) => listener(pendingRequests));
};

const increase = () => {
  pendingRequests += 1;
  emit();
};

const decrease = () => {
  pendingRequests = Math.max(0, pendingRequests - 1);
  emit();
};

export const getPendingRequests = () => pendingRequests;

export const subscribeNetworkActivity = (listener: Listener) => {
  listeners.add(listener);
  listener(pendingRequests);
  return () => {
    listeners.delete(listener);
  };
};

export const installFetchTracker = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    increase();
    try {
      return await originalFetch(...args);
    } finally {
      decrease();
    }
  };
};
