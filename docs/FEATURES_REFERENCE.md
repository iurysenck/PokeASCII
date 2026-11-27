# 🎯 FEATURES_REFERENCE — Pokémon GO → PokéStudy AR

> Pesquisa de mecânicas de um jogo AR de captura e como mapeamos para o nosso projeto **de estudo, gratuito e sem dinheiro real**.
> Pesquisa feita em 2026-11-26. **Números do Pokémon GO mudam com frequência** (balanceamento, eventos): tudo marcado *(verificar)* deve ser reconferido nas fontes antes de virar constante no código. Usamos as mecânicas como **referência de design**; valores e nomes finais são **nossos**.
> Não copiamos texto, imagens, sons, UI nem assets do Pokémon GO. Ver [CREDITS_AND_LICENSES](CREDITS_AND_LICENSES.md).

## 1. Tabela mestre: feature → equivalente nosso → fase

| Feature (Pokémon GO) | Equivalente em PokéStudy AR | Fase |
|---|---|---|
| Encontro AR (câmera + Pokémon sobreposto) | Encontro AR ASCII 3D, câmera ao vivo opcional + fallback sem câmera | v0.1 |
| Arremesso de bola (arrastar/soltar) | Arremesso por gesto com física própria | v0.1 |
| Curva (girar a bola) | Spin → curveball (multiplicador próprio) | v0.1 |
| Anel de captura (verde→amarelo→laranja→vermelho por dificuldade; encolhe) | Anel único que encolhe; cor por dificuldade | v0.1 |
| Nice / Great / Excellent | Mesmos 3 níveis, tamanhos de anel configuráveis | v0.1 |
| Poké Ball / Great / Ultra / Premier | 3 bolas originais (multiplicadores 1.0/1.5/2.0) | v0.1 |
| Bagas (Razz, Nanab, Pinap, Golden Razz) | 3 bagas originais (facilita / acalma / dobra doces) | v0.1 |
| Spawns no mapa | Spawn determinístico por célula+hora (semente) | v0.1 |
| Pokédex | Pokédex local (visto/capturado) | v0.1 |
| Mochila / itens | Mochila com limite configurável | v0.1 |
| Loja (PokéCoins, compra com dinheiro real) | Loja **só com moeda do jogo** ganha jogando | v0.1 |
| GO Pass (trilha grátis + Deluxe paga) | Passe **só grátis** (trilha única) | v0.1 |
| Tarefas de pesquisa / diárias | Missões diárias e semanais locais | v0.1 |
| Pokémon parceiro (buddy) | Parceiro caminha com você → doces | v0.2 |
| Doces por km (1/3/5/20 km) | Mesma estrutura por espécie (tabela própria) | v0.2 |
| Poeira estelar / Power Up | Poeira estelar (nome nosso: "Poeira de Estudo") | v0.2 |
| Evoluir com doces | Evolução com doces; itens especiais | v0.2 |
| Ovos (2/5/7/10/12 km) + incubadora | Ovos 2/5/10 km, incubadora básica ilimitada | v0.2 |
| PokéStops (giram disco → itens) | Pontos de Parada vindos do OpenStreetMap | v0.2 |
| Clima dinâmico | Clima via API aberta altera spawns | v0.2 |
| Ginásios | Ginásios PvE locais (selos bronze/prata/ouro) | v0.3 |
| Raids (T1/T3/T5, passes) | Raids PvE contra chefe; **sem passe pago** | v0.3 |
| Team GO Rocket (Recrutas, Líderes, Giovanni) | Vilões **originais** (organização fictícia) | v0.3 |
| Pokémon Sombrio + Purificação | "Corrompido" + Purificação (mecânica própria) | v0.3 |
| Batalha de treinador (rápido/carregado/escudo) | Batalhas 3×3 PvE com mesmo esqueleto | v0.3 |
| Amigos (níveis de amizade) | Lista de amigos por código | v0.4 |
| Trocas (poeira + candy) | Trocas atômicas no servidor | v0.4 |
| GO Battle League (Great/Ultra/Master) | Ligas PvP Pequena/Grande/Mestre | v0.4 |
| Menu principal (mapa + botão central + atalhos) | Ver §10 | v0.1 |

## 2. Captura

Fontes: Pokémon GO Hub (mecânicas de captura) https://pokemongohub.net/ · Bulbapedia (artigo *Catch mechanics*) https://bulbapedia.bulbagarden.net/ · Pokémon GO Wiki (Fandom) https://pokemongo.fandom.com/ · Pokémon GO oficial https://pokemongolive.com/

