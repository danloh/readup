class EventDispatcher {
  private syncListeners: Map<string, Array<(event: CustomEvent) => boolean>>;
  private asyncListeners: Map<string, Set<(event: CustomEvent) => Promise<void> | void>>;

  constructor() {
    this.syncListeners = new Map();
    this.asyncListeners = new Map();
  }

  on(event: string, callback: (event: CustomEvent) => Promise<void> | void): void {
    if (!this.asyncListeners.has(event)) {
      this.asyncListeners.set(event, new Set());
    }
    this.asyncListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (event: CustomEvent) => Promise<void> | void): void {
    this.asyncListeners.get(event)?.delete(callback);
  }

  async dispatch(event: string, detail?: unknown): Promise<void> {
    const listeners = this.asyncListeners.get(event);
    if (listeners) {
      const customEvent = new CustomEvent(event, { detail });
      // Snapshot the listeners before iterating: an awaited listener may
      // (re)subscribe another handler for the same event — e.g. a React effect
      // re-running on a state change it triggered. Iterating the live Set would
      // invoke that freshly-added handler in the same dispatch, double-firing
      // the event (paragraph mode toggled twice per keypress, #4717). dispatchSync
      // already snapshots for the same reason.
      for (const listener of [...listeners]) {
        await listener(customEvent);
      }
    }
  }

  onSync(event: string, callback: (event: CustomEvent) => boolean): void {
    if (!this.syncListeners.has(event)) {
      this.syncListeners.set(event, []);
    }
    this.syncListeners.get(event)!.push(callback);
  }

  offSync(event: string, callback: (event: CustomEvent) => boolean): void {
    const listeners = this.syncListeners.get(event);
    if (listeners) {
      this.syncListeners.set(
        event,
        listeners.filter((listener) => listener !== callback),
      );
    }
  }

  dispatchSync(event: string, detail?: unknown): boolean {
    const listeners = this.syncListeners.get(event);
    if (listeners) {
      const customEvent = new CustomEvent(event, { detail });
      for (const listener of [...listeners].reverse()) {
        const consumed = listener(customEvent);
        if (consumed) {
          return true;
        }
      }
    }
    return false;
  }
}

export const eventDispatcher = new EventDispatcher();
