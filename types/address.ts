import { Types } from 'mongoose';

export interface ICoordinates {
    type: 'Point';
    coordinates: [number, number];
}

export interface IAddress {
    fullName: string;
    phone: string;
    provinceId: number;
    districtId: number;
    wardCode: string;

    provinceName: string;
    districtName: string;
    wardName: string;

    street?: string;
    fullAddress?: string;

    coordinates?: ICoordinates;
}

export interface IUserAddress extends IAddress {
    _id?: Types.ObjectId;
    label: string;
    isDefault: boolean;
}
