"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

export type SSEConnectionState = "connecting" | "open" | "closed";

type EventHandler = (data: string) => void;

interface SSEContextValue {
  connectionState: SSEConnectionState;
  /**
   * Subscribe to a named SSE event. Returns an unsubscribe function.
   * Safe to call at any time — registers the EventSource listener lazily if
   * the connection is already live, or on the next connect if not.
   */
  subscribe: (eventType: string, handler: EventHandler) => () => void;
}

const SSEContext = createContext<SSEContextValue | null>(null);

export function SSEProvider({ url, children }: { url: string; children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>(
    url ? "connecting" : "closed"
  );

  // All registered handlers, keyed by event type.
  // Using a ref so event listeners always read the current handler set.
  const handlersMap = useRef(new Map<string, Set<EventHandler>>());
  const esRef = useRef<EventSource | null>(null);
  // Tracks which event types have a live addEventListener on the current ES instance.
  const listenedRef = useRef(new Set<string>());

  // Stable dispatch — reads handlersMap at call time, so no stale closures.
  const dispatch = useCallback((eventType: string, data: string) => {
    handlersMap.current.get(eventType)?.forEach((h) => h(data));
  }, []);

  useEffect(() => {
    if (!url) { setConnectionState("closed"); return; }

    let cancelled = false;
    let retryDelay = 2000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function attachType(es: EventSource, eventType: string) {
      if (listenedRef.current.has(eventType)) return;
      listenedRef.current.add(eventType);
      es.addEventListener(eventType, (e: MessageEvent) => {
        if (!cancelled) dispatch(eventType, e.data);
      });
    }

    function connect() {
      if (cancelled) return;
      setConnectionState("connecting");

      const es = new EventSource(url);
      esRef.current = es;
      listenedRef.current.clear();

      // Re-attach all known event types on every (re)connect.
      for (const [type] of handlersMap.current) attachType(es, type);
      // Always silence keepalive pings.
      attachType(es, "ping");

      es.onopen = () => {
        if (!cancelled) { setConnectionState("open"); retryDelay = 2000; }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!cancelled) {
          setConnectionState("closed");
          timer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30_000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [url, dispatch]);

  const subscribe = useCallback(
    (eventType: string, handler: EventHandler): (() => void) => {
      if (!handlersMap.current.has(eventType)) {
        handlersMap.current.set(eventType, new Set());
        // If an EventSource is already live and hasn't registered this type yet,
        // add the listener now — it will also be re-added on the next reconnect
        // because handlersMap now contains this type.
        if (esRef.current && !listenedRef.current.has(eventType)) {
          listenedRef.current.add(eventType);
          esRef.current.addEventListener(eventType, (e: MessageEvent) =>
            dispatch(eventType, e.data)
          );
        }
      }
      handlersMap.current.get(eventType)!.add(handler);
      return () => { handlersMap.current.get(eventType)?.delete(handler); };
    },
    [dispatch]
  );

  return (
    <SSEContext.Provider value={{ connectionState, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSEContext(): SSEContextValue {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error("useSSEContext must be used inside <SSEProvider>");
  return ctx;
}

/**
 * Subscribe to one named SSE event.
 * The handler ref is kept fresh on every render — no stale closures.
 */
export function useSSEEvent(eventType: string, handler: (data: string) => void): void {
  const { subscribe } = useSSEContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return subscribe(eventType, (data) => handlerRef.current(data));
    // subscribe is stable (useCallback with no deps that change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);
}
