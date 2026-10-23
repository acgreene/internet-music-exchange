import type { Random } from './random';

const FIRST_NAMES = [
  'Ada',
  'Alex',
  'Amara',
  'Ana',
  'Ari',
  'Bea',
  'Ben',
  'Billie',
  'Cam',
  'Cass',
  'Chen',
  'Dani',
  'Dev',
  'Eli',
  'Ellis',
  'Emi',
  'Esme',
  'Finn',
  'Gabe',
  'Gia',
  'Hana',
  'Harper',
  'Iris',
  'Isa',
  'Jae',
  'Jules',
  'June',
  'Kai',
  'Kenji',
  'Kit',
  'Lane',
  'Lena',
  'Leo',
  'Lior',
  'Luca',
  'Mae',
  'Mara',
  'Max',
  'Mika',
  'Milo',
  'Nadia',
  'Nico',
  'Noor',
  'Oak',
  'Omar',
  'Pia',
  'Quinn',
  'Rae',
  'Ravi',
  'Remy',
  'Rio',
  'Rosa',
  'Sage',
  'Sam',
  'Sol',
  'Suki',
  'Tess',
  'Theo',
  'Uma',
  'Vera',
  'Wren',
  'Xavi',
  'Yara',
  'Yuki',
  'Zane',
  'Zoe',
  'Ines',
  'Malik',
  'Priya',
  'Tomas',
  'Aiko',
  'Bruno',
  'Celia',
  'Dmitri',
  'Elif',
  'Femi',
  'Greta',
  'Hugo',
  'Ingrid',
  'Jonah',
];

const LAST_NAMES = [
  'Abe',
  'Alvarez',
  'Bauer',
  'Bell',
  'Brooks',
  'Castro',
  'Chen',
  'Cole',
  'Costa',
  'Dahl',
  'Diaz',
  'Ellis',
  'Evans',
  'Fox',
  'Garcia',
  'Grey',
  'Hale',
  'Hart',
  'Ito',
  'Jensen',
  'Kahn',
  'Kim',
  'Lane',
  'Larsen',
  'Lee',
  'Lopez',
  'Marsh',
  'Mendes',
  'Moss',
  'Nakamura',
  'Novak',
  'Okafor',
  'Park',
  'Patel',
  'Pike',
  'Quinn',
  'Reyes',
  'Rossi',
  'Sato',
  'Shah',
  'Silva',
  'Stone',
  'Tanaka',
  'Torres',
  'Vance',
  'Vega',
  'Wade',
  'Walsh',
  'West',
  'Young',
];

const ADJECTIVES = [
  'Amber',
  'Analog',
  'Ashen',
  'Blue',
  'Borrowed',
  'Bright',
  'Broken',
  'Burning',
  'Coastal',
  'Cold',
  'Copper',
  'Crimson',
  'Crystal',
  'Dawn',
  'Distant',
  'Drifting',
  'Dusty',
  'Electric',
  'Empty',
  'Faded',
  'Floating',
  'Foggy',
  'Gentle',
  'Ghost',
  'Glass',
  'Golden',
  'Hollow',
  'Honest',
  'Hungry',
  'Indigo',
  'Last',
  'Late',
  'Little',
  'Lost',
  'Low',
  'Lunar',
  'Midnight',
  'Mint',
  'Neon',
  'Northern',
  'Pale',
  'Paper',
  'Quiet',
  'Rare',
  'Restless',
  'Rusty',
  'Secret',
  'Silver',
  'Slow',
  'Soft',
  'Static',
  'Strange',
  'Sunday',
  'Tender',
  'Tiny',
  'Velvet',
  'Violet',
  'Wandering',
  'Wild',
  'Young',
];

const NOUNS = [
  'Antenna',
  'Arcade',
  'Atlas',
  'Avenue',
  'Balcony',
  'Bloom',
  'Cassette',
  'Cathedral',
  'Coast',
  'Comet',
  'Current',
  'Daylight',
  'Delta',
  'Diner',
  'Echo',
  'Engine',
  'Ferry',
  'Field',
  'Fountain',
  'Garden',
  'Harbor',
  'Highway',
  'Horizon',
  'Island',
  'Kite',
  'Lantern',
  'Lighthouse',
  'Machine',
  'Meadow',
  'Mirror',
  'Motel',
  'Ocean',
  'Orchard',
  'Parade',
  'Planet',
  'Pool',
  'Radio',
  'Ribbon',
  'River',
  'Satellite',
  'Signal',
  'Skyline',
  'Static',
  'Station',
  'Summer',
  'Telephone',
  'Tide',
  'Tower',
  'Valley',
  'Window',
];

