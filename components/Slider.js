import { View, Text, FlatList } from 'react-native'
import React from 'react'


const Slider = (sliderList) => {
  return (
    <View>
     <FlatList
      data={sliderList}
      horizontal="true"
      showsHorizontalScrollIndicator={false}
      renderItem={({item, index }) => (
        <View>
       <Image source={{uri:item?.Image}}
          className="h=[200px] w-[30px]"
           />
        </View>
      )}
     />
    </View>
  )
}

export default Slider