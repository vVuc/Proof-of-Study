# Proof of Study

App desktop para Windows e Linux: objetivos do dia com um cronômetro de play/pause que registra o título da janela ativa, rotina semanal opcional e meta de horas por matéria. O tempo focado só entra no banco de horas quando o dia tem anotação (texto ou imagem) do que foi estudado, feita no fim do dia ou na manhã seguinte. Os cenários estão em [docs/features/dia-de-estudo.md](docs/features/dia-de-estudo.md).

Uso pessoal, grátis, dados só no PC de cada pessoa (`%APPDATA%\io.github.mizerski.proofofstudy` no Windows, `~/.local/share/io.github.mizerski.proofofstudy` no Linux).

## Rodar

```bash
npm install
npm run desktop
```

Instalador (Windows: `bundle/nsis/*.exe`; Linux: `bundle/deb`, `bundle/rpm` e `bundle/appimage`, em `src-tauri/target/release/`):

```bash
npm run desktop:build
```

Precisa de Node 20+ e Rust. No Windows, com o toolchain MSVC e o WebView2 (que já vem no Windows 11). No Linux (Debian/Ubuntu):

```bash
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf build-essential
```

## Versões

- **Build de teste** ([build-teste.yml](.github/workflows/build-teste.yml)): a cada push numa branch `feature/**`, roda lint, testes do Rust e gera os instaladores do Windows e do Linux como artefato (14 dias), sem publicar.
- **Release** ([release.yml](.github/workflows/release.yml)): uma tag `vX.Y.Z` igual à versão do `package.json` gera os instaladores (`.exe`, `.deb`, `.rpm` e `.AppImage`) e publica numa Release.

```bash
git tag v0.3.0 && git push origin v0.3.0
```

## Telas

Layout 1a do protótipo `Banco de Horas.html` (canvas Bauhaus): barra de título própria, barra lateral com as telas e a meta da semana no rodapé.

| Tela | O que tem |
|---|---|
| Hoje | Na primeira abertura do dia, o plano (texto livre e as matérias de hoje, sem horário). Depois, os objetivos com play/pause e o relógio do dia de cada um, a sessão do dia sem matéria, o aviso de dia a validar, o resumo do dia (% em foco, fora com horário, ritmo entre pausas) e o calendário do dia |
| Anotação do dia | Resumo do dia, matéria do estudo sem matéria, para onde foi o tempo (trocar como uma janela conta no dia), anotação e imagens; na manhã seguinte, complemento sem mexer na anotação da noite |
| Rotina | Opcional. Grade da semana (8h à meia-noite), totais por categoria, horário livre para estudo em cada dia (o que sobra dos compromissos), dia vazio com "Adicionar" |
| Banco de horas | Meta da matéria na semana (a etapa), se cabe na rotina, horas focadas com o marco da metade, o que está a validar, dias de estudo e sessões com evidências |
| Histórico | % em foco contra a primeira semana, metas cumpridas e o resultado de cada semana |
| Apps e sites | Regras (Estudo / Fora do estudo / Ignorar), apps vistos sem regra, teste de uma janela e as opções da sessão |

Fora das telas: o aviso "Hora do estudo" no canto quando começa um bloco de estudo, e o modo **widget** (botão – da barra de título ou "Virar widget"), que encolhe a janela num cartão sempre por cima com o relógio e o play/pause.

## Como funciona

- **O Rust faz o relógio** (`src-tauri/src/rastreador.rs`). No Windows o WebView suspende timers com a janela escondida, então o cronômetro, a parada por inatividade, a virada do dia, o aviso de distração e os lembretes da rotina (`lembretes.rs`) rodam numa thread que lê a janela ativa uma vez por segundo. Fechar a janela só esconde o app na bandeja.
- **Cronômetro aberto**: cada play até o pause (ou a troca de objetivo) vira uma sessão; o relógio de um objetivo é a soma das sessões dele no dia, então o play continua de onde parou, mesmo depois de fechar o app. Passado o limite sem mexer no PC, o relógio para e o tempo parado é cortado; volta sozinho ao mexer, no mesmo dia. Na meia-noite o relógio para e o dia novo começa zerado.
- **O que é lido** (`janela.rs`): título da janela ativa, nome do programa (no Windows, o executável; no Linux, a classe da janela, `WM_CLASS`) e há quanto tempo o teclado e o mouse estão parados. Só com o cronômetro rodando e a captura ligada ("Pausar captura" para a leitura sem parar o relógio).
- **Linux**: a leitura usa o X11 (`x11rb`). Numa sessão Wayland só aparecem os apps do XWayland (os nativos ficam sem janela, sem contar como fora) e o tempo sem uso não é medido, então o relógio não para por inatividade; para o registro completo, use a sessão X11. A bandeja precisa de suporte a AppIndicator (no GNOME, a extensão "AppIndicator"); sem ela, abrir o app de novo traz a janela de volta.
- **Classificação** (`src/features/sessao/utils/classificacao.ts`, igual a `regra_que_casa` no Rust): regras de título valem antes das de app; a primeira que casa decide. **Janela sem regra conta como fora do estudo** (como no protótipo), por isso os apps de estudo comuns já vêm com regra. Na anotação do dia, a etiqueta de cada janela troca como ela conta só naquele dia.
- **Validação**: o tempo de um dia entra no banco quando o dia tem anotação (`Dia` em `src/store/model/dados.ts`); sem ela fica "a validar", sem prazo, e o app lembra na próxima abertura sem bloquear nada. O estudo da sessão do dia sem matéria só entra quando a matéria é escolhida na anotação. Sessões antigas com anotação própria continuam valendo.
- **Dados**: `dados.json` com o `plugin-store` (reducer + Context em `src/store/`, formato versão 3, que converte as versões 1 e 2), e as imagens em `imagens/`, mostradas pelo protocolo `asset`.

Stack e design system seguem `finance-sheet/docs/tecnologias.md` e `design-system.md`. Cores: azul = foco, vermelho = fora, amarelo = banco de horas.

## Fora do MVP

Insights de queda de foco (IA), plano e relato por voz, lembrete do relato ao desligar o PC, metas de habilidade em tópicos e integração com o Anki, extensão de Chrome para a URL, recursos com amigos, projetos com etapas, alerta de domingo, iniciar com o Windows.
