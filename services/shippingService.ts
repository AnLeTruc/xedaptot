const GHN_TOKEN = process.env.GHN_TOKEN || '';
const GHN_SHOP_ID = process.env.GHN_SHOP_ID || '';
const GHN_BASE_URL = process.env.GHN_API_URL
    ? process.env.GHN_API_URL.replace('/v2', '')
    : 'https://dev-online-gateway.ghn.vn/shiip/public-api';

//Cache
const cache = new Map<string, { data: any; expiredAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (entry && entry.expiredAt > Date.now()) return entry.data;
    cache.delete(key);
    return null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, expiredAt: Date.now() + CACHE_TTL });
}


//Helper
async function ghnRequest(endpoint: string, body?: any) {
    const url = `${GHN_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Token': GHN_TOKEN,
            'ShopId': GHN_SHOP_ID,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json();
    if (json.code !== 200) {
        throw new Error(`GHN API Error: ${json.message}`);
    }
    return json.data;
}


//Master Data
export async function getProvinces() {
    const cacheKey = 'provinces';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await ghnRequest('/master-data/province');
    setCache(cacheKey, data);
    return data;
}

export async function getDistricts(provinceId: number) {
    const cacheKey = `districts_${provinceId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await ghnRequest('/master-data/district', { province_id: provinceId });
    setCache(cacheKey, data);
    return data;
}

export async function getWards(districtId: number) {
    const cacheKey = `wards_${districtId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await ghnRequest('/master-data/ward', { district_id: districtId });
    setCache(cacheKey, data);
    return data;
}


//Shipping Fee
export interface ShippingFeeParams {
    fromDistrictId: number;
    fromWardCode: string;
    toDistrictId: number;
    toWardCode: string;
    weight?: number;         // gram — default 15000g (15kg)
    height?: number;         // cm
    length?: number;         // cm
    width?: number;          // cm
    insuranceValue?: number;
    serviceTypeId?: number;
}

export interface ShippingFeeResult {
    total: number;
    serviceFee: number;
    insuranceFee: number;
}

export async function calculateShippingFee(params: ShippingFeeParams): Promise<ShippingFeeResult> {
    const body = {
        from_district_id: params.fromDistrictId,
        from_ward_code: params.fromWardCode,
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        service_type_id: params.serviceTypeId || 2,
        weight: params.weight || 15000,
        height: params.height || 50,
        length: params.length || 180,
        width: params.width || 70,
        insurance_value: params.insuranceValue || 0,
    };

    const data = await ghnRequest('/v2/shipping-order/fee', body);
    return {
        total: data.total,
        serviceFee: data.service_fee,
        insuranceFee: data.insurance_fee,
    };
}
