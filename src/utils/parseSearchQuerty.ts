import { escapeAndNormalizeSearch } from "./regexHelper";

type Filters = Record<string, any>;

export const buildSearchFilter = (
  search: string | undefined,
  searchField: string | undefined,
  numberFields: string[],
  multiFieldMappings: Record<string, string[]> // Mapping for fields like "name"
): Filters => {
  let filters: Filters = {};

  if (!search || !searchField) return filters;

  const escapedSearch = escapeAndNormalizeSearch(search); // Ensure you have this function implemented

  if (numberFields.includes(searchField)) {
    // Handle numeric fields
    const parsedNumber = Number(escapedSearch);
    if (!isNaN(parsedNumber)) {
      filters[searchField] = parsedNumber;
    } else {
      throw new Error(`Invalid number provided for field ${searchField}`);
    }
  } else if (multiFieldMappings[searchField]) {
    // Handle fields that map to multiple DB fields
    filters.$or = multiFieldMappings[searchField].map((field) => ({
      [field]: { $regex: escapedSearch, $options: "i" },
    }));
  } else {
    // Handle regular string fields
    filters[searchField] = { $regex: escapedSearch, $options: "i" };
  }

  return filters;
};
