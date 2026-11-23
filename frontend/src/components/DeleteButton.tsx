// A small red delete button, the same everywhere in the schedule.
export default function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        background: "#a63a2b",
        color: "white",
        border: 0,
        borderRadius: 5,
        width: 22,
        height: 22,
        lineHeight: "20px",
        fontWeight: 700,
        cursor: "pointer",
        padding: 0,
      }}
    >
      ×
    </button>
  );
}