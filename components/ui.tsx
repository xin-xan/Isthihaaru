"use client";

import type { ReactNode } from "react";

export function Section({ title, step, children, right }: { title: string; step?: number; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {step !== undefined && (
          <span className="flex size-6 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{step}</span>
        )}
        <h2 className="flex-1 text-base font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-neutral-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${inputClass} resize-y ${props.className ?? ""}`} />;
}

export function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        active ? "bg-brand-700 text-white shadow" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="flex rounded-xl bg-neutral-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
            value === o.value ? "bg-white text-brand-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-neutral-300"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? "left-5.5" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}
