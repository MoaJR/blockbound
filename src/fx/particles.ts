export type ParticleShape = 'block' | 'spark' | 'glow' | 'ring' | 'confetti' | 'shard';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: ParticleShape;
  spin: number;
  angle: number;
  additive: boolean;
  radius: number;
  maxRadius: number;
  width: number;
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
  speed?: number;
  direction?: number;
  spread?: number;
  life?: number;
  additive?: boolean;
  drag?: number;
}

export interface ConfettiOptions {
  x: number;
  y: number;
  count?: number;
  colors: string[];
  power?: number;
  spread?: number;
}

const DEFAULT_MAX = 420;

export class ParticleField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private reduced = false;
  private scale = 1;
  private budget = DEFAULT_MAX;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) this.clear();
  }

  setQuality(scale: number, budget: number): void {
    this.scale = Math.max(0, scale);
    this.budget = Math.max(0, Math.floor(budget));
    if (this.particles.length > this.budget) {
      this.particles.splice(0, this.particles.length - this.budget);
    }
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

  private push(particle: Particle): void {
    this.particles.push(particle);
    if (this.particles.length > this.budget) {
      this.particles.splice(0, this.particles.length - this.budget);
    }
  }

  burst(options: BurstOptions): void {
    if (!this.ctx || this.reduced || this.scale <= 0) return;
    const count = Math.min(40, Math.round((options.count ?? 10) * this.scale));
    const power = options.power ?? 1;
    const speedBase = options.speed ?? 2.4;
    const dir = options.direction;
    const spread = options.spread ?? Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = dir === undefined ? Math.random() * spread : dir + (Math.random() - 0.5) * spread;
      const speed = (0.55 + Math.random() * 1.6) * speedBase * power;
      this.push({
        x: options.x + (Math.random() - 0.5) * 4,
        y: options.y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.15 * power,
        gravity: options.gravity ?? 0.14,
        drag: options.drag ?? 0.985,
        life: 0,
        maxLife: options.life ?? 34 + Math.random() * 26,
        size: (options.size ?? 4) * (0.7 + Math.random() * 0.8),
        color: options.color,
        shape: options.shape ?? 'block',
        spin: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * Math.PI,
        additive: options.additive ?? options.shape === 'spark',
        radius: 0,
        maxRadius: 0,
        width: 1,
      });
    }
    this.start();
  }

  ring(options: {
    x: number;
    y: number;
    color: string;
    radius: number;
    width?: number;
    life?: number;
    additive?: boolean;
  }): void {
    if (!this.ctx || this.reduced || this.scale <= 0) return;
    this.push({
      x: options.x,
      y: options.y,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      life: 0,
      maxLife: options.life ?? 26,
      size: 0,
      color: options.color,
      shape: 'ring',
      spin: 0,
      angle: 0,
      additive: options.additive ?? true,
      radius: 0,
      maxRadius: options.radius,
      width: (options.width ?? 2.5) * this.scale,
    });
    this.start();
  }

  confetti(options: ConfettiOptions): void {
    if (!this.ctx || this.reduced || this.scale <= 0) return;
    const count = Math.min(42, Math.round((options.count ?? 20) * this.scale));
    const colors = options.colors.length > 0 ? options.colors : ['#7ff0ff', '#ffd76a', '#d6bcff'];
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (options.spread ?? Math.PI * 0.9);
      const speed = (2 + Math.random() * 4) * (options.power ?? 1);
      this.push({
        x: options.x + (Math.random() - 0.5) * 20,
        y: options.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.2,
        drag: 0.99,
        life: 0,
        maxLife: 55 + Math.random() * 35,
        size: 4 + Math.random() * 5,
        color: colors[index % colors.length] ?? '#7ff0ff',
        shape: 'confetti',
        spin: (Math.random() - 0.5) * 0.4,
        angle: Math.random() * Math.PI,
        additive: false,
        radius: 0,
        maxRadius: 0,
        width: 1,
      });
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
    if (this.reduced || this.budget <= 0) return;
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

      if (particle.shape !== 'ring') {
        particle.vy += particle.gravity * dt;
        particle.vx *= particle.drag;
        particle.vy *= particle.drag;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.angle += particle.spin * dt;
      } else {
        particle.radius = particle.maxRadius * Math.min(1, particle.life / particle.maxLife);
      }

      const t = particle.life / particle.maxLife;
      const alpha = Math.max(0, 1 - t * t);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = particle.color;
      ctx.globalCompositeOperation = particle.additive ? 'lighter' : 'source-over';

      if (particle.shape === 'spark') {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.shape === 'glow') {
        ctx.globalAlpha = alpha * 0.24;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.shape === 'ring') {
        ctx.lineWidth = particle.width * (1 - t * 0.7);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (particle.shape === 'confetti') {
        const size = particle.size * (1 - t * 0.25);
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.angle);
        ctx.fillRect(-size / 2, -size / 4, size, size / 2);
        ctx.restore();
      } else if (particle.shape === 'shard') {
        const size = particle.size * (1 - t * 0.35);
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.angle);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.55, size * 0.6);
        ctx.lineTo(-size * 0.55, size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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
    ctx.globalCompositeOperation = 'source-over';
    if (alive.length > 0) {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.raf = 0;
      ctx.clearRect(0, 0, this.width, this.height);
    }
  };
}
