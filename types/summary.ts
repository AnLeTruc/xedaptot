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

