type SortOrder = 1 | -1;

export const parseSortQuery = (sortQuery: string | undefined, validFields: string[]): [string, SortOrder][] => {
  let sortOptions: [string, SortOrder][] = [];
  
  if (sortQuery) {
    const sortFields = sortQuery.split(","); // Split multiple fields
    sortFields.forEach((field) => {
      const [key, order] = field.split(":");
      if (validFields.includes(key)) {
        sortOptions.push([key, order === "desc" ? -1 : 1]);
      }
    });
  }

  return sortOptions;
};
