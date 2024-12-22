import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';

// Configure axios with retry logic for scraping
axiosRetry(axios, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

interface StoreLocation {
  storeId: string;
  name: string;
  address: string;
  distance?: number;
  chain: 'walmart' | 'target';
}

interface StoreInventory {
  storeId: string;
  chain: 'walmart' | 'target';
  inStock: boolean;
  quantity?: number;
  aisle: string;
  price?: number;
  lastUpdated: Date;
}

interface ProductInfo {
  name: string;
  image: string;
  barcode: string;
  inventory: StoreInventory;
  alternativeStores?: StoreInventory[];
  brand?: string;
}

export class ProductService {
  private static readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  private static async findWalmartStores(zipCode: string): Promise<StoreLocation[]> {
    try {
      const response = await axios.get(`https://www.walmart.com/store/finder?location=${zipCode}`, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      });

      const $ = cheerio.load(response.data);
      const stores: StoreLocation[] = [];

      $('.store-list-item').each((_, element) => {
        const storeId = $(element).attr('data-store-id') || '';
        const name = $(element).find('.store-name').text().trim();
        const address = $(element).find('.store-address').text().trim();
        const distanceText = $(element).find('.distance').text().trim();
        const distance = parseFloat(distanceText.replace('miles', '').trim());

        stores.push({
          storeId,
          name,
          address,
          distance,
          chain: 'walmart'
        });
      });

      return stores;
    } catch (error) {
      console.error('Error finding Walmart stores:', error);
      return [];
    }
  }

  private static async findTargetStores(zipCode: string): Promise<StoreLocation[]> {
    try {
      const response = await axios.get(`https://www.target.com/store-locator/find-stores?address=${zipCode}`, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      });

      const $ = cheerio.load(response.data);
      const stores: StoreLocation[] = [];

      $('.store-list-item').each((_, element) => {
        const storeId = $(element).attr('data-store-id') || '';
        const name = $(element).find('.store-name').text().trim();
        const address = $(element).find('.store-address').text().trim();
        const distanceText = $(element).find('.distance').text().trim();
        const distance = parseFloat(distanceText.replace('miles', '').trim());

        stores.push({
          storeId,
          name,
          address,
          distance,
          chain: 'target'
        });
      });

      return stores;
    } catch (error) {
      console.error('Error finding Target stores:', error);
      return [];
    }
  }

  private static async getWalmartInventory(storeId: string, barcode: string): Promise<StoreInventory | null> {
    try {
      const response = await axios.get(`https://www.walmart.com/ip/${barcode}`, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });

      const $ = cheerio.load(response.data);

      const inStockText = $('.fulfillment-status').text().toLowerCase();
      const priceText = $('.price-main').text().trim();
      const aisleText = $('.aisle-location').text().trim();

      return {
        storeId,
        chain: 'walmart',
        inStock: inStockText.includes('in stock'),
        aisle: aisleText || 'Ask store associate',
        price: parseFloat(priceText.replace('$', '')) || undefined,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting Walmart inventory:', error);
      return null;
    }
  }

  private static async getTargetInventory(storeId: string, barcode: string): Promise<StoreInventory | null> {
    try {
      const response = await axios.get(`https://www.target.com/p/a/${barcode}`, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });

      const $ = cheerio.load(response.data);

      const inStockText = $('.fulfillment-status').text().toLowerCase();
      const priceText = $('.price').text().trim();
      const aisleText = $('.aisle-location').text().trim();

      return {
        storeId,
        chain: 'target',
        inStock: inStockText.includes('in stock'),
        aisle: aisleText || 'Ask store associate',
        price: parseFloat(priceText.replace('$', '')) || undefined,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting Target inventory:', error);
      return null;
    }
  }

  private static async scrapeWalmartProduct(barcode: string): Promise<ProductInfo | null> {
    try {
      const response = await axios.get(`https://www.walmart.com/ip/${barcode}`, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      });

      const $ = cheerio.load(response.data);

      const name = $('.prod-title').text().trim();
      const image = $('.prod-image img').attr('src') || '';
      const brand = $('.prod-brand').text().trim();

      if (!name) {
        return null;
      }

      return {
        name,
        image,
        barcode,
        brand,
        inventory: {
          storeId: 'unknown',
          chain: 'walmart',
          inStock: false,
          aisle: 'unknown',
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      console.error('Error scraping Walmart product:', error);
      return null;
    }
  }

  private static async scrapeTargetProduct(barcode: string): Promise<ProductInfo | null> {
    try {
      const response = await axios.get(`https://www.target.com/p/a/${barcode}`, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      });

      const $ = cheerio.load(response.data);

      const name = $('.product-name').text().trim();
      const image = $('.product-image img').attr('src') || '';
      const brand = $('.product-brand').text().trim();

      if (!name) {
        return null;
      }

      return {
        name,
        image,
        barcode,
        brand,
        inventory: {
          storeId: 'unknown',
          chain: 'target',
          inStock: false,
          aisle: 'unknown',
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      console.error('Error scraping Target product:', error);
      return null;
    }
  }

  public static async getProductInfo(barcode: string, zipCode?: string): Promise<ProductInfo | null> {
    try {
      // Try both Walmart and Target
      let productInfo = await this.scrapeWalmartProduct(barcode);
      if (!productInfo) {
        productInfo = await this.scrapeTargetProduct(barcode);
      }

      if (!productInfo) {
        return null;
      }

      if (zipCode) {
        // Get stores from both chains
        const [walmartStores, targetStores] = await Promise.all([
          this.findWalmartStores(zipCode),
          this.findTargetStores(zipCode)
        ]);

        // Combine and sort stores by distance
        const allStores = [...walmartStores, ...targetStores]
          .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

        if (allStores.length > 0) {
          // Check nearest store first
          const nearestStore = allStores[0];
          const inventory = nearestStore.chain === 'walmart'
            ? await this.getWalmartInventory(nearestStore.storeId, barcode)
            : await this.getTargetInventory(nearestStore.storeId, barcode);

          if (inventory) {
            productInfo.inventory = inventory;
          }

          // If out of stock, check other nearby stores
          if (!inventory?.inStock) {
            const alternativeStores: StoreInventory[] = [];
            
            for (const store of allStores.slice(1, 4)) {
              const storeInventory = store.chain === 'walmart'
                ? await this.getWalmartInventory(store.storeId, barcode)
                : await this.getTargetInventory(store.storeId, barcode);

              if (storeInventory?.inStock) {
                alternativeStores.push(storeInventory);
              }
            }

            if (alternativeStores.length > 0) {
              productInfo.alternativeStores = alternativeStores;
            }
          }
        }
      }

      return productInfo;
    } catch (error) {
      console.error('Error getting product info:', error);
      return null;
    }
  }
}
