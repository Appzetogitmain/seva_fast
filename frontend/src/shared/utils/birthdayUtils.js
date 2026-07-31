export function isBirthdayToday(dateOfBirth) {
  if (!dateOfBirth) return false;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return false;

  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "numeric",
    day: "numeric",
  });
  const todayParts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );

  const dobMonth = dob.getUTCMonth() + 1;
  const dobDay = dob.getUTCDate();

  return (
    parseInt(todayParts.month, 10) === dobMonth &&
    parseInt(todayParts.day, 10) === dobDay
  );
}

export function getBirthdayFirstName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}
