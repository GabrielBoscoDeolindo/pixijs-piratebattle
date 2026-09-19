# Architecture notes

This is not a formal Clean Architecture implementation. For a game of this
size, I preferred a few clear boundaries over a large number of abstractions.
The important rule is that gameplay does not depend on React or PixiJS.

## Main boundaries

| Area | Responsibility |
| --- | --- |
| `src/game` | Match state, movement, weapons, collisions, enemies and spawning |
| `src/rendering` | PixiJS application, textures and state-to-sprite synchronization |
| `src/input` | Keyboard and touch input state |
| `src/screens` | React screens, HUD and dialogs |
| `src/api` | Typed HTTP contracts and Axios calls |
| `src/mocks` | MSW handlers, scenarios, fixtures and mock persistence |
| `src/storage` | Options, identity, last result and pending submissions |
| `src/performance` | Frame samples and match performance summary |
| `src/testing` | Test-only deterministic browser bridge |

`App.tsx` is the coordinator. It selects the current React screen, owns saved
options and starts result submission. `GameScreen.tsx` creates one `PixiGame`
instance for one match. `PixiGame` owns the renderer and delegates all rules to
`GameSession`.

I deliberately did not put live combat entities into React state. React only
receives a small HUD snapshot when health, score, phase or the displayed second
changes; FPS data is published every half second. This keeps React out of the
60 Hz loop.

## Simulation

`GameSession.update(deltaSeconds, input)` is the only normal entry point for a
simulation step. Movement, rotation, cooldowns, projectile age, effects, match
time and spawn time all use seconds rather than frames. Runtime deltas are
clamped to 50 ms so a stalled tab cannot create a huge physics jump.

The update order is intentional:

1. advance the active-match clock;
2. update cooldowns and short-lived effects;
3. apply player rotation and movement;
4. create requested shots;
5. move projectiles and resolve their first collision;
6. update Chasers and Shooters;
7. resolve Chaser impact;
8. spawn an enemy if the interval elapsed.

When the match reaches `finished`, `update` returns immediately. That freezes
movement, damage, cooldowns, projectiles, spawns and score with one phase check.
A restart creates a new session rather than trying to clean and reuse the old
one.

Every match receives a deep-cloned `GameConfig`. The Options screen changes the
duration and spawn interval used to create the next snapshot; the remaining
balance values stay centralized in `src/game/config.ts`.

## Input and pause

`KeyboardInput` keeps independent booleans for movement and every weapon. Touch
buttons write to the same logical actions, which is why turning and firing can
happen together. Holding forward and steering at the same time felt awkward on
a phone, so the mobile forward control became an auto-sail toggle. After one
tap, the player can steer with one thumb and use the cannons with the other.
Pausing resets both the input and the toggle.

Keyboard listeners are active only while the game exists. Pause clears held
input. Blur and `visibilitychange` pause automatically, but resuming always
requires the player. This avoids applying keys that were held while the tab was
hidden.

## Collision and navigation

Ships use circles because they rotate constantly and do not need a new polygon
transform every frame. Islands use local polygon points scaled from the same
size used to draw their sprites. Projectiles are circles as well.

Player movement is proposed first and reverted if the new circle crosses the
arena or an island. A projectile is removed after its first hit, after touching
an island, after leaving the arena or after its lifetime expires. Destroyed
enemies are removed immediately, so they cannot fire or collide later in the
same match.

Enemy steering is shared by the Chaser and Shooter. The system probes headings
on a persistent avoidance side instead of choosing left/right randomly every
frame. Path checks use a swept circle against every polygon edge, not sparse
point samples. That last detail fixed a case where the Chaser could rotate a few
degrees at a corner and then remain blocked because the probe had skipped the
first pixels of overlap. Exact tangency is accepted, allowing the hull to slide
along an edge.

The Chaser always advances toward the player and destroys itself on impact. The
Shooter tries to maintain its configured combat distance, but it keeps moving
when an island blocks the firing line. It fires only when the player is in
range, the aim error is within tolerance and the swept projectile path is clear.

