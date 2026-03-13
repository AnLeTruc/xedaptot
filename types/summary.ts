export interface TotalUsers{
    total: number;
    new: number;
}

export interface SummaryResult {
    totalUsers: TotalUsers;
    activeListings: number;
    totalRevenue: number;
    successOrders: number;
    escrowAmount: number;
    paidSubscriptions: number;
    period: string;
    year?: number;
}

//Query params type
export interface SummaryQuery{
    period: 'day' | 'week' | 'month' | 'year';
    year?: number;
}

//Bicycle Chart
export interface BicyclesStatusCount{
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    count: number;
}

export interface BicyclesChartResult {
    data: BicyclesStatusCount[];
    total: number;
}

//Top brand chart
export interface BrandChartItem {
    brandId: string;
    brandName: string;
    count: number;
    percentage: number; //% -> total
}

export interface BrandChartResult{
    data: BrandChartItem[];
    total: number; //Total bicycle of brand
}

//Top category chart
export interface CategoryChartItem {
  categoryId: string;
  categoryName: string;
  count: number;
  percentage: number;
}

export interface TopCategoriesResult {
  data: CategoryChartItem[];
  total: number;
}

//Top sellers chart
export interface SellerChartItem {
  sellerId: string;
  sellerName: string;
  avatarUrl: string;
  successOrders: number;
  percentage: number;
}

export interface TopSellersResult {
  data: SellerChartItem[];
  total: number; 
}
