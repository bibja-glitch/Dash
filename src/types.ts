export interface Transaction {
  date: string;
  type: 'Приход' | 'Расход';
  category: string;
  amount: number;
  dateObj: Date;
}

export interface DaySummary {
  dateObj: Date;
  dateStr: string;
  income: number;
  expense: number;
  cats: Record<string, number>;
}
