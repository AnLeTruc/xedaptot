import {Request, Response} from 'express';

export const getSummaryStats = async (
    req: Request,
    res: Response
): Promise<void> =>{
    try{
        const {period = 'all', year} = req.query;

        //Validate period
        const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
        if(!validPeriods.includes(period as string)){
            res.status(400).json({
                success: false,
                message: `Period phải là một trong ${validPeriods.join(', ')}`
            });
            return;
        }

        const summary = await getSummaryData(
            
        )
    }
}