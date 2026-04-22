import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FeedItemCard } from '@/components/FeedItemCard';
import { fetchFeed } from '@/api/feed';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import type { FeedItem } from '@/types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Discover'>;

export function DiscoverScreen({ navigation }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchFeed({ limit: 50 });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FeedItemCard item={item} onPress={() => navigation.navigate('ItemDetail', { item })} />
      )}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListEmptyComponent={<Text style={styles.empty}>No items yet. Seed the items table.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c00', padding: 16, textAlign: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#888' },
});
