import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  ScrollView, 
  View, 
  Image, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  FlatList, 
  Linking, 
  RefreshControl 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { useUser } from '@clerk/clerk-expo';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Text as RNText } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FullScreenPost from '../../components/FullScreenPost';
import SocialMediaPost from '../../components/SocialMediaPost';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import FullScreenRental from '../../components/FullScreenRental';
import PaymentScreen from '../screens/PaymentScreen';

// Styled components
const Container = styled(SafeAreaView, 'flex-1 bg-gray-100');
const Header = styled(View, 'p-4 bg-white flex-row items-center justify-between');
const ProfileImage = styled(Image, 'w-12 h-12 rounded-full');
const WelcomeText = styled(View, 'pl-3 pb-5');
const WelcomeMessage = styled(Text, 'text-base');
const UserName = styled(Text, 'text-xl font-bold');
const PostButton = styled(TouchableOpacity, 'p-4 bg-blue-500 rounded-lg absolute bottom-4 left-4 right-4 flex-row items-center justify-center');
const PostButtonText = styled(Text, 'text-white text-xl text-center ml-2');
const PostContainer = styled(View, 'p-4 bg-white mb-2 rounded-lg shadow');
const PostImage = styled(Image, 'w-full h-64 rounded-lg');
const PostActions = styled(View, 'flex-row items-center justify-between mt-2');
const ActionButton = styled(TouchableOpacity, 'flex-row items-center');
const ActionText = styled(Text, 'ml-1 text-gray-600');
const Stack = createStackNavigator();

// Utility function to parse hashtags, mentions, and links
const parseContent = (text, onHashtagPress, onMentionPress) => {
  const regex = /(#[\w-]+|@[\w-]+|https?:\/\/[\w-./?=&]+)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <RNText key={index} style={{ color: 'blue' }} onPress={() => onHashtagPress(part)}>
          {part}
        </RNText>
      );
    }
    if (part.startsWith('@')) {
      return (
        <RNText key={index} style={{ color: 'green' }} onPress={() => onMentionPress(part)}>
          {part}
        </RNText>
      );
    }
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <RNText key={index} style={{ color: 'blue' }} onPress={() => Linking.openURL(part)}>
          {part}
        </RNText>
      );
    }
    return <RNText key={index}>{part}</RNText>;
  });
};

// Autocomplete Component
const Autocomplete = ({ data, onSelect }) => {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => onSelect(item)} style={{ padding: 10 }}>
          <Text>{item}</Text>
        </TouchableOpacity>
      )}
    />
  );
};

