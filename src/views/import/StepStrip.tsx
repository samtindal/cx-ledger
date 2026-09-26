export function StepStrip({ steps }: { steps: { label: string; value: string }[] }) {
  return (
    <ol className="step-strip" aria-label="Import steps">
      {steps.map((s, i) => (
        <li key={s.label} className="step">
          <span className="step__num" aria-hidden="true">{i + 1}</span>
          <span className="step__label">{s.label}</span>
          <span className="step__value">{s.value}</span>
        </li>
      ))}
    </ol>
  );
}