Spawning uses a seeded random generator. Candidate points must be inside the
arena, outside every island, away from existing enemies and at least the
configured minimum distance from the player. The enemy cap prevents an
unbounded match after an aggressive spawn setting.

## Rendering and resource lifecycle

PixiJS renders the water, islands, ships, projectiles, effects and health bars.
React renders the menu, forms, data screens, HUD counters and dialogs. Textures
are loaded together before the ticker starts. `GameScreen` shows a loading state
and offers a retry if initialization fails.

The renderer keeps maps from entity IDs to Pixi display objects. Existing
sprites are updated in place and only created or destroyed when the entity set
changes. The world is scaled with the smaller viewport ratio and centered, so
the logical arena remains 1600×900 on every display. Pixi uses automatic pixel
density capped at 2×.

`PixiGame.destroy()` removes the ticker callback, input listeners, blur and
visibility listeners, the resize observer, active audio, display objects and
entity maps. Initialization also checks whether React unmounted the component
while textures were still loading. These guards are necessary because React
Strict Mode intentionally mounts and unmounts effects twice in development.

## UI and accessibility

The menu and data screens are regular semantic HTML. Buttons keep visible focus
styles, form errors are linked through `aria-describedby`, and pause/result
dialogs manage focus. Score, health, time and match state have semantic labels
outside the canvas.

Desktop and mobile share the same game coordinates. CSS has a dedicated short
landscape layout for 500 px of height or less: Options becomes a two-column
form, list rows are compressed and dialog actions remain in the viewport.
`svh` and safe-area insets are used for mobile browser chrome and notches.

## Ranking, history and network failure

The API layer exposes typed `MatchRecord`, `RankingEntry` and paginated response
contracts. Axios performs the requests. TanStack Query owns list caching,
loading/error states, retry behavior and invalidation.

Ranking query keys include duration, spawn interval and page. History keys
include player ID and page. This prevents pages or configurations from sharing
the wrong cache entry. Screens refetch when opened, and query cancellation keeps
an older delayed response from replacing newer data.

The browser MSW worker uses the same contracts in development, tests and the
production build. Its database stores confirmed matches in `localStorage`.
Ranking order is deterministic: score, effective duration, completion date and
match ID. A `POST /api/matches` with an existing `matchId` returns the stored
record rather than adding another one.

On match completion I save the result as pending before making the request. A
successful response removes it from the pending queue and invalidates ranking
and history. A failure leaves it available for retry after refresh, navigation
or the browser `online` event. A small in-flight guard prevents two recovery
loops from submitting the same queue concurrently.

Network scenarios are selected through one local-storage key. Delays and
out-of-order responses use controlled values so the E2E suite stays
reproducible.

## Storage ownership

The application keeps only browser-local data:

- player options;
- a stable local player identity;
- the last completed result;
- pending match submissions;
- confirmed MSW matches;
- the selected mock scenario;
- the last performance summary.

An abandoned match is never converted into a `MatchRecord`. Reloading or leaving
combat simply destroys that session.

## Testing

Playwright runs the same flows in desktop Chromium and a touch-enabled 844×390
Chromium profile. The browser bridge is compiled only in Vite test mode. It can
advance the real simulation in 1/60-second steps and configure a known state,
which removes wall-clock waits without replacing the actual rules.

The suite covers options, loading failure, movement, boundaries, island
collision, all weapons, cooldowns, damage, score, both enemy types, spawning,
pause, both endings, restart, touch input, data pagination, error recovery,
idempotency and out-of-order responses. Versioned screenshots cover the menu,
arena, result and short-landscape support screens.

The HTML report is kept in `playwright-report/`. Traces, screenshots and videos
are retained only for failed tests in `test-results/`.

## Performance notes

`PerformanceMonitor` samples Pixi ticker frame times only during active play. It
calculates average FPS, p95 frame time and the maximum simultaneous entity
count. Collection is capped at 20,000 samples, enough for a three-minute 60 FPS
run without growing indefinitely. The final snapshot also stores browser,
viewport, pixel ratio, logical processor count and the match configuration.

