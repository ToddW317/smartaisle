import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface PriceInfo {
  store: string;
  price: number;
  distance: number;
  address: string;
  timestamp: Date;
}

interface PantryItem {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
  dateAdded: Date;
  image: string;
  prices: PriceInfo[];
  aisle: string | null;
}

interface StoreRoute {
  store: string;
  items: PantryItem[];
  optimizedPath: PantryItem[];
  totalItems: number;
}

const RouteScreen = () => {
  const [storeRoutes, setStoreRoutes] = useState<StoreRoute[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadPantryItems();
  }, []);

  const loadPantryItems = async () => {
    try {
      const shoppingListData = await AsyncStorage.getItem('shoppingList');
      if (shoppingListData) {
        const items = JSON.parse(shoppingListData);
        const itemsWithDates = items.map((item: PantryItem) => ({
          ...item,
          dateAdded: new Date(item.dateAdded),
          prices: item.prices.map((price: PriceInfo) => ({
            ...price,
            timestamp: new Date(price.timestamp)
          }))
        }));
        organizeByStore(itemsWithDates);
      }
    } catch (error) {
      console.error('Error loading shopping list:', error);
    }
  };

  const getAisleNumber = (aisle: string | null): number => {
    if (!aisle) return 999; // Put items without aisle at the end
    // Extract the first number from the aisle string
    const match = aisle.match(/\d+/);
    return match ? parseInt(match[0]) : 998;
  };

  const optimizeRoute = (items: PantryItem[]): PantryItem[] => {
    // Group items by aisle
    const aisleGroups = items.reduce((groups: { [key: string]: PantryItem[] }, item) => {
      const aisle = item.aisle || 'Other';
      if (!groups[aisle]) {
        groups[aisle] = [];
      }
      groups[aisle].push(item);
      return groups;
    }, {});

    // Sort aisles by number
    const sortedAisles = Object.keys(aisleGroups).sort((a, b) => {
      return getAisleNumber(a) - getAisleNumber(b);
    });

    // Create optimized path
    return sortedAisles.flatMap(aisle => aisleGroups[aisle]);
  };

  const organizeByStore = (items: PantryItem[]) => {
    const storeMap = new Map<string, PantryItem[]>();
    
    items.forEach(item => {
      if (item.prices && item.prices.length > 0) {
        const store = item.prices[0].store;
        if (!storeMap.has(store)) {
          storeMap.set(store, []);
        }
        const storeItems = storeMap.get(store);
        if (storeItems) {
          // Only add items if quantity > 0
          if (item.quantity > 0) {
            storeItems.push(item);
          }
        }
      }
    });

    const routes: StoreRoute[] = [];
    storeMap.forEach((items, store) => {
      if (items.length > 0) {
        const optimizedItems = optimizeRoute(items);
        routes.push({
          store,
          items,
          optimizedPath: optimizedItems,
          totalItems: items.reduce((sum, item) => sum + item.quantity, 0)
        });
      }
    });

    // Sort stores by total number of items, descending
    routes.sort((a, b) => b.totalItems - a.totalItems);
    setStoreRoutes(routes);
  };

  const renderStoreItem = ({ item }: { item: StoreRoute }) => (
    <TouchableOpacity
      style={[
        styles.storeCard,
        selectedStore === item.store && styles.selectedStoreCard
      ]}
      onPress={() => setSelectedStore(item.store)}
    >
      <View style={styles.storeHeader}>
        <Text style={styles.storeName}>{item.store}</Text>
        <Text style={styles.itemCount}>{item.totalItems} items</Text>
      </View>
      {selectedStore === item.store && (
        <View style={styles.optimizedPath}>
          <Text style={styles.pathHeader}>Shopping Route:</Text>
          <FlatList
            data={item.optimizedPath}
            keyExtractor={(item) => item.id}
            renderItem={({ item: pathItem }) => (
              <View style={styles.pathItem}>
                <View style={styles.pathItemImageContainer}>
                  {pathItem.image ? (
                    <Image source={{ uri: pathItem.image }} style={styles.pathItemImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Ionicons name="image-outline" size={24} color="#999" />
                    </View>
                  )}
                </View>
                <View style={styles.pathItemDetails}>
                  <Text style={styles.pathItemName}>{pathItem.name}</Text>
                  <Text style={styles.pathItemAisle}>
                    {pathItem.aisle || 'Aisle not specified'}
                  </Text>
                  <Text style={styles.pathItemQuantity}>Quantity: {pathItem.quantity}</Text>
                </View>
              </View>
            )}
          />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shopping Routes</Text>
          <Text style={styles.headerSubtitle}>Tap a store to view optimized route</Text>
        </View>
        
        <FlatList
          data={storeRoutes}
          renderItem={renderStoreItem}
          keyExtractor={(item) => item.store}
          contentContainerStyle={styles.storeList}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  storeList: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Extra padding for bottom tab bar
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedStoreCard: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  optimizedPath: {
    marginTop: 16,
  },
  pathHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pathItem: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pathItemImageContainer: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  pathItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathItemDetails: {
    flex: 1,
  },
  pathItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  pathItemAisle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  pathItemQuantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});

export default RouteScreen;
