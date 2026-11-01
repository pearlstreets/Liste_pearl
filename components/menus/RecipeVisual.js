// Visuel d'une recette : photo si elle existe un jour, sinon une composition d'émojis
// d'ingrédients sur fond teinté (jamais d'image vide).
import React, { memo, useMemo, useState, useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import RECIPE_IMAGES from '../../lib/menus/recipeImages';
import { photoSources } from '../../services/recipePhotos';
import { COURSE_TINT, T } from './theme';

const CACHE_MAX = 400; // les recettes générées sont des milliers : le cache reste borné
const cache = new Map();

function emojisOf(recipe, ingredients) {
  if (!recipe) return ['🍽️'];
  const hit = !recipe.custom && cache.get(recipe.id); // une recette personnelle peut changer
  if (hit) {
    cache.delete(recipe.id); // plus récemment vue : reste en fin de file
    cache.set(recipe.id, hit);
    return hit;
  }
  const list = (recipe.ingredients || [])
    .map((i) => ({ i, ing: ingredients && ingredients[i.key] }))
    .filter((x) => x.ing && x.ing.emoji && !x.ing.pantry && !x.i.optional);
  // Recette générée : ses ingrédients principaux d'abord (calculés au build, quelles que soient les unités :
  // une omelette montre l'œuf avant 350 g de poireaux). Puis la viande ou le poisson, puis les plus grosses quantités.
  const mains =
    recipe.generated && recipe.dp && Array.isArray(recipe.dp.mains) ? recipe.dp.mains : [];
  const rank = (x) => {
    const k = mains.indexOf(x.i.key);
    return k < 0 ? mains.length : k;
  };
  list.sort((a, b) => {
    const pa = a.ing.aisle === 'viandes-poissons' ? 1 : 0;
    const pb = b.ing.aisle === 'viandes-poissons' ? 1 : 0;
    return rank(a) - rank(b) || pb - pa || (Number(b.i.qty) || 0) - (Number(a.i.qty) || 0);
  });
  const out = [];
  for (const x of list) if (!out.includes(x.ing.emoji)) out.push(x.ing.emoji);
  const res = out.length ? out.slice(0, 3) : ['🍽️'];
  if (!recipe.custom) {
    cache.set(recipe.id, res);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
  return res;
}

const RecipeVisual = memo(function RecipeVisual({
  recipe,
  ingredients,
  height = 120,
  radius = 0,
  round,
}) {
  const em = useMemo(() => emojisOf(recipe, ingredients), [recipe, ingredients]);
  const tint = (recipe && COURSE_TINT[recipe.course]) || T.brandSoft;
  const big = Math.round(height * 0.5);
  const sources = useMemo(() => photoSources(recipe), [recipe]);
  const [failed, setFailed] = useState(0); // fichier absent : adresse suivante, puis les émojis
  useEffect(() => setFailed(0), [sources]);
  const uri = sources[failed];
  const photo = (recipe && RECIPE_IMAGES[recipe.id]) || (uri ? { uri } : null);
  if (photo) {
    return (
      <Image
        source={photo}
        onError={uri ? () => setFailed((n) => n + 1) : undefined}
        resizeMode="cover"
        style={{
          height,
          width: round ? height : undefined,
          borderRadius: round ? height / 2 : radius,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          backgroundColor: tint,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  return (
    <View
      style={{
        height,
        width: round ? height : undefined,
        borderRadius: round ? height / 2 : radius,
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {em[1] ? (
        <Text
          style={{
            position: 'absolute',
            left: '12%',
            top: '14%',
            fontSize: big * 0.5,
            opacity: 0.55,
          }}
        >
          {em[1]}
        </Text>
      ) : null}
      {em[2] ? (
        <Text
          style={{
            position: 'absolute',
            right: '12%',
            bottom: '10%',
            fontSize: big * 0.5,
            opacity: 0.55,
          }}
        >
          {em[2]}
        </Text>
      ) : null}
      <Text style={{ fontSize: big }}>{em[0]}</Text>
    </View>
  );
});

export default RecipeVisual;
