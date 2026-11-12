export type ParticleShape = 'block' | 'spark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: ParticleShape;
  spin: number;
  angle: number;
}

export interface BurstOptions {
  x: number;
  y: number;
  color: string;
  count?: number;
  power?: number;
  gravity?: number;
  size?: number;
  shape?: ParticleShape;
}

const MAX_PARTICLES = 420;

export class ParticleField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private reduced = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) this.clear();
  }

  setSize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(options: BurstOptions): void {
    if (!this.ctx || this.reduced) return;
    const count = Math.min(28, Math.round(options.count ?? 10));
    const power = options.power ?? 1;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.6 + Math.random() * 1.6) * 2.4 * power;
      this.particles.push({
        x: options.x,
        y: options.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2 * power,
        gravity: options.gravity ?? 0.14,
        life: 0,
        maxLife: 34 + Math.random() * 26,
        size: options.size ?? 4 + Math.random() * 4,
        color: options.color,
        shape: options.shape ?? 'block',
        spin: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * Math.PI,
      });
    }
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
    this.start();
  }

  clear(): void {
    this.particles = [];
    if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
    this.stop();
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    this.particles = [];
  }

  private loop = (now: number): void => {
    const ctx = this.ctx;
    if (!ctx) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(2.6, Math.max(0.4, (now - this.last) / 16.67));
    this.last = now;
    ctx.clearRect(0, 0, this.width, this.height);

    const alive: Particle[] = [];
    for (const particle of this.particles) {
      particle.life += dt;
      if (particle.life >= particle.maxLife) continue;
      particle.vy += particle.gravity * dt;
      particle.vx *= 0.985;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.angle += particle.spin * dt;

      const t = particle.life / particle.maxLife;
      const alpha = Math.max(0, 1 - t * t);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;

      if (particle.shape === 'spark') {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const size = particle.size * (1 - t * 0.35);
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.angle);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }
      alive.push(particle);
    }

    this.particles = alive;
    ctx.globalAlpha = 1;
    if (alive.length > 0) {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.raf = 0;
      ctx.clearRect(0, 0, this.width, this.height);
    }
  };
}
