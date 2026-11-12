import { describe, expect, it } from 'vitest';
import { computeScore, defaultMods } from './scoring';
import { Rng } from './rng';

function base(overrides: Partial<Parameters<typeof computeScore>[0]> = {}) {
  return computeScore({
    blocks: 4,
    lines: 0,
    combo: 0,
    mods: defaultMods(),
    rarePlus: 0,
    noClearStreak: 0,
    pieceMult: 1,
    rng: new Rng(1),
    ...overrides,
  });
}

describe('pontuação', () => {
  it('posicionamento vale 5 pontos por bloco', () => {
    const result = base({ blocks: 3 });
    expect(result.place).toBe(15);
    expect(result.total).toBe(15);
  });

  it('linha única soma 100 e usa multiplicador de combo', () => {
    const result = base({ lines: 1, combo: 0 });
    expect(result.line).toBe(100);
    expect(result.comboMult).toBe(1);
    expect(result.total).toBe(120);
  });

  it('linhas simultâneas recebem bônus progressivo', () => {
    const two = base({ lines: 2 });
    expect(two.line).toBe(300);
    const three = base({ lines: 3 });
    expect(three.line).toBe(600);
    expect(three.lineBonus).toBe(300);
  });

  it('combo aumenta o multiplicador até o teto', () => {
    const result = base({ lines: 1, combo: 4 });
    expect(result.comboMult).toBe(2);
    const capped = base({ lines: 1, combo: 40 });
    expect(capped.comboMult).toBe(2);
  });

  it('Combo Mestre eleva o teto e o passo', () => {
    const mods = defaultMods();
    mods.comboStep = 0.4;
    mods.comboCap = 3;
    const result = base({ lines: 1, combo: 4, mods });
    expect(result.comboMult).toBe(2.6);
  });

  it('Coroa Dourada aumenta só a parte de linha', () => {
    const mods = defaultMods();
    mods.lineScoreMult = 0.2;
    const result = base({ lines: 1, mods });
    expect(result.line).toBe(120);
    expect(result.place).toBe(20);
    expect(result.total).toBe(140);
  });

  it('peça grande recebe bônus da Gema de Gravidade', () => {
    const mods = defaultMods();
    mods.bigPieceBonus = 0.5;
    const result = base({ blocks: 5, mods });
    expect(result.place).toBe(Math.round(25 * 1.5));
  });

  it('prisma multiplica o posicionamento por 3', () => {
    const result = base({ blocks: 1, pieceMult: 3 });
    expect(result.total).toBe(15);
  });

  it('Espelho de Prata pode dobrar o total', () => {
    const mods = defaultMods();
    mods.mirrorChance = 1;
    const result = base({ mods });
    expect(result.mirrored).toBe(true);
    expect(result.total).toBe(40);
  });

  it('Relógio de Sangue acumula bônus por jogadas sem limpar', () => {
    const mods = defaultMods();
    mods.noClearStreakBonus = 0.08;
    const result = base({ lines: 0, noClearStreak: 5, mods });
    expect(result.streakBonus).toBe(8);
    expect(result.total).toBe(28);
  });

  it('Elo de Sinergia multiplica relíquias raras equipadas', () => {
    const mods = defaultMods();
    mods.rareScoreBonus = 0.06;
    const result = base({ rarePlus: 3, mods });
    expect(result.globalMult).toBeCloseTo(1.18, 2);
    expect(result.total).toBe(24);
  });
});
