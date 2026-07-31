const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 120;

export function parseDateOfBirthInput(input) {
  if (input === null || input === undefined || input === "") {
    return null;
  }

  const raw = String(input).trim();
  if (!raw) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!isoMatch) {
    const err = new Error("Date of birth must be in YYYY-MM-DD format");
    err.statusCode = 400;
    throw err;
  }

  const year = parseInt(isoMatch[1], 10);
  const month = parseInt(isoMatch[2], 10);
  const day = parseInt(isoMatch[3], 10);
  const dateOfBirth = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    dateOfBirth.getUTCFullYear() !== year ||
    dateOfBirth.getUTCMonth() !== month - 1 ||
    dateOfBirth.getUTCDate() !== day
  ) {
    const err = new Error("Invalid date of birth");
    err.statusCode = 400;
    throw err;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassedThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassedThisYear) {
    age -= 1;
  }

  if (age < MIN_AGE_YEARS) {
    const err = new Error(`You must be at least ${MIN_AGE_YEARS} years old`);
    err.statusCode = 400;
    throw err;
  }

  if (age > MAX_AGE_YEARS) {
    const err = new Error("Invalid date of birth");
    err.statusCode = 400;
    throw err;
  }

  if (dateOfBirth.getTime() > Date.now()) {
    const err = new Error("Date of birth cannot be in the future");
    err.statusCode = 400;
    throw err;
  }

  return {
    dateOfBirth,
    dobMonth: month,
    dobDay: day,
  };
}

export function applyDateOfBirthToCustomer(customer, input) {
  if (input === undefined) return;
  if (input === null || input === "") {
    customer.dateOfBirth = undefined;
    customer.dobMonth = undefined;
    customer.dobDay = undefined;
    return;
  }

  const parsed = parseDateOfBirthInput(input);
  if (!parsed) return;

  customer.dateOfBirth = parsed.dateOfBirth;
  customer.dobMonth = parsed.dobMonth;
  customer.dobDay = parsed.dobDay;
}

export function getISTDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: parseInt(lookup.year, 10),
    month: parseInt(lookup.month, 10),
    day: parseInt(lookup.day, 10),
  };
}
