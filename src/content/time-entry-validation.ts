export function hasEnteredTimeValue(value: string): boolean {
  const normalizedValue = value.trim();

  return (
    normalizedValue !== "" &&
    normalizedValue !== "0" &&
    normalizedValue !== "-" &&
    !/^0+:00$/.test(normalizedValue)
  );
}

export function shouldWarnForMissingEvent(
  eventValue: string,
  dayValues: string[],
): boolean {
  return (
    eventValue.trim() === "" && dayValues.some(hasEnteredTimeValue)
  );
}