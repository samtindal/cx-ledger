export function Banner({ onAbout }: { onAbout: () => void }) {
  return (
    <div className="banner" role="note">
      <span>Demo with sample data. Changes stay in your browser.</span>
      <button type="button" onClick={onAbout}>About</button>
    </div>
  );
}
