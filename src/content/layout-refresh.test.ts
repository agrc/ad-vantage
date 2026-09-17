import { describe, expect, it, vi } from "vitest";
import { createLayoutRefreshController } from "./layout-refresh";

describe("createLayoutRefreshController", () => {
  it("coalesces native header resize notifications into one refresh", () => {
    const onRefresh = vi.fn();
    let notify: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const controller = createLayoutRefreshController(
      onRefresh,
      (callback) => {
        notify = callback;
        return { observe, disconnect };
      },
    );
    const header = document.createElement("tr");
    const firstCell = document.createElement("th");
    const secondCell = document.createElement("th");
    let animationFrameCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        animationFrameCallback = callback;
        return 1;
      });

    controller.sync([header, firstCell, secondCell]);
    notify!([], {} as ResizeObserver);
    notify!([], {} as ResizeObserver);
    animationFrameCallback!(0);

    expect(observe).toHaveBeenCalledWith(header);
    expect(observe).toHaveBeenCalledWith(firstCell);
    expect(observe).toHaveBeenCalledWith(secondCell);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledOnce();
    requestAnimationFrame.mockRestore();
  });
});