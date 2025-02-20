import * as XLSX from "xlsx";

/**
 * Generates an Excel file from multiple JSON datasets and returns a buffer.
 * @param dataSheets - Object where keys are sheet names and values are arrays of objects to be exported.
 * @returns Buffer containing the Excel file data.
 */
export const generateExcelBuffer = (dataSheets: Record<string, any[]>): Buffer => {
  if (!dataSheets || Object.keys(dataSheets).length === 0) {
    throw new Error("No data provided to export.");
  }

  const workbook = XLSX.utils.book_new();

  for (const [sheetName, data] of Object.entries(dataSheets)) {
    if (data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  }

  // Generate Excel file as buffer
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
};
