"use client";

import { CURRENCIES } from "@/lib/currencies";
import {
  SearchCombobox,
  type SearchComboboxOption,
} from "@/components/ui/search-combobox";

/**
 * Searchable currency dropdown — the rate-currency picker in profile
 * create/edit. A thin wrapper over the shared SearchCombobox; the value
 * stored is the three-letter currency CODE (e.g. "USD"), which is what the
 * server validates and stores in profiles.rate_currency. The code is also
 * what's displayed (trigger + list), with the currency name as the
 * searchable hint.
 */
const CURRENCY_OPTIONS: readonly SearchComboboxOption[] = CURRENCIES.map(
  (c) => ({ value: c.code, label: c.code, hint: c.name }),
);

export function CurrencyCombobox(
  props: Omit<React.ComponentProps<typeof SearchCombobox>, "options">,
) {
  return (
    <SearchCombobox
      options={CURRENCY_OPTIONS}
      placeholder="Select a currency"
      {...props}
    />
  );
}
