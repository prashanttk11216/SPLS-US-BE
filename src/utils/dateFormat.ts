import { format } from "date-fns";

/**
 * Formats a date string into the desired format.
 * @param dateString - The date string to format.
 * @param formatString - The format to apply (e.g., 'yyyy-MM-dd', 'MM/dd/yyyy').
 * @returns The formatted date string or an error message if the input is invalid.
 */
export const formatDate = (dateString: Date, formatString: string): string => {
  try {
    const parsedDate = new Date(dateString);

    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date");
    }

    return format(parsedDate, formatString);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

// Usage example
// console.log(formatDate('2024-12-02', 'MM/dd/yyyy')); // Output: 12/02/2024
