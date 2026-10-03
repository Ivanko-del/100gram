import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/** Thin bar at the top of the app while the browser reports no connection. */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={14} className="inline-icon" /> Немає з'єднання
    </div>
  );
}
