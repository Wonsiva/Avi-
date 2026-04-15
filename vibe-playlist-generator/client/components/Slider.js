export default function Slider({ label, value, onChange, min = 1, max = 10 }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="slider-row">
        <input
          className="slider"
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="value">{value}</span>
      </div>
    </div>
  );
}
