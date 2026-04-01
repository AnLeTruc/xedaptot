/**
 * FPT.AI Vision API Service - eKYC ID Card Recognition
 * Endpoint: POST https://api.fpt.ai/vision/idr/vnm
 * Docs: https://docs.fpt.ai/docs/en/vision/api/ekyc-id-recognition
 */

export interface FptAiIdResult {
    id: string;            // Số CCCD/CMND
    name: string;          // Họ tên
    dob: string;           // Ngày sinh (dd/mm/yyyy)
    sex: string;           // Giới tính
    nationality: string;   // Quốc tịch
    home: string;          // Quê quán
    address: string;       // Nơi thường trú
    doe: string;           // Ngày hết hạn
    type: string;          // Loại giấy tờ (old/new/chip)
}

export interface FptAiResponse {
    errorCode: number;
    errorMessage: string;
    data: FptAiIdResult[];
}

const FPT_AI_ENDPOINT = 'https://api.fpt.ai/vision/idr/vnm';

/**
 * Recognize Vietnamese ID card (CCCD/CMND) from image URL.
 * Uses FPT.AI Vision API.
 * 
 * @param imageUrl - Cloudinary URL of the uploaded CCCD image
 * @returns Parsed ID card data
 * @throws Error if API call fails or no data returned
 */
export async function recognizeIdCard(imageUrl: string): Promise<FptAiIdResult> {
    const apiKey = process.env.FPT_AI_API_KEY;
    if (!apiKey) {
        throw new Error('FPT_AI_API_KEY chưa được cấu hình');
    }

    // FPT.AI accepts image_url via form-data
    const formData = new FormData();
    formData.append('image_url', imageUrl);

    const response = await fetch(FPT_AI_ENDPOINT, {
        method: 'POST',
        headers: {
            'api-key': apiKey
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FPT.AI API lỗi (${response.status}): ${errorText}`);
    }

    const result = await response.json() as FptAiResponse;

    if (result.errorCode !== 0) {
        throw new Error(`FPT.AI lỗi: ${result.errorMessage || 'Không xác định'}`);
    }

    if (!result.data || result.data.length === 0) {
        throw new Error('Không nhận diện được thông tin từ ảnh CCCD. Vui lòng chụp rõ ràng hơn.');
    }

    const idData = result.data[0];

    // Validate essential fields
    if (!idData.id || idData.id === 'N/A') {
        throw new Error('Không đọc được số CCCD/CMND. Vui lòng chụp lại ảnh rõ hơn.');
    }
    if (!idData.name || idData.name === 'N/A') {
        throw new Error('Không đọc được họ tên trên CCCD. Vui lòng chụp lại ảnh rõ hơn.');
    }

    return idData;
}
