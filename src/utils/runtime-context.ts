const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIME_ZONE = "UTC";

export function currentDate(): Date {
  const fixedNow = process.env["SDD_FIXED_NOW"];
  if (fixedNow?.trim()) {
    const parsed = new Date(fixedNow);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function currentTimestamp(): string {
  return currentDate().toISOString();
}

export function currentDateString(): string {
  return currentTimestamp().split("T")[0];
}

export function formatTimestampForDisplay(value?: string | Date): string {
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (value) {
    date = new Date(value);
  } else {
    date = currentDate();
  }

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}
