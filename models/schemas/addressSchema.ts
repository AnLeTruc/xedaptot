export const addressSubSchema = {
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
