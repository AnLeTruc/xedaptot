import { Request, Response } from 'express';
import { getSummaryData } from '../../services/summaryService';

export const getSummaryStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { period = 'all', year } = req.query;

    // Validate period
    const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        message: `Period phải là một trong: ${validPeriods.join(', ')}`
      });
      return;
    }

    const summary = await getSummaryData(
      period as string,
      year ? parseInt(year as string) : undefined
    );

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};