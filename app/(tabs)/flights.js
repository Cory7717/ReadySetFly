import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  View, 
  Image, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  FlatList, 
  Linking, 
  RefreshControl, 
  Modal,
  ActivityIndicator, 
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { useUser } from '@clerk/clerk-expo';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Text as RNText } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import FullScreenRental from '../../components/FullScreenRental';
import PaymentScreen from '../payment.js/PaymentScreen';
import FullScreenPost from '../../components/FullScreenPost';
// import PaymentScreen from '../../components/PaymentScreen';

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

// Utility function to sanitize data
const sanitizeData = (data) => {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
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
        image: image || null,  // Ensure image is either a valid URL or null
        userName: user.fullName,
        profileImage: user.imageUrl,
        createdAt: new Date(),
        userId: user.id,  // Store the user's ID who created the post
      };

      // Sanitize data to remove undefined fields
      const sanitizedData = sanitizeData(newPost);

      try {
        await addDoc(collection(db, 'posts'), sanitizedData);
        onSubmit(sanitizedData);
        setContent('');  // Clear content after submitting
        setImage(null);  // Clear image after submitting
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
          <Text>Posting as</Text>
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
const Post = ({ post, onDelete }) => {
  const navigation = useNavigation();
  const { user } = useUser();
  const [modalVisible, setModalVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // For testing purposes, assume the current user is an admin if they have a specific ID
    const adminUserIds = ['adminUserId1', 'adminUserId2']; // Replace with your admin IDs
    if (adminUserIds.includes(user?.id)) {
      setIsAdmin(true);
    }
  }, [user]);

  const onHashtagPress = (hashtag) => {
    Alert.alert('Hashtag Pressed', `You pressed ${hashtag}`);
  };

  const onMentionPress = (mention) => {
    Alert.alert('Mention Pressed', `You pressed ${mention}`);
  };

  const handlePress = () => {
    if (post) {
      setModalVisible(true);
    } else {
      console.error('Post object is undefined or null');
    }
  };

  const handleDeletePost = async () => {
    // Optimistically update the UI
    onDelete(post.id);

    try {
      await deleteDoc(doc(db, 'posts', post.id));
      Alert.alert('Post deleted', 'Your post has been deleted.');
    } catch (error) {
      console.error('Error deleting post: ', error);
      Alert.alert('Error', 'There was an error deleting the post.');
      
      // Rollback the optimistic update if deletion fails
      onDelete(null); // Re-fetch or restore the post
    }
  };

  return (
    <>
      <TouchableOpacity onPress={handlePress}>
        <PostContainer>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <ProfileImage source={{ uri: post?.profileImage }} />
            <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: 'bold' }}>{post?.userName}</Text>
            {(user?.id === post?.userId || isAdmin) && (
              <TouchableOpacity onPress={handleDeletePost} style={{ marginLeft: 'auto' }}>
                <Feather name="trash" size={24} color="red" />
              </TouchableOpacity>
            )}
          </View>
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View style={{ width: '90%', backgroundColor: 'white', borderRadius: 10, padding: 20 }}>
            <ScrollView>
              <Text style={{ marginBottom: 10, fontSize: 18 }}>{parseContent(post?.content, onHashtagPress, onMentionPress)}</Text>
              {post?.image ? (
                <Image
                  source={{ uri: post?.image }}
                  style={{ width: '100%', height: 300, borderRadius: 10, marginBottom: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ padding: 20, backgroundColor: '#f0f0f0', borderRadius: 10 }}>
                  <Text style={{ textAlign: 'center', fontSize: 16, color: '#666' }}>No image available</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ alignSelf: 'center', marginTop: 20 }}>
              <Text style={{ color: 'blue' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Main Feed Component
const MainFeed = () => {
  const [posts, setPosts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const PAGE_SIZE = 10;  // Number of posts to load per page

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async (loadMore = false) => {
    setLoading(true);

    let postsRef = collection(db, 'posts');
    let q = query(postsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

    if (loadMore && lastVisible) {
      q = query(postsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
    }

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const newPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPosts((prevPosts) => (loadMore ? [...prevPosts, ...newPosts] : newPosts));
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    }

    setLoading(false);
  };

  const handleLoadMore = () => {
    if (!loading) {
      fetchPosts(true);
    }
  };

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

  const handleDeletePost = (postId) => {
    setPosts((prevPosts) => prevPosts.filter(post => post.id !== postId));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts().then(() => setRefreshing(false));
  };

  return (
    <Container>
      <Header>
        <Ionicons name="airplane-outline" size={24} color="black" />
        <Text style={{ textAlign: 'center', fontSize: 20, fontWeight: 'bold', flex: 1 }}>
          Aviation News and Events
        </Text>
      </Header>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Post key={item.id} post={item} onDelete={handleDeletePost} />}
        ListHeaderComponent={isCreatingPost ? <CreateNewPost onSubmit={handleSubmitPost} onCancel={handleCancelPost} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && <ActivityIndicator size="large" color="#0000ff" />}
      />
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
        <Stack.Screen 
          name="PaymentScreen" 
          component={PaymentScreen} 
          options={{ title: 'Payment' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
