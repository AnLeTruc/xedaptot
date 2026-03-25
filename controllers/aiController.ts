import { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AuthRequest } from '../types';
import Bicycle from '../models/Bicycle';

const MODEL_FALLBACK_CHAIN = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
];

function getAiClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY chưa được thiết lập');
    return new GoogleGenAI({ apiKey });
}

function isRetryableError(error: any): boolean {
    const msg = String(error?.message ?? '');
    return (
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota') ||
        msg.includes('not found') ||
        msg.includes('not supported')
    );
}

const ANALYZE_PROMPT = `Bạn đang hỗ trợ người bán đăng xe đạp cũ lên sàn mua bán lại tại Việt Nam.
Dựa vào ảnh, hãy viết nội dung để thu hút người mua lại xe.

**Tiêu đề** (tối đa 75 ký tự):
- Gồm: thương hiệu + tên xe/model (nếu nhận ra) + loại xe + màu sắc chính
- Ví dụ: "Giant ATX 27.5 màu đen - xe địa hình lướt phố"

**Mô tả** (80–120 từ, dùng xuống dòng để dễ đọc):
- Dòng 1: Loại xe, màu sắc, điểm nổi bật nhìn thấy được
- Dòng 2: Tình trạng tổng thể (chỉ mô tả những gì thực sự thấy trong ảnh)
- Dòng 3: Phù hợp cho ai / dùng để làm gì
- Dòng 4 (nếu có): Gợi ý người mua nên hỏi thêm gì (ví dụ: năm sản xuất, lịch sử bảo dưỡng)

Chỉ mô tả những gì thấy trong ảnh. Không bịa thông số, không dùng từ quảng cáo sáo rỗng.
Trả về JSON:
{
  "title": "...",
  "description": "..."
}`;

// POST /api/ai/analyze-bike
export const analyzeBike = async (req: AuthRequest, res: Response): Promise<void> => {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
        res.status(400).json({ success: false, message: 'imageUrl là bắt buộc' });
        return;
    }

    try {
        await runGeminiAnalysis(imageUrl, res);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Lỗi dịch vụ AI' });
    }
};

// GET /api/ai/price-suggestion
export const priceSuggestion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { brandId, categoryId, modelId, condition } = req.query;

        if (!brandId || !categoryId) {
            res.status(400).json({ success: false, message: 'brandId và categoryId là bắt buộc' });
            return;
        }

        const query: any = {
            brand: brandId,
            category: categoryId,
            status: 'APPROVED'
        };

        if (modelId) query.model = modelId;
        if (condition) query.condition = condition;

        const listings = await Bicycle.find(query).select('price');

        if (listings.length < 3) {
            res.json({
                success: true,
                data: null,
                message: 'Chưa đủ dữ liệu để gợi ý giá'
            });
            return;
        }

        const prices = listings.map(l => l.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

        res.json({
            success: true,
            data: {
                min,
                max,
                avg,
                count: listings.length
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống' });
    }
};

async function runGeminiAnalysis(imageUrl: string, res: Response): Promise<void> {
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    const client = getAiClient();
    for (const model of MODEL_FALLBACK_CHAIN) {
        try {
            const response = await client.models.generateContent({
                model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                            { text: ANALYZE_PROMPT },
                        ],
                    },
                ],
            });

            const text = response.text?.trim() ?? '';
            const json = extractJson(text);

            if (!json) {
                res.status(502).json({ success: false, message: 'AI không phân tích được ảnh này' });
                return;
            }

            res.json({ success: true, data: json });
            return;
        } catch (error: any) {
            if (isRetryableError(error)) {
                console.warn(`[AI] Model ${model} unavailable, trying next...`);
                continue;
            }
            throw error;
        }
    }

    throw new Error('Hệ thống đang có lỗi khi phân tích ảnh, vui lòng thử lại sau. Nếu bạn cho đây là lỗi, hãy liên hệ để chúng tôi có thể chỉnh sửa sớm nhất. Cảm ơn bạn.');
}

async function fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Tải ảnh thất bại: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

function extractJson(text: string): { title: string; description: string } | null {
    try {
        const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.title === 'string' && typeof parsed.description === 'string') {
            return { title: parsed.title, description: parsed.description };
        }
    } catch {
        const match = text.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                if (typeof parsed.title === 'string' && typeof parsed.description === 'string') {
                    return { title: parsed.title, description: parsed.description };
                }
            } catch {
                return null;
            }
        }
    }
    return null;
}
