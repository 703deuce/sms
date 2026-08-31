export default function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`tv-toggle ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    />
  );
}
