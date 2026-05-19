"use client";

import { useEffect, useRef } from "react";

type EventHandlers = Record<string, (data: string) => void>;

/**
 * Hook that subscribes to an SSE endpoint and calls handlers by event type.
 * Reconnects automatically on connection drop.
 */
export function useSSE(url: string, handlers: EventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!url) return;

    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource(url);

      es.onopen = () => {
        // connected
      };

      es.onerror = () => {
        es.close();
        if (!closed) {
          retryTimeout = setTimeout(connect, 5000);
        }
      };

      // Register handlers for each event type
      for (const [eventType, handler] of Object.entries(handlersRef.current)) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          handler(e.data);
        });
      }
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, [url]);
}
