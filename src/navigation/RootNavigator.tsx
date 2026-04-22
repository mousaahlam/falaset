import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { ItemDetailScreen } from '@/screens/ItemDetailScreen';
import type { FeedItem } from '@/types/models';

export type RootStackParamList = {
  Discover: undefined;
  ItemDetail: { item: FeedItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Falaset' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Details' }} />
    </Stack.Navigator>
  );
}
