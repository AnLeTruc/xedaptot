import { IAddress } from '../types/address';

export function buildFullAddress(addr: Partial<IAddress>): string {
    return [addr.street, addr.wardName, addr.districtName, addr.provinceName]
        .filter(Boolean)
        .join(', ');
}
