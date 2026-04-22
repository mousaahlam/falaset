import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ route }: Props) {
  const { item } = route.params;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}
      <Text style={styles.title}>{item.title}</Text>
      {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      <Pressable style={styles.cta} onPress={() => Linking.openURL(item.url)}>
        <Text style={styles.ctaText}>{item.kind === 'app' ? 'Open App' : 'Read More'}</Text>
      </Pressable>
      <View style={styles.meta}>
        {item.country ? <Text style={styles.metaItem}>Country: {item.country}</Text> : null}
        {item.locale ? <Text style={styles.metaItem}>Locale: {item.locale}</Text> : null}
        {item.tags && item.tags.length > 0 ? (
          <Text style={styles.metaItem}>Tags: {item.tags.join(', ')}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  image: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#eee' },
  title: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  subtitle: { fontSize: 15, color: '#555' },
  description: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  cta: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#111',
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600' },
  meta: { marginTop: 16, gap: 4 },
  metaItem: { fontSize: 12, color: '#888' },
});
