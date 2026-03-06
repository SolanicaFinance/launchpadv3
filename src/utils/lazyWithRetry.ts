import { lazy } from "react";

export function lazyWithRetry(
  importFn: () => Promise<any>,
  retries = 3,
  interval = 1000
) {
  return lazy(() => {
    const attempt = (retriesLeft: number): Promise<any> =>
      importFn().catch((error: unknown) => {
        if (retriesLeft <= 0) throw error;
        return new Promise((resolve) =>
          setTimeout(() => resolve(attempt(retriesLeft - 1)), interval)
        );
      });
    return attempt(retries);
  });
}
