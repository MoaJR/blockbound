export interface BossPresenceProps {
  accent: 'ice' | 'corrupt' | 'gravity' | 'boom';
  phase: number;
}

/**
 * Camada decorativa do retrato do chefe. CSS puro (transform/opacity) para
 * manter o custo baixo no mobile e ser desligada em qualidade econômica.
 */
export function BossPresence({ accent, phase }: BossPresenceProps) {
  return (
    <span className={`boss-presence boss-presence--${accent} ${phase > 0 ? 'is-enraged' : ''}`} aria-hidden="true">
      {accent === 'ice' && (
        <>
          <i className="boss-presence__shard boss-presence__shard--1" />
          <i className="boss-presence__shard boss-presence__shard--2" />
          <i className="boss-presence__shard boss-presence__shard--3" />
          <i className="boss-presence__frost" />
        </>
      )}
      {accent === 'corrupt' && (
        <>
          <i className="boss-presence__spore boss-presence__spore--1" />
          <i className="boss-presence__spore boss-presence__spore--2" />
          <i className="boss-presence__spore boss-presence__spore--3" />
          <i className="boss-presence__spore boss-presence__spore--4" />
        </>
      )}
      {accent === 'gravity' && (
        <>
          <i className="boss-presence__orbit boss-presence__orbit--1" />
          <i className="boss-presence__orbit boss-presence__orbit--2" />
          <i className="boss-presence__weight" />
        </>
      )}
      {accent === 'boom' && (
        <>
          <i className="boss-presence__fuse" />
          <i className="boss-presence__ember boss-presence__ember--1" />
          <i className="boss-presence__ember boss-presence__ember--2" />
        </>
      )}
    </span>
  );
}
