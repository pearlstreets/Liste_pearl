// Visuel d'une recette : photo si elle existe un jour, sinon une composition d'émojis
// d'ingrédients sur fond teinté (jamais d'image vide).
import React, { memo, useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import RECIPE_IMAGES from '../../lib/menus/recipeImages';
import { COURSE_TINT, T } from './theme';

const cache = new Map();

function emojisOf(recipe, ingredients) {
  if (!recipe) return ['🍽️'];
  const hit = cache.get(recipe.id);
  if (hit) return hit;
  const list = (recipe.ingredients || [])
    .map((i) => ({ i, ing: ingredients && ingredients[i.key] }))
    .filter((x) => x.ing && x.ing.emoji && !x.ing.pantry && !x.i.optional);
  // La viande ou le poisson d'abord, puis les plus grosses quantités.
  list.sort((a, b) => {
    const pa = a.ing.aisle === 'viandes-poissons' ? 1 : 0;
    const pb = b.ing.aisle === 'viandes-poissons' ? 1 : 0;
    return pb - pa || (Number(b.i.qty) || 0) - (Number(a.i.qty) || 0);
  });
  const out = [];
  for (const x of list) if (!out.includes(x.ing.emoji)) out.push(x.ing.emoji);
  const res = out.length ? out.slice(0, 3) : ['🍽️'];
  cache.set(recipe.id, res);
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
  const photo = recipe && RECIPE_IMAGES[recipe.id];
  if (photo) {
    return (
      <Image
        source={photo}
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
