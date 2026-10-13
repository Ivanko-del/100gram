import { useEffect, useState } from "react";
import { isOnline } from "../utils/offline";

/** Tracks navigator.onLine via the online/offline window events. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
