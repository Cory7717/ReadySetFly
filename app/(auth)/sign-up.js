import { View, Text, ScrollView, Dimensions, Alert, Image } from 'react-native';
import { useState } from 'react';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { images } from "../../constants";
import FormField from '../../components/FormField';
import CustomButton from '../../components/CustomButton';
import { StatusBar } from 'expo-status-bar';
import { createUser, setUser } from '../../lib/appwrite';
import { signUp } from '../../lib/appwrite';
import { useGlobalContext } from '../../context/GlobalProvider';



const SignUp = () => {
  const { setUser, setIsLogged } = useGlobalContext();
  const [isSubmitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  
  
  const submit = async () => {
    if(form.email ==="" || form.password ==="") {
      Alert.alert('Error', 'Please fill in the required fields')
    }

    setSubmitting(true);
    
    try {
      const result = await createUser(form.email, form.password, form.username);
      setUser(result);
      setIsLogged(true);

      router.replace('/home');
    } catch (error) {
        Alert.alert('Error', error.message)
    }  finally {
      
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="bg-white h-full">
      <ScrollView> 
        <View className="w-full justify-center items-center px-4 ">
          <Image source={images.logo}
            resizeMode='contain'
            className='w-[150px] h-[150px]'
            
          />
        </View>

        <View className=' mt-1 justify-center items-center'>
          <Text className='text-2xl font-rubikblack justify-center items-center'>
            Sign up for Ready, Set, Fly!
          </Text>
          <FormField
            title="Username"
            value={form.username}
            handleChangeText={(e) => setForm({...form, username: e })}
            otherStyles='mt-10 mx-5'
            
          />   
          <FormField
            title="Email"
            value={form.email}
            handleChangeText={(e) => setForm({...form, email: e })}
            otherStyles='mt-7 mx-5'
            keyboardType="email-address"
          />     
          <FormField 
          title="Password"
          value={form.password}
          handleChangeText={(e) => setForm({...form, password: e })}    
          otherStyles='mt-7 mx-5'
          /> 
        <CustomButton
          title='Sign-Up'
          handlePress={submit}
          containerStyles='mt-7 bg-black w-100% ' 
          isLoading={isSubmitting}         
           />
           <View className='justify-center pt-5 flex-row gap-2'>
           <Text className='text-lg font-rubikregular text-#404040'>
            Already have an account? 
           </Text>
            <Link href='/sign-in' className='text-lg font-rubikbold text-emerald-700'>Sign In
            </Link>
           </View>
         
        </View>
      </ScrollView>
      <StatusBar backgroundColor='white' />
    </SafeAreaView>
  )
}

export default SignUp
