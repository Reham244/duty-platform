import { useEffect, useState } from "react";
import { getUsers } from "./api";
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
import ComingSoon from "./components/ComingSoon";

// Chooses which screen to show for the person and the menu item.
function ScreenView({ user, screen }: { user: User; screen: ScreenId }) {
  if (screen === "myDuties") return <MyDuties user={user} />;
  if (screen === "attendance") return <AttendanceCards user={user} />;
  if (screen === "stats" || screen === "allStats") return <Statistics user={user} />;
  if (screen === "substitutions") return <Substitutions user={user} />;
  if (screen === "schedule") return <ManageSchedule user={user} />;
  if (screen === "dutyTypes") return <DutyTypes />;
  if (screen === "users") return <StaffRoles user={user} />;
  return <ComingSoon id={screen} />;
}

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

  // Reload the list when the screen changes, so a role change shows in the "view as" list.
  useEffect(() => {
    getUsers().then(setUsers);
  }, [screen, currentId]);

  const current = users.find((u) => u.id === currentId);
  const menu: ScreenId[] = current ? menuByRole[current.role] : [];
  // If the chosen screen is not allowed for this role, fall back to its first screen.
  const active: ScreenId | undefined = menu.includes(screen) ? screen : menu[0];

  if (!current || !active) return <p style={{ padding: 24 }}>Loading...</p>;

  return (
    <Layout
      users={users}
      current={current}
      onUserChange={setCurrentId}
      menu={menu}
      active={active}
      onSelect={setScreen}
    >
      <ScreenView key={`${current.id}-${active}`} user={current} screen={active} />
    </Layout>
  );
}

export default App;