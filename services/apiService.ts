import axios from 'axios';

const API_BASE_URL = 'https://your-backend-api.com'; // You'll need to replace this with your actual backend API URL

export interface ProductInfo {
  store: string;
  inStock: boolean;
  aisle?: string;
  price?: string;
}

export const searchProduct = async (barcode: string, zipCode: string): Promise<ProductInfo[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: {
        barcode,
        zipCode,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error searching product:', error);
    throw error;
  }
};
