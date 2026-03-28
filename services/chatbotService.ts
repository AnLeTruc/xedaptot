import { GoogleGenAI } from '@google/genai';
import Bicycle from '../models/Bicycle';
import Order from '../models/Order';

const MODEL_FALLBACK_CHAIN = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
];

const SYSTEM_PROMPT = `Bạn là "Trợ lý Bike Connect" — trợ lý ảo thân thiện của sàn mua bán xe đạp cũ "Bike Connect".

Nhiệm vụ:
- Trả lời câu hỏi về xe đạp (loại xe, thương hiệu, giá cả, bảo dưỡng)
- Hướng dẫn mua/bán xe trên sàn
- Giải thích chính sách: kiểm duyệt tin đăng, kiểm tra xe (inspector), thanh toán (VNPay, ví điện tử), giao hàng (GHN)
- Hỗ trợ giải quyết thắc mắc về đơn hàng, tranh chấp
- GỢI Ý SẢN PHẨM dựa trên dữ liệu thực từ hệ thống khi được cung cấp

Quy tắc:
- Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, dùng emoji phù hợp
- Khi gợi ý sản phẩm, hãy format đẹp với tên xe, giá, tình trạng, thương hiệu
- Nếu không biết câu trả lời chính xác, hãy gợi ý user liên hệ admin qua tab "Chat với Admin"
- Không bịa thông tin, không đưa giá cụ thể nếu không chắc chắn
- Giữ câu trả lời dưới 300 từ
- Nếu user hỏi ngoài phạm vi xe đạp, nhẹ nhàng hướng dẫn lại chủ đề`;

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

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

// ── Intent Detection ──────────────────────────────────────────────

interface DetectedIntent {
    type: 'product_search' | 'order_status' | 'price_estimate' | 'general';
    filters?: {
        keyword?: string;
        maxPrice?: number;
        minPrice?: number;
        category?: string;
        brand?: string;
        condition?: string;
    };
}

function detectIntent(message: string): DetectedIntent {
    const msg = message.toLowerCase();

    // ── Product search intent ─────────────────────────────────────
    const searchKeywords = [
        'gợi ý', 'tìm xe', 'tìm kiếm', 'có xe nào', 'xe nào', 'muốn mua',
        'recommend', 'suggest', 'sản phẩm', 'danh sách xe', 'xe đạp',
        'mua xe', 'xem xe', 'có bán', 'giá rẻ', 'giá tốt', 'phổ biến',
        'hot', 'bán chạy', 'nổi bật', 'đề xuất',
    ];

    const isProductSearch = searchKeywords.some((kw) => msg.includes(kw));

    if (isProductSearch) {
        const filters: DetectedIntent['filters'] = {};

        // Detect price range
        const priceMatch = msg.match(/(?:dưới|under|<|tầm|khoảng)\s*(\d+)\s*(triệu|tr|m)/i);
        if (priceMatch) {
            filters.maxPrice = parseInt(priceMatch[1]) * 1000000;
        }
        const priceMatch2 = msg.match(/(\d+)\s*(triệu|tr|m)/i);
        if (!priceMatch && priceMatch2) {
            filters.maxPrice = parseInt(priceMatch2[1]) * 1000000;
        }

        // Detect category
        const categoryMap: Record<string, string> = {
            'địa hình': 'Xe đạp địa hình',
            'mountain': 'Xe đạp địa hình',
            'mtb': 'Xe đạp địa hình',
            'đường phố': 'Xe đạp đường phố',
            'road': 'Xe đạp đường trường',
            'đường trường': 'Xe đạp đường trường',
            'thể thao': 'Xe đạp thể thao',
            'gấp': 'Xe đạp gấp',
            'folding': 'Xe đạp gấp',
            'trẻ em': 'Xe đạp trẻ em',
            'điện': 'Xe đạp điện',
            'đua': 'Xe đạp đua',
            'touring': 'Xe đạp touring',
            'nữ': 'Xe đạp nữ',
        };
        for (const [kw, cat] of Object.entries(categoryMap)) {
            if (msg.includes(kw)) {
                filters.category = cat;
                break;
            }
        }

        // Detect brand
        const brands = ['giant', 'trek', 'specialized', 'merida', 'trinx', 'java',
            'twitter', 'cannondale', 'scott', 'bianchi', 'fuji', 'sava', 'phoenix'];
        for (const brand of brands) {
            if (msg.includes(brand)) {
                filters.brand = brand;
                break;
            }
        }

        // Detect condition
        if (msg.includes('mới') || msg.includes('new')) filters.condition = 'NEW';
        else if (msg.includes('như mới') || msg.includes('like new')) filters.condition = 'LIKE_NEW';

        return { type: 'product_search', filters };
    }

    // ── Order status intent ───────────────────────────────────────
    const orderKeywords = ['đơn hàng', 'order', 'tình trạng đơn', 'trạng thái đơn', 'kiểm tra đơn', 'đã đặt'];
    if (orderKeywords.some((kw) => msg.includes(kw))) {
        return { type: 'order_status' };
    }

    // ── Price estimate intent ─────────────────────────────────────
    const priceKeywords = ['giá bao nhiêu', 'đáng giá', 'định giá', 'ước tính giá', 'price estimate'];
    if (priceKeywords.some((kw) => msg.includes(kw))) {
        return { type: 'price_estimate' };
    }

    return { type: 'general' };
}

