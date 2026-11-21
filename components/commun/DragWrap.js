import { useReorderableDrag } from "react-native-reorderable-list";

// Enveloppe qui expose le déclencheur de glisser-déposer aux lignes de liste.
// Le hook doit être appelé dans un enfant du ReorderableList : on le fait ici,
// puis on passe `drag` à la ligne via une render-prop (aucune closure perdue).
export const DragWrap = ({ enabled, children }) => {
  const drag = useReorderableDrag();
  return children(enabled ? drag : undefined);
};
