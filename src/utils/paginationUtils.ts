// src/utils/paginationUtils.ts
export function getPaginationParams(query: any) {
    const page = parseInt(query.page as string, 10) || 1;
    const limit = parseInt(query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    return { page, limit, skip };
}