// ── Types ─────────────────────────────────────────────────────────

export interface ProductCard {
    _id: string;
    title: string;
    price: number;
    condition: string;
    imageUrl: string;
    brand: string;
    category: string;
}

export interface OrderCard {
    _id: string;
    orderCode: string;
    status: string;
    statusLabel: string;
    totalAmount: number;
    bicycleTitle: string;
    bicycleImage: string;
    paymentType: string;
    createdAt: string;
}

export interface ChatBotResponse {
    reply: string;
    products?: ProductCard[];
    orders?: OrderCard[];
}

const CONDITION_MAP: Record<string, string> = {
    NEW: 'Mới 100%',
    LIKE_NEW: 'Như mới',
    GOOD: 'Tốt',
    FAIR: 'Khá',
    POOR: 'Cần sửa chữa',
};

// ── Data Retrieval ────────────────────────────────────────────────

interface ProductResult {
    contextForAI: string;
    cards: ProductCard[];
}

async function fetchProducts(filters: DetectedIntent['filters']): Promise<ProductResult> {
    try {
        const query: any = { status: 'APPROVED' };

        if (filters?.maxPrice) query.price = { $lte: filters.maxPrice };
        if (filters?.minPrice) {
            query.price = { ...(query.price || {}), $gte: filters.minPrice };
        }
        if (filters?.category) {
            query['category.name'] = { $regex: filters.category, $options: 'i' };
        }
        if (filters?.brand) {
            query['brand.name'] = { $regex: filters.brand, $options: 'i' };
        }
        if (filters?.condition) {
            query.condition = filters.condition;
        }

        const bicycles = await Bicycle.find(query)
            .select('title price condition category.name brand.name model.name viewCount images')
            .sort({ viewCount: -1, createdAt: -1 })
            .limit(5)
            .lean();

        if (bicycles.length === 0) {
            return {
                contextForAI: '\n[DỮ LIỆU HỆ THỐNG] Không tìm thấy sản phẩm phù hợp. Gợi ý user thay đổi tiêu chí hoặc xem trang /listings.',
                cards: [],
            };
        }

        const cards: ProductCard[] = bicycles.map((b: any) => ({
            _id: b._id.toString(),
            title: b.title,
            price: b.price,
            condition: CONDITION_MAP[b.condition] || b.condition,
            imageUrl: b.images?.find((img: any) => img.isPrimary)?.url || b.images?.[0]?.url || '',
            brand: b.brand?.name || 'N/A',
            category: b.category?.name || 'N/A',
        }));

        const items = cards.map((c, i) =>
            `${i + 1}. "${c.title}" | Giá: ${c.price.toLocaleString('vi-VN')}đ | ${c.condition} | ${c.brand}`
        );

        return {
            contextForAI: `\n[DỮ LIỆU HỆ THỐNG - ${cards.length} sản phẩm]\n${items.join('\n')}\n\nHãy giới thiệu ngắn gọn các sản phẩm trên (hình ảnh và link đã được hiển thị bên dưới). Gợi ý user bấm vào sản phẩm để xem chi tiết.`,
            cards,
        };
    } catch (error) {
        console.error('[Chatbot] Product fetch error:', error);
        return { contextForAI: '\n[DỮ LIỆU HỆ THỐNG] Không thể truy xuất sản phẩm lúc này.', cards: [] };
    }
}

const ORDER_STATUS_MAP: Record<string, string> = {
    RESERVED_FULL: 'Đã đặt (Full)',
    RESERVED_DEPOSIT: 'Đã đặt cọc',
    DEPOSIT_CONFIRMED: 'Cọc xác nhận',
    DEPOSIT_EXPIRED: 'Cọc hết hạn',
    PAYMENT_TIMEOUT: 'Hết hạn TT',
    WAITING_SELLER_CONFIRMATION: 'Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận',
    REJECTED: 'Từ chối',
    WAITING_FOR_PICKUP: 'Chờ lấy hàng',
    IN_TRANSIT: 'Đang giao',
    DELIVERED: 'Đã giao',
    WAITING_REMAINING_PAYMENT: 'Chờ TT còn lại',
    COMPLETED: 'Hoàn thành',
    FUNDS_RELEASED: 'Đã giải ngân',
    CANCELLED: 'Đã hủy',
    CANCELLED_BY_BUYER: 'Buyer hủy',
    DISPUTED: 'Tranh chấp',
};

interface OrderResult {
    contextForAI: string;
    cards: OrderCard[];
}

