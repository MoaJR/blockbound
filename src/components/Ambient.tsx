const CRYSTALS = [
  { left: '6%', top: '16%', size: 18, delay: '0s', hue: 190 },
  { left: '12%', top: '68%', size: 12, delay: '-3s', hue: 265 },
  { left: '85%', top: '22%', size: 22, delay: '-6s', hue: 45 },
  { left: '92%', top: '62%', size: 14, delay: '-2s', hue: 190 },
  { left: '74%', top: '82%', size: 10, delay: '-8s', hue: 150 },
  { left: '28%', top: '10%', size: 9, delay: '-5s', hue: 265 },
  { left: '48%', top: '90%', size: 13, delay: '-10s', hue: 45 },
  { left: '62%', top: '8%', size: 8, delay: '-1s', hue: 190 },
];

export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <span
        className="ambient__orb"
        style={{ width: 420, height: 420, left: '-8%', top: '-12%', background: 'rgba(45,140,255,0.45)' }}
      />
      <span
        className="ambient__orb"
        style={{ width: 360, height: 360, right: '-10%', bottom: '-14%', background: 'rgba(138,91,255,0.4)', animationDelay: '-4s' }}
      />
      {CRYSTALS.map((crystal, index) => (
        <span
          key={index}
          className="ambient__crystal"
          style={{
            left: crystal.left,
            top: crystal.top,
            width: crystal.size,
            height: crystal.size,
            animationDelay: crystal.delay,
            filter: `hue-rotate(${crystal.hue - 190}deg)`,
          }}
        />
      ))}
    </div>
  );
}
