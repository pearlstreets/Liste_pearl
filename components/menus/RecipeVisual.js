// Visuel d'une recette : sa photo (paquet, puis adresses distantes), sinon un fond teinté avec une
// icône discrète (jamais d'émoji, jamais d'image vide). zoomable : toucher la photo l'ouvre en grand.
import React, { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { View, Image, Pressable } from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import RECIPE_IMAGES from '../../lib/menus/recipeImages';
import { uniqueUris, pickPhotoSource } from '../../lib/menus/photoUrls';
import { remoteRecipePhotoUri, remoteIngredientSource } from '../../lib/menus/photoManifest';
import { photoSources } from '../../services/recipePhotos';
import { useManifestVersion } from '../../services/photoManifest';
import { COURSE_TINT, T } from './theme';
import PhotoViewer from './PhotoViewer';
import useT from './useT';

const ICONE = {
  plat: 'restaurant-outline',
  entree: 'leaf-outline',
  dessert: 'ice-cream-outline',
  'petit-dejeuner': 'cafe-outline',
};

const Zoom = memo(function Zoom({ source, children }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={t('recipe.photoZoom')}
      >
        {children}
      </Pressable>
      <PhotoViewer source={source} visible={open} onClose={close} />
    </>
  );
});

/** Photo à montrer pour une recette (null : pas de photo), avec le repli si elle ne charge pas. */
export function useRecipePhoto(recipe) {
  const local = (recipe && RECIPE_IMAGES[recipe.id]) || null;
  const mv = useManifestVersion(); // photo en ligne seulement si le manifeste la liste
  const uris = useMemo(
    () => (local ? [] : uniqueUris([...photoSources(recipe), remoteRecipePhotoUri(recipe)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, local, mv]
  );
  const [failed, setFailed] = useState(0); // adresse absente : la suivante, puis le repli
  useEffect(() => setFailed(0), [uris]);
  const source = pickPhotoSource(local, uris, failed);
  const onError = source && !local ? () => setFailed((n) => n + 1) : undefined;
  return { source, onError };
}

const RecipeVisual = memo(function RecipeVisual({
  recipe,
  height = 120,
  radius = 0,
  round,
  zoomable,
}) {
  const tint = (recipe && COURSE_TINT[recipe.course]) || T.brandSoft;
  const { source, onError } = useRecipePhoto(recipe);
  const shape = {
    height,
    width: round ? height : undefined,
    borderRadius: round ? height / 2 : radius,
    borderTopLeftRadius: round ? height / 2 : radius,
    borderTopRightRadius: round ? height / 2 : radius,
    backgroundColor: tint,
  };
  if (source) {
    const img = (
      <Image
        source={source}
        onError={onError}
        resizeMode="cover"
        style={shape}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
    return zoomable ? <Zoom source={source}>{img}</Zoom> : img;
  }
  return (
    <View
      style={[shape, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons
        name={(recipe && ICONE[recipe.course]) || 'restaurant-outline'}
        size={Math.max(16, Math.min(56, Math.round(height * 0.3)))}
        color={T.brandDark}
        style={{ opacity: 0.45 }}
      />
    </View>
  );
});

export default RecipeVisual;

/**
 * Vignette d'un ingrédient, à gauche de sa ligne. Sans photo (ou si elle ne charge pas) : rien du
 * tout, la ligne commence directement par le nom.
 */
export const IngredientThumb = memo(function IngredientThumb({ ingKey, size = 34, style }) {
  const mv = useManifestVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => remoteIngredientSource(ingKey), [ingKey, mv]);
  const [ko, setKo] = useState(false);
  useEffect(() => setKo(false), [source]);
  if (!source || ko) return null;
  return (
    <Image
      source={source}
      onError={() => setKo(true)}
      resizeMode="cover"
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: T.subtle },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
});
