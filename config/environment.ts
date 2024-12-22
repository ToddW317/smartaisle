import Constants from 'expo-constants';

// Get the environment variables from Expo's manifest
const ENV = {
  SPOONACULAR_API_KEY: Constants.expoConfig?.extra?.SPOONACULAR_API_KEY ?? '',
  BARCODE_LOOKUP_API_KEY: Constants.expoConfig?.extra?.BARCODE_LOOKUP_API_KEY ?? '',
  KROGER_CLIENT_ID: Constants.expoConfig?.extra?.KROGER_CLIENT_ID ?? '',
  KROGER_CLIENT_SECRET: Constants.expoConfig?.extra?.KROGER_CLIENT_SECRET ?? '',
};

export default ENV;
