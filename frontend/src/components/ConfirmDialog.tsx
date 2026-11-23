import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A confirmation window in the platform's own style. Clicking outside it cancels.
export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(15, 30, 50, 0.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 14, maxWidth: 460, width: "100%", padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}
      >
        <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
        <div style={{ marginBottom: 16 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} style={{ background: "#a63a2b", color: "white", border: 0, borderRadius: 8, padding: "8px 18px", fontWeight: 700 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}