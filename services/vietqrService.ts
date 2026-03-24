export interface VietQRBankData {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
  isTransfer?: number;
  support?: number;
}

export class VietQRService {
  static async getBanksList(): Promise<VietQRBankData[]> {
    try {
      const response = await fetch('https://api.vietqr.io/v2/banks');

      if (!response.ok) {
        throw new Error(`Khoá kết nối VietQR trả về mã lỗi: ${response.status}`);
      }

      const result = await response.json();

      if (result.code === '00') {
        return result.data as VietQRBankData[];
      }

      throw new Error(result.desc || 'Failed to get banks from VietQR');
    } catch (error: any) {
      console.error('Error fetching VietQR banks:', error);
      throw new Error('Lỗi liên kết danh sách ngân hàng. Vui lòng thử lại sau.');
    }
  }
}
