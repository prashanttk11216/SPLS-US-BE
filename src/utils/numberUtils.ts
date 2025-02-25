export const formatNumber = (
  value: number | string | null | undefined,
  locale: string = "en-US",
  numberFormatOptions: Intl.NumberFormatOptions = {}
): string => {
  if (value == null || value === "") return ""; // Handle null, undefined, and empty string

  const stringValue = String(value); // Convert numbers to string for processing
  
  // Remove all commas before processing
  const rawValue = stringValue.replace(/,/g, "");

  // Handle case when user is typing a negative sign (-) at the beginning
  if (rawValue === "-") return "-";

  // Handle case when user is typing a decimal point (e.g., "55,555.")
  const hasTrailingDot = rawValue.endsWith(".");

  // Convert to number
  const number = parseFloat(rawValue);
  if (isNaN(number)) return stringValue; // Return original value if it's not a valid number

  // Format the number
  let formatted = new Intl.NumberFormat(locale, numberFormatOptions).format(number);

  // Append back the dot if user is typing a decimal
  if (hasTrailingDot) {
    formatted += ".";
  }

  return formatted;
};
