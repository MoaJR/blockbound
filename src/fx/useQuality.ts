import { useEffect, useState } from 'react';
import { getQualityLevel, subscribeQuality } from './quality';
import type { QualityLevel } from './quality';

export function useQualityLevel(): QualityLevel {
  const [level, setLevel] = useState<QualityLevel>(() => getQualityLevel());
  useEffect(() => subscribeQuality(setLevel), []);
  return level;
}
