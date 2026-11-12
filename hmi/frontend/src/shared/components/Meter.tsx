export function Meter({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="meter">
      <div className="meter-label">{label}</div>
      <div className="meter-value">
        {value}
        <span className="meter-unit">{unit}</span>
      </div>
    </div>
  );
}

