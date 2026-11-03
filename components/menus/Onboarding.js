// Première ouverture de Menus : le questionnaire « Personnaliser mes menus » (4 pages, tout facultatif,
// enregistré à chaque page). Le marqueur `onboarded` est posé à la fin, ou en passant les pages.
import React, { useCallback } from 'react';
import Questionnaire from './Questionnaire';
import { useMenus } from './MenusContext';

export default function Onboarding() {
  const { finishOnboarding } = useMenus();
  // Les réponses sont déjà enregistrées : la fin pose seulement le marqueur, et compose la semaine si on le veut.
  const onFinish = useCallback(
    (generate) => finishOnboarding(null, { generate: generate !== false }),
    [finishOnboarding]
  );
  return <Questionnaire onboarding onFinish={onFinish} />;
}
