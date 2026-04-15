import { WEEKDAYS } from "./constants";

const naturalCollator = new Intl.Collator("it", {
  numeric: true,
  sensitivity: "base"
});

export function euro(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function weekdayLabel(value) {
  return WEEKDAYS.find((day) => day.value === value)?.label || String(value);
}

export function toSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dateInputValue(date) {
  const iso = new Date(date).toISOString();
  return iso.slice(0, 16);
}

export function naturalCompare(left, right) {
  return naturalCollator.compare(String(left || ""), String(right || ""));
}
