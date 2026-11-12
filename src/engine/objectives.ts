import type { Objective, ObjectiveKind } from './types';

export function createObjective(kind: ObjectiveKind, target: number): Objective {
  return { kind, target: Math.max(1, Math.round(target)), progress: 0 };
}

export function objectiveDone(objective: Objective): boolean {
  return objective.progress >= objective.target;
}

export function allDone(objectives: readonly Objective[]): boolean {
  return objectives.every(objectiveDone);
}

export function objectiveText(objective: Objective): string {
  const target = objective.target;
  switch (objective.kind) {
    case 'score':
      return `Marque ${target} pontos`;
    case 'lines':
      return `Destrua ${target} linhas ou colunas`;
    case 'double':
      return `Complete 2 linhas de uma vez ${target}×`;
    case 'survive':
      return `Sobreviva ${target} jogadas`;
    case 'corrupt':
      return `Destrua ${target} células corrompidas`;
    case 'combo':
      return `Alcance um combo de ${target}`;
    case 'boss':
      return `Reduza o chefe a zero (${target} de vida)`;
    default:
      return 'Objetivo';
  }
}

export function objectiveKindLabel(kind: ObjectiveKind): string {
  switch (kind) {
    case 'score':
      return 'Pontuação';
    case 'lines':
      return 'Destruição';
    case 'double':
      return 'Precisão';
    case 'survive':
      return 'Sobrevivência';
    case 'corrupt':
      return 'Purificação';
    case 'combo':
      return 'Combo';
    case 'boss':
      return 'Chefe';
    default:
      return 'Objetivo';
  }
}

export function objectiveIcon(kind: ObjectiveKind): string {
  switch (kind) {
    case 'score':
      return 'bolt';
    case 'lines':
      return 'rows';
    case 'double':
      return 'cross';
    case 'survive':
      return 'shield';
    case 'corrupt':
      return 'virus';
    case 'combo':
      return 'flame';
    case 'boss':
      return 'skull';
    default:
      return 'target';
  }
}

export function bumpObjectives(objectives: Objective[], kind: ObjectiveKind, amount: number): void {
  for (const objective of objectives) {
    if (objective.kind === kind) {
      objective.progress = Math.max(objective.progress, objective.progress + amount);
    }
  }
}

export function setObjectiveProgress(objectives: Objective[], kind: ObjectiveKind, value: number): void {
  for (const objective of objectives) {
    if (objective.kind === kind) objective.progress = Math.max(objective.progress, value);
  }
}

export function objectiveProgressText(objective: Objective): string {
  if (objective.kind === 'score') {
    return `${Math.min(objective.progress, objective.target)} / ${objective.target}`;
  }
  return `${Math.min(objective.progress, objective.target)} / ${objective.target}`;
}

export function primaryObjective(objectives: readonly Objective[]): Objective | undefined {
  return objectives[0];
}
