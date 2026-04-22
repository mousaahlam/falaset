import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedItem } from '@/types/models';

interface Props {
  item: FeedItem;
  onPress: (item: FeedItem) => void;
}

export function FeedItemCard({ item, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}
      <View style={styles.body}>
        <Text style={styles.badge}>{item.kind === 'app' ? 'APP' : 'READ'}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 12,
  },
  image: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  body: { flex: 1 },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#888', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#555', marginTop: 2 },
});
