"use client";

import { useState } from "react";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagsInput({ value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,/g, "");
    if (!tag) return;
    if (value.includes(tag)) return;
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 rounded border border-neutral-800 bg-neutral-900 p-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-[#ffcd07]/20 px-1.5 py-0.5 text-[10px] text-[#ffcd07] ring-1 ring-[#ffcd07]/30"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-[#ffcd07]/70 hover:text-[#ffcd07]"
            aria-label={`Quitar ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draft);
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            removeTag(value[value.length - 1]);
          }
        }}
        onBlur={() => draft && addTag(draft)}
        placeholder={value.length === 0 ? (placeholder ?? "agregar etiqueta...") : ""}
        className="min-w-[80px] flex-1 bg-transparent text-xs text-white placeholder:text-neutral-600 focus:outline-none"
      />
    </div>
  );
}