const PLURALS = [
  'Accidents',
  'Animals',
  'Birds',
  'Bridges',
  'Captains',
  'Cousins',
  'Dreamers',
  'Engines',
  'Friends',
  'Ghosts',
  'Hands',
  'Hearts',
  'Kids',
  'Lights',
  'Lovers',
  'Machines',
  'Moths',
  'Neighbors',
  'Owls',
  'Pilots',
  'Poets',
  'Radios',
  'Rivals',
  'Saints',
  'Satellites',
  'Sisters',
  'Strangers',
  'Tigers',
  'Wolves',
  'Years',
];

/**
 * The sounds demo artists make. Each artist belongs to one scene, which picks
 * their releases' genres (ids from IME's list) and tags, and names their bio.
 */
export const SCENES = [
  {
    label: 'shoegaze',
    genres: ['shoegaze', 'dream-pop', 'noise', 'indie-rock'],
    tags: ['wall of sound', 'reverb', 'hazy', 'loud', 'fuzz'],
  },
  {
    label: 'post-punk',
    genres: ['post-punk', 'punk', 'garage-rock', 'indie-rock'],
    tags: ['angular', 'wiry', 'basement', 'live to tape', 'nervous'],
  },
  {
    label: 'ambient',
    genres: ['ambient', 'drone', 'new-age', 'experimental'],
    tags: [
      'slow',
      'field recordings',
      'tape loops',
      'meditative',
      'late night',
    ],
  },
  {
    label: 'indie folk',
    genres: ['folk', 'singer-songwriter', 'acoustic', 'americana'],
    tags: [
      'fingerpicked',
      'kitchen recording',
      'winter',
      'quiet',
      'storytelling',
    ],
  },
  {
    label: 'lo-fi house',
    genres: ['house', 'dance', 'electronic', 'disco'],
    tags: ['four on the floor', 'sunrise', 'groovy', 'warehouse', 'lo-fi'],
  },
  {
    label: 'techno',
    genres: ['techno', 'industrial', 'electronic'],
    tags: ['hypnotic', 'dark', 'modular', 'driving', 'warehouse'],
  },
  {
    label: 'jazz trio',
    genres: ['jazz', 'soul', 'funk'],
    tags: ['trio', 'improvised', 'live', 'smoky', 'upright bass'],
  },
  {
    label: 'synthwave',
    genres: ['synthwave', 'synth-pop', 'electronic'],
    tags: ['neon', 'retro', 'night drive', 'analog synths'],
  },
  {
    label: 'beat tape',
    genres: ['hip-hop', 'lo-fi', 'r-and-b', 'trip-hop'],
    tags: ['boom bap', 'samples', 'beat tape', 'chill', 'late night'],
  },
  {
    label: 'math rock',
    genres: ['math-rock', 'post-rock', 'emo'],
    tags: ['odd time', 'twinkly', 'instrumental', 'tapping'],
  },
  {
    label: 'bedroom pop',
    genres: ['indie-pop', 'pop', 'synth-pop'],
    tags: ['bedroom pop', 'catchy', 'summer', 'heartbreak'],
  },
  {
    label: 'doom',
    genres: ['metal', 'hardcore', 'noise'],
    tags: ['heavy', 'doom', 'sludge', 'loud'],
  },
  {
    label: 'glitch',
    genres: ['experimental', 'electronic', 'chiptune', 'ambient'],
    tags: ['glitch', 'modular', '8-bit', 'strange'],
  },
  {
    label: 'dub',
    genres: ['dub', 'reggae', 'ska'],
    tags: ['bass heavy', 'echo', 'sound system'],
  },
  {
    label: 'modern classical',
    genres: ['classical', 'soundtrack', 'ambient'],
    tags: ['piano', 'strings', 'cinematic', 'minimal'],
  },
] as const;

export type Scene = (typeof SCENES)[number];

