export interface DateRange{
    start: Date;
    end: Date;
}

export const getDateRange = (period: string, year?: number): DateRange | null => {

    //If year not provide -> use current year
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    let start: Date;
    let end: Date;

    switch (period){
        case 'week': {
            
        }
    }
}