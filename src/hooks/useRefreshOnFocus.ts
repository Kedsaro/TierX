import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Re-runs `onFocus` every time the screen regains focus (e.g. switching back
 * to this tab), always using the latest closure instead of the one captured
 * when the screen first mounted. This keeps the call in sync with whatever
 * filters, segment or search text are currently selected, which a plain
 * `useFocusEffect(useCallback(fn, []))` would not: an empty dependency array
 * freezes `fn` at its first render.
 */
export function useRefreshOnFocus(onFocus: () => void): void {
  const onFocusRef = useRef(onFocus);

  useEffect(() => {
    onFocusRef.current = onFocus;
  });

  useFocusEffect(
    useCallback(() => {
      onFocusRef.current();
    }, []),
  );
}
