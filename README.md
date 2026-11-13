# BLOCKBOUND

Puzzle de blocos **roguelite** para navegador (desktop e mobile). Encaixe peças em um tabuleiro 9×9, destrua linhas e colunas, cumpra objetivos cada vez mais exigentes, colecione relíquias e enfrente chefes para fechar os 8 estágios da run.

Stack: **TypeScript + React 19 + Vite 8**, animações com **Framer Motion**, motor de jogo puro (sem React/DOM), áudio sintetizado com **Web Audio API**, partículas em **Canvas 2D** e persistência em **localStorage**.

---

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit + build de produção em dist/
npm run preview    # serve o build em http://localhost:4173
npm test           # 112 testes (Vitest)
npm run smoke      # teste real no Chromium (requer build e Playwright)
```

Requisitos: Node 20.19+ (validado em Node 24). O smoke test usa o Chromium do cache do Playwright (`~/.cache/ms-playwright`) e aceita `CHROME_PATH` para apontar outro binário.

---

## Como jogar

- Você recebe **3 peças** por bandeja e precisa encaixá-las no tabuleiro 9×9.
- Ao completar uma **linha ou coluna** inteira, ela é destruída e pontua.
- Completar **várias linhas de uma vez** gera bônus e multiplicador de combo.
- Quando as três peças são usadas, uma nova bandeja é sorteada. O gerador garante que **sempre existe ao menos uma peça encaixável** (e prefere bandejas com 2+ opções válidas).
- Cada estágio tem **objetivo(s)** e um **par de jogadas**. O par **não é um limite**: passar dele não encerra a run — você entra em **prorrogação** e, a cada 2 jogadas extras, uma célula do tabuleiro é corrompida (a pressão substitui o relógio). A run só termina quando o tabuleiro trava sem poderes ou resgates.
- **Bônus de eficiência:** concluir a câmara dentro do par converte cada jogada economizada em **+20 pontos** e cristais. O chip do HUD mostra `Par · n` e vira `Prorrogação · n` quando você passa.
- **Segunda Chance:** uma vez por run, se a bandeja travar sem poderes e sem a Fênix, o tabuleiro é parcialmente limpo em vez de encerrar a run.
- **Durante a fase** a barra de **energia** enche com posicionamentos, linhas, combos e purificação; ao atingir 100% você escolhe uma recompensa (carga, novo poder, evolução, energia, cristais ou fragmentos). **Eventos** (baú, portal, mercador, santuário e fragmentos) também aparecem durante o estágio, sem interromper o fluxo.
- Ao concluir um estágio, escolha **1 entre 3 (ou 4)** relíquias e siga para o próximo. Vencer o estágio 8 encerra a run em **vitória**.

### Controles

| Ação | Desktop | Mobile |
| --- | --- | --- |
| Pegar peça | Arraste da bandeja para o tabuleiro | Arraste **ou** toque na peça e depois no tabuleiro |
| Confirmar | Soltar a peça | Toque novamente na mesma posição (ou botão **Colocar**) |
| Cancelar | `Esc` ou botão Cancelar | Botão Cancelar |
| Selecionar peça | `1` `2` `3` | Toque na peça |
| Mover cursor | Setas | — |
| Posicionar no cursor | `Enter` | — |
| Devolver peça (Luva) | `R` | Botão da Luva |
| Pausar | `Esc` | Botão de pausa |

O tabuleiro mostra **prévia fantasma** alinhada à grade: ciano quando o encaixe é válido, vermelho tracejado quando há conflito. Durante o arraste a peça acompanha o ponteiro **sem snap** (offset de pega preservado, atualização por `requestAnimationFrame`), e o preview antecipa:
- **linhas e colunas** que serão destruídas (dourado = células já ocupadas, ciano = preenchidas pela peça, interseção com brilho extra);
- a **pontuação prevista** vinda da mesma fórmula e do mesmo RNG da jogada real (inclui combo, relíquias e multiplicadores);
- a **energia** que a jogada concederia.

O encaixe na grade só acontece ao soltar — e usa exatamente a mesma função de resolução do preview (`src/engine/placement.ts`).

---

## Sistemas

### Pontuação

Constantes em `src/engine/scoring.ts`:

```
posicionamento = blocos × 5 (+ pontos planos de relíquias) × multiplicador da peça
linha          = 100 × linhas × (1 + 0,5 × (linhas − 1)) × bônus de linha
bônus 3+       = linha × 0,5 × (linhas − 2)
combo          = 1 + passo × nível do combo (teto padrão 2,0)
total          = (posicionamento + linha + bônus) × combo × multiplicador global
```

- Combo cresce quando um posicionamento limpa linhas (uma por linha destruída) e zera em uma jogada sem limpeza (algumas relíquias alteram essa regra).
- Peças especiais: **Prisma** (1 célula, 3× pontos), **Estrela** (+1 carga de poder), **TNT** (explode 3×3 quando a linha dela é limpa).
- Relíquias entram em um pipeline determinístico (`onPlace` → `onClear` → efeitos pós-limpeza), usando apenas o RNG da run.

### Estágios

`src/engine/stages.ts` gera 8 estágios procedurais:

| Estágio | Característica |
| --- | --- |
| 1 | Objetivo de pontuação (introdução) |
| 2 | Objetivo de destruição de linhas |
| 3 | Precisão (limpezas duplas) ou purificação + modificador |
| 4 | **Chefe** (sorteado) |
| 5–7 | Objetivos variados, objetivos secundários e modificadores |
| 8 | **Chefe final**, com vida ampliada (+25%) |

Objetivos possíveis: pontuação, linhas destruídas, limpezas duplas, destruir corrupção, alcançar combo e derrotar chefe.

Modificadores: estágio preciso (sem poderes/especiais), silêncio arcano, gravidade pesada (peças grandes), verniz de gelo, semente corrompida, par curto, chuva de prismas e fome de combo.

### Chefes

| Chefe | Identidade | Mecânica |
| --- | --- | --- |
| **Rei de Gelo** | Prata/ciano, halo congelante | Congela células periodicamente; bloqueiam encaixes e derretem com limpezas próximas |
| **Rei da Corrupção** | Roxo, praga pulsante | Espalha células corrompidas; destrua-as em linhas para causar dano |
| **Rei da Gravidade** | Azul profundo | Blocos caem após limpezas; cada linha destruída fere o rei |
| **Rei Explosivo** | Laranja/vermelho | Planta bombas com contagem regressiva; limpe a linha da bomba antes do estouro |

Cada chefe tem barra de vida, fase enfurecida abaixo de 50%, regra exibida na HUD e limites de segurança (máximo de células congeladas/corrompidas e espaço mínimo livre), evitando derrotas inevitáveis.

### Relíquias

**40 relíquias** em 5 raridades (`common`, `uncommon`, `rare`, `epic`, `legendary`), cada uma com descrição objetiva, ícone próprio e **tags de sinergia** (Combo, Linhas, Prisma, Poderes, Economia, Precisão). Exemplos de interação real:

- **Coroa Dourada + Combo Mestre + Elo de Sinergia** → linhas valem +20%, o combo sobe mais rápido e cada relíquia rara+ aumenta o total.
- **Núcleo Prismático + Sol Prismático + Sorte Dourada** → geração frequente de prismas (3× pontos) e mais peças especiais.
- **Botas Pesadas + Fome de Combo + Tempo Fractal** → loops longos com jogadas extras a cada marco de combo.
- **Cristal Explosivo + Coração de Fogo + Coroa do Vazio** → limpezas em cadeia que abrem o tabuleiro.
- **Relicário + Olho do Estrategista** → duas escolhas por recompensa, com 4 cartas.
- **Cristal de Energia + Mestre dos Combos + Bateria Arcana** → energia por linha e por combo com teto maior; **Baú Afortunado**, **Duplicador**, **Comerciante Itinerante** e **Fragmentador** alimentam os eventos in-run.

Relíquias com lógica dedicada: Cristal Explosivo, Coração de Fogo, Coroa do Vazio, Espada do Dilúvio, Fênix de Cristal, Relicário, Tempo Fractal, Mesa do Mestre, Luva Magnética (devolver peça) e Lente de Vidro (detalha a pontuação prevista). As relíquias de energia/eventos entram no mesmo pipeline de `RunMods` — nenhuma funcionalidade isolada.

### Poderes

Seis poderes com **níveis de evolução (1–4)**, cargas por estágio vindas de desbloqueios + relíquias/talentos, e aquisição **durante a fase** (barra de energia, baús, portais, mercador e recompensas por desempenho). O nível altera o efeito real no motor, não só o texto:

| Poder | Nível 1 | Evoluções |
| --- | --- | --- |
| Martelo | esmaga 1 célula | L2 duas células · L3 +10 de energia |
| Bomba | área 3×3 | L2 4×4 · L3 +12 pts por célula · L4 chance de energia em células especiais |
| Reorganizar | troca a bandeja | L2 gera dois conjuntos e mantém o melhor · L3 prioriza peças que completam linha |
| Broca | limpa uma linha | L2 +8 de energia · L3 linha + coluna |
| Conversão | área 2×2 | L2 3×3 · L3 +6 de energia por corrupção |
| Coringa | armazena 1 encaixe especial | L2 queima corrupção adjacente · L3 +12 de energia |

Poderes desbloqueados (na meta ou durante a run) começam cada estágio com **1 carga**; até 3 recompensas de energia podem ficar pendentes, e a escolha é sempre feita pelo jogador (sem modal forçado).

### Energia, eventos e performance

A progressão in-run vive em `src/engine/progression.ts` e usa apenas funções puras/reutilizadas:

- **Energia**: +4 por posicionamento, +1 por bloco, +12 por linha, +2 por nível de combo (cap 8), +8 por linha extra, +6 por corrupção/peça especial. `RunMods.energyMult/energyOnLine/energyComboMult/energyMax` ajustam tudo. Ao cruzar 100% (ou mais com Bateria Arcana) surge uma pendência com 3 escolhas: carga, poder novo, evolução, energia, cristais ou fragmentos.
- **Eventos** (chance base `10% + 2% por estágio`, cooldown de 3 jogadas, limite por fase, nunca com outra recompensa aberta): **Fragmento** (energia + cristais imediatos), **Baú** (habilidade/cristais/cargas), **Portal** (duas melhorias), **Mercador** (compra com cristais da run ou **fragmentos**, com desconto do Comerciante) e **Santuário** (energia, carga, upgrade ou troca de relíquia).
- **Performance**: 3+ linhas de uma vez → chance de carga; marco de combo 5 → energia; objetivo secundário concluído → escolha de bônus; 3+ especiais destruídos → carga; jogada excepcional (≥1500 pts) → cristais + energia. No máximo uma recompensa de performance por jogada.
- **Anti-duplicação**: `addEnergy` é a única porta de energia, `claimEnergyReward` consome `pending` e a oferta de forma atômica, `resolveStageEvent` anula o evento antes de aplicar, e a simulação do preview não consome RNG real.

### Metaprogressão

- **Cristais** ao final de cada run (pontuação, estágio, combo, linhas, chefes e multiplicadores de relíquias).
- **Coleção** (Relíquias / Poderes / Talentos): desbloqueios permanentes com custo por raridade.
- **Talentos** (4, com níveis): carga extra de Martelo, +% cristais, reroll gratuito e jogadas extras.
- **16 conquistas** com recompensa em cristais.
- **Estatísticas e recordes**, incluindo chefes derrotados, linhas simultâneas e tempo jogado.
- **Autosave** da run em andamento (`blockbound.run.v1`) e da conta (`blockbound.meta.v1`). Ao recarregar, o menu oferece **Continuar**.

---

## Arquitetura

```
src/
├─ engine/            # regras puras, determinísticas e testáveis
│  ├─ types.ts        # estado, eventos, peças, objetivos, recompensas, meta
│  ├─ rng.ts          # mulberry32 com estado serializável
│  ├─ board.ts        # encaixe, conflitos, linhas, limpeza, gelo, corrupção, bombas
│  ├─ placement.ts    # projeção do arraste → âncora (fonte única do preview e do drop)
│  ├─ preview.ts      # simulação sem efeitos colaterais + pontuação/energia previstas
│  ├─ progression.ts  # energia, eventos de estágio, recompensas e níveis de poder
│  ├─ mods.ts         # derivação compartilhada de RunMods (relíquias + talentos + estágio)
│  ├─ pieces.ts       # catálogo de formas + gerador justo + `preferClear`
│  ├─ scoring.ts      # fórmula de pontos e modificadores padrão
│  ├─ relics.ts       # 40 relíquias, raridades, sinergias, sorteio de recompensas
│  ├─ powers.ts       # catálogo de poderes + tabela de evolução (POWER_LEVELS)
│  ├─ objectives.ts   # textos e progresso dos objetivos
│  ├─ stages.ts       # geração procedural dos 8 estágios + modificadores
│  ├─ bosses.ts       # 4 chefes com hooks de turno
│  ├─ run.ts          # orquestração (placePiece, usePower, claimEnergyReward...)
│  ├─ meta.ts         # cristais, desbloqueios, talentos, recordes
│  └─ achievements.ts # 16 conquistas
├─ audio/
│  ├─ core.ts          # AudioContext único, buses master/música/SFX, compressor e unlock
│  ├─ instruments.ts   # mallet, bell, pluck, pad, bass, percussão e envelopes
│  ├─ sfx.ts           # biblioteca de efeitos + variações + throttle + haptics
│  ├─ music/
│  │  ├─ theory.ts     # notas, acordes e transformações do motivo
│  │  ├─ themes.ts     # 7 composições originais + padrões por camada
│  │  └─ engine.ts     # sequenciador, crossfade, intensidade, tensão e duck
│  └─ useAudioScene.ts # liga view/estágio/chefe à trilha adaptativa
├─ fx/
│  ├─ particles.ts     # block, spark, glow, ring, confetti e shard em Canvas 2D
│  ├─ director.ts      # intensidade de limpeza, combos, centro e linhas afetadas
│  ├─ quality.ts       # auto/alta/econômica, orçamento de partículas e FPS
│  └─ fxBus.ts         # barramento central de eventos visuais
├─ hooks/useGame.ts   # ponte React ↔ engine, persistência e feedback
├─ components/        # Board, PieceTray, EnergyBar, ProgressionPanel, HUD, modais...
├─ screens/           # Menu, Run, Recompensa, Resultado, Coleção, Conquistas...
├─ ui/                # ícones SVG próprios e arte das relíquias
├─ persistence.ts     # localStorage versionado (migra runs v1 → v2) com validação
└─ styles/            # tokens, base, tabuleiro, HUD, cartas, telas, responsivo, efeitos
```

O motor é **imutável por ação**: cada comando clona o estado, aplica as regras e devolve `{ ok, state, events }`. A UI nunca altera o estado diretamente — apenas consome eventos (`place`, `clear`, `combo`, `energy`, `powerUp`, `stageEvent`...) para som, partículas e popups. O arraste é a única camada puramente visual: a posição do ghost é escrita no DOM via `rAF`, e só o **âncora inteiro** atualiza o estado React do preview. Isso mantém o comportamento determinístico (mesma seed + mesmas ações ⇒ mesmo resultado), testável e serializável.

---

## Responsividade

- Mobile-first; tabuleiro dimensionado por `ResizeObserver`, sem scroll horizontal.
- Três layouts: mobile (coluna única com dock inferior), tablet/desktop (relíquias | tabuleiro | objetivos/poderes) e **celular na horizontal** (tabuleiro à esquerda, coluna de jogo à direita).
- `100dvh` com fallback `100vh`, `env(safe-area-inset-*)` para notch, alvos de toque ≥ 44 px e `touch-action: none` apenas na área de jogo.
- O tamanho das peças da bandeja é calculado pela largura real do card, garantindo encaixe em qualquer proporção.
- Duas formas de interação (arrastar e tocar-para-posicionar), com `Pointer Events` unificando mouse, toque e caneta, `setPointerCapture` no card da peça e offset de pega em fração do shape (funciona em qualquer densidade de pixels/zoom).

## Áudio e game feel

### Trilha adaptativa

O ambiente não possui encoders de áudio (sem `ffmpeg` de áudio, `sox`, `lame` ou `oggenc`; o ffmpeg do Playwright é somente vídeo/VP9). Por isso a trilha é **original e sintetizada em tempo real com Web Audio API**, sem URLs externas e sem arquivos binários fictícios.

- **7 temas:** menu, gameplay, estágio avançado, chefe, recompensa, vitória e derrota.
- **Motivo original de 4 notas** (tônica → terça → quinta → nona) transformado em cada tema: contemplativo no menu, sincopado no gameplay, invertido no avançado, cromatizado no chefe e resolvido em fanfarra na vitória.
- **Camadas independentes:** pad, baixo, arpejo, melodia, sinos, percussão e tensão. A intensidade (0–3) ativa camadas sem reiniciar a faixa.
- **Tensão adaptativa:** entra com poucas jogadas, chefe com vida baixa, tabuleiro travado ou combo alto.
- **Crossfade** entre temas (1,2–2,2 s) no barramento de música; abrir pausa/configurações aplica **duck**, não reinicia.
- **Vitória** inclui uma sequência de fanfarra no primeiro ciclo; chefes têm stingers de entrada e derrota.
- `visibilitychange` faz fade/suspensão e retoma sem perder o ponto da composição.

### Efeitos sonoros

`src/audio/sfx.ts` tem receitas próprias para pegar peça, arrastar, soltar, encaixar, inválido, linha, coluna, cruz, combos, multiplicador, cada poder (bomba/martelo/broca/reorganizar/conversão/coringa), raridades de relíquia, interface, cristais, conquistas, chefe, vitória e derrota. Sons repetidos recebem variação de altura/ganho e throttle individual para evitar duplicação.

### Áudio no navegador

- Um único `AudioContext` compartilhado entre música e SFX, criado apenas no primeiro gesto legítimo do jogador.
- `pointerdown`, `keydown` e `touchstart` desbloqueiam/retomam o contexto (incluindo iOS/Safari).
- Volumes separados de **geral, música e efeitos**, mute global e preferências persistidas no `localStorage`.
- O tema ativo é exposto em `document.documentElement.dataset.musicTheme` e o estado do motor em `window.__blockboundMusic.getState()` para diagnóstico.

### Feedback visual

- Encaixe com impacto por célula, compressão/expansão e partículas; a confirmação lógica acontece antes da animação.
- Arraste com elevação, sombra, escala e ghost independente; tick sutil ao mudar de âncora.
- Limpeza com flash, pulso, partículas na cor real do bloco, pontuação flutuante e shake proporcional à quantidade de linhas/cruz.
- Combos com banner e efeitos crescentes: ×2 brilho, ×3 confete, ×5 anel de energia, ×10 apresentação especial.
- Poderes com anéis/feixes próprios; reorganizar faz flip nas peças da bandeja.
- Relíquias com entrada, aquisição por raridade, pulso de ativação e apresentação curta de lendária.
- Chefes com presença viva em CSS (cristais orbitando, esporos, anéis gravitacionais, pavio/ brasas), entrada cinematográfica curta, reação a dano e banner de derrota.

### Qualidade e performance

- Configuração **Automática / Alta / Econômica** nas opções.
- O modo automático parte da capacidade do dispositivo (`hardwareConcurrency`, `deviceMemory`) e pode rebaixar suavemente se o frame time médio ficar alto, sem mudanças no meio de uma animação crítica.
- Econômica reduz partículas (420 → 180), limita DPR, remove blur pesado e enxuga efeitos.
- `prefers-reduced-motion` e a opção própria desligam ambient/partículas/cinemáticas, mantendo som, flash curto e mudança de estado.
- Partículas vivem apenas enquanto existem, com atualização por um único `requestAnimationFrame` e limpeza de timers/efeitos ao desmontar.

- Partículas só rodam enquanto existem (um `requestAnimationFrame` compartilhado, teto de 420 em alta / 180 em econômica).
- Células do tabuleiro memoizadas; o ghost do arraste escreve `transform` direto no DOM (um write por frame), e o preview só recalcula quando o âncora inteiro muda.
- Sem imagens externas: blocos, ícones, logo e arte das relíquias são CSS/SVG.
- `prefers-reduced-motion` + configuração própria desligam ambient, partículas e cinemáticas, mantendo o feedback essencial.
- Foco visível, rótulos ARIA nos botões, tabuleiro como `role="grid"` e região `aria-live` para pontuação/objetivos.

---

## Testes

`npm test` cobre o motor (112 asserções, incluindo composição musical e direção de efeitos):

- posicionamento em todas as orientações e limites;
- projeção do arraste → âncora: arredondamento, clamp nas bordas, conflitos e Coringa;
- preview × confirmação: **mesma âncora, mesmas linhas/colunas e pontuação idêntica**, inclusive com Espelho de Prata (RNG espelhado);
- preview é puro: não altera tabuleiro, pontuação, energia nem o estado do RNG;
- detecção de linhas/colunas, interseções e limpeza simultânea;
- corrupção, gelo, bombas e gravidade;
- pontuação, combo, multiplicadores e relíquias;
- energia (ganho, teto, pendências, claim único), eventos (cooldown, cap, mercador, recusa) e recompensas por desempenho;
- evolução de poderes (bomba 4×4/L3, martelo duplo, broca com energia, teto de nível) e `preferClear`;
- relíquias novas (Cristal de Energia, Bateria Arcana, Duplicador, Comerciante, Fragmentador, Baú Afortunado) e compra com fragmentos;
- objetivos, progressão de estágio, chefes e derrota;
- salvamento/restauração (incluindo migração v1 → v2) e metaprogressão;
- justiça do gerador (120 tabuleiros aleatórios) e determinismo por seed.

`npm run smoke` abre o jogo em Chromium (desktop 1440×900, mobile 390×844, tablet 820×1180 e landscape 844×390) e valida: logo, início de run, **desbloqueio de áudio + tema musical de gameplay + sequenciador ativo + 7 camadas**, qualidade visual aplicada, pausa sem reiniciar a trilha, barra de energia, tap-to-place, **arraste sem snap** (delta do transform ≈ delta do ponteiro), preview fantasma + pontuação prevista durante o arraste, poder, pausa, autosave/recuperação, recompensa de estágio, **recompensa de energia aplicada uma única vez**, **evento injetado consumido ao escolher**, vitória, telas secundárias, ausência de overflow horizontal e de erros de console. As capturas ficam em `screenshots/`.

---

## Limitações conhecidas / próximos passos

- Interface em **pt-BR** apenas (textos organizados para futura i18n).
- Sem personagens/temas cosméticos desbloqueáveis e sem service worker/offline (o jogo funciona 100% local após o carregamento).
- O balanceamento dos alvos e do par é parametrizado em `stages.ts` e validado por um harness determinístico (`src/engine/balance.test.ts`), que simula runs com o engine real e falha se a primeira câmara ficar impossível ou a progressão virar parede.
- A trilha é sintetizada em tempo real (Web Audio) porque o ambiente não possui encoder de áudio (OGG/MP3) — não há arquivos de música externos. A validação automatizada confirma desbloqueio, tema e sequenciador; a audição física em Safari/iOS e Android é recomendada manualmente.
- A prévia usa a **fórmula real** de pontuação para o posicionamento + linhas. Efeitos de relíquias que destroem células extras **depois** da limpeza (Cristal Explosivo, Coroa do Vazio, TNT) não alteram esse valor e não são simulados no preview — eles acontecem normalmente ao confirmar.
- O smoke test manipula o save apenas para acelerar cenários de recompensa/vitória; toda a lógica de conclusão é executada pelo motor real.
