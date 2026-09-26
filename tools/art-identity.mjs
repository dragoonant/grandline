// tools/art-identity.mjs — ONE visual clause per character, written once.
//
// A character appears on several cards; describing them once here and varying only the
// environment is what makes 147 renders read as one set. Project 5 proved this: without an
// identity table the same character came back as a different person on every card.
//
// THREE CONSTANTS, and they do not move under any decision (PLAN.md D3):
//   1. no text is ever rendered in an image
//   2. no specific official illustration is reproduced — these are original descriptions of a
//      visual identity, written from scratch
//   3. no real artist, studio or franchise is ever named in a prompt
//
// Anything not in this table gets a clause derived from its own card data, which is honest
// about what it is: a pirate-world figure of a given role and element.
export const IDENTITY = {
  'Monkey.D.Luffy': 'a wiry young pirate captain in an open red vest, a battered straw hat slung on his back, bare feet planted wide, grinning into the wind',
  'Roronoa Zoro': 'a broad-shouldered swordsman in a dark green coat, a bundle of sheathed katana at his hip, one eye scarred shut, standing perfectly still',
  'Sanji': 'a lean blond cook in a sharp black suit, one leg raised mid-kick, a curl of cigarette smoke crossing his face',
  'Nami': 'a red-haired navigator in a cropped orange top, a sectioned blue staff across her shoulders, charts fluttering at her belt',
  'Usopp': 'a long-nosed marksman in goggles and overalls, a slingshot drawn taut, one eye squeezed shut in aim',
  'Nico Robin': 'a tall dark-haired archaeologist in a long violet coat, arms crossed, extra arms blossoming out of the stone around her',
  'Tony Tony.Chopper': 'a small blue-nosed reindeer in a pink brimmed hat and red shorts, hooves braced, far too brave for his size',
  'Franky': 'a hulking cyborg shipwright with blue hair and metal forearms, an open shirt, steam venting from his shoulders',
  'Brook': 'a towering skeleton in a tailcoat and top hat, a slender cane-sword drawn, an enormous afro',
  'Jinbe': 'a massive blue whale-shark fish-man in an open patterned kimono, arms folded, calm as deep water',
  'Nefeltari Vivi': 'a blue-haired desert princess in flowing white, twin ringed blades spinning at her wrists',
  'Karoo': 'a tall flightless duck in a sailor collar, chest out, absurdly earnest',
  'Portgas.D.Ace': 'a freckled young man in an open shirt and a wide orange hat, fire curling off his shoulders',
  'Edward.Newgate': 'an immense white-moustached old giant of a man, bare-chested and scarred, a colossal bladed polearm planted in the deck',
  'Marco': 'a sleepy-eyed blond man in an open purple coat, blue and gold flame unfurling behind him like wings',
  'Shanks': 'a red-haired captain in a dark cloak over one shoulder, one sleeve empty, parallel scars raking his left eye',
  'Dracule Mihawk': 'a gaunt swordsman in a wide plumed hat and a long black coat, a cross-hilted greatsword taller than he is, golden hawk eyes',
  'Trafalgar Law': 'a tattooed surgeon in a spotted fur hat and long coat, a nodachi resting on his shoulder, shadowed eyes',
  'Eustass"Captain"Kid': 'a red-haired brawler with a scavenged metal arm, goggles pushed up, scrap iron rising around him',
  'Killer': 'a silent figure in a full featureless helmet, long blond hair, two enormous spinning scythe-blades',
  'Jewelry Bonney': 'a pink-haired young captain in a flat cap and jacket, sprawled over a barrel mid-meal, entirely unbothered',
  'Basil Hawkins': 'a pale soothsayer with long blond hair and hollow eyes, straw effigies hanging from his sleeves',
  'Scratchmen Apoo': 'a long-armed musician with a wide grin and horn-shaped hair, his own body played like an instrument',
  'Urouge': 'a huge grinning monk with a curled top-knot, scarred arms, an enormous mace across his back',
  'Capone"Gang"Bege': 'a squat pinstriped gangster with a cigar and a fortress silhouette rising behind him',
  'X.Drake': 'a scarred officer in a feathered captain hat and long coat, a battle-axe in hand, dinosaur bone-plates surfacing along his arm',
  'Bepo': 'a polite white bear in an orange jumpsuit, standing upright, apologising',
  'Heat': 'a lanky crewman with slicked hair and a high collar, blue flame at his lips',
  'Vito': 'a young gangster in a chalk-stripe suit and round glasses, twin pistols crossed',
  'Koby': 'an earnest pink-haired young officer in a white coat, fists clenched, sea wind at his back',
  'Tashigi': 'a dark-haired officer in glasses and a naval coat, katana half-drawn, jaw set',
  'Sengoku': 'a silver-bearded commander in a naval cap and long coat, arms folded, gulls circling',
  'Jaguar.D.Saul': 'a colossal bearded giant in a torn coat, laughing with his whole chest, an island-sized shadow',
  'Sentomaru': 'a squat axe-wielding officer in a shoulder-plated coat, hair in a stiff topknot',
  'Donquixote Rosinante': 'a very tall clown-faced man in a black feathered coat, a cigarette burning a hole in his lapel, silence pooling around him',
  'Kaido': 'a vast horned man with a wild mane and a spiked club, storm-scales along his arms, lightning in the clouds behind',
  'King': 'a winged figure in a full flame-slit mask and dark coat, black wings spread, fire trailing',
  'Queen': 'a grinning bald brute in a purple coat, mechanical legs, far too pleased with himself',
  'Yamato': 'a tall white-haired warrior with horns and a heavy studded club, a rope belt over bare shoulders',
  'Kouzuki Oden': 'a broad bare-chested lord with a flame-patterned haori and two katana, hair tied back, feet planted',
  "Kin'emon": 'a topknotted samurai in a fox-patterned kimono, blade drawn, fire licking along the steel',
  'Kikunojo': 'a tall elegant samurai in a pale kimono, a single long blade held low, snow drifting',
  'Kawamatsu': 'a huge kappa fish-man samurai with a dished head and a fanged grin, a battered sword across his back',
  'Kouzuki Momonosuke': 'a small boy in an oversized lord’s kimono, trying very hard to look tall',
  'Kouzuki Hiyori': 'a poised young woman in an ornate kimono, a shamisen resting against her knee',
  'Otama': 'a small girl in a patched kimono with a tail-like topknot, a dumpling in each hand',
  'Otsuru': 'an elderly innkeeper in a plain kimono, sleeves tied back, steam from a teahouse behind her',
  'Tenguyama Hitetsu': 'a tiny old swordsmith in a long-nosed mask, hammer in hand, a forge glowing red',
  'Shimotsuki Ushimaru': 'a stern old lord in dark armour and a topknot, a single blade planted point-down',
  'Perona': 'a pink-haired girl in a gothic dress with a parasol, small ghosts drifting around her',
  'Arlong': 'a saw-nosed shark fish-man with a jagged grin, a serrated blade over his shoulder',
  'Sabo': 'a blond young man in a long dark coat and top hat, a lead pipe in one hand, claws of fire on the other',
  'Rocks.D.Xebec': 'a broad old sea captain in a long dark coat, wild hair, a curved blade held loose, an ugly calm about him',
  'Gloriosa': 'an ancient tiny woman with an enormous hair knot, a walking stick, absolutely unafraid',
  'Marguerite': 'a blonde archer in a feathered green outfit, bow drawn, jungle light behind her',
  'Sweetpea': 'a heavyset warrior woman in patterned wrappings, a club across her shoulders',
  'Rebecca': 'a pink-haired gladiator in a plated outfit and a battered helm, a shield raised',
  'Viola': 'a dark-haired dancer in a long dress, one eye glowing violet, arms in a slow sweep',
  'Uta': 'a singer with white and red hair in a bright stage coat, one hand raised, ribbons of sound spiralling out',
  'Charlotte Smoothie': 'an immensely tall woman in a sleeveless gown, a wine glass in one hand, a heavy blade in the other',
  'Charlotte Oven': 'a scowling giant of a man with a squared jaw, hands glowing furnace-red',
  'Charlotte Daifuku': 'a bearded man in patterned robes, a huge smoke-genie rising from his own shoulders',
  'Charlotte Brulee': 'a thin sharp-faced woman with a wide slit smile, stepping half out of a tall mirror',
  'Charlotte Galette': 'a woman in a ruffled butter-yellow gown, one hand turning the ground to slick gold',
  'Charlotte Poire': 'a small solemn girl in a layered pastry-frilled dress',
  'Charlotte Anana': 'a young woman with a stiff pineapple-shaped hairstyle and an unimpressed stare',
  'Streusen': 'a wiry old chef in a tall hat and a long coat, an enormous knife over one shoulder',
  'Bobbin the Disposer': 'a hunched figure in a patchwork coat and hood, a curved blade held low',
  'Rabiyan': 'a living flying carpet with tassel-fringed eyes, curling in the wind',
  'Enel': 'a serene man with enormous earlobes in a white shroud, a golden staff, lightning crawling over his skin',
  'Pica': 'a colossal stone man rising out of the ground, a stern carved face, arms of rubble',
  'Diamante': 'a flamboyant swordsman in a plumed hat and a coat of banners, a rippling blade',
  'Baby 5': 'a dark-haired woman in a tight uniform, one arm already changing into a weapon, eyes full of tears',
  'Bellamy': 'a grinning blond brawler with springs coiled in his legs, bouncing forward',
  'Buffalo': 'a round man with a spinning propeller topknot and a striped coat',
  'Machvise': 'an enormous armoured man dropping from the sky, arms crossed',
  'Giolla': 'an eccentric artist in a voluminous gown, a palette knife raised, the air behind her warping into paint',
  'Monet': 'a green-haired woman with feathered wings and harpy legs, snow gathering on her shoulders',
  'Black Maria': 'a towering woman in an elaborate robe, spider silk trailing from her sleeves',
  'Ginrummy': 'a sharp-faced woman in a fur collar, a long cigarette holder, cold eyes',
  'Speed': 'a woman in a horned helm, the lower half of a horse, hooves striking sparks',
  'Dobon': 'a squat armoured brute with a hippo-jawed helm',
  'Sheepshead': 'a horned brute with ram-curled horns and bladed arms',
  "Who's.Who": 'a masked figure in a striped coat with feline teeth, twin blades crossed',
  'Porche': 'a bright-eyed performer in a ruffled costume, mid-pirouette',
  'Vergo': 'a bamboo-armoured officer with round sunglasses and a stiff collar, stance low',
  'Jango': 'a lanky hypnotist in a striped shirt and shades, swinging a pendulum ring',
  'Komille': 'a uniformed officer with cropped hair and a straight sabre',
  'Doberman': 'a scarred officer with a jutting jaw and a heavy fur-collared coat',
  'Ideo': 'a compact fighter with piston-driven forearms and a wide mohawk',
  'Belo Betty': 'a woman in a plumed hat with a flag furled at her shoulder, one arm thrown up in a rallying shout',
  'Curiel': 'a tattooed gunner with a shaved head and a long rifle',
  'Kingdew': 'a hugely muscled sailor with an anchor tattoo, bracing a mast',
  'Thatch': 'a cheerful pompadoured cook with twin blades and a kerchief',
  'Doma': 'a scarred duellist in a long coat with a slender rapier',
  'LittleOars Jr.': 'a mountain-sized giant in a striped tunic, an anchor used as a club',
  'Komachiyo': 'an enormous shaggy dog-lion the size of a cart, tongue out, harness jingling',
  'Apis': 'a small girl with wild hair in a fisherman’s smock, a tiny dragon curled on her shoulder',
  'Kaya': 'a pale gentle girl in a long dress on a clifftop lawn, hands folded',
  'Merry': 'a stiff elderly butler in a pressed coat, a tray held perfectly level',
  'Luffy & Ace': 'two young brothers back to back, one in a straw hat and vest, one in an orange wide-brimmed hat, fire and wind between them'
};

// A clause derived from the card's own data, for anything not named above.
const ROLE = {
  LEADER: 'a commanding pirate-world captain',
  CHARACTER: 'a pirate-world fighter',
  EVENT: 'a surge of motion across open water',
  STAGE: 'a place on the sea'
};
const ELEMENT = {
  Slash: 'a drawn blade catching the light',
  Strike: 'fists set and braced',
  Ranged: 'a weapon levelled at distance',
  Special: 'strange power curling off the figure',
  Wisdom: 'a calm, reading expression'
};
export function derivedClause(card) {
  var role = ROLE[card.category] || ROLE.CHARACTER;
  var el = ELEMENT[card.attribute[0]] || 'a steady stance';
  var crew = card.types[0] ? ' of the ' + card.types[0] : '';
  if (card.category === 'EVENT' || card.category === 'STAGE') {
    return role + crew.replace(' of the ', ' near the ');
  }
  return role + crew + ', ' + el;
}