const CITIES = [
  ['Portland', 'OR', 'US'],
  ['Austin', 'TX', 'US'],
  ['Chicago', 'IL', 'US'],
  ['Brooklyn', 'NY', 'US'],
  ['Oakland', 'CA', 'US'],
  ['Asheville', 'NC', 'US'],
  ['Minneapolis', 'MN', 'US'],
  ['Denver', 'CO', 'US'],
  ['Philadelphia', 'PA', 'US'],
  ['Nashville', 'TN', 'US'],
  ['Seattle', 'WA', 'US'],
  ['Detroit', 'MI', 'US'],
  ['Montreal', 'QC', 'CA'],
  ['Toronto', 'ON', 'CA'],
  ['Glasgow', null, 'GB'],
  ['Manchester', null, 'GB'],
  ['Berlin', null, 'DE'],
  ['Lyon', null, 'FR'],
  ['Melbourne', 'VIC', 'AU'],
  ['Osaka', null, 'JP'],
  ['Lisbon', null, 'PT'],
  ['Amsterdam', null, 'NL'],
  ['Mexico City', null, 'MX'],
  ['Reykjavik', null, 'IS'],
] as const;

const STREETS = [
  'Alder St',
  'Birch Ave',
  'Cedar Ln',
  'Division St',
  'Elm St',
  'Grand Ave',
  'Harbor Rd',
  'Lake St',
  'Main St',
  'Maple Ave',
  'Market St',
  'Oak St',
  'Park Ave',
  'Pine St',
  'River Rd',
  'Union St',
];

const TRACK_WORDS = [
  'Afterglow',
  'All Night',
  'Apartment',
  'Backroads',
  'Blue Hour',
  'Bonfire',
  'Ceiling Fan',
  'Closing Time',
  'Coffee',
  'Crosswalk',
  'Daydream',
  'Dial Tone',
  'Driveway',
  'Elevator',
  'Firefly',
  'Friday',
  'Glow',
  'Half Awake',
  'Headlights',
  'Heatwave',
  'Holding On',
  'Homesick',
  'Hourglass',
  'Interlude',
  'June',
  'Keepsake',
  'Landline',
  'Laundromat',
  'Letters',
  'Lullaby',
  'Monday',
  'Morning Tape',
  'Moving Day',
  'Night Bus',
  'Nowhere',
  'Overpass',
  'Paper Planes',
  'Parking Lot',
  'Polaroid',
  'Postcard',
  'Rearview',
  'Reel to Reel',
  'Rooftop',
  'Runaway',
  'Salt',
  'Slow Dance',
  'Snowglobe',
  'Static',
  'Sunburn',
  'Swim',
  'Tangerine',
  'Thunder',
  'Tuesday',
  'Undertow',
  'Vending Machine',
  'Waiting Room',
  'Weekend',
  'Window Seat',
];

const BIO_OPENERS = [
  'Making {genre} out of a converted garage in {city}.',
  '{genre} from {city}, recorded mostly at night.',
  'A {genre} project that started as a dare and kept going.',
  'Songs about small towns and long drives. {genre}, mostly.',
  'Four friends from {city} who never learned to play quietly.',
  'One person, a four-track, and too many pedals. {genre} from {city}.',
  'We make {genre} for kitchens, cars, and the walk home.',
];

const BIO_CLOSERS = [
  'Everything here is self-released.',
  'Thanks for listening, really.',
  'New record in the works.',
  'Touring the northeast this spring.',
  'Vinyl ships from our living room.',
  '',
];

const CRATE_NAMES = [
  'Late night drives',
  'Records that got me through winter',
  'Sunday morning',
  'Headphones only',
  'For the kitchen',
  'Rainy day records',
  'Tapes I keep coming back to',
  'Songs for a long walk',
  'The quiet ones',
  'First listens I loved',
  'Play these loud',
  'Summer, mostly',
];

const CRATE_TIMES = [
  'the train',
  'late nights',
  'rainy days',
  'a long drive',
  'cooking',
  'mornings',
];

const CRATE_NOTES = [
  'Everything here sounds better after midnight.',
  'Records I found on IME and could not stop playing.',
  'A box I keep adding to. Start at the top.',
  'For anyone who asks me what to listen to.',
  'Small labels, big records.',
];

