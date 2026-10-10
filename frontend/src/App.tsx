import { useEffect, useState } from "react";
import { getUsers } from "./api";
import { menuByRole, screens } from "./roles";
import type { ScreenId } from "./roles";
import type { User } from "./types";
import MyDuties from "./components/MyDuties";
import AttendanceCards from "./components/AttendanceCards";
import ComingSoon from "./components/ComingSoon";
import Statistics from "./components/Statistics";

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [screen, setScreen] = useState<ScreenId>("myDuties");

  useEffect(() => {
    getUsers().then((list) => {
      setUsers(list);
      setCurrentId(list[0]?.id ?? null);
    });
  }, []);

  const current = users.find((u) => u.id === currentId);
  const menu: ScreenId[] = current ? menuByRole[current.role] : [];
  // If the chosen screen is not allowed for this role, fall back to its first screen.
  const active: ScreenId | undefined = menu.includes(screen) ? screen : menu[0];

  function renderScreen() {
    if (!current || !active) return null;
    if (active === "myDuties") return <MyDuties user={current} />;
    if (active === "attendance") return <AttendanceCards key={current.id} user={current} />;    
        if (active === "stats" || active === "allStats") return <Statistics key={current.id + active} user={current} />;
    return <ComingSoon id={active} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Duty Platform</h1>
      <label>
        View as:{" "}
        <select value={currentId ?? ""} onChange={(e) => setCurrentId(Number(e.target.value))}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.role})
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        {menu.map((id) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d9e0e7",
              background: id === active ? "#0f4c8a" : "white",
              color: id === active ? "white" : "#1f2d3d",
              fontWeight: id === active ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {screens[id].title}
            {!screens[id].ready && " (soon)"}
          </button>
        ))}
      </div>

      {renderScreen()}
    </div>
  );
}

export default App;