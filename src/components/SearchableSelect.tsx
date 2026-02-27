import { useMemo, useState } from "react";

type Option = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  noResultsText?: string;
  className?: string;
};

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  noResultsText = "Sin coincidencias",
  className = "",
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((row) => row.value === value)?.label ?? "";

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return options;
    return options.filter((row) => row.label.toLowerCase().includes(text));
  }, [options, query]);

  return (
    <div className={`searchable-select ${className}`}>
      <input
        type="text"
        className="searchable-select-input"
        value={open ? query : selectedLabel}
        onFocus={() => {
          setQuery(selectedLabel);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          setQuery(selectedLabel);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />

      {open && (
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            <div className="searchable-select-empty">{noResultsText}</div>
          )}
          {filtered.map((row) => (
            <button
              type="button"
              key={row.value}
              className="searchable-select-item"
              onMouseDown={() => {
                onChange(row.value);
                setQuery(row.label);
                setOpen(false);
              }}
            >
              {row.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
