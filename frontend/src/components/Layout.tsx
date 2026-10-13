import { useState } from "react";
import type { ReactNode } from "react";
import { screens } from "../roles";
import type { ScreenId } from "../roles";
import type { Role, User } from "../types";

const roleLabels: Record<Role, string> = {
  teacher: "Teacher",
  supervisor: "Supervisor",
  head_of_stage: "Head of stage",
  admin: "Admin",
};

interface LayoutProps {
  users: User[];
  current: User;
  onUserChange: (id: number) => void;
  menu: ScreenId[];
  active: ScreenId;
  onSelect: (id: ScreenId) => void;
  children: ReactNode;
}

export default function Layout({ users, current, onUserChange, menu, active, onSelect, children }: LayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <nav className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-head">
          Dashboard
          <button className="close-menu" onClick={() => setOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <div className="side-group">
          <span className="gold-icon" />
          <span>Duty Management</span>
          <span className="new-tag">NEW</span>
        </div>
        {menu.map((id) => (
          <button
            key={id}
            className={`nav-item ${id === active ? "active" : ""} ${screens[id].ready ? "" : "soon"}`}
            onClick={() => {
              onSelect(id);
              setOpen(false);
            }}
          >
            {screens[id].title}
            {!screens[id].ready && " (soon)"}
          </button>
        ))}
      </nav>

      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <div className="topbar-right">
            <label>
              Demo, view as:{" "}
              <select value={current.id} onChange={(e) => onUserChange(Number(e.target.value))}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({roleLabels[u.role]})
                  </option>
                ))}
              </select>
            </label>
            <span className="avatar" />
            <span>Hi, {current.fullName}</span>
          </div>
        </header>

        <main className="content">
          <section className="banner">
            <h1>{screens[active].title}</h1>
            <p>{screens[active].about}</p>
          </section>
          <div className="screen">{children}</div>
        </main>
      </div>
    </div>
  );
}