const CRATE_LINES = [
  'The second side is perfect.',
  'Found this on a rainy Tuesday.',
  'Play it loud.',
  'The closing track still gets me.',
  'Best bassline on IME.',
  'Start with track three.',
  'Sounds like the drive home.',
  'Bought it twice, gave one away.',
];

const COMMENTS = [
  'This one has been on repeat all week.',
  'The second track is unreal.',
  'Saw you live last spring and this captures it perfectly.',
  'Bought the vinyl, sounds even better.',
  'Production on this is so warm.',
  'Instant favorite. Thank you for putting this out.',
  'That bridge on track three!',
  'Perfect late night record.',
  'Been waiting for this since the demo.',
  'The drums on this are incredible.',
  'Needed this today.',
  'Every song is a highlight.',
  'This deserves way more listens.',
  'Cried at the last track, in a good way.',
  'Shared this with everyone I know.',
  'Can we get the lyrics somewhere?',
  'The cover art is perfect for this.',
  'How is this free? Paid anyway.',
  'Sounds like summer in a basement. Love it.',
  'This is going on every road trip playlist.',
];

const REPORT_NOTES = [
  'This looks like a rip of an album I own.',
  "The cover uses a photographer's work without credit.",
  'Comment is harassing the artist.',
  'Spam links in the description.',
  "Uploaded someone else's music under a new name.",
  null,
  null,
];

/** Paragraphs for a release's notes, written the way artists write them. */
const LINER_NOTES = [
  'We made this record over one long winter, with the heat broken and the tape machine running every night. Most of it is first takes.',
  'These songs started as voice memos on the walk home from work. It took two years and three apartments to finish them.',
  'Everything here was tracked live in one room, facing each other, with the windows open. You can hear the street on the quiet parts.',
  'This is the record we wanted to make the first time. Fewer songs, more room, and nothing we would skip.',
  'Half of it was written on tour, in vans and green rooms and one very long ferry ride. The other half was written after, about coming home.',
  'We kept every mistake that sounded like the truth. The click track got turned off on the second day and never came back.',
  'Thank you to everyone who came to the shows while these songs were still figuring themselves out. You heard them first.',
  'Mixed slowly, mostly at night, by people who should have been asleep. Play it start to finish if you can.',
];

/** Lines that read like song lyrics, a few to a verse. */
const LYRIC_LINES = [
  'turned the radio low so the static could sing',
  'every station a coastline, every coastline a ring',
  "we were weathervanes spinning in somebody's yard",
  'pointing home for a minute, then pointing too far',
  'I left the porch light on in case you changed your mind',
  'the city hums a song it never learned the words to',
  'count the bridges back to where we started',
  'your coat still on the hook by the door',
  'all the windows down and nowhere to be',
  'we said forever like it was a place',
  'the last train hums the same note every night',
  'I kept your letters in a shoebox under the stairs',
  'summer came in sideways through the screen door',
  'hold the light a little longer',
  'nobody tells you how quiet it gets',
  'we were young enough to think the tide would wait',
  'I sang it to the dashboard till the dawn came up',
  'there is a song in the floorboards of this house',
];

/** What a band might call the photos they put with a record. */
const PHOTO_TITLES = [
  'The rehearsal room',
  'Load-in, first night of the tour',
  'Where most of it was recorded',
  'The tape machine',
  'Last show of the winter',
  'Out back of the studio',
  'Soundcheck',
  'The van, somewhere in the middle',
];

const ROLES = [
  'voice, guitar',
  'bass, organ',
  'drums, tape loops',
  'keys, backing vocals',
  'guitar, pedal steel',
  'synths, drum machine',
];

const STUDIOS = [
  'Low Ceiling',
  'The Annex',
  'Dovetail Sound',
  'Room 9',
  'Basement East',
  'Kettle House',
];

