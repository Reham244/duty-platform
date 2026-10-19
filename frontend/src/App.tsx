import { useCallback, useEffect, useState } from "react";
import { getUnreadCount, getUsers, setCurrentUser } from "./api";
import { menuByRole } from "./roles";
import type { ScreenId } from "./roles";
import type { User } from "./types";
import Layout from "./components/Layout";
import MyDuties from "./components/MyDuties";
import AttendanceCards from "./components/AttendanceCards";
import Statistics from "./components/Statistics";
import Substitutions from "./components/Substitutions";
import ManageSchedule from "./components/ManageSchedule";
import DutyTypes from "./components/DutyTypes";
import StaffRoles from "./components/StaffRoles";
import Notifications from "./components/Notifications";
import ComingSoon from "./components/ComingSoon";

// Chooses which screen to show for the person and the menu item.
function ScreenView({ user, screen, onNotificationsChanged }: { user: User; screen: ScreenId; onNotificationsChanged: () => void }) {
  if (screen === "myDuties") return <MyDuties user={user} />;
  if (screen === "attendance") return <AttendanceCards user={user} />;
  if (screen === "stats" || screen === "allStats") return <Statistics user={user} />;
  if (screen === "substitutions") return <Substitutions user={user} />;
  if (screen === "schedule") return <ManageSchedule user={user} />;
  if (screen === "dutyTypes") return <DutyTypes />;
  if (screen === "users") return <StaffRoles />;
  if (screen === "notifications") return <Notifications onChanged={onNotificationsChanged} />;
  return <ComingSoon id={screen} />;
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [screen, setScreen] = useState<ScreenId>("myDuties");
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    getUsers()
      .then((list) => {
        setUsers(list);
        if (list[0]) {
          setCurrentUser(list[0].id);
          setCurrentId(list[0].id);
        }
      })
      .catch(() => setError("Cannot reach the backend. Start it with npm run dev in the backend folder."));
  }, []);

  // Reload the list when the screen changes, so a role change shows in the "view as" list.
  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => undefined);
  }, [screen, currentId]);

  const refreshUnread = useCallback(() => {
    getUnreadCount()
      .then(setUnread)
      .catch(() => undefined);
  }, []);

  // The bell count: loaded when the person or screen changes, and every 10 seconds.
  useEffect(() => {
    if (currentId === null) return;
    refreshUnread();
    const timer = setInterval(refreshUnread, 10000);
    return () => clearInterval(timer);
  }, [currentId, screen, refreshUnread]);

  function chooseUser(id: number) {
    setCurrentUser(id); // tell the server who is asking, before the new screen loads its data
    setCurrentId(id);
  }

  const current = users.find((u) => u.id === currentId);
  const menu: ScreenId[] = current ? menuByRole[current.role] : [];
  // If the chosen screen is not allowed for this role, fall back to its first screen.
  const active: ScreenId | undefined = menu.includes(screen) ? screen : menu[0];

  if (error) return <p style={{ padding: 24, color: "#a63a2b", fontWeight: 700 }}>{error}</p>;
  if (!current || !active) return <p style={{ padding: 24 }}>Loading...</p>;

  return (
    <Layout
      users={users}
      current={current}
      onUserChange={chooseUser}
      menu={menu}
      active={active}
      onSelect={setScreen}
      unread={unread}
    >
      <ScreenView
        key={`${current.id}-${active}`}
        user={current}
        screen={active}
        onNotificationsChanged={refreshUnread}
      />
    </Layout>
  );
}

export default App;