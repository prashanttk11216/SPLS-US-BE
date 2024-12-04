export function escapeAndNormalizeSearch(input: string): string {
    // Trim leading/trailing spaces and replace multiple spaces with a single space
    const normalizedInput = input.trim().replace(/\s+/g, " ");
    // Escape special regex characters
    return normalizedInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
  