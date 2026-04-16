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
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function naturalCompare(left, right) {
  return naturalCollator.compare(String(left || ""), String(right || ""));
}
