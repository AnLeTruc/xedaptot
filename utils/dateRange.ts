export interface DateRange {
  start: Date;
  end: Date;
}

export const getDateRange = (period: string, year?: number): DateRange | null => {
  // If not provide year → current
  if (period === 'all' && !year) return null;

  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start = new Date(now);
      start.setDate(now.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      break;
    }

    case 'month': {
      start = new Date(targetYear, now.getMonth(), 1);
      end = new Date(targetYear, now.getMonth() + 1, 0, 23, 59, 59);
      break;
    }

    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(targetYear, quarter * 3, 1);
      end = new Date(targetYear, quarter * 3 + 3, 0, 23, 59, 59);
      break;
    }

    case 'year': {
      start = new Date(targetYear, 0, 1);
      end = new Date(targetYear, 11, 31, 23, 59, 59);
      break;
    }

    default:
      return null;
  }

  return { start, end };
};