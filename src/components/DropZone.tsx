import { useRef, useState, type DragEvent } from 'react';

export function DropZone({
  onFiles,
  label,
  accept,
  multiple = true,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  label: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      className={`drop-zone${dragging && !disabled ? ' drop-zone--active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p>Drop files here, or</p>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>{label}</button>
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        aria-label={label}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
