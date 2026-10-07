"use client";

import { KeyboardEvent, useEffect, useId, useState } from "react";

export type AddressSelection = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  latitude: number | null;
  longitude: number | null;
  source: "photon" | "manual" | "google";
};

type AddressAutocompleteProps = {
  label: string;
  value: string;
  selection: AddressSelection | null;
  placeholder: string;
  destination?: boolean;
  onChange: (value: string) => void;
  onSelect: (selection: AddressSelection) => void;
};

export function AddressAutocomplete({
  label,
  value,
  selection,
  placeholder,
  destination = false,
  onChange,
  onSelect,
}: AddressAutocompleteProps) {
  const generatedId = useId().replaceAll(":", "");
  const inputId = `address-${generatedId}`;
  const listId = `address-list-${generatedId}`;
  const helpId = `address-help-${generatedId}`;
  const [suggestions, setSuggestions] = useState<AddressSelection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [attribution,setAttribution] = useState("");

  const trimmedValue = value.trim();
  const hasConfirmedValue = Boolean(selection && selection.label === value);
  const optionCount = suggestions.length + (trimmedValue.length >= 3 ? 1 : 0);

  useEffect(() => {
    if (hasConfirmedValue || trimmedValue.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchFailed(false);
      setOpen(true);
      try {
        const response = await fetch(`/api/addresses?q=${encodeURIComponent(trimmedValue)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { suggestions?: AddressSelection[]; attribution?: string };
        if (!response.ok) throw new Error("Address search unavailable");
        const nextSuggestions = data.suggestions ?? [];
        setSuggestions(nextSuggestions);
        setAttribution(data.attribution||"");
        setActiveIndex(nextSuggestions.length ? 0 : nextSuggestions.length);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setSuggestions([]);
        setSearchFailed(true);
        setActiveIndex(0);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [hasConfirmedValue, trimmedValue]);

  function chooseSuggestion(nextSelection: AddressSelection) {
    onSelect(nextSelection);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function chooseManualValue() {
    chooseSuggestion({
      id: `manual-${trimmedValue.toLowerCase()}`,
      label: trimmedValue,
      primary: trimmedValue,
      secondary: "Address entered manually",
      latitude: null,
      longitude: null,
      source: "manual",
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!optionCount) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") return current < optionCount - 1 ? current + 1 : 0;
        return current > 0 ? current - 1 : optionCount - 1;
      });
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      const suggestion = suggestions[activeIndex];
      if (suggestion) chooseSuggestion(suggestion);
      else if (activeIndex === suggestions.length) chooseManualValue();
    }
  }

  const activeOptionId = activeIndex >= 0
    ? activeIndex < suggestions.length
      ? `${listId}-option-${activeIndex}`
      : `${listId}-manual`
    : undefined;

  return (
    <div className="address-field">
      <label htmlFor={inputId}>{label}</label>
      <span className={`input-wrap ${destination ? "destination" : ""} ${hasConfirmedValue ? "is-confirmed" : ""}`}>
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setSuggestions([]);setLoading(false);setSearched(false);setSearchFailed(false);setActiveIndex(-1);
            setOpen(event.target.value.trim().length >= 3);
          }}
          onFocus={() => {
            if (!hasConfirmedValue && trimmedValue.length >= 3) setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeOptionId}
          aria-describedby={helpId}
        />
        {loading && <span className="address-spinner" aria-hidden="true" />}
      </span>

      {open && trimmedValue.length >= 3 && (
        <div className="address-menu">
          <div className="address-results-status" role="status" aria-live="polite">
            {loading
              ? "Searching addresses…"
              : searchFailed
                ? "Live suggestions are temporarily unavailable."
                : searched && suggestions.length === 0
                  ? "No matching address found."
                  : `${suggestions.length} address suggestion${suggestions.length === 1 ? "" : "s"}`}
          </div>
          <ul id={listId} className="address-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="presentation">
                <button
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={activeIndex === index ? "active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  <span className="address-pin" aria-hidden="true">⌖</span>
                  <span><strong>{suggestion.primary}</strong><small>{suggestion.secondary}</small></span>
                </button>
              </li>
            ))}
            <li role="presentation" className="manual-address-option">
              <button
                id={`${listId}-manual`}
                type="button"
                role="option"
                aria-selected={activeIndex === suggestions.length}
                className={activeIndex === suggestions.length ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(suggestions.length)}
                onClick={chooseManualValue}
              >
                <span className="address-pin" aria-hidden="true">✎</span>
                <span><strong>Use “{trimmedValue}”</strong><small>Keep the address exactly as entered</small></span>
              </button>
            </li>
          </ul>
          <p className="address-attribution">{attribution}</p>
        </div>
      )}

      <span id={helpId} className={`address-help ${hasConfirmedValue ? "confirmed" : ""}`}>
        {hasConfirmedValue
          ? selection?.source === "manual"
            ? "✓ Address accepted as entered"
            : "✓ Address confirmed"
          : trimmedValue.length > 0 && trimmedValue.length < 3
            ? "Type at least 3 characters to search"
            : "Start typing, then choose an address to confirm it"}
      </span>
    </div>
  );
}
