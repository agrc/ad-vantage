type ResizeObserverLike = Pick<ResizeObserver, "disconnect" | "observe">;

type CreateResizeObserver = (
  callback: ResizeObserverCallback,
) => ResizeObserverLike;

export function createLayoutRefreshController(
  onRefresh: () => void,
  createObserver: CreateResizeObserver = (callback) =>
    new ResizeObserver(callback),
) {
  let animationFrame: number | undefined;
  let observedHeaders = new Set<HTMLElement>();
  const observer = createObserver(() => {
    if (animationFrame !== undefined) return;

    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = undefined;
      onRefresh();
    });
  });

  return {
    sync(headers: Iterable<HTMLElement>) {
      const nextHeaders = new Set(headers);
      if (
        nextHeaders.size === observedHeaders.size &&
        Array.from(nextHeaders).every((header) => observedHeaders.has(header))
      ) {
        return;
      }

      observer.disconnect();
      nextHeaders.forEach((header) => observer.observe(header));
      observedHeaders = nextHeaders;
    },
  };
}