The target is 60 FPS, with a p95 below 16.67 ms on a 60 Hz reference machine.
I have not committed invented hardware numbers. The final delivery check still
needs one measured run on the machine used for submission:

1. run `npm run build` and `npm run preview`;
2. select a 180-second match and record the Result-screen metrics;
3. capture a representative browser Performance trace;
4. take a baseline heap snapshot;
5. start, play and leave five matches, forcing GC between snapshots when
   available;
6. compare retained `PixiGame`, `Application`, sprite, `Audio` and listener
   instances;
7. record hardware, browser, viewport, pixel ratio and selected options here.

GPU memory varies by browser and device, so it needs to be checked on the same
reference machine rather than inferred from a development run.

## Balance decisions

- A Chaser is slower than the player, so an attentive player can disengage.
- The Shooter is slower again and stops at a preferred distance when it has a
  clear shot.
- Broadside damage is stronger, but the longer cooldown and aiming angle make
  it harder to use.
- Spawns are kept away from the player to avoid unavoidable entry damage.
- Twelve enemies is the hard cap for readability and predictable performance.
- The arena keeps one large central island and two smaller reefs. This leaves
  useful firing lanes without turning local avoidance into full pathfinding.

## Known limitations

- Enemy navigation is local avoidance, not a navigation mesh. The swept checks
  solve edge stalls, but deliberately constructed mazes would need waypoint or
  graph-based pathfinding.
- Data is a browser-local MSW simulation, so ranking is not shared between
  devices.
- The final public URL and hardware profiling evidence are external delivery
  steps and are not represented by application code.

## Diário de desenvolvimento

### Quinta-feira, 18:07 — entendendo o escopo

Comecei lendo o desafio com calma e separando o que era interface, o que era
renderização e o que precisava ser regra pura de jogo. Decidi também manter
ranking e histórico fora da partida, porque não fazia sentido uma falha da API
impedir o jogador de entrar no combate.

### Quinta-feira, 18:42 — projeto no ar

Configurei Vite, React, TypeScript em modo estrito e PixiJS. Aproveitei para
montar a estrutura inicial das pastas e colocar os valores de balanceamento no
`GAME_CONFIG`. Queria evitar aquele cenário em que velocidade e dano acabam
espalhados por vários arquivos.

### Quinta-feira, 19:16 — primeiro barco navegando

Carreguei a água, a ilha e o primeiro navio. Depois fiz o movimento para a
frente e a rotação. Nessa etapa já coloquei as regras no `GameSession`; deixar o
movimento preso ao renderer parecia simples no começo, mas ficaria ruim de
testar assim que entrassem colisões e combate.

### Quinta-feira, 19:53 — colisão e resize

Fiz o navio respeitar os limites da arena e a hitbox da ilha. Usei um círculo
para o casco e um polígono para a ilha, o que ficou simples o suficiente para
rodar a cada frame. Também ajustei o canvas para manter a arena em 1600×900 sem
distorcer quando a janela muda de tamanho.

### Quinta-feira, 20:27 — menu principal

Montei o menu em React com os assets do desafio e fiz os estados normal, hover e
pressionado dos botões. Liguei o botão Play à criação da partida e deixei a tela
de Options encaminhada.

### Quinta-feira, 20:56 — fechando o primeiro dia

Antes de parar, testei algumas entradas e saídas da tela de jogo. O Strict Mode
mostrou cedo que eu precisava cuidar da desmontagem do Pixi, então garanti a
remoção do ticker e dos listeners. Terminei o dia com menu, arena, movimento,
colisão e resize funcionando.

### Sexta-feira, 12:08 — canhões e projéteis

Voltei pelo combate. Implementei o tiro frontal e as duas broadsides, com três
projéteis paralelos em cada lateral. Também entrei com dono do projétil, dano,
cooldown, tempo de vida e remoção no primeiro impacto.

### Sexta-feira, 13:19 — primeiros inimigos

Criei o Chaser e o Shooter. O Chaser vai direto para o jogador e explode quando
encosta; o Shooter tenta encontrar uma distância boa antes de atirar. Logo
depois fiz o spawn com seed, distância mínima do jogador, checagem de obstáculos
e um limite de inimigos para a partida não crescer sem controle.

