import { useState } from "react";
import ActivityLog from "./ActivityLog";
import SystemLog from "./SystemLog";

export default function Logs() {
  const [kind, setKind] = useState<"audit" | "system">("audit");

  return (
    <div>
      <h2>Logs</h2>
      <label>
        Log type{" "}
        <select value={kind} onChange={(e) => setKind(e.target.value as "audit" | "system")}>
          <option value="audit">Audit log: who did what, and when</option>
          <option value="system">System log: API requests, errors and scheduled jobs</option>
        </select>
      </label>
      {kind === "audit" ? <ActivityLog /> : <SystemLog />}
    </div>
  );
}