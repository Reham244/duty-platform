import { screens } from "../roles";
import type { ScreenId } from "../roles";

export default function ComingSoon({ id }: { id: ScreenId }) {
  const screen = screens[id];
  return (
    <div style={{ background: "white", border: "1px dashed #b8c2cf", borderRadius: 10, padding: 32, textAlign: "center", color: "#6b7a90" }}>
      <h2 style={{ color: "#1f2d3d" }}>{screen.title}</h2>
      <p>{screen.about}</p>
      <p><i>Coming soon.</i></p>
    </div>
  );
}