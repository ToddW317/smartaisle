import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  Platform,
  Animated,
} from 'react-native';
import {
  SafeAreaView
} from 'react-native-safe-area-context';
import {
  Swipeable
} from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BarcodeScanner from '@/components/BarcodeScanner';
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
  aisle: string;
}

interface PantryItemComponentProps {
  item: PantryItem;
  onDelete: (id: string) => void;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
  onAddToList: (id: string) => void;
}

const PantryItemComponent: React.FC<PantryItemComponentProps> = ({ 
  item, 
  onDelete,
  onUpdateQuantity,
  onAddToList
}) => {
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity
          style={[styles.rightAction, { backgroundColor: '#007AFF' }]}
          onPress={() => onAddToList(item.id)}
        >
          <Animated.Text
            style={[
              styles.actionText,
              { transform: [{ scale }] }
            ]}>
            Add to List
          </Animated.Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rightAction, { backgroundColor: '#ff3b30' }]}
          onPress={() => onDelete(item.id)}
        >
          <Animated.Text
            style={[
              styles.actionText,
              { transform: [{ scale }] }
            ]}>
            Delete
          </Animated.Text>
        </TouchableOpacity>
      </View>
    );
  };

  const cheapestPrice = item.prices[0];
  const isOldPrice = cheapestPrice && 
    (new Date().getTime() - new Date(cheapestPrice.timestamp).getTime()) > (24 * 60 * 60 * 1000);

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={40}
    >
      <View style={styles.itemContainer}>
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/100' }}
          style={styles.itemImage}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemAisle}>Aisle: {item.aisle || 'Unknown'}</Text>
          {cheapestPrice && (
            <Text style={[styles.itemPrice, isOldPrice && styles.oldPrice]}>
              ${cheapestPrice.price.toFixed(2)} at {cheapestPrice.store}
              {isOldPrice && ' (Price may be outdated)'}
            </Text>
          )}
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
            >
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Swipeable>
  );
};

const Index = () => {
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadPantryItems();
  }, []);

  useEffect(() => {
    savePantryItems();
  }, [pantryItems]);

  const loadPantryItems = async () => {
    try {
      const savedItems = await AsyncStorage.getItem('pantryItems');
      if (savedItems) {
        const items = JSON.parse(savedItems);
        const itemsWithDates = items.map((item: PantryItem) => ({
          ...item,
          dateAdded: new Date(item.dateAdded),
          prices: item.prices.map((price: PriceInfo) => ({
            ...price,
            timestamp: new Date(price.timestamp)
          }))
        }));
        setPantryItems(itemsWithDates);
      }
    } catch (error) {
      console.error('Error loading pantry items:', error);
    }
  };

  const savePantryItems = async () => {
    try {
      await AsyncStorage.setItem('pantryItems', JSON.stringify(pantryItems));
    } catch (error) {
      console.error('Error saving pantry items:', error);
    }
  };

  const handleScanned = async (data: { 
    barcode: string; 
    type: string; 
    productName: string;
    productImage: string;
    prices: PriceInfo[];
    aisle: string | null;
  }) => {
    const newItem: PantryItem = {
      id: Math.random().toString(36).substring(7),
      barcode: data.barcode,
      name: data.productName,
      quantity: 1,
      dateAdded: new Date(),
      image: data.productImage,
      prices: data.prices,
      aisle: data.aisle || 'Unknown',
    };

    setPantryItems(prev => {
      const existingItemIndex = prev.findIndex(item => item.barcode === data.barcode);
      if (existingItemIndex >= 0) {
        const updatedItems = [...prev];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + 1,
          prices: data.prices,
        };
        return updatedItems;
      }
      return [...prev, newItem];
    });
  };

  const handleDelete = (id: string) => {
    setPantryItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setPantryItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleAddToList = async (id: string) => {
    try {
      // Get the current shopping list
      const savedList = await AsyncStorage.getItem('shoppingList');
      let shoppingList: PantryItem[] = savedList ? JSON.parse(savedList) : [];
      
      // Find the item in pantry items
      const itemToAdd = pantryItems.find(item => item.id === id);
      
      if (itemToAdd) {
        // Check if item already exists in shopping list
        const existingIndex = shoppingList.findIndex(item => item.id === id);
        
        if (existingIndex >= 0) {
          // Update quantity if item exists
          shoppingList[existingIndex].quantity += 1;
        } else {
          // Add new item if it doesn't exist
          shoppingList.push({
            ...itemToAdd,
            quantity: 1
          });
        }
        
        // Save updated shopping list
        await AsyncStorage.setItem('shoppingList', JSON.stringify(shoppingList));
        console.log('Item added to shopping list:', id);
      }
    } catch (error) {
      console.error('Error adding item to shopping list:', error);
    }
  };

  const renderItem = ({ item }: { item: PantryItem }) => (
    <PantryItemComponent
      item={item}
      onDelete={handleDelete}
      onUpdateQuantity={handleUpdateQuantity}
      onAddToList={handleAddToList}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pantry</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/route')}
            >
              <Ionicons name="map-outline" size={24} color="#007AFF" />
              <Text style={styles.headerButtonText}>View Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setScannerVisible(true)}
            >
              <Ionicons name="scan-outline" size={24} color="#007AFF" />
              <Text style={styles.headerButtonText}>Scan Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={pantryItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />

        <Modal
          visible={isScannerVisible}
          onRequestClose={() => setScannerVisible(false)}
          animationType="slide"
        >
          <BarcodeScanner
            onScanned={(data) => {
              setScannerVisible(false);
              handleScanned(data);
            }}
            onClose={() => setScannerVisible(false)}
          />
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default Index;

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemAisle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  oldPrice: {
    color: '#ff9500',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: '#f0f0f0',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  quantityText: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  rightAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
