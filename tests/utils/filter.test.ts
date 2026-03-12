import assert from 'assert';
import buildBicycleFilter from '../../utils/filter';

function deepSort(obj: any): any {
    if (Array.isArray(obj)) return obj.map(deepSort);
    if (obj && typeof obj === 'object') {
        const out: any = {};
        Object.keys(obj).sort().forEach(k => out[k] = deepSort(obj[k]));
        return out;
    }
    return obj;
}

// Test: brands comma list -> $in
(() => {
    const q = { brands: 'b1,b2' };
    const f = buildBicycleFilter(q, []);
    assert(f['brand._id'] && f['brand._id'].$in && f['brand._id'].$in.length === 2, 'brands -> $in failed');
    console.log('PASS: brands -> $in');
})();

// Test: colors -> $or regex entries
(() => {
    const q = { colors: 'Red, blue' };
    const f = buildBicycleFilter(q, []);
    // Expect $and with one $or clause that contains regexes for specifications.color
    assert(f.$and && Array.isArray(f.$and), 'colors did not produce $and');
    const orClause = f.$and.find((c: any) => c.$or && c.$or[0] && c.$or[0]['specifications.color']);
    assert(orClause, 'colors -> $or regex not found');
    console.log('PASS: colors -> regex $or');
})();

// Test: price range
(() => {
    const q = { minPrice: '100', maxPrice: '500' };
    const f = buildBicycleFilter(q, []);
    assert(f.price && f.price.$gte === 100 && f.price.$lte === 500, 'price range failed');
    console.log('PASS: price range');
})();

// Test: usage range and year range
(() => {
    const q = { usageMin: '10', usageMax: '20', yearMin: '2000', yearMax: '2020' };
    const f = buildBicycleFilter(q, []);
    assert(f.usageMonths && f.usageMonths.$gte === 10 && f.usageMonths.$lte === 20, 'usage range failed');
    assert(f['specifications.yearManufactured'] && f['specifications.yearManufactured'].$gte === 2000, 'yearMin failed');
    console.log('PASS: usage/year ranges');
})();

// Test: location AND semantics
(() => {
    const q = { provinceId: '79', districtId: '123' };
    const f = buildBicycleFilter(q, []);
    assert(f['location.provinceId'] === 79, 'provinceId not set as number');
    assert(f['location.districtId'] === 123, 'districtId not set as number');
    console.log('PASS: location AND semantics');
})();

// Test: provinceName fuzzy -> $or on provinceName/districtName
(() => {
    const q = { provinceName: 'Ho Chi' };
    const f = buildBicycleFilter(q, []);
    assert(f.$and && f.$and.some((c: any) => c.$or && c.$or.some((p: any) => p['location.provinceName'])), 'provinceName fuzzy not present');
    console.log('PASS: provinceName fuzzy $or');
})();

console.log('\nAll buildBicycleFilter tests passed.');
