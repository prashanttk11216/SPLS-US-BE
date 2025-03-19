import { format } from "date-fns";

/**
 * Formats a date string into the desired format.
 * @param dateString - The date string to format.
 * @param formatString - The format to apply (e.g., 'yyyy-MM-dd', 'yyyy/MM/dd').
 * @returns The formatted date string or an error message if the input is invalid.
 */
export const formatDate = (dateString: Date, formatString: string): string => {
  try {
    const parsedDate = new Date(dateString);

    if (isNaN(parsedDate.getTime())) {
      return "";
    }

    return format(parsedDate, formatString);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
};

// Usage example
// console.log(formatDate('2024-12-02', 'yyyy/MM/dd')); // Output: 12/02/2024