**Fórmula (documentada pela comunidade — *verificar*):**

`p_captura = 1 − (1 − baseCaptureRate / (2 · CPM)) ^ (bola · baga · arremesso · curva · medalha)`

onde `CPM` é o multiplicador do nível do Pokémon e `baseCaptureRate` é por espécie. É a probabilidade de **cada tentativa**; a bola balança e decide.

**Multiplicadores reportados** (Pokémon GO Hub; *verificar*):

| Fator | Valor |
|---|---:|
| Sem bônus (fora do anel) | 1.00 |
| Nice | 1.15 |
| Great | 1.50 |
| Excellent | 1.85 |
| Curva (aplicado ao multiplicador de arremesso) | ×1.70 |
| Curva + Great (combinado) | ≈ 2.55 |
| Poké Ball / Great / Ultra | 1.0 / 1.5 / 2.0 |
| Razz Berry | ×1.5 |
| Golden Razz | ×2.5 |
| Medalhas de tipo (bronze→platina) | até ×2 (modelo próprio simplificado) |

**Anel (tamanho relativo ao anel externo; valores comunitários *verificar*):** Nice ≈ 0.70–1.00 · Great ≈ 0.30–0.70 · Excellent < 0.30. Cor do anel: verde (fácil) → amarelo → laranja → vermelho (difícil).

**XP por captura:** as fontes divergem entre si e mudam ao longo dos anos (valores de arremesso vão de dezenas a centenas de XP). Decisão nossa: **100 XP base** + 10 curva + 15 Nice + 50 Great + 100 Excellent + 50 primeira bola (tabela em `data.js`, ajustável).

**Nossa implementação (v0.1):** física 2D→3D simples (velocidade do gesto + ângulo + spin → trajetória parabólica com deriva lateral proporcional ao spin); hit-test contra esfera do Pokémon; tamanho do anel no instante do impacto define Nice/Great/Excellent; fuga com probabilidade crescente por tentativa.

## 3. Pontos de Parada (PokéStops) e OpenStreetMap

