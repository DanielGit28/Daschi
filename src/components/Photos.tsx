import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ageLabel } from '../lib/age';
import { deletePhoto, type Dog, type Photo } from '../lib/db';
import { confirmAction, notify } from '../lib/dialogs';
import { LEVELS } from '../lib/levels';
import { cameraAvailable, pickAndUploadPhoto, type PhotoSource } from '../lib/photos';
import { colors, radius, space } from '../lib/theme';
import { Button, Muted } from './ui';

/** Botón "Agregar foto": en el teléfono pregunta cámara o galería; en web abre el selector de archivos. */
export function AddPhotoButton({
  dog,
  levelId,
  label = '📷 Agregar foto',
  onAdded,
}: {
  dog: Dog;
  levelId?: string;
  label?: string;
  onAdded: () => void;
}) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);

  async function run(source: PhotoSource) {
    setBusy(true);
    try {
      if (await pickAndUploadPhoto(db, dog.id, source, { levelId })) onAdded();
    } catch (e) {
      notify('No se pudo agregar la foto', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function choose() {
    if (!cameraAvailable) return run('library');
    Alert.alert('Agregar foto', undefined, [
      { text: 'Sacar foto', onPress: () => run('camera') },
      { text: 'Elegir de la galería', onPress: () => run('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return busy ? <ActivityIndicator color={colors.accent} /> : <Button label={label} variant="secondary" onPress={choose} />;
}

/** Línea de tiempo: fotos de la más nueva a la más vieja, con la edad que tenía en cada una. */
export function Timeline({ dog, photos, onChange }: { dog: Dog; photos: Photo[]; onChange: () => void }) {
  const db = useSQLiteContext();
  const [open, setOpen] = useState<Photo | null>(null);

  function confirmDelete(p: Photo) {
    confirmAction('Borrar foto', '¿Sacar esta foto de la línea de tiempo?', 'Borrar', async () => {
      await deletePhoto(db, p.id);
      setOpen(null);
      onChange();
    });
  }

  if (photos.length === 0) return <Muted>Todavía no hay fotos. La primera semana pasa volando: ¡sacale una hoy!</Muted>;

  return (
    <View style={styles.list}>
      {photos.map((p) => {
        const level = LEVELS.find((l) => l.id === p.level_id);
        return (
          <Pressable key={p.id} onPress={() => setOpen(p)} onLongPress={() => confirmDelete(p)} style={styles.item}>
            <Image source={{ uri: p.url }} style={[styles.image, { aspectRatio: p.width && p.height ? p.width / p.height : 4 / 3 }]} />
            <View style={styles.meta}>
              <Text style={styles.date}>{new Date(p.taken_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              <Muted>
                {ageLabel(dog.birth_date, new Date(p.taken_at))}
                {level ? ` · ${level.emoji} ${level.name}` : ''}
              </Muted>
              {p.caption ? <Text style={styles.caption}>{p.caption}</Text> : null}
            </View>
          </Pressable>
        );
      })}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(null)}>
          {open ? <Image source={{ uri: open.url }} style={styles.full} resizeMode="contain" /> : null}
          {open ? (
            <Pressable onPress={() => confirmDelete(open)} hitSlop={10} style={styles.viewerDelete}>
              <Text style={styles.viewerDeleteText}>🗑 Borrar</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  image: { width: '100%' },
  meta: { padding: space.sm, gap: 2 },
  date: { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  caption: { fontSize: 15, color: colors.text },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '80%' },
  viewerDelete: { position: 'absolute', bottom: 48, paddingHorizontal: space.md, paddingVertical: space.sm },
  viewerDeleteText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
