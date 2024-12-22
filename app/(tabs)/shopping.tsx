import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface PriceInfo {
  store: string;
  price: number;
  distance: number;
  address: string;
  timestamp: Date;
  aisle?: string;
}

interface PantryItem {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
  dateAdded: Date;
  image: string;
  prices: PriceInfo[];
}

const ShoppingListScreen = () => {
  const [shoppingList, setShoppingList] = useState<PantryItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    try {
      const savedList = await AsyncStorage.getItem('shoppingList');
      if (savedList) {
        const items = JSON.parse(savedList);
        // Convert date strings back to Date objects
        const itemsWithDates = items.map((item: PantryItem) => ({
          ...item,
          dateAdded: new Date(item.dateAdded),
          prices: item.prices.map((price: PriceInfo) => ({
            ...price,
            timestamp: new Date(price.timestamp)
          }))
        }));
        setShoppingList(itemsWithDates);
      }
    } catch (error) {
      console.error('Error loading shopping list:', error);
    }
  };

  const saveShoppingList = async (newList: PantryItem[]) => {
    try {
      // Dates are automatically converted to ISO strings when stringified
      await AsyncStorage.setItem('shoppingList', JSON.stringify(newList));
      setShoppingList(newList);
    } catch (error) {
      console.error('Error saving shopping list:', error);
    }
  };

  const removeFromList = (id: string) => {
    const newList = shoppingList.filter(item => item.id !== id);
    saveShoppingList(newList);
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    const newList = shoppingList.map(item =>
      item.id === id ? { ...item, quantity: newQuantity } : item
    );
    if (newQuantity <= 0) {
      removeFromList(id);
    } else {
      saveShoppingList(newList);
    }
  };

  const renderItem = ({ item }: { item: PantryItem }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.itemImage} />
        ) : (
          <View style={[styles.itemImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={24} color="#999" />
          </View>
        )}
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            style={styles.quantityButton}
          >
            <Ionicons name="remove" size={20} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            style={styles.quantityButton}
          >
            <Ionicons name="add" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        {item.prices && item.prices.length > 0 && (
          <Text style={styles.itemPrice}>
            ${(item.prices[0].price * item.quantity).toFixed(2)}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => removeFromList(item.id)}
        style={styles.removeButton}
      >
        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  const calculateTotal = () => {
    return shoppingList.reduce((total, item) => {
      if (item.prices && item.prices.length > 0) {
        return total + (item.prices[0].price * item.quantity);
      }
      return total;
    }, 0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping List</Text>
        {shoppingList.length > 0 && (
          <TouchableOpacity
            style={styles.routeButton}
            onPress={() => router.push('/route')}
          >
            <Ionicons name="map-outline" size={24} color="#007AFF" />
            <Text style={styles.routeButtonText}>View Route</Text>
          </TouchableOpacity>
        )}
      </View>
      {shoppingList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#999" />
          <Text style={styles.emptyText}>Your shopping list is empty</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/pantry')}
          >
            <Text style={styles.addButtonText}>Add from Pantry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={shoppingList}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
          <View style={styles.footer}>
            <Text style={styles.totalText}>
              Total: ${calculateTotal().toFixed(2)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  routeButtonText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  itemImageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 12,
  },
  itemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  removeButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});

export default ShoppingListScreen;