async function fetchUserOrders(userId: string): Promise<OrderResult> {
    try {
        const orders = await Order.find({ 'buyer._id': userId })
            .select('orderCode status amounts.total bicycle.title bicycle.primaryImage paymentType createdAt')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        if (orders.length === 0) {
            return {
                contextForAI: '\n[DỮ LIỆU HỆ THỐNG] User chưa có đơn hàng nào. Gợi ý user truy cập trang /listings để tìm xe.',
                cards: [],
            };
        }

        const cards: OrderCard[] = orders.map((o: any) => ({
            _id: o._id.toString(),
            orderCode: o.orderCode,
            status: o.status,
            statusLabel: ORDER_STATUS_MAP[o.status] || o.status,
            totalAmount: o.amounts?.total || 0,
            bicycleTitle: o.bicycle?.title || 'Xe đạp',
            bicycleImage: o.bicycle?.primaryImage || '',
            paymentType: o.paymentType === 'DEPOSIT_10' ? 'Đặt cọc 10%' : 'Thanh toán 100%',
            createdAt: new Date(o.createdAt).toLocaleDateString('vi-VN'),
        }));

        const items = cards.map((c, i) =>
            `${i + 1}. Đơn #${c.orderCode} | ${c.statusLabel} | ${c.totalAmount.toLocaleString('vi-VN')}đ | ${c.bicycleTitle} | ${c.createdAt}`
        );

        return {
            contextForAI: `\n[DỮ LIỆU HỆ THỐNG - ${cards.length} đơn hàng]\n${items.join('\n')}\n\nHãy trình bày thông tin đơn hàng rõ ràng (thẻ đơn hàng đã hiển thị bên dưới). Gợi ý user bấm vào đơn hàng để xem chi tiết.`,
            cards,
        };
    } catch (error) {
        console.error('[Chatbot] Order fetch error:', error);
        return { contextForAI: '\n[DỮ LIỆU HỆ THỐNG] Không thể truy xuất đơn hàng lúc này.', cards: [] };
    }
}

async function fetchMarketStats(): Promise<string> {
    try {
        const [totalBikes, avgPrice] = await Promise.all([
            Bicycle.countDocuments({ status: 'APPROVED' }),
            Bicycle.aggregate([
                { $match: { status: 'APPROVED' } },
                { $group: { _id: null, avg: { $avg: '$price' }, min: { $min: '$price' }, max: { $max: '$price' } } },
            ]),
        ]);

        const stats = avgPrice[0] || { avg: 0, min: 0, max: 0 };
        return `\n[DỮ LIỆU HỆ THỐNG - Thống kê thị trường]\nTổng xe đang bán: ${totalBikes} | Giá TB: ${Math.round(stats.avg).toLocaleString('vi-VN')}đ | Giá thấp nhất: ${stats.min?.toLocaleString('vi-VN')}đ | Giá cao nhất: ${stats.max?.toLocaleString('vi-VN')}đ\n\nDùng thông tin trên để hỗ trợ user đưa ra quyết định giá hợp lý.`;
    } catch {
        return '';
    }
}

// ── Main Chat Function ────────────────────────────────────────────

export async function chatWithBot(
    message: string,
    history: ChatMessage[] = [],
    userId?: string
): Promise<ChatBotResponse> {
    const client = getAiClient();
    const intent = detectIntent(message);

    // ── Gather context data based on intent ───────────────────────
    let contextData = '';
    let products: ProductCard[] = [];
    let orders: OrderCard[] = [];

    if (intent.type === 'product_search') {
        const result = await fetchProducts(intent.filters);
        contextData = result.contextForAI;
        products = result.cards;
    } else if (intent.type === 'order_status' && userId) {
        const result = await fetchUserOrders(userId);
        contextData = result.contextForAI;
        orders = result.cards;
    } else if (intent.type === 'price_estimate') {
        contextData = await fetchMarketStats();
    }

    // Build contents array with conversation history (last 10 messages)
    const recentHistory = history.slice(-10);
    const enrichedMessage = contextData ? `${message}${contextData}` : message;

    const contents = [
        ...recentHistory.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
        })),
        {
            role: 'user' as const,
            parts: [{ text: enrichedMessage }],
        },
    ];

    let lastError: any = null;
    for (const model of MODEL_FALLBACK_CHAIN) {
        try {
            console.log(`[Chatbot] Trying model: ${model} | Intent: ${intent.type}`);
            const response = await client.models.generateContent({
                model,
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                },
                contents,
            });

            const text = response.text?.trim() ?? '';
            if (!text) continue;

            return {
                reply: text,
                products: products.length > 0 ? products : undefined,
                orders: orders.length > 0 ? orders : undefined,
            };
        } catch (error: any) {
            console.error(`[Chatbot] Model ${model} failed:`, error.message);
            lastError = error;
            if (isRetryableError(error)) {
                continue;
            }
            throw error;
        }
    }

    console.error('[Chatbot] All models failed. Last error:', lastError?.message);
    throw new Error('Hệ thống AI tạm thời không khả dụng. Vui lòng thử lại sau hoặc chat trực tiếp với Admin.');
}
