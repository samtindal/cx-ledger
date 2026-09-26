export function About({ onClose }: { onClose: () => void }) {
  return (
    <section className="about" aria-label="About">
      <p>Inspired by commissioning data work I supported at an engineering firm's commissioning group in 2016.</p>
      <p>The project, equipment, and issues here are fictional sample data, made up for this demo.</p>
      <p>CxAlloy and Facility Grid cover this space commercially; this demo is about the import pipeline.</p>
      <button type="button" onClick={onClose}>Close</button>
    </section>
  );
}
