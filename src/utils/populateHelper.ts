import { Query } from "mongoose";

/**
 * Dynamically applies population to a Mongoose query with specific fields.
 *
 * Supports:
 * - "field" → Populate the whole reference
 * - "field:subField1 subField2" → Populate only specific sub-fields
 * - "field:-subField1 -subField2" → Populate the whole reference except specific sub-fields
 *
 * @param query - The Mongoose query to apply population to.
 * @param populateParam - The populate parameter from request query, supports specific sub-fields.
 * @returns The modified query with applied population.
 */
export const applyPopulation = <T, R extends T | T[] | null>(
  query: Query<R, T>,
  populateParam?: string
): Query<R, T> => {
  if (populateParam && typeof query.populate === "function") {
    const populateFields = populateParam.split(",");

    populateFields.forEach((field) => {
      const [path, select] = field.split(":"); // Split to extract sub-fields
      query = query.populate({ path, select: select ? select.replace(/ /g, " ") : undefined });
    });
  }
  return query;
};
    