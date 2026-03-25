export const addressSubSchema = {
    fullName: {
        type: String,
        trim: true,
        required: [true, 'Tên người nhận (fullName) là bắt buộc']
    },
    phone: {
        type: String,
        trim: true,
        required: [true, 'Số điện thoại (phone) là bắt buộc']
    },
    provinceId: {
        type: Number,
        required: [true, 'Province ID (GHN) is required']
    },
    districtId: {
        type: Number,
        required: [true, 'District ID (GHN) is required']
    },
    wardCode: {
        type: String,
        required: [true, 'Ward Code (GHN) is required']
    },
    provinceName: {
        type: String,
        required: [true, 'Province name is required']
    },
    districtName: {
        type: String,
        required: [true, 'District name is required']
    },
    wardName: {
        type: String,
        required: [true, 'Ward name is required']
    },
    street: {
        type: String,
        trim: true
    },
    fullAddress: {
        type: String,
        trim: true
    },
    coordinates: {
        type: {
            type: String,
            enum: ['Point']
        },
        coordinates: {
            type: [Number]
        }
    }
};
