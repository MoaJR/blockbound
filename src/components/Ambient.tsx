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

const SPARKS = [
  { left: '18%', top: '28%', delay: '-2s', duration: '9s' },
  { left: '34%', top: '74%', delay: '-6s', duration: '11s' },
  { left: '66%', top: '18%', delay: '-4s', duration: '10s' },
  { left: '82%', top: '44%', delay: '-8s', duration: '13s' },
  { left: '56%', top: '62%', delay: '-1s', duration: '12s' },
  { left: '8%', top: '84%', delay: '-7s', duration: '14s' },
  { left: '94%', top: '80%', delay: '-3s', duration: '10s' },
];

export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient__gradient ambient__gradient--a" />
      <span className="ambient__gradient ambient__gradient--b" />
      <span
        className="ambient__orb"
        style={{ width: 420, height: 420, left: '-8%', top: '-12%', background: 'rgba(45,140,255,0.45)' }}
      />
      <span
        className="ambient__orb"
        style={{ width: 360, height: 360, right: '-10%', bottom: '-14%', background: 'rgba(138,91,255,0.4)', animationDelay: '-4s' }}
      />
      <span className="ambient__ring ambient__ring--1" />
      <span className="ambient__ring ambient__ring--2" />
      <span className="ambient__geometry ambient__geometry--1" />
      <span className="ambient__geometry ambient__geometry--2" />
      {CRYSTALS.map((crystal, index) => (
        <span
          key={`crystal-${index}`}
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
      {SPARKS.map((spark, index) => (
        <span
          key={`spark-${index}`}
          className="ambient__spark"
          style={{
            left: spark.left,
            top: spark.top,
            animationDelay: spark.delay,
            animationDuration: spark.duration,
          }}
        />
      ))}
    </div>
  );
}
