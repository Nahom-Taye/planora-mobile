export function configureSplash(
  expoGo: boolean,
  reducedMotion: boolean,
  setOptions: (options: { duration: number; fade: boolean }) => void,
) {
  if (!expoGo) setOptions({ duration: reducedMotion ? 0 : 300, fade: !reducedMotion });
}
