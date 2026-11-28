"use strict";

// ============================================================================
// POKÉDEX UNIVERSAL (151 KANTO + GEN 2..9 EMBUTIDOS + SYNC DINÂMICO 1025 POKEAPI)
// Pesos de Spawn estilo Pokémon GO, Fórmulas de IV (0..15) & CP, Moves, Evoluções e Itens
// ============================================================================

window.PokeData = (function() {

  // Paletas RGB [0..1] por Tipo Elemental para geração de malhas 3D detalhadas
  const TYPE_COLORS = {
    Normal:   { main: [0.78, 0.76, 0.68], sec: [0.92, 0.90, 0.84], accent: [0.45, 0.42, 0.38] },
    Fire:     { main: [0.98, 0.44, 0.12], sec: [0.98, 0.86, 0.42], accent: [1.00, 0.95, 0.22] },
    Water:    { main: [0.22, 0.58, 0.96], sec: [0.72, 0.90, 1.00], accent: [0.12, 0.32, 0.72] },
    Grass:    { main: [0.22, 0.80, 0.42], sec: [0.18, 0.72, 0.68], accent: [0.92, 0.35, 0.48] },
    Electric: { main: [1.00, 0.88, 0.14], sec: [0.88, 0.68, 0.06], accent: [0.98, 0.18, 0.16] },
    Ice:      { main: [0.45, 0.88, 0.96], sec: [0.85, 0.98, 1.00], accent: [0.20, 0.55, 0.82] },
    Fighting: { main: [0.78, 0.32, 0.24], sec: [0.88, 0.76, 0.62], accent: [0.35, 0.22, 0.18] },
    Poison:   { main: [0.68, 0.28, 0.82], sec: [0.86, 0.55, 0.95], accent: [0.35, 0.92, 0.55] },
    Ground:   { main: [0.82, 0.66, 0.38], sec: [0.94, 0.86, 0.68], accent: [0.52, 0.38, 0.20] },
    Flying:   { main: [0.58, 0.72, 0.95], sec: [0.92, 0.92, 0.95], accent: [0.88, 0.68, 0.22] },
    Psychic:  { main: [0.96, 0.36, 0.62], sec: [0.98, 0.78, 0.88], accent: [0.55, 0.22, 0.78] },
    Bug:      { main: [0.58, 0.78, 0.18], sec: [0.88, 0.92, 0.45], accent: [0.92, 0.28, 0.22] },
    Rock:     { main: [0.68, 0.62, 0.48], sec: [0.50, 0.46, 0.36], accent: [0.85, 0.78, 0.62] },
    Ghost:    { main: [0.42, 0.22, 0.64], sec: [0.74, 0.34, 0.96], accent: [0.98, 0.95, 1.00] },
    Dragon:   { main: [0.38, 0.28, 0.92], sec: [0.95, 0.78, 0.35], accent: [0.95, 0.25, 0.32] },
    Dark:     { main: [0.28, 0.24, 0.32], sec: [0.62, 0.58, 0.68], accent: [0.95, 0.22, 0.28] },
    Steel:    { main: [0.68, 0.74, 0.82], sec: [0.88, 0.92, 0.96], accent: [0.35, 0.68, 0.95] },
    Fairy:    { main: [0.96, 0.58, 0.78], sec: [1.00, 0.88, 0.95], accent: [0.45, 0.88, 0.98] }
  };

  // Matriz de Efetividade de Tipos (Multiplicadores estilo Pokémon GO: 1.6x Super Efetivo, 0.625x Não Muito Efetivo)
  const TYPE_CHART = {
    Fire:     { Grass: 1.6, Ice: 1.6, Bug: 1.6, Steel: 1.6, Water: 0.625, Fire: 0.625, Rock: 0.625, Dragon: 0.625 },
    Water:    { Fire: 1.6, Ground: 1.6, Rock: 1.6, Water: 0.625, Grass: 0.625, Dragon: 0.625 },
    Grass:    { Water: 1.6, Ground: 1.6, Rock: 1.6, Fire: 0.625, Grass: 0.625, Poison: 0.625, Flying: 0.625, Bug: 0.625 },
    Electric: { Water: 1.6, Flying: 1.6, Grass: 0.625, Electric: 0.625, Dragon: 0.625, Ground: 0.39 },
    Ice:      { Grass: 1.6, Ground: 1.6, Flying: 1.6, Dragon: 1.6, Fire: 0.625, Water: 0.625, Ice: 0.625, Steel: 0.625 },
    Fighting: { Normal: 1.6, Ice: 1.6, Rock: 1.6, Dark: 1.6, Steel: 1.6, Flying: 0.625, Psychic: 0.625, Fairy: 0.625, Ghost: 0.39 },
    Poison:   { Grass: 1.6, Fairy: 1.6, Poison: 0.625, Ground: 0.625, Rock: 0.625, Ghost: 0.625 },
    Ground:   { Fire: 1.6, Electric: 1.6, Poison: 1.6, Rock: 1.6, Steel: 1.6, Grass: 0.625, Bug: 0.625, Flying: 0.39 },
    Flying:   { Grass: 1.6, Fighting: 1.6, Bug: 1.6, Electric: 0.625, Rock: 0.625, Steel: 0.625 },
    Psychic:  { Fighting: 1.6, Poison: 1.6, Psychic: 0.625, Steel: 0.625, Dark: 0.39 },
    Bug:      { Grass: 1.6, Psychic: 1.6, Dark: 1.6, Fire: 0.625, Fighting: 0.625, Flying: 0.625, Ghost: 0.625 },
    Rock:     { Fire: 1.6, Ice: 1.6, Flying: 1.6, Bug: 1.6, Fighting: 0.625, Ground: 0.625, Steel: 0.625 },
    Ghost:    { Psychic: 1.6, Ghost: 1.6, Dark: 0.625, Normal: 0.39 },
    Dragon:   { Dragon: 1.6, Steel: 0.625, Fairy: 0.39 },
    Dark:     { Psychic: 1.6, Ghost: 1.6, Fighting: 0.625, Dark: 0.625, Fairy: 0.625 },
    Steel:    { Ice: 1.6, Rock: 1.6, Fairy: 1.6, Fire: 0.625, Water: 0.625, Electric: 0.625, Steel: 0.625 },
    Fairy:    { Fighting: 1.6, Dragon: 1.6, Dark: 1.6, Fire: 0.625, Poison: 0.625, Steel: 0.625 }
  };

  function getTypeEffectiveness(moveType, defTypes) {
    let mult = 1.0;
    const chart = TYPE_CHART[moveType];
    if (!chart) return 1.0;
    for (const dt of defTypes) {
      if (chart[dt]) mult *= chart[dt];
    }
    return mult;
  }

  // Catálogo de Golpes Rápidos (Fast Moves) e Carregados (Charged Moves)
  const FAST_MOVES = {
    Tackle:       { name: "Tackle",       type: "Normal",   power: 5,  energyGain: 8,  cooldownMs: 500 },
    QuickAttack:  { name: "Quick Attack", type: "Normal",   power: 8,  energyGain: 10, cooldownMs: 700 },
    ThunderShock: { name: "Thunder Shock",type: "Electric", power: 5,  energyGain: 13, cooldownMs: 600 },
    Ember:        { name: "Ember",        type: "Fire",     power: 10, energyGain: 10, cooldownMs: 900 },
    VineWhip:     { name: "Vine Whip",    type: "Grass",    power: 7,  energyGain: 11, cooldownMs: 600 },
    WaterGun:     { name: "Water Gun",    type: "Water",    power: 5,  energyGain: 9,  cooldownMs: 500 },
    Lick:         { name: "Lick",         type: "Ghost",    power: 5,  energyGain: 11, cooldownMs: 500 },
    Confusion:    { name: "Confusion",    type: "Psychic",  power: 16, energyGain: 14, cooldownMs: 1200 },
    DragonBreath: { name: "Dragon Breath",type: "Dragon",   power: 6,  energyGain: 8,  cooldownMs: 500 },
    WingAttack:   { name: "Wing Attack",  type: "Flying",   power: 8,  energyGain: 11, cooldownMs: 750 },
    BugBite:      { name: "Bug Bite",     type: "Bug",      power: 5,  energyGain: 9,  cooldownMs: 500 },
    RockThrow:    { name: "Rock Throw",   type: "Rock",     power: 12, energyGain: 10, cooldownMs: 900 },
    KarateChop:   { name: "Karate Chop",  type: "Fighting", power: 8,  energyGain: 12, cooldownMs: 800 },
    PoisonJab:    { name: "Poison Jab",   type: "Poison",   power: 10, energyGain: 10, cooldownMs: 800 },
    MudShot:      { name: "Mud Shot",     type: "Ground",   power: 6,  energyGain: 12, cooldownMs: 600 },
    FrostBreath:  { name: "Frost Breath", type: "Ice",      power: 10, energyGain: 9,  cooldownMs: 850 },
    BulletPunch:  { name: "Bullet Punch", type: "Steel",    power: 9,  energyGain: 11, cooldownMs: 800 },
    Bite:         { name: "Bite",         type: "Dark",     power: 6,  energyGain: 8,  cooldownMs: 500 },
    Charm:        { name: "Charm",        type: "Fairy",    power: 15, energyGain: 11, cooldownMs: 1100 }
  };

  const CHARGED_MOVES = {
    Thunderbolt:  { name: "Thunderbolt",  type: "Electric", power: 90,  energyCost: 50 },
    Flamethrower: { name: "Flamethrower", type: "Fire",     power: 90,  energyCost: 50 },
    SolarBeam:    { name: "Solar Beam",   type: "Grass",    power: 150, energyCost: 100 },
    PowerWhip:    { name: "Power Whip",   type: "Grass",    power: 90,  energyCost: 50 },
    HydroPump:    { name: "Hydro Pump",   type: "Water",    power: 130, energyCost: 75 },
    AquaTail:     { name: "Aqua Tail",    type: "Water",    power: 55,  energyCost: 35 },
    ShadowBall:   { name: "Shadow Ball",  type: "Ghost",    power: 100, energyCost: 50 },
    Psystrike:    { name: "Psystrike",    type: "Psychic",  power: 110, energyCost: 45 },
    Psychic:      { name: "Psychic",      type: "Psychic",  power: 90,  energyCost: 50 },
    DragonClaw:   { name: "Dragon Claw",  type: "Dragon",   power: 50,  energyCost: 35 },
    Outrage:      { name: "Outrage",      type: "Dragon",   power: 110, energyCost: 60 },
    Hurricane:    { name: "Hurricane",    type: "Flying",   power: 110, energyCost: 65 },
    RockSlide:    { name: "Rock Slide",   type: "Rock",     power: 75,  energyCost: 45 },
    Earthquake:   { name: "Earthquake",   type: "Ground",   power: 120, energyCost: 65 },
    CloseCombat:  { name: "Close Combat", type: "Fighting", power: 100, energyCost: 45 },
    SludgeBomb:   { name: "Sludge Bomb",  type: "Poison",   power: 80,  energyCost: 50 },
    IceBeam:      { name: "Ice Beam",     type: "Ice",      power: 90,  energyCost: 55 },
    BodySlam:     { name: "Body Slam",    type: "Normal",   power: 60,  energyCost: 35 },
    HyperBeam:    { name: "Hyper Beam",   type: "Normal",   power: 150, energyCost: 100 },
    DazzlingGleam:{ name: "Dazzling Gleam",type:"Fairy",    power: 100, energyCost: 65 },
    FlashCannon:  { name: "Flash Cannon", type: "Steel",    power: 100, energyCost: 65 },
    DarkPulse:    { name: "Dark Pulse",   type: "Dark",     power: 80,  energyCost: 50 },
    XScissor:     { name: "X-Scissor",    type: "Bug",      power: 55,  energyCost: 35 }
  };

  // Gerador de Icones Vetoriais SVG para Itens e Medalhas (Zero Emojis!)
  function itemSvg(color, innerPath) {
    return `<svg class="pogo-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;">${innerPath}</svg>`;
  }

  const ITEMS_CATALOG = {
    poke_ball:       { id: "poke_ball",       name: "Poke Ball",        cat: "ball",  catchMult: 1.0,  icon: itemSvg("#ef4444", "<circle cx='12' cy='12' r='9'/><line x1='3' y1='12' x2='21' y2='12'/><circle cx='12' cy='12' r='3' fill='#fff'/>"), desc: "Capsula padrao para capturar Pokemons selvagens (1.0x)." },
    great_ball:      { id: "great_ball",      name: "Great Ball",       cat: "ball",  catchMult: 1.5,  icon: itemSvg("#2563eb", "<circle cx='12' cy='12' r='9'/><line x1='3' y1='12' x2='21' y2='12'/><circle cx='12' cy='12' r='3' fill='#fff'/>"), desc: "Capsula de alta performance com +50% de taxa de captura (1.5x)." },
    ultra_ball:      { id: "ultra_ball",      name: "Ultra Ball",       cat: "ball",  catchMult: 2.0,  icon: itemSvg("#d97706", "<circle cx='12' cy='12' r='9'/><line x1='3' y1='12' x2='21' y2='12'/><circle cx='12' cy='12' r='3' fill='#fff'/>"), desc: "Capsula avancada que dobra a chance de captura (2.0x)." },
    master_ball:     { id: "master_ball",     name: "Master Ball",      cat: "ball",  catchMult: 99.0, icon: itemSvg("#9333ea", "<circle cx='12' cy='12' r='9'/><line x1='3' y1='12' x2='21' y2='12'/><circle cx='12' cy='12' r='3' fill='#fff'/>"), desc: "Captura qualquer Pokemon sem falhar (100% garantido)." },
    razz_berry:      { id: "razz_berry",      name: "Razz Berry",       cat: "berry", catchMult: 1.5,  candyMult: 1, calm: false, icon: itemSvg("#e11d48", "<path d='M12 5c-4 0-7 3-7 8 0 4 3 7 7 7s7-3 7-7c0-5-3-8-7-8z'/><path d='M12 2v3'/>"), desc: "Acalma o Pokemon aumentando a chance de captura em 1.5x." },
    nanab_berry:     { id: "nanab_berry",     name: "Nanab Berry",      cat: "berry", catchMult: 1.15, candyMult: 1, calm: true,  icon: itemSvg("#f59e0b", "<path d='M7 17c4 2 9-2 11-9-3 0-8 3-11 9z'/>"), desc: "Deixa o Pokemon imovel na camera AR para facilitar o tiro Excellent." },
    pinap_berry:     { id: "pinap_berry",     name: "Pinap Berry",      cat: "berry", catchMult: 1.0,  candyMult: 2, calm: false, icon: itemSvg("#eab308", "<ellipse cx='12' cy='14' rx='6' ry='7'/><path d='M9 7l3-4 3 4'/>"), desc: "Dobra a quantidade de Candies recebidos ao capturar o Pokemon (2x)." },
    golden_razz:     { id: "golden_razz",     name: "Golden Razz Berry",cat: "berry", catchMult: 2.5,  candyMult: 1, calm: true,  icon: itemSvg("#f59e0b", "<polygon points='12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9'/>"), desc: "Aumenta drasticamente a chance de captura (2.5x) e acalma o alvo." },
    potion:          { id: "potion",          name: "Potion",           cat: "heal",  healHp: 50,      icon: itemSvg("#8b5cf6", "<path d='M9 3h6v4l4 8v5H5v-5l4-8V3z'/>"), desc: "Restaura 50 HP de um Pokemon apos batalhas de Ginasio/Raid." },
    hyper_potion:    { id: "hyper_potion",    name: "Hyper Potion",     cat: "heal",  healHp: 200,     icon: itemSvg("#ec4899", "<path d='M9 3h6v4l4 8v5H5v-5l4-8V3z'/>"), desc: "Restaura 200 HP de um Pokemon ferido." },
    max_revive:      { id: "max_revive",      name: "Max Revive",       cat: "heal",  healHp: 9999,    icon: itemSvg("#eab308", "<polygon points='12 2 19 12 12 22 5 12'/>"), desc: "Revive e restaura 100% do HP de um Pokemon desmaiado." },
    incense:         { id: "incense",         name: "Incense (30m)",    cat: "boost", durationSec: 1800, icon: itemSvg("#ec4899", "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='4'/>"), desc: "Atrai Pokemons selvagens com 3x mais frequencia para a sua posicao." },
    lucky_egg:       { id: "lucky_egg",       name: "Lucky Egg (30m)",  cat: "boost", durationSec: 1800, icon: itemSvg("#0ea5e9", "<ellipse cx='12' cy='13' rx='7' ry='9'/>"), desc: "Dobra todo o XP ganho durante 30 minutos (2x XP)." },
    star_piece:      { id: "star_piece",      name: "Star Piece (30m)", cat: "boost", durationSec: 1800, icon: itemSvg("#f59e0b", "<polygon points='12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9'/>"), desc: "Aumenta o Stardust recebido em +50% durante 30 minutos." },
    rare_candy:      { id: "rare_candy",      name: "Rare Candy",       cat: "evo",   icon: itemSvg("#3b82f6", "<circle cx='12' cy='12' r='6'/><path d='M4 8l3 4-3 4M20 8l-3 4 3 4'/>"), desc: "Converte-se em +5 Candies de qualquer Pokemon selecionado." },
    evo_stone:       { id: "evo_stone",       name: "Evolution Stone",  cat: "evo",   icon: itemSvg("#10b981", "<polygon points='12 2 20 9 17 21 7 21 4 9'/>"), desc: "Pedra elemental ancestral usada para evolucoes especiais." },
    charged_tm:      { id: "charged_tm",      name: "Charged TM",       cat: "tm",    icon: itemSvg("#6366f1", "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/>"), desc: "Ensina um novo Golpe Carregado de elite ao seu Pokemon." },
    raid_pass:       { id: "raid_pass",       name: "Raid Pass",        cat: "raid",  icon: itemSvg("#f97316", "<rect x='3' y='6' width='18' height='12' rx='2'/><line x1='15' y1='6' x2='15' y2='18'/>"), desc: "Permite desafiar um Boss Gigante de Raid 5 Estrelas." }
  };

  // Banco Compacto dos 151 Pokémons Clássicos de Kanto + Favoritos Gen 2..9
  // Formato: [id, Nome, Tipo1, Tipo2, BaseAtk, BaseDef, BaseSta, AlturaM, PesoKg, SpawnWeight, BaseCatchRate, Archetype, EvolvesToId, CandyCost]
  const RAW_SPECIES = [
    [1,"Bulbasaur","Grass","Poison",118,111,128,0.7,6.9,45,0.20,"quad_bulb",2,25],
    [2,"Ivysaur","Grass","Poison",151,143,155,1.0,13.0,12,0.10,"quad_bulb",3,100],
    [3,"Venusaur","Grass","Poison",198,189,190,2.0,100.0,3,0.05,"quad_bulb",0,0],
    [4,"Charmander","Fire",null,116,93,118,0.6,8.5,45,0.20,"biped_tail_flame",5,25],
    [5,"Charmeleon","Fire",null,158,126,151,1.1,19.0,12,0.10,"biped_tail_flame",6,100],
    [6,"Charizard","Fire","Flying",223,173,186,1.7,90.5,3,0.05,"winged_dragon",0,0],
    [7,"Squirtle","Water",null,94,121,127,0.5,9.0,45,0.20,"shell_turtle",8,25],
    [8,"Wartortle","Water",null,126,155,153,1.0,22.5,12,0.10,"shell_turtle",9,100],
    [9,"Blastoise","Water",null,171,207,188,1.6,85.5,3,0.05,"shell_turtle",0,0],
    [10,"Caterpie","Bug",null,55,55,128,0.3,2.9,140,0.50,"bug_segmented",11,12],
    [11,"Metapod","Bug",null,45,80,137,0.7,9.9,40,0.25,"bug_segmented",12,50],
    [12,"Butterfree","Bug","Flying",167,137,155,1.1,32.0,10,0.12,"bird_winged",0,0],
    [13,"Weedle","Bug","Poison",63,50,120,0.3,3.2,140,0.50,"bug_segmented",14,12],
    [14,"Kakuna","Bug","Poison",46,75,128,0.6,10.0,40,0.25,"bug_segmented",15,50],
    [15,"Beedrill","Bug","Poison",169,130,163,1.0,29.5,10,0.12,"bird_winged",0,0],
    [16,"Pidgey","Normal","Flying",85,73,120,0.3,1.8,160,0.50,"bird_winged",17,12],
    [17,"Pidgeotto","Normal","Flying",117,105,160,1.1,30.0,35,0.20,"bird_winged",18,50],
    [18,"Pidgeot","Normal","Flying",166,154,195,1.5,39.5,8,0.10,"bird_winged",0,0],
    [19,"Rattata","Normal",null,103,70,102,0.3,3.5,155,0.50,"quad_feline",20,25],
    [20,"Raticate","Normal",null,161,139,146,0.7,18.5,28,0.20,"quad_feline",0,0],
    [21,"Spearow","Normal","Flying",112,60,120,0.3,2.0,115,0.40,"bird_winged",22,50],
    [22,"Fearow","Normal","Flying",182,133,163,1.2,38.0,18,0.15,"bird_winged",0,0],
    [23,"Ekans","Poison",null,110,97,111,2.0,6.9,90,0.40,"serpent_long",24,50],
    [24,"Arbok","Poison",null,167,153,155,3.5,65.0,15,0.15,"serpent_long",0,0],
    [25,"Pikachu","Electric",null,112,96,111,0.4,6.0,60,0.25,"biped_mouse_ears",26,50],
    [26,"Raichu","Electric",null,193,151,155,0.8,30.0,10,0.10,"biped_mouse_ears",0,0],
    [27,"Sandshrew","Ground",null,126,120,137,0.6,12.0,75,0.35,"biped_mouse_ears",28,50],
    [28,"Sandslash","Ground",null,182,175,181,1.0,29.5,14,0.15,"biped_mouse_ears",0,0],
    [29,"Nidoran-F","Poison",null,86,89,146,0.4,7.0,95,0.40,"quad_feline",30,25],
    [30,"Nidorina","Poison",null,117,120,172,0.8,20.0,22,0.20,"quad_feline",31,100],
    [31,"Nidoqueen","Poison","Ground",180,173,207,1.3,60.0,5,0.08,"humanoid_fighter",0,0],
    [32,"Nidoran-M","Poison",null,105,76,130,0.5,9.0,95,0.40,"quad_feline",33,25],
    [33,"Nidorino","Poison",null,137,111,156,0.9,19.5,22,0.20,"quad_feline",34,100],
    [34,"Nidoking","Poison","Ground",204,156,191,1.4,62.0,5,0.08,"humanoid_fighter",0,0],
    [35,"Clefairy","Fairy",null,107,108,172,0.6,7.5,55,0.25,"biped_mouse_ears",36,50],
    [36,"Clefable","Fairy",null,178,162,216,1.3,40.0,9,0.10,"biped_mouse_ears",0,0],
    [37,"Vulpix","Fire",null,96,109,116,0.6,9.9,60,0.30,"quad_feline",38,50],
    [38,"Ninetales","Fire",null,169,190,177,1.1,19.9,9,0.10,"quad_feline",0,0],
    [39,"Jigglypuff","Normal","Fairy",80,41,251,0.5,5.5,65,0.35,"ghost_orb",40,50],
    [40,"Wigglytuff","Normal","Fairy",156,90,295,1.0,12.0,12,0.15,"biped_mouse_ears",0,0],
    [41,"Zubat","Poison","Flying",83,73,120,0.8,7.5,135,0.45,"bird_winged",42,25],
    [42,"Golbat","Poison","Flying",161,150,181,1.6,55.0,25,0.20,"bird_winged",169,100],
    [43,"Oddish","Grass","Poison",131,112,128,0.5,5.4,95,0.45,"quad_bulb",44,25],
    [44,"Gloom","Grass","Poison",153,136,155,0.8,8.6,22,0.20,"quad_bulb",45,100],
    [45,"Vileplume","Grass","Poison",202,167,181,1.2,18.6,6,0.10,"quad_bulb",0,0],
    [46,"Paras","Bug","Grass",121,99,111,0.3,5.4,85,0.40,"bug_segmented",47,50],
    [47,"Parasect","Bug","Grass",165,146,155,1.0,29.5,15,0.18,"bug_segmented",0,0],
    [48,"Venonat","Bug","Poison",100,100,155,1.0,30.0,80,0.40,"ghost_orb",49,50],
    [49,"Venomoth","Bug","Poison",179,143,172,1.5,12.5,15,0.16,"bird_winged",0,0],
    [50,"Diglett","Ground",null,109,78,67,0.2,0.8,85,0.40,"ghost_orb",51,50],
    [51,"Dugtrio","Ground",null,167,134,111,0.7,33.3,14,0.15,"ghost_orb",0,0],
    [52,"Meowth","Normal",null,92,78,120,0.4,4.2,85,0.40,"quad_feline",53,50],
    [53,"Persian","Normal",null,150,136,163,1.0,32.0,15,0.15,"quad_feline",0,0],
    [54,"Psyduck","Water",null,122,95,137,0.8,19.6,80,0.40,"biped_mouse_ears",55,50],
    [55,"Golduck","Water",null,191,162,190,1.7,76.6,14,0.15,"humanoid_fighter",0,0],
    [56,"Mankey","Fighting",null,148,82,120,0.5,28.0,75,0.35,"humanoid_fighter",57,50],
    [57,"Primeape","Fighting",null,207,138,163,1.0,32.0,14,0.15,"humanoid_fighter",0,0],
    [58,"Growlithe","Fire",null,136,93,146,0.7,19.0,60,0.30,"quad_feline",59,50],
    [59,"Arcanine","Fire",null,227,166,207,1.9,155.0,6,0.08,"quad_feline",0,0],
    [60,"Poliwag","Water",null,101,82,120,0.6,12.4,90,0.40,"ghost_orb",61,25],
    [61,"Poliwhirl","Water",null,130,123,163,1.0,20.0,22,0.20,"humanoid_fighter",62,100],
    [62,"Poliwrath","Water","Fighting",182,184,207,1.3,54.0,6,0.10,"humanoid_fighter",0,0],
    [63,"Abra","Psychic",null,195,82,93,0.9,19.5,55,0.35,"humanoid_fighter",64,25],
    [64,"Kadabra","Psychic",null,232,117,120,1.3,56.5,14,0.16,"humanoid_fighter",65,100],
    [65,"Alakazam","Psychic",null,271,167,146,1.5,48.0,4,0.07,"humanoid_fighter",0,0],
    [66,"Machop","Fighting",null,137,82,172,0.8,19.5,75,0.35,"humanoid_fighter",67,25],
    [67,"Machoke","Fighting",null,177,125,190,1.5,70.5,16,0.18,"humanoid_fighter",68,100],
    [68,"Machamp","Fighting",null,234,159,207,1.6,130.0,4,0.07,"humanoid_fighter",0,0],
    [69,"Bellsprout","Grass","Poison",139,61,137,0.7,4.0,90,0.40,"quad_bulb",70,25],
    [70,"Weepinbell","Grass","Poison",172,92,163,1.0,6.4,22,0.20,"quad_bulb",71,100],
    [71,"Victreebel","Grass","Poison",207,135,190,1.7,15.5,6,0.10,"quad_bulb",0,0],
    [72,"Tentacool","Water","Poison",97,149,120,0.9,45.5,85,0.40,"aquatic_fin",73,50],
    [73,"Tentacruel","Water","Poison",166,209,190,1.6,55.0,14,0.15,"aquatic_fin",0,0],
    [74,"Geodude","Rock","Ground",132,132,120,0.4,20.0,95,0.40,"colossal_golem",75,25],
    [75,"Graveler","Rock","Ground",164,164,146,1.0,105.0,22,0.20,"colossal_golem",76,100],
    [76,"Golem","Rock","Ground",211,198,190,1.4,300.0,5,0.08,"colossal_golem",0,0],
    [77,"Ponyta","Fire",null,170,127,137,1.0,30.0,55,0.30,"quad_feline",78,50],
    [78,"Rapidash","Fire",null,207,162,163,1.7,95.0,10,0.12,"quad_feline",0,0],
    [79,"Slowpoke","Water","Psychic",109,98,207,1.2,36.0,70,0.35,"quad_feline",80,50],
    [80,"Slowbro","Water","Psychic",177,180,216,1.6,78.5,12,0.12,"shell_turtle",0,0],
    [81,"Magnemite","Electric","Steel",165,121,93,0.3,6.0,75,0.38,"ghost_orb",82,50],
    [82,"Magneton","Electric","Steel",223,169,137,1.0,60.0,14,0.15,"ghost_orb",0,0],
    [83,"Farfetchd","Normal","Flying",124,115,141,0.8,15.0,25,0.22,"bird_winged",0,0],
    [84,"Doduo","Normal","Flying",158,83,111,1.4,39.2,70,0.38,"bird_winged",85,50],
    [85,"Dodrio","Normal","Flying",218,140,155,1.8,85.2,14,0.15,"bird_winged",0,0],
    [86,"Seel","Water",null,85,121,163,1.1,90.0,65,0.35,"aquatic_fin",87,50],
    [87,"Dewgong","Water","Ice",139,177,207,1.7,120.0,12,0.14,"aquatic_fin",0,0],
    [88,"Grimer","Poison",null,135,90,190,0.9,30.0,60,0.35,"colossal_golem",89,50],
    [89,"Muk","Poison",null,190,172,233,1.2,30.0,10,0.12,"colossal_golem",0,0],
    [90,"Shellder","Water",null,116,134,102,0.3,4.0,75,0.38,"shell_turtle",91,50],
    [91,"Cloyster","Water","Ice",186,256,137,1.5,132.5,12,0.12,"shell_turtle",0,0],
    [92,"Gastly","Ghost","Poison",186,67,102,1.3,0.1,70,0.32,"ghost_orb",93,25],
    [93,"Haunter","Ghost","Poison",223,107,128,1.6,0.1,18,0.16,"ghost_orb",94,100],
    [94,"Gengar","Ghost","Poison",261,149,155,1.5,40.5,4,0.07,"humanoid_fighter",0,0],
    [95,"Onix","Rock","Ground",85,232,111,8.8,210.0,22,0.18,"serpent_long",208,50],
    [96,"Drowzee","Psychic",null,89,136,155,1.0,32.4,75,0.38,"humanoid_fighter",97,50],
    [97,"Hypno","Psychic",null,144,193,198,1.6,75.6,14,0.15,"humanoid_fighter",0,0],
    [98,"Krabby","Water",null,181,124,102,0.4,6.5,85,0.40,"bug_segmented",99,50],
    [99,"Kingler","Water",null,240,181,146,1.3,60.0,15,0.15,"bug_segmented",0,0],
    [100,"Voltorb","Electric",null,109,111,120,0.5,10.4,80,0.40,"ghost_orb",101,50],
    [101,"Electrode","Electric",null,173,173,155,1.2,66.6,15,0.16,"ghost_orb",0,0],
    [102,"Exeggcute","Grass","Psychic",107,125,155,0.4,2.5,70,0.35,"ghost_orb",103,50],
    [103,"Exeggutor","Grass","Psychic",233,149,216,2.0,120.0,10,0.12,"quad_bulb",0,0],
    [104,"Cubone","Ground",null,90,144,137,0.4,6.5,60,0.32,"biped_tail_flame",105,50],
    [105,"Marowak","Ground",null,144,186,155,1.0,45.0,12,0.14,"biped_tail_flame",0,0],
    [106,"Hitmonlee","Fighting",null,224,181,137,1.5,49.8,10,0.14,"humanoid_fighter",0,0],
    [107,"Hitmonchan","Fighting",null,193,197,137,1.4,50.2,10,0.14,"humanoid_fighter",0,0],
    [108,"Lickitung","Normal",null,108,137,207,1.2,65.5,25,0.20,"biped_tail_flame",0,0],
    [109,"Koffing","Poison",null,119,141,120,0.6,1.0,70,0.38,"ghost_orb",110,50],
    [110,"Weezing","Poison",null,174,197,163,1.2,9.5,14,0.15,"ghost_orb",0,0],
    [111,"Rhyhorn","Ground","Rock",140,127,190,1.0,115.0,55,0.30,"colossal_golem",112,50],
    [112,"Rhydon","Ground","Rock",222,171,233,1.9,120.0,10,0.10,"colossal_golem",0,0],
    [113,"Chansey","Normal",null,60,128,487,1.1,34.6,6,0.12,"biped_mouse_ears",0,0],
    [114,"Tangela","Grass",null,183,169,163,1.0,35.0,35,0.25,"ghost_orb",0,0],
    [115,"Kangaskhan","Normal",null,181,165,233,2.2,80.0,12,0.14,"humanoid_fighter",0,0],
    [116,"Horsea","Water",null,129,125,102,0.4,8.0,75,0.38,"aquatic_fin",117,50],
    [117,"Seadra","Water",null,187,156,146,1.2,25.0,15,0.16,"aquatic_fin",230,100],
    [118,"Goldeen","Water",null,123,110,128,0.6,15.0,80,0.40,"aquatic_fin",119,50],
    [119,"Seaking","Water",null,175,147,190,1.3,39.0,16,0.16,"aquatic_fin",0,0],
    [120,"Staryu","Water",null,137,112,102,0.8,34.5,75,0.38,"ghost_orb",121,50],
    [121,"Starmie","Water","Psychic",210,184,155,1.1,80.0,12,0.14,"ghost_orb",0,0],
    [122,"Mr. Mime","Psychic","Fairy",192,205,120,1.3,54.5,15,0.18,"humanoid_fighter",0,0],
    [123,"Scyther","Bug","Flying",218,170,172,1.5,56.0,14,0.14,"winged_dragon",212,50],
    [124,"Jynx","Ice","Psychic",223,151,163,1.4,40.6,16,0.16,"humanoid_fighter",0,0],
    [125,"Electabuzz","Electric",null,198,158,163,1.1,30.0,16,0.16,"humanoid_fighter",0,0],
    [126,"Magmar","Fire",null,206,154,163,1.3,44.5,16,0.16,"humanoid_fighter",0,0],
    [127,"Pinsir","Bug",null,238,182,163,1.5,55.0,16,0.16,"bug_segmented",0,0],
    [128,"Tauros","Normal",null,198,183,181,1.4,88.4,20,0.18,"quad_feline",0,0],
    [129,"Magikarp","Water",null,29,85,85,0.9,10.0,130,0.55,"aquatic_fin",130,400],
    [130,"Gyarados","Water","Flying",237,186,216,6.5,235.0,2,0.06,"serpent_long",0,0],
    [131,"Lapras","Water","Ice",165,174,277,2.5,220.0,4,0.08,"aquatic_fin",0,0],
    [132,"Ditto","Normal",null,91,91,134,0.3,4.0,18,0.18,"ghost_orb",0,0],
    [133,"Eevee","Normal",null,104,114,146,0.3,6.5,65,0.32,"quad_feline",134,25],
    [134,"Vaporeon","Water",null,205,161,277,1.0,29.0,7,0.10,"quad_feline",0,0],
    [135,"Jolteon","Electric",null,232,182,163,0.8,24.5,7,0.10,"quad_feline",0,0],
    [136,"Flareon","Fire",null,246,179,163,0.9,25.0,7,0.10,"quad_feline",0,0],
    [137,"Porygon","Normal",null,153,136,163,0.8,36.5,14,0.18,"ghost_orb",0,0],
    [138,"Omanyte","Rock","Water",155,153,111,0.4,7.5,25,0.22,"shell_turtle",139,50],
    [139,"Omastar","Rock","Water",207,201,172,1.0,35.0,6,0.10,"shell_turtle",0,0],
    [140,"Kabuto","Rock","Water",148,140,102,0.5,11.5,25,0.22,"shell_turtle",141,50],
    [141,"Kabutops","Rock","Water",220,186,155,1.3,40.5,6,0.10,"humanoid_fighter",0,0],
    [142,"Aerodactyl","Rock","Flying",221,159,190,1.8,59.0,5,0.09,"winged_dragon",0,0],
    [143,"Snorlax","Normal",null,190,169,330,2.1,460.0,4,0.08,"colossal_golem",0,0],
    [144,"Articuno","Ice","Flying",192,236,207,1.7,55.4,1,0.03,"bird_winged",0,0],
    [145,"Zapdos","Electric","Flying",253,185,207,1.6,52.6,1,0.03,"bird_winged",0,0],
    [146,"Moltres","Fire","Flying",251,181,207,2.0,60.0,1,0.03,"bird_winged",0,0],
    [147,"Dratini","Dragon",null,119,91,121,1.8,3.3,18,0.20,"serpent_long",148,25],
    [148,"Dragonair","Dragon",null,163,135,156,4.0,16.5,5,0.09,"serpent_long",149,100],
    [149,"Dragonite","Dragon","Flying",263,198,209,2.2,210.0,2,0.05,"winged_dragon",0,0],
    [150,"Mewtwo","Psychic",null,300,182,214,2.0,122.0,1,0.03,"humanoid_fighter",0,0],
    [151,"Mew","Psychic",null,210,210,225,0.4,4.0,1,0.04,"biped_mouse_ears",0,0],
    // Ícones das Gerações 2 a 9 também pré-carregados offline
    [169,"Crobat","Poison","Flying",194,178,198,1.8,75.0,5,0.08,"bird_winged",0,0],
    [196,"Espeon","Psychic",null,261,175,163,0.9,26.5,6,0.10,"quad_feline",0,0],
    [197,"Umbreon","Dark",null,126,240,216,1.0,27.0,6,0.10,"quad_feline",0,0],
    [208,"Steelix","Steel","Ground",148,272,181,9.2,400.0,3,0.06,"serpent_long",0,0],
    [212,"Scizor","Bug","Steel",236,181,172,1.8,118.0,4,0.07,"winged_dragon",0,0],
    [230,"Kingdra","Water","Dragon",194,194,181,1.8,152.0,4,0.07,"aquatic_fin",0,0],
    [248,"Tyranitar","Rock","Dark",251,207,225,2.0,202.0,2,0.05,"colossal_golem",0,0],
    [249,"Lugia","Psychic","Flying",193,310,235,5.2,216.0,1,0.03,"winged_dragon",0,0],
    [250,"Ho-Oh","Fire","Flying",239,244,214,3.8,199.0,1,0.03,"bird_winged",0,0],
    [282,"Gardevoir","Psychic","Fairy",237,195,169,1.6,48.4,4,0.08,"humanoid_fighter",0,0],
    [384,"Rayquaza","Dragon","Flying",284,170,213,7.0,206.5,1,0.03,"serpent_long",0,0],
    [445,"Garchomp","Dragon","Ground",261,193,239,1.9,95.0,2,0.05,"winged_dragon",0,0],
    [448,"Lucario","Fighting","Steel",236,144,172,1.2,54.0,5,0.08,"humanoid_fighter",0,0],
    [658,"Greninja","Water","Dark",223,152,176,1.5,40.0,4,0.07,"humanoid_fighter",0,0],
    [700,"Sylveon","Fairy",null,203,205,216,1.0,23.5,6,0.10,"quad_feline",0,0],
    [887,"Dragapult","Dragon","Ghost",266,170,204,3.0,50.0,2,0.05,"winged_dragon",0,0],
    [1000,"Gholdengo","Steel","Ghost",252,190,202,1.2,30.0,2,0.05,"humanoid_fighter",0,0]
  ];

  const SPECIES_BY_ID = new Map();
  const ALL_TYPES = Object.keys(TYPE_COLORS);
  const ALL_ARCHETYPES = [
    "quad_bulb", "biped_tail_flame", "biped_mouse_ears", "winged_dragon",
    "serpent_long", "bird_winged", "bug_segmented", "shell_turtle",
    "ghost_orb", "humanoid_fighter", "quad_feline", "aquatic_fin", "colossal_golem"
  ];

  function defaultMovesForTypes(t1, t2) {
    const fastByType = {
      Electric: "ThunderShock", Fire: "Ember", Grass: "VineWhip", Water: "WaterGun",
      Ghost: "Lick", Psychic: "Confusion", Dragon: "DragonBreath", Flying: "WingAttack",
      Bug: "BugBite", Rock: "RockThrow", Fighting: "KarateChop", Poison: "PoisonJab",
      Ground: "MudShot", Ice: "FrostBreath", Steel: "BulletPunch", Dark: "Bite", Fairy: "Charm"
    };
    const chargedByType = {
      Electric: "Thunderbolt", Fire: "Flamethrower", Grass: "PowerWhip", Water: "HydroPump",
      Ghost: "ShadowBall", Psychic: "Psystrike", Dragon: "Outrage", Flying: "Hurricane",
      Bug: "XScissor", Rock: "RockSlide", Fighting: "CloseCombat", Poison: "SludgeBomb",
      Ground: "Earthquake", Ice: "IceBeam", Steel: "FlashCannon", Dark: "DarkPulse", Fairy: "DazzlingGleam"
    };
    return {
      fastMove: fastByType[t1] || fastByType[t2] || "QuickAttack",
      chargedMove: chargedByType[t1] || chargedByType[t2] || "BodySlam"
    };
  }

  for (const [k, it] of Object.entries(ITEMS_CATALOG)) {
    it.type = it.cat;
    it.price = it.cat === "ball" ? (k === "master_ball" ? 250 : 25) : (it.cat === "berry" ? 20 : 60);
  }

  for (const r of RAW_SPECIES) {
    const types = r[3] ? [r[2], r[3]] : [r[2]];
    const mv = defaultMovesForTypes(r[2], r[3]);
    SPECIES_BY_ID.set(r[0], {
      id: r[0],
      name: r[1],
      types,
      baseAtk: r[4],
      baseDef: r[5],
      baseSta: r[6],
      height_m: r[7],
      weight_kg: r[8],
      spawnWeight: r[9],
      baseCatchRate: r[10],
      archetype: r[11],
      evolvesTo: r[12] || 0,
      candyCost: r[13] || 25,
      evoCandyCost: r[13] || 25,
      fastMove: mv.fastMove,
      chargedMove: mv.chargedMove,
      fastMoves: [mv.fastMove],
      chargedMoves: [mv.chargedMove]
    });
  }

  // Preenche deterministicamente todos os IDs de 1 até 1025 (Gen 1..9) e permite enriquecimento via PokéAPI
  for (let id = 1; id <= 1025; ++id) {
    if (SPECIES_BY_ID.has(id)) continue;
    const h = (id * 2654435761) >>> 0;
    const t1 = ALL_TYPES[h % ALL_TYPES.length];
    const t2 = (h & 3) === 0 ? ALL_TYPES[(h >> 5) % ALL_TYPES.length] : null;
    const types = (t2 && t2 !== t1) ? [t1, t2] : [t1];
    const arch = ALL_ARCHETYPES[(h >> 8) % ALL_ARCHETYPES.length];
    const isRare = (id % 25 === 0);
    const mv = defaultMovesForTypes(t1, t2);
    const cCost = (id % 3 === 1) ? 25 : 100;
    SPECIES_BY_ID.set(id, {
      id,
      name: `Pokemon #${id}`,
      types,
      baseAtk: 105 + (h % 145),
      baseDef: 95 + ((h >> 4) % 140),
      baseSta: 110 + ((h >> 9) % 150),
      height_m: Number((0.4 + ((h % 24) * 0.12)).toFixed(1)),
      weight_kg: Number((4.0 + ((h % 95) * 1.4)).toFixed(1)),
      spawnWeight: isRare ? 3 : (12 + (h % 55)),
      baseCatchRate: isRare ? 0.08 : 0.25,
      archetype: arch,
      evolvesTo: (id < 1020 && (id % 3 !== 0)) ? (id + 1) : 0,
      candyCost: cCost,
      evoCandyCost: cCost,
      fastMove: mv.fastMove,
      chargedMove: mv.chargedMove,
      fastMoves: [mv.fastMove],
      chargedMoves: [mv.chargedMove],
      needsWikiSync: true
    });
  }

  // Sincronizador assíncrono em background com a PokéAPI Open-Source (https://pokeapi.co/api/v2/pokemon/{id})
  async function syncSpeciesFromPokeAPI(id) {
    const sp = SPECIES_BY_ID.get(id);
    if (!sp || !sp.needsWikiSync) return sp;
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!res.ok) return sp;
      const data = await res.json();
      sp.name = data.name.charAt(0).toUpperCase() + data.name.slice(1);
      if (data.height) sp.height_m = Number((data.height / 10).toFixed(1));
      if (data.weight) sp.weight_kg = Number((data.weight / 10).toFixed(1));
      if (data.types && data.types.length > 0) {
        sp.types = data.types.map(t => {
          const n = t.type.name;
          return n.charAt(0).toUpperCase() + n.slice(1);
        }).filter(t => TYPE_COLORS[t]);
        if (sp.types.length === 0) sp.types = ["Normal"];
      }
      sp.needsWikiSync = false;
    } catch (_) {
      // Sem internet: mantém dados determinísticos offline sem erro
    }
    return sp;
  }

  function getSpecies(id) {
    return SPECIES_BY_ID.get(id) || SPECIES_BY_ID.get(25);
  }

  // Multiplicador de CP (CPM) por Nível (1 a 51) estilo Pokémon GO
  function getCpmForLevel(level) {
    const clamped = Math.max(1, Math.min(51, level));
    return 0.094 + 0.706 * Math.sqrt((clamped - 1) / 50);
  }

  // Fórmula Oficial de CP do Pokémon GO: CP = floor(max(10, (Atk * sqrt(Def) * sqrt(Sta) * CPM^2) / 10))
  function calculateCP(speciesId, level, ivAtk, ivDef, ivSta) {
    const sp = getSpecies(speciesId);
    const cpm = getCpmForLevel(level);
    const atk = sp.baseAtk + ivAtk;
    const def = sp.baseDef + ivDef;
    const sta = sp.baseSta + ivSta;
    return Math.max(10, Math.floor((atk * Math.sqrt(def) * Math.sqrt(sta) * cpm * cpm) / 10));
  }

  function calculateMaxHP(speciesId, level, ivSta) {
    const sp = getSpecies(speciesId);
    const cpm = getCpmForLevel(level);
    return Math.max(15, Math.floor((sp.baseSta + ivSta) * cpm));
  }

  // Avaliação de Estrelas de IV (0★, 1★, 2★, 3★, 4★ HUNDO 100%)
  function evaluateIvStars(ivAtk, ivDef, ivSta) {
    const sum = ivAtk + ivDef + ivSta;
    const pct = Math.round((sum / 45) * 100);
    let stars = 0;
    if (sum === 45) stars = 4;
    else if (sum >= 37) stars = 3;
    else if (sum >= 30) stars = 2;
    else if (sum >= 23) stars = 1;
    return { sum, pct, stars, label: stars === 4 ? "4★ (100% HUNDO!)" : `${stars}★ (${pct}%)` };
  }

  // Medalhas de Maestria por Tipo (Ideia C: Bronze 5, Prata 20, Ouro 50, Platina 100)
  function getTypeMedalInfo(profile, typeName) {
    const counts = (profile && profile.typeCounts) ? profile.typeCounts : {};
    const count = counts[typeName] || 0;
    let tier = "Nenhuma", catchBonus = 1.0, rareWeightMult = 1.0, icon = "[ - ]";
    if (count >= 100) { tier = "Platina"; catchBonus = 1.25; rareWeightMult = 1.65; icon = "[PLAT]"; }
    else if (count >= 50) { tier = "Ouro"; catchBonus = 1.18; rareWeightMult = 1.40; icon = "[OURO]"; }
    else if (count >= 20) { tier = "Prata"; catchBonus = 1.12; rareWeightMult = 1.22; icon = "[PRATA]"; }
    else if (count >= 5)  { tier = "Bronze"; catchBonus = 1.06; rareWeightMult = 1.10; icon = "[BRONZE]"; }
    return { typeName, count, tier, catchBonus, rareWeightMult, icon };
  }

  // Calcula o Bônus Progressivo de Spawn Raro (Nível + Prestígio + Pokédex + Caminhada + Combo + Ímã do Parceiro + Medalhas)
  function computeProgressiveRareBoost(balanceCfg, profile) {
    const baseAdmin = (balanceCfg && balanceCfg.rareSpawnMultiplier) ? balanceCfg.rareSpawnMultiplier : 1.0;
    if (!profile) return { totalMult: baseAdmin, ivBonusFloor: 0, shinyMult: 1.0, buddyTypes: [] };

    // 1. Bônus por Nível do Treinador (até +75% no Nv.50) + Prestígio Infinito (+5% por Rank, c/ soft-cap)
    const lvlBonus = Math.min(0.75, ((profile.level || 1) - 1) * 0.015);
    const prestigeBonus = Math.min(1.25, (profile.prestigeRank || 0) * 0.05);

    // 2. Bônus de Explorador por Distância Caminhada (até +60% ao caminhar 2.000m+)
    const walkBonus = Math.min(0.60, ((profile.distanceWalkedM || 0) / 2000) * 0.60);

    // 3. Bônus de Maestria da Pokédex (Amuleto Raro/Shiny ao registrar mais espécies únicas)
    const dexCount = profile.pokedexCaught ? Object.keys(profile.pokedexCaught).length : 1;
    const dexBonus = Math.min(0.80, (dexCount / 151) * 0.50);

    // 4. Bônus de Combo / Streak de Capturas e Curveballs
    const curveCount = (profile.stats && profile.stats.curveballsLanded) ? profile.stats.curveballsLanded : 0;
    const streakBonus = Math.min(0.75, (curveCount % 25) * 0.03);

    // 5. Ideia A: Ímã Elemental do Parceiro (Buddy Type Resonance +45% p/ Pokémons do mesmo tipo do Parceiro!)
    let buddyTypes = [];
    if (profile.pokemonBox && profile.pokemonBox.length > 0) {
      const buddy = profile.pokemonBox.find(p => p.uid === profile.buddyUid) || profile.pokemonBox[0];
      if (buddy) {
        const bSp = getSpecies(buddy.speciesId);
        buddyTypes = bSp.types || [];
      }
    }

    // Limite máximo (Hard Cap = 4.5x) para nunca quebrar a raridade do jogo
    const totalMult = Math.min(4.5, baseAdmin * (1.0 + lvlBonus + prestigeBonus + walkBonus + dexBonus + streakBonus));
    const ivBonusFloor = Math.min(9, Math.floor((lvlBonus + dexBonus + streakBonus) * 4));
    const shinyMult = Math.min(4.5, 1.0 + dexBonus * 1.5 + streakBonus);

    return { totalMult, ivBonusFloor, shinyMult, buddyTypes };
  }

  // Ideia B: Sorteia uma Anomalia Dimensional Ultra-Rara quando o Scanner de Anomalia chega a 100%!
  function rollAnomalyUltraRareSpawn(balanceCfg, playerLevel = 10) {
    const ultraRarePool = [3, 6, 9, 59, 65, 68, 94, 130, 131, 142, 143, 144, 145, 146, 149, 150, 151, 248, 249, 250, 282, 384, 445, 448, 658, 887, 1000];
    const chosenId = ultraRarePool[Math.floor(Math.random() * ultraRarePool.length)];
    const chosen = getSpecies(chosenId);
    const ivAtk = 12 + Math.floor(Math.random() * 4);
    const ivDef = 12 + Math.floor(Math.random() * 4);
    const ivSta = 12 + Math.floor(Math.random() * 4);
    const level = Math.min(40, Math.max(15, playerLevel + 5));
    const isShiny = Math.random() < 0.12; // 12% chance de Shiny em Anomalias!
    const cp = calculateCP(chosen.id, level, ivAtk, ivDef, ivSta);
    const maxHp = calculateMaxHP(chosen.id, level, ivSta);
    return {
      uid: "pk_anom_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
      speciesId: chosen.id,
      name: chosen.name,
      level, ivAtk, ivDef, ivSta, cp, hp: maxHp, maxHp, isShiny,
      isAnomaly: true,
      fastMove: chosen.fastMove,
      chargedMove: chosen.chargedMove,
      caughtAt: Date.now()
    };
  }

  // Sorteia um Pokémon selvagem respeitando os pesos de aparecimento (Qualquer Pokémon pode aparecer em qualquer área!)
  function rollWeightedSpawn(balanceCfg, playerLevel = 1) {
    const maxDex = (balanceCfg && balanceCfg.activeDexLimit) ? balanceCfg.activeDexLimit : 151;
    const profile = window.PokeStorage ? window.PokeStorage.getProfile() : { level: playerLevel };
    const prog = computeProgressiveRareBoost(balanceCfg, profile);
    const rareBoost = prog.totalMult;

    function effectiveWeight(sp) {
      let w = sp.spawnWeight < 15 ? sp.spawnWeight * rareBoost : sp.spawnWeight;
      // Ideia A: Ímã Elemental do Parceiro (+45% se compartilha tipo com o Parceiro!)
      if (prog.buddyTypes.length > 0 && sp.types.some(t => prog.buddyTypes.includes(t))) {
        w *= 1.45;
      }
      // Ideia C: Medalha de Tipo aumenta peso de espécies raras daquele tipo
      const medal = getTypeMedalInfo(profile, sp.types[0]);
      if (sp.spawnWeight < 25) {
        w *= medal.rareWeightMult;
      }
      // Clima real do local (weather.js): tipos favorecidos pelo tempo aparecem mais (x1.8)
      if (window.PokeWeather) {
        w *= window.PokeWeather.spawnMult(sp.types);
      }
      return w;
    }

    let totalWeight = 0;
    for (let id = 1; id <= maxDex; ++id) {
      const sp = getSpecies(id);
      totalWeight += effectiveWeight(sp);
    }

    let r = Math.random() * totalWeight;
    let chosen = getSpecies(25);
    for (let id = 1; id <= maxDex; ++id) {
      const sp = getSpecies(id);
      r -= effectiveWeight(sp);
      if (r <= 0) {
        chosen = sp;
        break;
      }
    }

    if (chosen.needsWikiSync) {
      syncSpeciesFromPokeAPI(chosen.id);
    }

    const baseIvFloor = (balanceCfg && balanceCfg.wildIvFloor) ? balanceCfg.wildIvFloor : 0;
    const ivFloor = Math.min(14, Math.max(baseIvFloor, prog.ivBonusFloor));
    const ivRange = Math.max(1, 16 - ivFloor);
    const ivAtk = ivFloor + Math.floor(Math.random() * ivRange);
    const ivDef = ivFloor + Math.floor(Math.random() * ivRange);
    const ivSta = ivFloor + Math.floor(Math.random() * ivRange);

    const maxWildLvl = Math.min(35, Math.max(5, playerLevel + 3));
    const level = 1 + Math.floor(Math.random() * maxWildLvl);
    const baseShinyRate = (balanceCfg && balanceCfg.shinyProbability) ? balanceCfg.shinyProbability : (1 / 256);
    const isShiny = Math.random() < (baseShinyRate * prog.shinyMult);

    const cp = calculateCP(chosen.id, level, ivAtk, ivDef, ivSta);
    const maxHp = calculateMaxHP(chosen.id, level, ivSta);

    return {
      uid: "pk_" + Date.now() + "_" + Math.floor(Math.random() * 99999),
      speciesId: chosen.id,
      name: chosen.name,
      level,
      ivAtk,
      ivDef,
      ivSta,
      ivPercent: Math.round(((ivAtk + ivDef + ivSta) / 45) * 100),
      scaleVariation: 0.92 + Math.random() * 0.18,
      cp,
      hp: maxHp,
      maxHp,
      isShiny,
      fastMove: chosen.fastMove,
      chargedMove: chosen.chargedMove,
      caughtAt: Date.now()
    };
  }

  return {
    TYPE_COLORS,
    FAST_MOVES,
    CHARGED_MOVES,
    ITEMS_CATALOG,
    ITEMS: ITEMS_CATALOG,
    SPECIES_BY_ID,
    getSpecies,
    syncSpeciesFromPokeAPI,
    getTypeEffectiveness,
    calculateCP,
    calculateMaxHP,
    evaluateIvStars,
    getTypeMedalInfo,
    computeProgressiveRareBoost,
    calculateRareProgressMultiplier: (profile, balanceCfg) => computeProgressiveRareBoost(balanceCfg, profile).totalMult,
    rollAnomalyUltraRareSpawn,
    rollWeightedSpawn
  };
})();
