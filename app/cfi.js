import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
} from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps"; // Import Marker directly
import { styled } from "nativewind";
import { Feather } from "@expo/vector-icons";

const CFI = () => {
  const INITIAL_REGION = {
    latitude: 30.2666666,
    longitude: -97.73333,
    latitudeDelta: 1,
    longitudeDelta: 1,
  };

  const StyledView = styled(View);
  const StyledText = styled(Text);
  const StyledTextInput = styled(TextInput);

  const [searchQuery, setSearchQuery] = useState("");

  // Dummy flight schools data (for demonstration purposes)
  const flightSchools = [
    { id: 1, name: "Austin Flight School", latitude: 30.2672, longitude: -97.7431 },
    { id: 2, name: "Houston Aviation Academy", latitude: 29.7604, longitude: -95.3698 },
    { id: 3, name: "Dallas Flying Academy", latitude: 32.7767, longitude: -96.7970 },
  ];

  const filteredSchools = flightSchools.filter((school) =>
    school.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView className="h-full bg-white sand">
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <StyledView className="flex-row p-5 items-center gap-1">
          <TouchableOpacity>
            <Image
              source={require("../Assets/images/icononly_nobuffer.png")}
              className="w-12 h-12 rounded-full"
            />
          </TouchableOpacity>
          <View>
            <StyledText className="text-[14px] font-rubikblack ml-5 ">
              Search for flight instructors
            </StyledText>
            <StyledText className="text-xl font-rubikblack ml-5">
              in your area!
            </StyledText>
          </View>
        </StyledView>

        <TouchableOpacity>
          <StyledView className="flex-row gap-1 bg-gray-50 rounded-full p-2 ml-5 mr-5 border-gray-300 border-[1px]">
            <Feather name="search" size={24} color="grey" className="justify-center" />
            <StyledTextInput
              className="text-[20px]"
              placeholder="Search"
              value={searchQuery}
              onChangeText={(value) => setSearchQuery(value)}
            />
          </StyledView>
        </TouchableOpacity>

        <StyledView className="flex-1 pt-5">
          <MapView initialRegion={INITIAL_REGION} className="flex-1 mb-10">
            {filteredSchools.map((school) => (
              <Marker
                key={school.id}
                coordinate={{ latitude: school.latitude, longitude: school.longitude }}
                title={school.name}
              />
            ))}
          </MapView>
        </StyledView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CFI;
