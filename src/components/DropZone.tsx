import { useRef, useState, type DragEvent } from 'react';

export function DropZone({
  onFiles,
  label,
  accept,
  multiple = true,
}: {
  onFiles: (files: File[]) => void;
  label: string;
  accept?: string;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p>Drop files here, or</p>
      <button type="button" onClick={() => inputRef.current?.click()}>{label}</button>
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        aria-label={label}
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
