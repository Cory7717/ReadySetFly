import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  Image,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const RenterProfile = () => {
  const { user } = useUser();
  const [favoriteListings, setFavoriteListings] = useState([]);

  useEffect(() => {
    fetchFavoriteListings();
  }, []);

  const fetchFavoriteListings = async () => {
    try {
      const userRef = doc(db, "users", user.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const favorites = userSnap.data().favorites || [];
        const favoritesData = [];
        for (const listingId of favorites) {
          const listingRef = doc(db, "airplanes", listingId);
          const listingSnap = await getDoc(listingRef);
          if (listingSnap.exists()) {
            favoritesData.push({ id: listingSnap.id, ...listingSnap.data() });
          }
        }
        setFavoriteListings(favoritesData);
      }
    } catch (error) {
      console.error("Error fetching favorite listings:", error);
    }
  };

  const renderFavoriteItem = ({ item }) => (
    <View className="flex-row justify-between items-center p-4 bg-white rounded-lg mb-3 shadow-sm">
      <View className="flex-1 mr-3">
        <Text className="text-lg font-bold text-gray-800">{item.airplaneModel}</Text>
        <Text className="text-red-500">${item.ratesPerHour} per hour</Text>
        <Text className="text-gray-600">{item.description}</Text>
      </View>
      {item.images && item.images[0] && (
        <Image source={{ uri: item.images[0] }} className="w-20 h-20 rounded-lg" />
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-800">Favorite Listings</Text>
        <FlatList
          data={favoriteListings}
          renderItem={renderFavoriteItem}
          keyExtractor={(item) => item.id}
        />
      </View>
    </SafeAreaView>
  );
};

export default RenterProfile;
