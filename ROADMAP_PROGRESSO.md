# Roadmap de Progresso, Deploy no GitHub Pages & Estratégia de Crowdfunding

Este documento acompanha o status de todas as funcionalidades do **PokeASCII GO 3D AR** e o plano para lançamento público no GitHub e financiamento coletivo estudantil.

---

## 1. Checklist de Progresso do Projeto

### Fase 1 — Motor Gráfico ASCII 3D, Câmera iPhone & Ancoragem Precisa (CONCLUÍDO ✅)
- [x] **Ambiente ASCII de Alta Definição (70 níveis de luminância + CLAHE Auto-Contrast na câmera ao vivo)**
- [x] **Correção para Chrome/Safari no iPhone:** Atributos `webkit-playsinline`, elemento de vídeo ativo na árvore de renderização (`2x2px opacity:0.01`), cascata de *constraints* e suporte a HTTPS (`:8443` local + GitHub Pages HTTPS oficial).
- [x] **Ancoragem KLT de Alta Precisão na Webcam/Celular:** Filtro de Kalman com amortecimento de velocidade angular + Zona Morta anti-ruído térmico (`|dx| < 0.09`) + Rejeição de *Outliers* (Trimmed Mean).
- [x] **Proporções Reais de Tamanho (`height_m` & `weight_kg`):** Escala 3D proporcional entre os Pokémons e o ambiente (com grade métrica `1m x 1m` no chão e régua visual de altura/peso).
- [x] **Gerador 3D Detalhado por Arquétipo:** Olhos 3D, pupilas, asas, caudas, chamas, cascos e variação cromática *Shiny*.

### Fase 2 — Mecânicas Completas Estilo Pokémon GO & Zero-Gacha (CONCLUÍDO ✅)
- [x] **Mecânica de Rotação da Bola (Curveball) + Anel de Precisão (`Nice! 1.15x`, `Great! 1.5x`, `Excellent! 1.85x`)**.
- [x] **Animações Dinâmicas:** Pulo/esquiva do Pokémon, investida de ataque, *Laser Vortex* vermelho sugando o Pokémon em espiral para a Pokébola, 3 balançadas com faíscas e explosão de captura.
- [x] **1.025 Pokémons (151 Kanto + Gen 2..9 Embutidos + Sync Dinâmico com a Wiki PokéAPI)** com pesos reais de aparecimento em qualquer área.
- [x] **Sistema de IVs (0–15 ATK/DEF/STA + Avaliação 0★ a 4★ HUNDO), CP Oficial, Power Up e Evoluções**.
- [x] **Mapa da Cidade com Joystick Virtual Analógico + Pokémon Parceiro (Buddy)** caminhando ao lado do jogador.
- [x] **Tela Inicial Animada, Cadastro Offline (apenas nome) e Criação de Personagem (Homem ♂ / Mulher ♀ + Personalização)**.
- [x] **Ginásios, Raids 5 Estrelas (Mewtwo, Rayquaza), Vilões (Equipe Shadow) e Arena PvP / Troca Lucky**.
- [x] **Passe de Batalha 100% Gratuito (Zero Gacha / Zero Dinheiro Real)** + **Progressão Infinita com Hard Cap Nível 50**.
- [x] **Motor de Som WebAudio Procedural** (gritos sintetizados para as 1.025 espécies, som de Curveball, fanfarra *GOTCHA!* e música BGM).
- [x] **Salvamento Resiliente (`IndexedDB` + `localStorage` + `navigator.storage.persist()` + Export/Import `.JSON` + Cloud Sync)**.
- [x] **Painel de Administração de Balanceamento (`web/admin.html`)**, **Reporte de Bugs em 2 Cliques** e **Instalação/Desinstalação PWA em 1 Clique**.
- [x] **Versão de Terminal C++20 (`pokemon_ar_preview.exe`)** funcional a 60 FPS (expansões futuras de UI ficam como opcional).

### Fase 3 — Expansão Multiplayer Global (Meta de Crowdfunding ⏳)
- [ ] **Servidor WebSocket Global Dedicado** para ver outros jogadores andando ao vivo na mesma cidade em ASCII 3D.
- [ ] **Salas de Raid Cooperativas Síncronas** (até 10 jogadores atacando o mesmo Boss de Raid em tempo real).
- [ ] **Trocas P2P Diretas por QR Code / Código de Sala** e Ranking Sazonal de Prestígio.

---

## 2. Como Rodar Jogável Dentro do GitHub (GitHub Pages — Grátis e com HTTPS Oficial!)

Sim! Como toda a versão Web do jogo em `web/` é estática e livre de dependências pesadas, o **GitHub Pages** hospeda o jogo gratuitamente com **certificado HTTPS oficial (`https://seu-usuario.github.io/pokemon-ar/`)**.
* **Vantagem imediata:** No GitHub Pages, o **Chrome e o Safari do iPhone** liberam a câmera traseira e o giroscópio instantaneamente sem nenhum aviso de certificado!
* **Como publicar:**
  1. Crie um repositório público no GitHub e envie o conteúdo desta pasta (`git init`, `git add .`, `git commit -m "Release MVP v1.0"`, `git push`).
  2. O workflow `.github/workflows/deploy-pages.yml` que já deixamos pronto publicará automaticamente a pasta `web/` no GitHub Pages!

---

## 3. Planejamento do Crowdfunding (Sem Fins Lucrativos / Open-Source)

Como o projeto utiliza referências de estudo à franquia Pokémon sob *Fair Use* educacional e licença MIT, a campanha de financiamento coletivo (no **Apoia.se**, **Catarse**, **Ko-fi** ou **GitHub Sponsors**) deve seguir **3 regras de ouro jurídicas**:
1. **Financie a Tecnologia Open-Source e a Infraestrutura de Servidor (Nunca venda Pokémons ou itens):**
   Descreva a campanha como: *"Financiamento Coletivo de Estudo: Motor Gráfico WebAR em ASCII 3D + Custeio do Servidor Multiplayer Comunitário"*.
2. **100% das Features Liberadas para Todos (Stretch Goals Comunitários):**
   Não tranque Pokémons ou vantagens de combate atrás de pagamento. Cada meta batida libera o código e o servidor para toda a comunidade!
3. **Metas Sugeridas para a Campanha:**
   * **Meta 1 (R$ 500 — MVP no GitHub Pages):** Jogo single-player completo com Câmera AR, 1.025 Pokémons, Passe de Batalha Gratuito e Save Local/Backup (Já pronto para lançamento!).
   * **Meta 2 (R$ 1.500 — Desafio Fitness / Caminhada Comunitária):** Integração com pedômetro/GPS e eventos globais de caminhada no final de semana.
   * **Meta 3 (R$ 3.500 — Servidor Web Multiplayer Dedicado 24/7):** Hospedagem do servidor Cloud (`Dockerfile` + `api_server.py` + WebSockets) em VPS para que todos os jogadores se encontrem no Mapa da Cidade, façam **Trocas ao Vivo**, **Raids Cooperativas** e **Torneios PvP**!
