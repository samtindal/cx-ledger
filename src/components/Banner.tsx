import { useState } from 'react';
import { useLedger } from '../state/store';

export function Banner({ onAbout }: { onAbout: () => void }) {
  const { reset } = useLedger();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="banner" role="note">
      <span>Demo with sample data. Changes stay in your browser.</span>
      {confirming ? (
        <span>
          Reset clears your changes and documents.
          <button type="button" onClick={() => { setConfirming(false); void reset(); }}>Yes, reset everything</button>
          <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>Reset demo data</button>
      )}
      <button type="button" onClick={onAbout}>About</button>
    </div>
  );
}
