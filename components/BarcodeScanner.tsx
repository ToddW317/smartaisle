import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { ProductService } from '@/services/productService';
import Constants from 'expo-constants';

interface BarcodeScannerProps {
  onScanned: (data: {
    barcode: string,
    type: string,
    productName: string,
    productImage: string,
    prices: PriceInfo[],
    aisle: string | null,
    quantity: number,
    inPantry: boolean,
    inShoppingList: boolean,
    brand: string
  }) => void;
  onClose: () => void;
}

interface PriceInfo {
  store: string;
  price: number;
  distance: number;
  address: string;
  timestamp: Date;
}

export default function BarcodeScanner({ onScanned, onClose }: BarcodeScannerProps) {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!permission || !locationPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!permission.granted || !locationPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>We need camera and location permissions</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={async () => {
            await requestPermission();
            await requestLocationPermission();
          }}
        >
          <Text style={styles.buttonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || isLoading) {
      console.log('Scan blocked - already scanning');
      return;
    }
    
    setScanned(true);
    setIsLoading(true);
    
    try {
      // Trigger haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Get current location and convert to zip code
      const location = await Location.getCurrentPositionAsync({});
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${Constants.expoConfig?.extra?.googleMapsApiKey}`
      );
      
      let zipCode;
      if (response.data.results[0]) {
        for (const component of response.data.results[0].address_components) {
          if (component.types.includes('postal_code')) {
            zipCode = component.short_name;
            break;
          }
        }
      }
      
      // Get product information from our service
      const productInfo = await ProductService.getProductInfo(data, zipCode);
      
      if (!productInfo) {
        console.log('Product not found');
        setIsLoading(false);
        setTimeout(() => {
          setScanned(false);
        }, 2000);
        return;
      }

      // Create price info
      const priceInfo: PriceInfo[] = [];
      if (productInfo.inventory?.price) {
        priceInfo.push({
          store: productInfo.inventory.storeId,
          price: productInfo.inventory.price,
          distance: 0,
          address: productInfo.inventory.aisle,
          timestamp: new Date()
        });
      }

      // Format aisle information with store name
      const aisleInfo = productInfo.inventory?.inStock 
        ? `${productInfo.inventory.chain === 'walmart' ? 'Walmart' : 'Target'}: ${productInfo.inventory.aisle}`
        : productInfo.alternativeStores && productInfo.alternativeStores.length > 0
          ? `Out of stock here. Available at ${productInfo.alternativeStores[0].chain === 'walmart' ? 'Walmart' : 'Target'}`
          : 'Out of stock at both Walmart and Target';

      onScanned({
        barcode: data,
        type,
        productName: productInfo.name,
        productImage: productInfo.image,
        prices: priceInfo,
        aisle: aisleInfo,
        quantity: 1,
        inPantry: false,
        inShoppingList: false,
        brand: productInfo.brand || ''
      });

      setTimeout(() => {
        setScanned(false);
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Error scanning barcode:', error);
      setIsLoading(false);
      setTimeout(() => {
        setScanned(false);
      }, 2000);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Scan Barcode</Text>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={facing}
            barcodeScannerEnabled
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
              {isLoading ? (
                <View style={styles.loadingOverlay}>
                  <Text style={styles.loadingText}>Searching product...</Text>
                </View>
              ) : scanned ? (
                <Text style={styles.scanText}>
                  Product not found. Try scanning again...
                </Text>
              ) : (
                <Text style={styles.scanText}>
                  Position barcode within the frame
                </Text>
              )}
            </View>
          </CameraView>
        </View>

        <View style={styles.footer}>
          {scanned && !isLoading && (
            <TouchableOpacity 
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  closeButton: {
    padding: 8,
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  scanAgainButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  messageText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
});