- No GO: giro do disco dá itens; PokéStops vêm de dados de jogadores/Wayfarer. **Não temos acesso a esses dados** e **não devemos** tentar raspar.
- Nosso equivalente: consultar **Overpass API** por tags OSM (`tourism=artwork`, `tourism=attraction`, `historic=*`, `amenity=place_of_worship`, `leisure=park`, `amenity=library`, `tourism=viewpoint`), filtrar por **segurança** (nunca vias de alta velocidade, escolas/creches, propriedades privadas, hospitais) e **cachear em IndexedDB**, uma consulta por célula.
- Política: usar `User-Agent`/`Referer` identificável, ≤ poucos pedidos/dia, backoff em 429/504. Detalhes em [CREDITS_AND_LICENSES §OSM](CREDITS_AND_LICENSES.md#openstreetmap).
- Fonte: https://wiki.openstreetmap.org/wiki/Overpass_API · https://wiki.openstreetmap.org/wiki/Map_features

## 4. Ginásios e Raids

Fontes: Pokémon GO Hub https://pokemongohub.net/ · LeekDuck https://leekduck.com/ · Bulbapedia https://bulbapedia.bulbagarden.net/

| Aspecto no GO | Fato resumido | Nosso equivalente |
|---|---|---|
| Ginásio | Local de equipes; defensores rendem moedas (1 moeda/10 min, máx. 50/dia, paga ao voltar o defensor) | **Sem moeda por defesa** nem times; ginásio PvE local com selo de progresso |
| Selos de ginásio | Básico/Bronze/Prata/Ouro por interação | Selos locais por vitórias/visitas |
| Raid | Chefe com tempo (180–300 s), lobby até 20 jogadores, depois captura com bolas Premier | Chefe PvE solo (v0.3) e coop (v0.4) |
| Tiers | T1, T3, T5, Mega, Sombrio, Elite | T1/T3/T5 |
| Passes | Grátis (1/dia), Premium (moedas), Remoto (moedas, ~195) | **Passe de raid grátis diário**; sem remoto pago |
| Recompensas | XP, poeira, doces raros, TMs, bagas | Mesmas categorias com nomes originais |

## 5. Vilões — Team GO Rocket → vilões originais

Fonte: Serebii https://www.serebii.net/pokemongo/ · Pokémon GO Hub · Bulbapedia.

| Elemento GO | Resumo | Equivalente original nosso |
|---|---|---|
| Recrutas | Tomam PokéStops/balões; batalha 3×3; dão Componente Misterioso | "Recrutas" de uma organização fictícia (nome, uniforme e falas próprias) |
| Radar | 6 componentes → Radar; mostra Líderes | Radar com 6 peças |
| Líderes | 3 líderes, escudos; consomem o Radar | 3 líderes originais |
| Chefe | Radar Super via pesquisa especial | Chefe original por história |
| Pokémon Sombrio | +20% dano / −20% defesa; custa mais para power-up; Purificar (≈1000–5000 poeira + doces), vira nível 25 com +2 IV | "Corrompido" com mesmas ideias, **valores nossos** |

> ⚠️ Não usar nomes, logotipos, uniformes ou falas da Equipe Rocket/Giovanni (marca de terceiros).

## 6. Pokémon parceiro, doces e poeira estelar

Fonte: https://pokemon.com / https://pokemongolive.com (tabela de distância por espécie) · Eurogamer/Pokémon GO Hub.

| Faixa de buddy | Exemplos de espécie | Custo do 2º golpe carregado (GO) | Nossa tabela (v0.2) |
|---|---|---|---|
| 1 km | comuns/bebês | 10 000 poeira + 25 doces | 1 km → 1 doce |
| 3 km | iniciais, evoluções médias | 50 000 + 50 | 3 km → 1 doce |
| 5 km | raros, pseudo-lendários 1º estágio | 75 000 + 75 | 5 km → 1 doce |
| 20 km | lendários/míticos | 100 000 + 100 | 20 km → 1 doce |

Estado "empolgado" (interagir com parceiro) **reduz pela metade** a distância no GO. Nós adotamos: tocar/alimentar o parceiro 1×/dia = empolgado por 6 h.

**Poeira estelar:** entra por captura, chocar ovo, missões, pesquisa; sai em Power Up (nível 1→50 custa centenas de milhares no total *(verificar)*) e 2º golpe. Descontos: Lucky −50% poeira; Purificado −10%; Sombrio +20% *(verificar)*. Nossa regra: curva de custo própria, nível máximo 40, sem "Lucky"/"XL" na v0.2.

## 7. Moedas e economia (como ganhar, gastar e preços típicos)

Fontes: https://pokemongolive.com · Pokémon GO Hub · LeekDuck · Dittobase (preços de loja). Valores abaixo são do GO e servem **só como escala relativa** *(verificar)*.

| Item no GO | Preço (PokéCoins) | Proporção |
|---|---:|---|
| 20 Poké Balls | 100 | 5 moedas/bola |
| 100 Poké Balls | 460 | 4,6 |
| 200 Poké Balls | 800 | 4 |
| Incubadora de ovos (3 usos) | 150 | 50/uso |
| Super Incubadora (3 usos) | 200 | ~67/uso |
| Passe Premium de batalha | 100 (3 por 250) | — |
| Passe de Raid Remoto | 195 (3 por 525) | — |
| Pacotes de moedas (USD) | 100=\$0,99 · 550=\$4,99 · 1200=\$9,99 · 2500=\$19,99 · 5200=\$39,99 · 14500=\$99,99 | **NÃO FAREMOS** |

Como se ganha moeda no GO: defender ginásio (máx. 50/dia); compra com dinheiro real. **Nosso modelo (somente moeda do jogo):**

| Fonte de moeda (nossa) | Quantidade | Frequência |
|---|---:|---|
| Missão diária (3) | 20 / 30 / 50 | diária |
| Capturar primeira espécie nova do dia | 10 | diária |
| Marco de caminhada (1/3/5 km) | 15 / 30 / 50 | diária |
| Passe grátis (por nível) | 10–50 | por nível |
| Conquistas | 50–200 | única |
| **Teto diário sugerido** | **~150** | — |

| Item na nossa loja | Preço | Nota |
|---|---:|---|
| Bola básica | 5 | 25 bolas/dia ≈ teto de 1 dia |
| Bola grande | 12 | |
| Baga | 8 | |
| Incubadora (3 usos) | 100 | |
| Incenso (30 min) | 60 | |
| Cosméticos originais do avatar | 50–400 | só estético |

Regras: moeda **nunca** compra poder exclusivo; **sem** moeda premium, **sem** caixa surpresa, **sem** temporizador de FOMO, **sem** anúncios.

## 8. Ovos

| Tipo (GO) | Distância | Nosso |
|---|---|---|
| Ovo 2 km, 5 km, 7 km (presente), 10 km, 12 km (Rocket) | ver tabela | Ovos 2 / 5 / 10 km |
| Incubadora básica (ilimitada) + laranja (3 usos) | | Básica ilimitada; "incubadora reforçada" na loja |
| Distância só conta andando a velocidade de caminhada/corrida | acima de ~10,5 m/s não conta *(verificar)* | Cortar acima de 10 m/s |

## 9. Passe, pesquisas, amigos, trocas e batalhas

Fontes: LeekDuck https://leekduck.com/ · Pokémon GO Hub · https://pokemongo.com · https://pokemongolive.com

| Tema | Como é no GO | Nosso |
|---|---|---|
| GO Pass | Trilha grátis + **Deluxe** paga (~US\$ 4,99–9,99 conforme tipo); pontos por tarefas; marcos de bônus | **Só trilha grátis**; pontos por missões; recompensas: moedas, bolas, cosméticos |
| Tarefas de pesquisa (Field Research) | Tarefa → recompensa (encontro, itens) | Missões diárias com recompensa de encontro/itens |
| Amigos | Código de amigo, níveis (Bom → Melhor), presentes, bônus de raid | Código + presente diário (sem dinheiro) |
| Trocas | Custo em poeira variável; limite diário; "Lucky" | Custo fixo em poeira; limite diário; log de auditoria |
| GO Battle League | Great ≤1500 PC · Ultra ≤2500 · Master sem limite; 3×3; 1 golpe rápido + 2 carregados; 2 escudos; energia | Mesmo esqueleto, motor próprio e determinístico (referência de lógica: Pokémon Showdown, MIT) |

## 10. Menu principal e UI/UX (padrões, sem copiar assets)

Padrões observados em jogos AR/mobile de coleção (não derivados de arquivos nossos de terceiros):

| Padrão | Descrição | Aplicação |
|---|---|---|
| Mapa como "home" | Tela principal é o mapa com avatar centralizado | `screen-map` |
| Botão central + atalhos | Botão grande central abre menu radial/gaveta; HUD fino em cima (nível/XP) | Gaveta inferior com 6 ícones: Pokédex, Mochila, Loja, Passe, Missões, Perfil |
| Zona do polegar | Ações frequentes na metade inferior; sem alvos < 44 px | Joystick canto inferior esquerdo; botão de ação à direita |
| Fluxo de encontro | Mapa → toque no spawn → câmera/AR → arremesso → resultado → voltar | `screen-encounter` |
| Feedback tátil | `navigator.vibrate` em acerto, captura, fuga | opcional em Configurações |
| Estados vazios úteis | Telas vazias explicam o que fazer | todas as listas |
| Onboarding curto | Nome → personagem → parceiro inicial → tutorial de arremesso | `screen-name`/`character`/`partner` |
| Modo economia | Reduz taxa de quadros/brilho para bateria | Configurações |
| Acessibilidade | Contraste AA, reduzir movimento, modo sem câmera, texto escalável | Configurações |

Referências de estudo de UX (observação, não cópia): Material Design https://m3.material.io/ · Apple HIG https://developer.apple.com/design/human-interface-guidelines/ · Game UI Database https://www.gameuidatabase.com/ (consulta visual).

## 11. O que NÃO faremos

| Não faremos | Por quê |
|---|---|
| **Gacha / caixas surpresa / "loot paga"** | Mecânica de jogo de azar; incompatível com público jovem e com a proposta de estudo |
| **Dinheiro real dentro do jogo** (moeda premium, passe Deluxe, boost pago, venda de Pokémon) | Monetização de IP de terceiros + risco legal + sem fins lucrativos |
| Vender Pokémon, itens ou contas | Idem |
| Anúncios e rastreamento publicitário | Privacidade (LGPD, menores) |
| Chat livre e localização exata pública | Segurança de menores |
| Raspar dados do Pokémon GO/Niantic/Wayfarer ou usar APIs não oficiais | Violação de termos |
| Usar nomes/logos/uniformes de Team Rocket, Niantic ou GO | Marca de terceiros |
| Incentivar jogar em locais perigosos (vias, propriedade privada) | Segurança |
| FOMO artificial, streak punitiva | Bem-estar |
