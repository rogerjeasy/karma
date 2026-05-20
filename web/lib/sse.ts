"use client";

import { useEffect, useRef, useState } from "react";

type EventHandlers = Record<string, (data: string) => void>;

export type SSEConnectionState = "connecting" | "open" | "closed";

interface UseSSEOptions {
  /** Called whenever the underlying EventSource connection state changes. */
  onConnectionChange?: (state: SSEConnectionState) => void;
  /** Milliseconds to wait before reconnecting after a drop. Default: 5000. */
  retryDelayMs?: number;
}

/**
 * Subscribes to an SSE endpoint and calls handlers by event type.
 * Handlers are always dispatched from the latest closure — no stale values.
 * Reconnects automatically on connection drop.
 *
 * Returns the current connection state so callers can show a status indicator.
 */
export function useSSE(
  url: string,
  handlers: EventHandlers,
  options: UseSSEOptions = {}
): SSEConnectionState {
  // Keep latest handler and options without restarting the effect
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<SSEConnectionState>("connecting");

  function updateState(next: SSEConnectionState) {
    setState(next);
    optionsRef.current.onConnectionChange?.(next);
  }

  useEffect(() => {
    if (!url) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    // Snapshot the event type keys on first connect so addEventListener is
    // called exactly once per event type per EventSource instance.
    // Dispatch always reads handlersRef.current so closures stay fresh.
    const eventTypes = Object.keys(handlersRef.current);

    function connect() {
      if (closed) return;
      updateState("connecting");

      es = new EventSource(url);

      es.onopen = () => updateState("open");

      es.onerror = () => {
        es?.close();
        es = null;
        updateState("closed");
        if (!closed) {
          retryTimeout = setTimeout(connect, optionsRef.current.retryDelayMs ?? 5000);
        }
      };

      for (const eventType of eventTypes) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          // Always dispatch to the *current* handler so React state closures
          // are never stale — the ref is updated on every render.
          handlersRef.current[eventType]?.(e.data);
        });
      }

      // Silence keepalive pings even if the caller didn't register a handler
      if (!eventTypes.includes("ping")) {
        es.addEventListener("ping", () => { /* keepalive — no-op */ });
      }
    }

    connect();

    return () => {
      closed = true;
      if (retryTimeout !== null) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [url]); // url change restarts the connection; handler changes are live via ref

  return state;
}
