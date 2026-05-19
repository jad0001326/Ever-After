"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { venueTypes } from "@/data/venue-options";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export function SearchBar() {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["location", "guests", "budget", "type"]) {
      const value = formData.get(key)?.toString();
      if (value) params.set(key, value);
    }
    router.push(`/venues?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="soft-shadow grid gap-3 rounded-[2rem] border border-white/70 bg-white/95 p-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1fr_auto]"
    >
      <Field label="Location">
        <Input name="location" placeholder="Edinburgh, Highlands..." />
      </Field>
      <Field label="Guests">
        <Input inputMode="numeric" name="guests" placeholder="120" type="number" min="1" />
      </Field>
      <Field label="Budget">
        <Input inputMode="numeric" name="budget" placeholder="12000" type="number" min="0" />
      </Field>
      <Field label="Venue type">
        <Select name="type" defaultValue="">
          <option value="">Any style</option>
          {venueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </Field>
      <Button className="mt-auto h-12 px-6" type="submit">
        <Search size={17} />
        Search
      </Button>
    </form>
  );
}
