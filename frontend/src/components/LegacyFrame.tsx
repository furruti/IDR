type LegacyFrameProps = { title: string; src: string };
export function LegacyFrame({ title, src }: LegacyFrameProps) {
  return <iframe className="legacy-frame" title={title} src={src} />;
}
