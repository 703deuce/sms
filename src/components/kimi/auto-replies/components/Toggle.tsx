export default function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-pressed={on}
      className={`tv-toggle ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="tv-toggle-knob" />
    </button>
  );
}
