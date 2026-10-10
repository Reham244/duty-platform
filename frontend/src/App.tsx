import { useEffect, useState } from "react";
import { getUsers } from "./api";
import type { User } from "./types";
import MyDuties from "./components/MyDuties";

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);

  useEffect(() => {
    getUsers().then((list) => {
      setUsers(list);
      setCurrentId(list[0]?.id ?? null);
    });
  }, []);

  const current = users.find((u) => u.id === currentId);

  return (
<div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>      <h1>Duty Platform</h1>
      <label>
        View as:{" "}
        <select
          value={currentId ?? ""}
          onChange={(e) => setCurrentId(Number(e.target.value))}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.role})
            </option>
          ))}
        </select>
      </label>
      {current && (
        <p>
          You are signed in as <b>{current.fullName}</b> with the role{" "}
          <b>{current.role}</b>.
        </p>
      )}
            {current?.role === "teacher" ? (
        <MyDuties user={current} />
      ) : (
        <p>This screen is coming soon.</p>
      )}
    </div>
  );
}

export default App;