// CreateNewPost Component
const CreateNewPost = ({ onSubmit, onCancel }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [autocompleteData, setAutocompleteData] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const { user } = useUser();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleContentChange = (text) => {
    setContent(text);

    const lastChar = text.slice(-1);
    if (lastChar === '@') {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }

    if (showAutocomplete) {
      const query = text.split('@').pop();
      if (query.length > 0) {
        // Simulate fetching user list
        const users = ['JohnDoe', 'JaneSmith', 'User123'];
        const filteredUsers = users.filter((user) =>
          user.toLowerCase().includes(query.toLowerCase())
        );
        setAutocompleteData(filteredUsers);
      }
    }
  };

  const handleSelectUser = (username) => {
    const words = content.split(' ');
    words.pop();
    setContent([...words, `@${username}`].join(' ') + ' ');
    setShowAutocomplete(false);
  };

  const handleSubmit = async () => {
    if (content.trim() || image) {
      const newPost = {
        content,
        image,
        userName: user.fullName,
        profileImage: user.imageUrl,
        createdAt: new Date(),
      };
      try {
        await addDoc(collection(db, 'posts'), newPost);
        onSubmit(newPost);
        setContent('');
        setImage(null);
      } catch (error) {
        Alert.alert('Error', 'Could not submit post.');
      }
    } else {
      Alert.alert('Error', 'Please enter some text or upload an image.');
    }
  };

  return (
    <View style={{ paddingTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ProfileImage source={{ uri: user?.imageUrl }} />
        <WelcomeText>
          <Text style={{ fontFamily: 'RubikRegular' }}>Posting as</Text>
          <UserName>{user?.fullName}</UserName>
        </WelcomeText>
      </View>
      <PostContainer>
        <TextInput
          placeholder="What's on your mind?"
          value={content}
          onChangeText={handleContentChange}
          multiline
          style={{ marginBottom: 10, maxHeight: 100 }}
        />
        {showAutocomplete && (
          <Autocomplete data={autocompleteData} onSelect={handleSelectUser} />
        )}
        <View style={{ paddingBottom: 10 }}>
          <TouchableOpacity onPress={pickImage} style={{ padding: 10, backgroundColor: '#E2E8F0', borderRadius: 5, marginBottom: 10 }}>
            <Text style={{ textAlign: 'center', color: '#4A5568' }}>Upload Image</Text>
          </TouchableOpacity>
        </View>
        {image && <PostImage source={{ uri: image }} />}
        <PostButton onPress={handleSubmit}>
          <Ionicons name="send" size={26} color="white" />
          <PostButtonText>Post</PostButtonText>
        </PostButton>
        <View style={{ paddingTop: 10 }}>
          <TouchableOpacity onPress={onCancel} style={{ marginTop: 10 }}>
            <Feather name="x-circle" size={32} color="white" />
          </TouchableOpacity>
        </View>
      </PostContainer>
    </View>
  );
};

// Post Component
const Post = ({ post }) => {
  const navigation = useNavigation();

  const onHashtagPress = (hashtag) => {
    Alert.alert('Hashtag Pressed', `You pressed ${hashtag}`);
  };

  const onMentionPress = (mention) => {
    Alert.alert('Mention Pressed', `You pressed ${mention}`);
  };

  const handlePress = () => {
    if (post) {
      navigation.navigate('FullScreenPost', { post });
    } else {
      console.error('Post object is undefined or null');
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <PostContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <ProfileImage source={{ uri: post?.profileImage }} />
          <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: 'bold' }}>{post?.userName}</Text>
        </View>
        {/* Post text now appears above the image */}
        <Text style={{ marginTop: 10 }}>{parseContent(post?.content, onHashtagPress, onMentionPress)}</Text>
        {post?.image && <PostImage source={{ uri: post?.image }} />}
        <PostActions>
          <ActionButton>
            <FontAwesome name="thumbs-up" size={20} color="gray" />
            <ActionText>Like</ActionText>
          </ActionButton>
          <ActionButton>
            <FontAwesome name="comment" size={20} color="gray" />
            <ActionText>Comment</ActionText>
          </ActionButton>
          <ActionButton>
            <Ionicons name="share-social-outline" size={24} color="black" />
            <ActionText>Share</ActionText>
          </ActionButton>
        </PostActions>
      </PostContainer>
    </TouchableOpacity>
  );
};

// Main Feed Component
const MainFeed = () => {
  const [posts, setPosts] = useState([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(fetchedPosts);
    });

    return () => unsubscribe();
  }, []);

  const handleCreatePost = () => {
    setIsCreatingPost(true);
  };

  const handleCancelPost = () => {
    setIsCreatingPost(false);
  };

  const handleSubmitPost = (newPost) => {
    setIsCreatingPost(false);
    setPosts((prevPosts) => [newPost, ...prevPosts]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate a refresh by refetching posts (or any other logic)
    setRefreshing(false);
  };

  return (
    <Container>
      <Header>
        <Ionicons name="airplane-outline" size={24} color="black" />
        <Text style={{ fontFamily: 'RubikRegular', textAlign: 'center', fontSize: 20, fontWeight: 'bold', flex: 1 }}>
          Aviation News and Events
        </Text>
      </Header>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {isCreatingPost ? (
          <CreateNewPost onSubmit={handleSubmitPost} onCancel={handleCancelPost} />
        ) : (
          posts.map((post) => <Post key={post.id} post={post} />)
        )}
      </ScrollView>
      {!isCreatingPost && (
        <PostButton onPress={handleCreatePost}>
          <Ionicons name="create" size={24} color="white" />
          <PostButtonText>Create Post</PostButtonText>
        </PostButton>
      )}
    </Container>
  );
};

// Root App Component
export default function App() {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="MainFeed">
        <Stack.Screen name="MainFeed" component={MainFeed} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenPost" component={FullScreenPost} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenRental" component={FullScreenRental} />
        <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
