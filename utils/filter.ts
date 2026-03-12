// Utility to build Mongoose filters from query params for bicycles
function parseCommaList(value?: string): string[] | undefined {
    if (!value) return undefined;
    return value.split(',').map(s => s.trim()).filter(Boolean);
}

function toNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildBicycleFilter(query: any, userRoles: string[] = []): any {
    const filter: any = {};
    const clauses: any[] = [];

    // Simple equality / id filters
    if (query.category) filter['category._id'] = query.category;
    if (query.brand) filter['brand._id'] = query.brand;
    if (query.model) filter['model._id'] = query.model;
    if (query.sellerId) filter['seller._id'] = query.sellerId;
    if (query.condition) filter.condition = query.condition;
    if (query.inspectionStatus) filter.inspectionStatus = query.inspectionStatus;
    if (query.status) filter.status = query.status;

    // Brands list
    const brandsList = parseCommaList(query.brands);
    if (brandsList && brandsList.length > 0) {
        filter['brand._id'] = { $in: brandsList };
    }

    // Price range
    const minPrice = toNumber(query.minPrice);
    const maxPrice = toNumber(query.maxPrice);
    if (minPrice !== undefined || maxPrice !== undefined) {
        filter.price = {};
        if (minPrice !== undefined) filter.price.$gte = minPrice;
        if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    // usage months range
    const usageMin = toNumber(query.usageMin);
    const usageMax = toNumber(query.usageMax);
    if (usageMin !== undefined || usageMax !== undefined) {
        filter.usageMonths = {};
        if (usageMin !== undefined) filter.usageMonths.$gte = usageMin;
        if (usageMax !== undefined) filter.usageMonths.$lte = usageMax;
    }

    // year manufactured range -> specifications.yearManufactured
    const yearMin = toNumber(query.yearMin);
    const yearMax = toNumber(query.yearMax);
    if (yearMin !== undefined || yearMax !== undefined) {
        filter['specifications.yearManufactured'] = {};
        if (yearMin !== undefined) filter['specifications.yearManufactured'].$gte = yearMin;
        if (yearMax !== undefined) filter['specifications.yearManufactured'].$lte = yearMax;
    }

    // Colors (comma-separated) -> use case-insensitive exact match via regex
    const colors = parseCommaList(query.colors);
    if (colors && colors.length > 0) {
        const ors = colors.map((c) => ({ 'specifications.color': new RegExp(`^${escapeRegExp(c)}$`, 'i') }));
        clauses.push({ $or: ors });
    }

    const provinceIdNum = toNumber(query.provinceId);
    const districtIdNum = toNumber(query.districtId);
    if (provinceIdNum !== undefined) {
        filter['location.provinceId'] = provinceIdNum;
    }
    if (districtIdNum !== undefined) {
        filter['location.districtId'] = districtIdNum;
    }
    if (query.wardCode) {
        filter['location.wardCode'] = String(query.wardCode);
    }

    if (query.provinceName) {
        const regex = new RegExp(escapeRegExp(String(query.provinceName)), 'i');
        clauses.push({
            $or: [
                { 'location.provinceName': regex },
                { 'location.districtName': regex }
            ]
        });
    }

    // Colors handled above; search text
    if (query.search) {
        // Prefer $text (index exists on title,description). Client may still want regex fallback.
        filter.$text = { $search: String(query.search) };
    }

    // If we collected extra clauses, attach them
    if (clauses.length > 0) {
        // Merge with existing $and
        if (!filter.$and) filter.$and = [];
        filter.$and = filter.$and.concat(clauses);
    }

    // Return the built filter
    return filter;
}

export default buildBicycleFilter;
