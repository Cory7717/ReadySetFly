import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image, 
  TextInput
} from "react-native";
import React, { useState, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import SocialMediaPost from "../../components/SocialMediaPost";
import CreateNewPost from "../../components/CreateNewPost";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";

const Flights = () => {
  const { user } = useUser();

  // Sample posts
  const samplePost = {
    profileImage: "https://example.com/profile.jpg",
    userName: "John Doe",
    time: "2 hours ago",
    content: "This is a sample post content.",
    image: "../../Assets/images/icononly_nobuffer.png",
    likes: 120,
    comments: 45,
  };

  const post = {
    profileImage: "https://example.com/profile.jpg",
    userName: "Cory Armer",
    time: "2 hours ago",
    content: "Time to get rich",
    image: "https://example.com/post-image.jpg",
    likes: 120,
    comments: 45,
  };

  const post1 = {
    profileImage: "https://example.com/profile.jpg",
    userName: "Amy Armer",
    time: "2 hours ago",
    content: "I have the hottest husband",
    image: "https://example.com/post-image.jpg",
    likes: 10000,
    comments: 8500,
  };

  // Initialize posts as an array of the sample posts
  const [posts, setPosts] = useState([samplePost, post, post1]);

  const addPost = (newPost) => {
    setPosts((prevPosts) => [...prevPosts, newPost]);
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-100">
      <ScrollView>
        <View className="pt-2 pl-5 pr-5 bg-white">
          <View className="flex-row gap-2">
            <Image
              source={{ uri: user?.imageUrl }}
              className="rounded-full w-12 h-12"
            />
            <View className="pb-5">
              <Text className="text-[16px]">Welcome</Text>
              <Text className="text-[20px] font-bold">{user?.fullName}</Text>
            </View>
          </View>
        </View>
        
        {/* Render existing posts */}
        {posts.map((post, index) => (
          <SocialMediaPost key={index} post={post} />
        ))}
      </ScrollView>

      {/* Button to add a new post */}
      <TouchableOpacity onPress={() => addPost(samplePost)}>
        <View className="flex-row gap-4 ml-2">
          <Ionicons
            name="chevron-down-circle-outline"
            size={28}
            color="green"
          />
          <Text className="text-xl font-rubikblack pl-12 text-emerald-700">
            Add new post
          </Text>
        </View>
      </TouchableOpacity>

      <CreateNewPost onSubmit={addPost} />
    </SafeAreaView>
  );
};

export default Flights;