export const words = {
  personName: (random: Random) =>
    `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,

  artistName(random: Random): string {
    return random.weighted<() => string>([
      [() => `${random.pick(ADJECTIVES)} ${random.pick(NOUNS)}`, 4],
      [() => `The ${random.pick(ADJECTIVES)} ${random.pick(PLURALS)}`, 3],
      [() => `${random.pick(NOUNS)} ${random.pick(PLURALS)}`, 2],
      [() => words.personName(random), 3],
      [() => `${random.pick(FIRST_NAMES)} & the ${random.pick(PLURALS)}`, 1],
      [() => `${random.pick(NOUNS)}`.toUpperCase(), 1],
    ])();
  },

  releaseTitle(random: Random): string {
    return random.weighted<() => string>([
      [() => `${random.pick(ADJECTIVES)} ${random.pick(NOUNS)}`, 4],
      [() => random.pick(TRACK_WORDS), 3],
      [() => `${random.pick(NOUNS)}s`, 1],
      [() => `Songs for ${random.pick(PLURALS)}`, 1],
      [() => `${random.pick(TRACK_WORDS)} (Live)`, 1],
      [() => `${random.pick(['I', 'II', 'III', 'IV'])}`, 1],
    ])();
  },

  trackTitle(random: Random): string {
    return random.weighted<() => string>([
      [() => random.pick(TRACK_WORDS), 5],
      [() => `${random.pick(ADJECTIVES)} ${random.pick(NOUNS)}`, 3],
      [() => `${random.pick(TRACK_WORDS)} (Reprise)`, 1],
      [() => `For ${random.pick(FIRST_NAMES)}`, 1],
    ])();
  },

  bio(random: Random, scene: Scene): string {
    const city = random.pick(CITIES)[0];
    const opener = random
      .pick(BIO_OPENERS)
      .replace('{genre}', scene.label)
      .replace('{city}', city);
    const sentence = opener.charAt(0).toUpperCase() + opener.slice(1);
    return `${sentence} ${random.pick(BIO_CLOSERS)}`.trim();
  },

  /** Where an artist is based: usually a city, sometimes only a country. */
  place(random: Random): { city: string | null; country: string } {
    const [city, , country] = random.pick(CITIES);
    return { city: random.chance(0.85) ? city : null, country };
  },

  crateName(random: Random, scene: Scene): string {
    const label = scene.label.charAt(0).toUpperCase() + scene.label.slice(1);
    return random.weighted<() => string>([
      [() => random.pick(CRATE_NAMES), 4],
      [() => `${label} for ${random.pick(CRATE_TIMES)}`, 3],
      [() => `${random.pick(CITIES)[0]} ${scene.label}`, 1],
      [() => `Best ${scene.label} on IME`, 1],
    ])();
  },

  crateNote: (random: Random) => random.pick(CRATE_NOTES),
  crateLine: (random: Random) => random.pick(CRATE_LINES),

  comment: (random: Random) => random.pick(COMMENTS),

  /** A release's notes: one or two paragraphs. */
  linerNotes: (random: Random) =>
    random.sample(LINER_NOTES, random.int(1, 2)).join('\n\n'),

  /** A song's words: two verses of four lines. */
  lyrics: (random: Random) =>
    [random.sample(LYRIC_LINES, 4), random.sample(LYRIC_LINES, 4)]
      .map((verse) => verse.join('\n'))
      .join('\n\n'),

  photoTitle: (random: Random) => random.pick(PHOTO_TITLES),

  /** Who played what, where it was made, and who made the art. */
  credits(random: Random, artistName: string): string {
    const players = random
      .sample(ROLES, random.int(2, 4))
      .map((role) => `${words.personName(random)}: ${role}`);
    const studio = random.pick(STUDIOS);
    return [
      `Written and performed by ${artistName}`,
      ...players,
      `Recorded and mixed by ${words.personName(random)} at ${studio}`,
      `Artwork by ${words.personName(random)}`,
    ].join('\n');
  },
  reportNote: (random: Random) => random.pick(REPORT_NOTES),

  address(random: Random, name: string) {
    const [city, state, country] = random.pick(CITIES);
    return {
      name,
      line1: `${random.int(10, 9999)} ${random.pick(STREETS)}`,
      line2: random.chance(0.2) ? `Apt ${random.int(1, 40)}` : null,
      city,
      state,
      postalCode:
        country === 'US'
          ? String(random.int(10000, 99999))
          : `${random.int(1000, 9999)}`,
      country,
    };
  },
};

/** A handle or username from a name: lowercase, dashes, 3 to 30 characters. */
export function slugify(text: string, maxLength = 30): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  // too short for a handle or slug, as for a title like "IV"
  return slug.length >= 3 ? slug : slug ? `${slug}-mix` : 'mix';
}
