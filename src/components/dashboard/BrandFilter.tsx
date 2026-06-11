"use client";

import { useState } from "react";

interface BrandFilterProps {
  options: string[];
  onBrandChange: (brand: string) => void;
}

export function BrandFilter({ onBrandChange, options }: BrandFilterProps) {
  const [selectedBrand, setSelectedBrand] = useState(options[0] ?? "");

  return (
    <section
      aria-label="Brand filter"
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <label className="text-sm font-medium text-slate-700" htmlFor="brand">
        Brand
      </label>
      <select
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        id="brand"
        onChange={(event) => {
          setSelectedBrand(event.target.value);
          onBrandChange(event.target.value);
        }}
        value={selectedBrand}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </section>
  );
}
