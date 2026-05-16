import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#4a443c]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-12 w-full rounded-full border border-[var(--line)] bg-white px-4 text-sm text-[#191713] outline-none transition placeholder:text-[#9a9286] focus:border-[#b08d57]",
        props.className
      )}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "focus-ring h-12 w-full rounded-full border border-[var(--line)] bg-white px-4 text-sm text-[#191713] outline-none transition focus:border-[#b08d57]",
        props.className
      )}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-32 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[#191713] outline-none transition placeholder:text-[#9a9286] focus:border-[#b08d57]",
        props.className
      )}
      {...props}
    />
  );
}