### Sexta-feira, 14:33 — começo, meio e fim da partida

Adicionei cronômetro, fim por tempo ou morte, pausa manual e pausa ao trocar de
aba. O ponto mais importante aqui foi garantir que uma partida encerrada
realmente parasse: nada de projétil, dano ou spawn continuando por baixo da tela
de resultado.

### Sexta-feira, 15:41 — HUD e configurações

Montei o HUD com vida, score, tempo, FPS e número de entidades. Depois terminei
Options com validação e persistência e fiz a tela de resultado mostrar o motivo
do fim, a duração real e as ações de jogar novamente ou voltar ao menu.

### Sexta-feira, 16:47 — ranking e histórico

Entrei na parte de dados com os contratos tipados, Axios e TanStack Query. Usei
o MSW para paginação, fixtures e persistência local. Resolvi salvar o resultado
como pendente antes do POST; desse jeito, se a página recarregar ou a rede cair,
a partida ainda pode ser recuperada.

### Sexta-feira, 18:06 — testando a rede ruim

Adicionei os cenários de latência, respostas fora de ordem, offline, erros HTTP
e timeout depois do commit. Usei o `matchId` como chave idempotente para um
reenvio nunca criar duas entradas no histórico ou no ranking.

### Sexta-feira, 19:17 — Playwright sem esperar o relógio

Os primeiros testes em tempo real estavam demorando e variavam demais. Fiz um
controlador disponível somente no modo de teste que avança a simulação em passos
fixos. Assim consegui testar movimento, armas, spawn, pausa e término de partida
usando as regras reais, mas sem esperar minutos em cada caso.

### Sexta-feira, 20:23 — feedback e som

Coloquei os sons de canhão, impacto, explosão, interface e ambiente. Também
adicionei mudança de cor conforme o dano, efeitos de disparo, explosões e screen
shake. Aproveitei essa etapa para mostrar FPS, p95 do frame e pico de entidades
sem deixar o monitor guardar amostras para sempre.

### Sexta-feira, 21:31 — acertando o landscape

Quando testei em uma tela baixa, Options e Result ficavam cortados e o menu de
pausa tinha texto sobreposto. Fiz um layout específico para landscape curto e
salvei screenshots de Options, Ranking, History e Pause em 844×390. Foi mais
seguro do que continuar ajustando CSS no olho.

### Sexta-feira, 22:14 — Chaser preso na ilha

Consegui reproduzir o Chaser girando um pouco e parando em um canto da ilha. O
probe antigo pulava alguns pixels e às vezes dizia que a direção estava livre
quando não estava. Troquei essa parte por um teste contínuo do círculo ao longo
do segmento e guardei o caso diagonal no Playwright. No playtest também removi
a ilha pequena do norte; com três ilhas a arena ficou mais limpa e os inimigos
ganharam espaço para contornar os obstáculos.

### Sexta-feira, 22:57 — limpando os assets

Antes de apagar qualquer coisa, procurei todas as referências usadas em runtime.
O pacote tinha 523 arquivos e cerca de 30,4 MB, mas o jogo carregava só 58 deles,
aproximadamente 5,45 MB. Mantive esse conjunto, separei em `game`, `ui` e `audio`
e atualizei os caminhos no código.

### Sexta-feira, 23:20 — última conferência

No último teste pelo celular ainda achei os controles pesados: era preciso
segurar a aceleração, virar e apertar um canhão ao mesmo tempo. Transformei a
aceleração mobile em um botão de auto-sail, deixei o HUD mais compacto e ajustei
os textos dos botões para não vazarem em telas baixas. Essa regra só entra em
dispositivos touch na horizontal; o controle de desktop continua igual.

Depois rodei novamente o build, lint, typecheck e a suíte completa do Playwright
em desktop e mobile. Por último, enxuguei a documentação para ficar só com este
arquivo e o README, sem o diário enorme dividido em etapas que eu estava usando
durante o desenvolvimento.

### Comandos usados na revisão final

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```
