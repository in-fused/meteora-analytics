import { useState, useEffect } from 'react';

/**
 * Returns a responsive column count that updates on window resize.
 * Avoids stale `window.innerWidth` reads inside useMemo.
 */
export function useColumnCount(): number {
  const getCount = () => window.innerWidth >= 1200 ? 3 : window.innerWidth >= 768 ? 2 : 1;
  const [colCount, setColCount] = useState(getCount);

  useEffect(() => {
    const handler = () => setColCount(getCount());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return colCount;
}
