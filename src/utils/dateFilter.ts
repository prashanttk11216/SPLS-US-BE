/**
 * Generates a date range filter for a given field.
 *
 * @param filters - The existing filter object (optional).
 * @param dateField - The field to apply the date filter on.
 * @param fromDate - The start date (optional).
 * @param toDate - The end date (optional).
 * @returns The updated filter object with the date range applied.
 */
export const applyDateRangeFilter = (
    filters: Record<string, any> = {},
    dateField?: string,
    fromDate?: string,
    toDate?: string
  ): Record<string, any> => {
    if (!dateField) return filters; // No date field provided, return existing filters
  
    const startDate = fromDate ? new Date(fromDate) : undefined;
    const endDate = toDate ? new Date(toDate) : undefined;
  
    if (startDate || endDate) {
      filters[dateField] = {};
      if (startDate) filters[dateField].$gte = startDate;
      if (endDate) filters[dateField].$lte = endDate;
    }
  
    return filters; // Return the modified filters object
  };
  