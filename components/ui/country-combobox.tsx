"use client";

import { COUNTRIES } from "@/lib/countries";
import {
  SearchCombobox,
  type SearchComboboxOption,
} from "@/components/ui/search-combobox";

/**
 * Searchable country dropdown — the location picker for profile create/edit
 * and the Country filter on the job pages (Discovery / Pipeline / Leads).
 * A thin wrapper over the shared SearchCombobox; the value stored is the
 * country NAME (as the gist's list defines it).
 */
const COUNTRY_OPTIONS: readonly SearchComboboxOption[] = COUNTRIES.map(
  (c) => ({ value: c.name, label: c.name, hint: c.code }),
);

export function CountryCombobox(
  props: Omit<React.ComponentProps<typeof SearchCombobox>, "options">,
) {
  return (
    <SearchCombobox
      options={COUNTRY_OPTIONS}
      placeholder="Select a country"
      {...props}
    />
  );
}
