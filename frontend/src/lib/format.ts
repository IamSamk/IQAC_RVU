const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const parse = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

export const formatDate = (iso: string) => dateFormat.format(parse(iso));
export const formatShortDate = (iso: string) => shortDateFormat.format(parse(iso));
export const formatDateTime = (iso: string) => `${dateTimeFormat.format(parse(iso))} IST`;
export const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;
